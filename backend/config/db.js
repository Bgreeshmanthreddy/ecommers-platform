const mongoose = require('mongoose');

const connectDB = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is not set. Configure the MongoDB connection before starting the API.');
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        throw err;
    }
};

module.exports = connectDB;