const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
