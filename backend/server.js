const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const { handleStripeWebhook } = require('./routes/orders');
const { expirePendingOrders } = require('./routes/orders');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? 'ok' : 'unavailable',
        database: databaseConnected ? 'connected' : 'disconnected'
    });
});

app.get('/api/config', (req, res) => {
    res.json({
        currency: process.env.STORE_CURRENCY || 'INR',
        payments: {
            cod: true,
            stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.FRONTEND_URL),
            razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
        },
        storeName: process.env.STORE_NAME || 'Everyday Market'
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.use((req, res) => {
    res.status(404).json({ message: 'The requested API route was not found.' });
});

app.use((error, req, res, next) => {
    console.error('API request failed:', error.message);
    if (res.headersSent) {
        return next(error);
    }
    const status = Number.isInteger(error.status) ? error.status : error.name === 'ValidationError' ? 400 : 500;
    res.status(status).json({ message: status === 500 ? 'An unexpected server error occurred.' : error.message });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            expirePendingOrders().catch((error) => console.error('Could not expire pending orders:', error.message));
            setInterval(() => {
                expirePendingOrders().catch((error) => console.error('Could not expire pending orders:', error.message));
            }, 60 * 1000);
        });
    } catch (error) {
        console.error('API startup failed:', error.message);
        process.exitCode = 1;
    }
};

startServer();