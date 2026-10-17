import express from 'express';
import authenticateToken from '../middleware/authentication.js';
import authorizeRoles from '../middleware/roleAuthorization.js';
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

// Direct messages are student <-> assigned supervisor only (pairing enforced in the controller via utils/dmPolicy.js)
router.use(authenticateToken, authorizeRoles('STUDENT', 'SUPERVISOR'));

// List all conversations for the authenticated user
router.get('/conversations', listConversations);

// Start or get a conversation with another user
router.post('/conversations', startConversation);

// Get online users
router.get('/online-users', getOnlineUsers);

// Get unread message count
router.get('/unread-count', getUnreadMessageCount);

// Send a message in a conversation
router.post('/:conversationId', sendMessage);

// Get messages from a conversation
router.get('/:conversationId', getMessages);

// Mark messages as read in a conversation
router.put('/:conversationId/read', markMessagesAsRead);

export default router; 