import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
import { flagSecurityEvent } from '../../../utils/securityEvents.js';
import { findTicketForAccessCheck, canAccessTicket, TICKET_ADMIN_ROLES } from '../../../utils/ticketAccess.js';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addMessageToTicket,
  getStudentTickets,
  getSupervisorTickets
} from '../controllers/ticketController.js';

import fs from 'fs';
import path from 'path';

// Rate Limiter to prevent bot spam (e.g., max 5 tickets per IP per hour)
const createTicketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: "Too many tickets created from this IP, please try again after an hour" }
});

// Configure multer for image uploads (attachments in chat)
const uploadDir = 'public/uploads/tickets';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only accept common image types for screenshots/attachments
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File size too large. Maximum size is 5MB' });
    }
    return res.status(400).json({ message: error.message });
  }
  if (error) {
    return res.status(400).json({ message: error.message });
  }
  next();
};

// Middleware to optionally authenticate (allows guest users)
const optionalAuth = (req, res, next) => {
  if (req.headers.authorization) {
    return authenticateToken(req, res, next);
  }
  next();
};

// Chat replies (guests included): generous for a conversation, tight enough to stop upload spam.
const ticketMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  handler: (req, res) => {
    flagSecurityEvent(req, 'RATE_LIMITED');
    res.status(429).json({ message: 'Too many messages. Please wait a few minutes and try again.' });
  },
});

// Runs before the upload so rejected requests never write a file to disk.
const requireTicketAccess = async (req, res, next) => {
  try {
    const ticket = await findTicketForAccessCheck(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    if (!canAccessTicket(ticket, req.user, req.headers['x-ticket-token'])) {
      flagSecurityEvent(req, 'RBAC_DENIED');
      return res.status(403).json({ message: 'You do not have access to this ticket' });
    }
    const isAdmin = req.user && TICKET_ADMIN_ROLES.includes(req.user.role);
    if (ticket.status === 'CLOSED' && !isAdmin) {
      return res.status(409).json({ message: 'This ticket is closed. Please start a new chat.' });
    }
    req.ticket = ticket;
    next();
  } catch (error) {
    next(error);
  }
};

const router = express.Router();

// Public / Guest / Student endpoints
router.post('/', createTicketLimiter, optionalAuth, upload.single('attachment'), handleMulterError, createTicket);

// Student endpoints
router.get('/student/me', authenticateToken, authorizeRoles('STUDENT'), getStudentTickets);

// Supervisor endpoints
router.get('/supervisor/me', authenticateToken, authorizeRoles('SUPERVISOR'), getSupervisorTickets);

// Management endpoints
// Only SUPERADMIN and MANAGER roles can manage tickets
router.get('/', authenticateToken, authorizeRoles('SUPERADMIN', 'MANAGER'), getTickets);
router.get('/:id', authenticateToken, authorizeRoles('SUPERADMIN', 'MANAGER'), getTicketById);
router.put('/:id/status', authenticateToken, authorizeRoles('SUPERADMIN', 'MANAGER'), updateTicketStatus);
router.put('/:id/assign', authenticateToken, authorizeRoles('SUPERADMIN', 'MANAGER'), assignTicket);

// Add message endpoint: ticket admins, the ticket's creator, or a guest holding the ticket's access key
router.post('/:id/messages', optionalAuth, ticketMessageLimiter, requireTicketAccess, upload.single('attachment'), handleMulterError, addMessageToTicket);

export default router;
