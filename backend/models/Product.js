const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 160 },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', maxlength: 5000 },
    image: { type: String, default: '' },
    category: { type: String, required: true, trim: true, default: 'General' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);