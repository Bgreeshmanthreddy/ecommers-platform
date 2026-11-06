const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const syncProductRating = async (productId) => {
    const [stats] = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    await Product.findByIdAndUpdate(productId, {
        rating: stats ? Math.round(stats.avg * 10) / 10 : 0,
        reviewCount: stats ? stats.count : 0
    });
};

const parseProduct = (body) => {
    const { name, description, price, image, category, stock, sku, active, featured } = body;
    const numericPrice = Number(price);
    const numericStock = Number(stock);

    if (typeof name !== 'string' || !name.trim() ||
        !Number.isFinite(numericPrice) || numericPrice < 0 ||
        !Number.isInteger(numericStock) || numericStock < 0 ||
        typeof category !== 'string' || !category.trim()) {
        return null;
    }

    return {
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() : '',
        price: numericPrice,
        image: typeof image === 'string' ? image.trim() : '',
        category: category.trim(),
        stock: numericStock,
        sku: typeof sku === 'string' ? sku.trim() : '',
        active: active !== false,
        featured: featured === true
    };
};

router.get('/', async (req, res, next) => {
    try {
        const filter = { active: true };
        if (typeof req.query.category === 'string' && req.query.category.trim()) {
            filter.category = req.query.category.trim();
        }
        if (typeof req.query.search === 'string' && req.query.search.trim()) {
            const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { name: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
                { category: { $regex: escaped, $options: 'i' } },
                { tags: { $regex: escaped, $options: 'i' } }
            ];
        }

        const products = await Product.find(filter).sort({ featured: -1, createdAt: -1 }).limit(100);
        res.json(products);
    } catch (error) {
        next(error);
    }
});

router.get('/categories', async (req, res, next) => {
    try {
        const categories = await Product.distinct('category', { active: true });
        res.json(categories.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const product = await Product.findOne({ _id: req.params.id, active: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json(product);
    } catch (error) {
        next(error);
    }
});

router.get('/:id/reviews', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const reviews = await Review.find({ product: req.params.id })
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(reviews);
    } catch (error) {
        next(error);
    }
});

router.post('/:id/reviews', authenticate, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const rating = Number(req.body.rating);
        const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 1000) : '';
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rate from 1 to 5 stars.' });
        }
        const product = await Product.findOne({ _id: req.params.id, active: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const review = await Review.findOneAndUpdate(
            { product: req.params.id, user: req.user._id },
            { rating, comment },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        await syncProductRating(req.params.id);
        res.status(201).json(await Review.populate(review, { path: 'user', select: 'name' }));
    } catch (error) {
        next(error);
    }
});

router.delete('/:id/reviews', authenticate, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const deleted = await Review.deleteOne({ product: req.params.id, user: req.user._id });
        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'You have not reviewed this product.' });
        }
        await syncProductRating(req.params.id);
        res.json({ message: 'Review removed.' });
    } catch (error) {
        next(error);
    }
});

router.get('/admin/all', authenticate, requireAdmin, async (req, res, next) => {
    try {
        res.json(await Product.find().sort({ createdAt: -1 }));
    } catch (error) {
        next(error);
    }
});

router.post('/', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const product = parseProduct(req.body);
        if (!product) {
            return res.status(400).json({ message: 'Provide a product name, category, non-negative price, and whole-number stock.' });
        }
        res.status(201).json(await Product.create(product));
    } catch (error) {
        next(error);
    }
});

router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const product = parseProduct(req.body);
        if (!product) {
            return res.status(400).json({ message: 'Provide a product name, category, non-negative price, and whole-number stock.' });
        }
        const updated = await Product.findByIdAndUpdate(req.params.id, product, { new: true, runValidators: true });
        if (!updated) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }
        const deleted = await Product.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ message: 'Product not found.' });
        }
        res.json({ message: 'Product deleted.' });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
