const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate, getSecret } = require('../middleware/auth');

const router = express.Router();

const createToken = (user) => jwt.sign(
    { sub: user._id.toString() },
    getSecret(),
    { expiresIn: '7d' }
);

const serializeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
});

router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        if (typeof name !== 'string' || name.trim().length < 2 ||
            typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ message: 'Enter a name, valid email, and password with at least 8 characters.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        if (await User.exists({ email: normalizedEmail })) {
            return res.status(409).json({ message: 'An account with that email already exists.' });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await bcrypt.hash(password, 12)
        });

        res.status(201).json({ token: createToken(user), user: serializeUser(user) });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ message: 'An account with that email already exists.' });
        }
        next(error);
    }
});

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Enter your email and password.' });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Email or password is incorrect.' });
        }

        res.json({ token: createToken(user), user: serializeUser(user) });
    } catch (error) {
        next(error);
    }
});

router.get('/me', authenticate, (req, res) => {
    res.json({ user: serializeUser(req.user) });
});

module.exports = router;
