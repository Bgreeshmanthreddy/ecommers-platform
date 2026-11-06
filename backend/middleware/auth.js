const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getSecret = () => {
    if (!process.env.JWT_SECRET) {
        const error = new Error('JWT_SECRET is not configured on the server.');
        error.status = 503;
        throw error;
    }

    return process.env.JWT_SECRET;
};

const authenticate = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization || '';
        const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!token) {
            return res.status(401).json({ message: 'Please sign in to continue.' });
        }

        const payload = jwt.verify(token, getSecret());
        const user = await User.findById(payload.sub).select('_id name email role');
        if (!user) {
            return res.status(401).json({ message: 'Your account could not be found.' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
        }
        next(error);
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Administrator access is required.' });
    }
    next();
};

module.exports = { authenticate, requireAdmin, getSecret };
