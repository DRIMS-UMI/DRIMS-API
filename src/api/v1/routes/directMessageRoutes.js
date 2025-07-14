import express from 'express';
import { listConversations, getMessages, sendMessage, startConversation } from '../controllers/directMessageController.js';
import authenticateToken from '../middleware/authentication.js';
const router = express.Router();

// List all conversations for the current user
router.get('/conversations', authenticateToken, listConversations);

// Get all messages in a conversation
router.get('/:conversationId', authenticateToken, getMessages);

// Start a new conversation (or return existing)
router.post('/conversations', authenticateToken, startConversation);

// Send a message in a conversation
router.post('/:conversationId', authenticateToken, sendMessage);

export default router; 