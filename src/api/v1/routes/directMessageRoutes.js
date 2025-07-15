import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import { 
  listConversations, 
  getMessages, 
  sendMessage, 
  startConversation, 
  markMessagesAsRead,
  getOnlineUsers,
  getUnreadMessageCount
} from '../controllers/directMessageController.js';

const router = express.Router();

// List all conversations for the authenticated user
router.get('/conversations', authenticateToken, listConversations);

// Get online users
router.get('/online-users', authenticateToken, getOnlineUsers);

// Get unread message count
router.get('/unread-count', authenticateToken, getUnreadMessageCount);

// Send a message in a conversation
router.post('/:conversationId', authenticateToken, sendMessage);

// Get messages from a conversation
router.get('/:conversationId', authenticateToken, getMessages);

// Start or get a conversation with another user
router.post('/conversations', authenticateToken, startConversation);

// Mark messages as read in a conversation
router.put('/:conversationId/read', authenticateToken, markMessagesAsRead);

export default router; 