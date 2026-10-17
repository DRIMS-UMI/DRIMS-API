import express from 'express';
import rateLimit from 'express-rate-limit';
import emailController from '../controllers/emailController.js';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { flagSecurityEvent } from '../../../utils/securityEvents.js';

const router = express.Router();

// Each send goes out from UMI's mail account, so cap it per signed-in user.
const sendResultsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.id}`,
    handler: (req, res) => {
        flagSecurityEvent(req, 'RATE_LIMITED');
        res.status(429).json({ success: false, message: 'Too many results emails sent. Please try again later.' });
    },
});

// Send results email with Excel attachment
router.post(
    '/send-results',
    authenticateToken,
    authorizeRoles('SCHOOL_ADMIN', 'SUPERADMIN', 'RESEARCH_ADMIN'),
    sendResultsLimiter,
    emailController.sendResultsEmail
);

export default router;
