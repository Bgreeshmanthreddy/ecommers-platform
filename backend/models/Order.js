const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    shippingAddress: {
        fullName: { type: String, required: true, trim: true },
        phone: { type: String, required: true, trim: true },
        address: { type: String, required: true, trim: true },
        city: { type: String, required: true, trim: true },
        state: { type: String, required: true, trim: true },
        postalCode: { type: String, required: true, trim: true },
        country: { type: String, required: true, trim: true, default: 'India' }
    },
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, default: 'inr' },
    paymentMethod: { type: String, enum: ['cod', 'stripe', 'razorpay'], required: true },
    paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed'], default: 'unpaid' },
    status: { type: String, enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    stripeSessionId: { type: String, default: '' },
    razorpayOrderId: { type: String, default: '' },
    paymentExpiresAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
