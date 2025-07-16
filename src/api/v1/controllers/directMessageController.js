import prisma from "../../../utils/db.mjs";
import emailService from "../../../services/emailService.js";
import { env } from "../../../env.mjs";

export const listConversations = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find all conversations where the user is a participant
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { has: userId }
      },
      include: {
        lastMessage: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get all other participant IDs
    const otherUserIds = [
      ...new Set(
        conversations
          .map(c => c.participants.find(pid => pid !== userId))
          .filter(Boolean)
      )
    ];

    // Fetch user info for all other participants
    const users = await prisma.user.findMany({
      where: { id: { in: otherUserIds } },
      select: { id: true, name: true, email: true, role: true }
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    // Format response
    const result = conversations.map(conv => {
      const otherId = conv.participants.find(pid => pid !== userId);
      return {
        id: conv.id,
        participants: conv.participants,
        otherParticipant: userMap[otherId] || null,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt
      };
    });

    res.json({ conversations: result });
  } catch (err) {
    console.error('listConversations error:', err);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
};

// Get online users status
export const getOnlineUsers = async (req, res) => {
  try {
    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({ error: 'Socket.IO not available' });
    }
    
    const onlineUsers = Array.from(io.onlineUsers || new Set());
    res.json({ onlineUsers });
  } catch (err) {
    console.error('getOnlineUsers error:', err);
    res.status(500).json({ error: 'Failed to get online users' });
  }
};

// Get unread message count for the authenticated user
export const getUnreadMessageCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Find all conversations where the user is a participant
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { has: userId }
      },
      select: { id: true }
    });

    const conversationIds = conversations.map(c => c.id);

    if (conversationIds.length === 0) {
      return res.json({ unreadCount: 0 });
    }

    // Count messages where:
    // 1. The message is in one of the user's conversations
    // 2. The message was not sent by the current user
    // 3. The current user is not in the readBy array
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        NOT: {
          readBy: { has: userId }
        }
      }
    });

    res.json({ unreadCount });
  } catch (err) {
    console.error('getUnreadMessageCount error:', err);
    res.status(500).json({ error: 'Failed to get unread message count' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    // Check if the user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participants: true }
    });
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get total count
    const total = await prisma.message.count({
      where: { conversationId }
    });

    // Get paginated messages
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: pageSize
    });

    res.json({
      total,
      page,
      pageSize,
      messages
    });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { conversationId } = req.params;
    const { text, formatting } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    // Check if the user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { participants: true }
    });
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        text,
        formatting: formatting || undefined,
        readBy: [userId], // sender has read their own message
      }
    });

    // Update conversation's lastMessage and updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: message.id,
        updatedAt: new Date(),
      }
    });

    // Real-time: emit to the other participant
    const otherUserId = conversation.participants.find(pid => pid !== userId);
    const io = req.app.get('io');
    let messageDelivered = false;
    
    if (io && otherUserId) {
      // Emit with the structure the frontend expects
      messageDelivered = io.emitToUser(otherUserId, 'new_message', {
        type: 'new_message',
        conversationId,
        message
      });
    }

    // If message wasn't delivered via socket (user is offline), send email notification
    if (!messageDelivered && otherUserId) {
      try {
        // Get recipient and sender user details
        const [recipient, sender] = await Promise.all([
          prisma.user.findUnique({
            where: { id: otherUserId },
            select: { id: true, name: true, email: true, role: true }
          }),
          prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true }
          })
        ]);

        if (recipient && recipient.email && sender) {
          // Determine the conversation URL based on user role
          let conversationUrl = '';
          if (recipient.role === 'STUDENT') {
            conversationUrl = `${env.STUDENT_CLIENT_URL || 'https://umistudentportal.netlify.app'}/direct-messages`;
          } else if (recipient.role === 'SUPERVISOR' || recipient.role === 'FACULTY') {
            conversationUrl = `${env.SUPERVISOR_CLIENT_URL || 'https://umisupervisorportal.netlify.app'}/direct-messages`;
          }

          // Send email notification
          await emailService.sendMessageNotificationEmail({
            // to: recipient.email,
            to: "stephaniekirathe@gmail.com",
            recipientName: recipient.name,
            senderName: sender.name,
            messageText: text,
            conversationUrl
          });

          console.log(`Email notification sent to offline user ${recipient.name} (${recipient.email})`);
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't fail the message sending if email fails
      }
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

export const startConversation = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { participantId } = req.body;
    if (!participantId || typeof participantId !== 'string') {
      return res.status(400).json({ error: 'participantId is required.' });
    }
    if (participantId === userId) {
      return res.status(400).json({ error: 'Cannot start a conversation with yourself.' });
    }

    // Find all conversations with both participants
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          hasEvery: [userId, participantId]
        }
      },
      include: { lastMessage: true }
    });
    // Find the one with exactly 2 participants
    let conversation = conversations.find(c => c.participants.length === 2);

    // If not, create it
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          participants: [userId, participantId],
        },
        include: { lastMessage: true }
      });
    }

    // Fetch the other participant's info
    const otherUser = await prisma.user.findUnique({
      where: { id: participantId },
      select: { id: true, name: true, email: true, role: true }
    });

    res.json({
      conversation: {
        id: conversation.id,
        participants: conversation.participants,
        otherParticipant: otherUser,
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt
      }
    });
  } catch (err) {
    console.error('startConversation error:', err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
};

// Mark messages as read in a conversation
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user is a participant in the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { has: userId }
      }
    });

    if (!conversation) {
      const error = new Error('Conversation not found or access denied');
      error.statusCode = 404;
      throw error;
    }

    // Find messages that need to be marked as read (not sent by current user and not already read by them)
    const messagesToUpdate = await prisma.message.findMany({
      where: {
        conversationId: conversationId,
        senderId: { not: userId },
      },
      select: { id: true, readBy: true }
    });

    // Filter out messages already read by this user and update the rest
    const unreadMessages = messagesToUpdate.filter(msg => !msg.readBy.includes(userId));
    
    if (unreadMessages.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: unreadMessages.map(msg => msg.id) }
        },
        data: {
          readBy: {
            push: userId
          }
        }
      });
    }

    // Emit read receipt to other participants via Socket.IO
    const io = req.app.get('io');
    if (io) {
      console.log(`Emitting read receipts for conversation ${conversationId}, read by user ${userId}`);
      conversation.participants.forEach(participantId => {
        if (participantId !== userId) {
          const readReceiptData = {
            type: 'message_read',
            conversationId,
            readBy: userId,
            timestamp: new Date()
          };
          console.log(`Emitting message_read to participant ${participantId}:`, readReceiptData);
          // Emit with the structure the frontend expects
          io.emitToUser(participantId, 'message_read', readReceiptData);
        }
      });
    } else {
      console.log('No Socket.IO instance found - read receipts not sent');
    }

    res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    next(error);
  }
}; 