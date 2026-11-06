const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Stripe = require('stripe');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        const error = new Error('Stripe payments are not configured.');
        error.status = 503;
        throw error;
    }
    return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const getRazorpay = () => {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        const error = new Error('Razorpay payments are not configured.');
        error.status = 503;
        throw error;
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
};

const restoreInventory = async (items) => {
    await Promise.all(items.map((item) => Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity } }
    )));
};

const isValidAddress = (address) => address &&
    ['fullName', 'phone', 'address', 'city', 'state', 'postalCode', 'country']
        .every((field) => typeof address[field] === 'string' && address[field].trim());

const findAccessibleOrder = async (id, user) => {
    if (!mongoose.isValidObjectId(id)) {
        return null;
    }
    const filter = { _id: id };
    if (user.role !== 'admin') {
        filter.user = user._id;
    }
    return Order.findOne(filter);
};

const expirePendingOrders = async () => {
    const now = new Date();
    const expiredOrders = await Order.find({
        status: 'pending',
        paymentStatus: 'pending',
        paymentExpiresAt: { $lte: now }
    }).select('_id').lean();

    for (const expired of expiredOrders) {
        const cancelled = await Order.findOneAndUpdate(
            { _id: expired._id, status: 'pending', paymentStatus: 'pending', paymentExpiresAt: { $lte: now } },
            { status: 'cancelled', paymentStatus: 'failed' },
            { new: false }
        );
        if (cancelled) {
            await restoreInventory(cancelled.items);
        }
    }
};

router.post('/', authenticate, async (req, res, next) => {
    let reservedItems = [];
    let order;
    try {
        const { items, shippingAddress, paymentMethod } = req.body;
        if (!Array.isArray(items) || items.length === 0 || items.length > 50 || !isValidAddress(shippingAddress)) {
            return res.status(400).json({ message: 'Provide at least one item and a complete shipping address.' });
        }
        if (!['cod', 'stripe', 'razorpay'].includes(paymentMethod)) {
            return res.status(400).json({ message: 'Select a supported payment method.' });
        }
        if (paymentMethod === 'stripe' && (!process.env.STRIPE_SECRET_KEY || !process.env.FRONTEND_URL)) {
            return res.status(503).json({ message: 'Stripe payments are not configured on this store.' });
        }
        if (paymentMethod === 'razorpay' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
            return res.status(503).json({ message: 'Razorpay payments are not configured on this store.' });
        }

        const quantities = new Map();
        for (const item of items) {
            if (!item || !mongoose.isValidObjectId(item.productId) ||
                !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
                return res.status(400).json({ message: 'Each cart item needs a valid product and quantity.' });
            }
            const id = item.productId.toString();
            quantities.set(id, (quantities.get(id) || 0) + item.quantity);
        }

        const products = await Product.find({
            _id: { $in: Array.from(quantities.keys()) },
            active: true
        });
        if (products.length !== quantities.size) {
            return res.status(400).json({ message: 'One or more products are no longer available.' });
        }

        const orderItems = products.map((product) => ({
            product: product._id,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity: quantities.get(product._id.toString())
        }));
        const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const currency = (process.env.STORE_CURRENCY || 'INR').toLowerCase();

        for (const item of orderItems) {
            const result = await Product.updateOne(
                { _id: item.product, active: true, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } }
            );
            if (result.modifiedCount !== 1) {
                await restoreInventory(reservedItems);
                reservedItems = [];
                return res.status(409).json({ message: 'A product in your cart has insufficient stock. Please refresh your cart.' });
            }
            reservedItems.push(item);
        }

        order = await Order.create({
            user: req.user._id,
            items: orderItems,
            shippingAddress: Object.fromEntries(
                Object.entries(shippingAddress).map(([key, value]) => [key, value.trim()])
            ),
            subtotal,
            shippingFee: 0,
            total: subtotal,
            currency,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'pending',
            paymentExpiresAt: paymentMethod === 'cod' ? null : new Date(Date.now() + 30 * 60 * 1000)
        });

        if (paymentMethod === 'stripe') {
            const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
            const session = await getStripe().checkout.sessions.create({
                mode: 'payment',
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
                client_reference_id: order._id.toString(),
                metadata: { orderId: order._id.toString() },
                line_items: orderItems.map((item) => ({
                    quantity: item.quantity,
                    price_data: {
                        currency,
                        unit_amount: Math.round(item.price * 100),
                        product_data: { name: item.name }
                    }
                })),
                success_url: `${frontendUrl}/?payment=success&orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${frontendUrl}/?payment=cancelled&orderId=${order._id}`
            });
            order.stripeSessionId = session.id;
            await order.save();
            return res.status(201).json({ order, checkout: { provider: 'stripe', url: session.url } });
        }

        if (paymentMethod === 'razorpay') {
            const razorpayOrder = await getRazorpay().orders.create({
                amount: Math.round(subtotal * 100),
                currency: currency.toUpperCase(),
                receipt: order._id.toString(),
                notes: { orderId: order._id.toString() }
            });
            order.razorpayOrderId = razorpayOrder.id;
            await order.save();
            return res.status(201).json({
                order,
                checkout: {
                    provider: 'razorpay',
                    keyId: process.env.RAZORPAY_KEY_ID,
                    orderId: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    name: process.env.STORE_NAME || 'Store',
                    description: `Order ${order._id}`
                }
            });
        }

        res.status(201).json({ order, checkout: { provider: 'cod' } });
    } catch (error) {
        if (reservedItems.length) {
            await restoreInventory(reservedItems);
        }
        if (order) {
            await Order.deleteOne({ _id: order._id });
        }
        next(error);
    }
});

router.get('/mine', authenticate, async (req, res, next) => {
    try {
        res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100));
    } catch (error) {
        next(error);
    }
});

router.get('/admin/all', authenticate, requireAdmin, async (req, res, next) => {
    try {
        res.json(await Order.find().populate('user', 'name email role createdAt').sort({ createdAt: -1 }).limit(500));
    } catch (error) {
        next(error);
    }
});

router.patch('/admin/:id/status', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!mongoose.isValidObjectId(req.params.id) || !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Provide a valid order and status.' });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        if (order.status === 'cancelled' && status !== 'cancelled') {
            return res.status(409).json({ message: 'Cancelled orders cannot be reopened.' });
        }
        if (status === 'cancelled' && order.status !== 'cancelled') {
            if (order.paymentStatus === 'paid') {
                return res.status(409).json({ message: 'Paid orders must be refunded before cancellation.' });
            }
            await restoreInventory(order.items);
        }
        order.status = status;
        if (status === 'delivered' && order.paymentMethod === 'cod') {
            order.paymentStatus = 'paid';
        }
        await order.save();
        res.json(order);
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify-stripe', authenticate, async (req, res, next) => {
    try {
        const order = await findAccessibleOrder(req.params.id, req.user);
        if (!order || order.paymentMethod !== 'stripe' || !order.stripeSessionId ||
            req.body.sessionId !== order.stripeSessionId) {
            return res.status(404).json({ message: 'Payment session not found.' });
        }
        if (order.paymentStatus === 'paid') {
            return res.json({ order });
        }

        const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
        if (session.payment_status !== 'paid' || session.metadata.orderId !== order._id.toString()) {
            return res.status(402).json({ message: 'Payment has not been confirmed.' });
        }
        const paidOrder = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending', paymentStatus: 'pending' },
            { paymentStatus: 'paid', status: 'processing' },
            { new: true }
        );
        if (!paidOrder) {
            return res.status(409).json({ message: 'This order is no longer awaiting payment.' });
        }
        res.json({ order: paidOrder });
    } catch (error) {
        next(error);
    }
});

router.post('/:id/verify-razorpay', authenticate, async (req, res, next) => {
    try {
        const order = await findAccessibleOrder(req.params.id, req.user);
        const { razorpay_order_id: paymentOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
        if (!order || order.paymentMethod !== 'razorpay' || order.razorpayOrderId !== paymentOrderId ||
            typeof paymentId !== 'string' || typeof signature !== 'string' || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(400).json({ message: 'Payment details are invalid.' });
        }
        if (order.paymentStatus === 'paid') {
            return res.json({ order });
        }

        const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${paymentOrderId}|${paymentId}`)
            .digest();
        const supplied = Buffer.from(signature, 'hex');
        if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
            return res.status(400).json({ message: 'Payment signature could not be verified.' });
        }

        const paidOrder = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending', paymentStatus: 'pending' },
            { paymentStatus: 'paid', status: 'processing' },
            { new: true }
        );
        if (!paidOrder) {
            return res.status(409).json({ message: 'This order is no longer awaiting payment.' });
        }
        res.json({ order: paidOrder });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const order = await findAccessibleOrder(req.params.id, req.user);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.json(order);
    } catch (error) {
        next(error);
    }
});

router.post('/:id/cancel', authenticate, async (req, res, next) => {
    try {
        const order = await findAccessibleOrder(req.params.id, req.user);
        if (!order) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        if (order.status !== 'pending' || order.paymentStatus === 'paid' || order.paymentMethod === 'cod') {
            return res.status(409).json({ message: 'Only unpaid pending online orders can be cancelled here.' });
        }
        if (order.paymentMethod === 'stripe') {
            const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
            if (session.payment_status === 'paid') {
                return res.status(409).json({ message: 'This order has already been paid.' });
            }
        }
        if (order.paymentMethod === 'razorpay') {
            const payments = await getRazorpay().orders.fetchPayments(order.razorpayOrderId);
            if (payments.items.some((payment) => payment.status === 'authorized' || payment.status === 'captured')) {
                return res.status(409).json({ message: 'This order has an authorized payment and cannot be cancelled here.' });
            }
        }
        const cancelled = await Order.findOneAndUpdate(
            { _id: order._id, status: 'pending', paymentStatus: 'pending' },
            { status: 'cancelled', paymentStatus: 'failed' },
            { new: true }
        );
        if (!cancelled) {
            return res.status(409).json({ message: 'This order is no longer awaiting payment.' });
        }
        await restoreInventory(cancelled.items);
        res.json({ order: cancelled });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
module.exports.expirePendingOrders = expirePendingOrders;

module.exports.handleStripeWebhook = async (req, res) => {
    try {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
            return res.status(503).json({ message: 'Stripe webhooks are not configured.' });
        }

        const event = getStripe().webhooks.constructEvent(
            req.body,
            req.headers['stripe-signature'],
            process.env.STRIPE_WEBHOOK_SECRET
        );
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            if (session.payment_status === 'paid' && session.metadata.orderId) {
                await Order.findOneAndUpdate(
                    { _id: session.metadata.orderId, stripeSessionId: session.id, status: 'pending', paymentStatus: 'pending' },
                    { paymentStatus: 'paid', status: 'processing' }
                );
            }
        }
        res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook verification failed:', error.message);
        res.status(400).json({ message: 'Stripe webhook signature is invalid.' });
    }
};
