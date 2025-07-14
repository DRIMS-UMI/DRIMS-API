import prisma from "../../../utils/db.mjs";

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
    if (io && otherUserId) {
      io.emitToUser(otherUserId, 'new_message', {
        conversationId,
        message
      });
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