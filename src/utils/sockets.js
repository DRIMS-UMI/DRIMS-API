import { Server } from 'socket.io';
import { corsOptions } from './corsOptions.js';
import jwt from 'jsonwebtoken';
// import { env } from '../env.mjs';

// In-memory map of userId to socket and online status
const userSockets = new Map();
const onlineUsers = new Set();

export function setupSocketIO(server, app) {
    const io = new Server(server, {
        cors: corsOptions,
        transports: ['websocket', 'polling'], // Allow both transports
        allowEIO3: true // Allow Engine.IO v3 clients
    });

    // Store reference to online users for other parts of the app
    server.onlineUsers = onlineUsers;

    console.log('Socket.IO server initialized with CORS options:', corsOptions);

    // Helper to emit to a user by userId
    io.emitToUser = (userId, event, data) => {
        console.log(`Attempting to emit '${event}' to user ${userId}:`, data);
        
        // Try direct socket emission first
        const socket = userSockets.get(userId);
        if (socket && socket.connected) {
            console.log(`Emitting via direct socket ${socket.id} to user ${userId}`);
            socket.emit(event, data);
            return true;
        }
        
        // Fallback: emit to user room
        const roomName = `user_${userId}`;
        const connectedSockets = io.sockets.adapter.rooms.get(roomName);
        if (connectedSockets && connectedSockets.size > 0) {
            console.log(`Emitting via room ${roomName} to user ${userId}`);
            io.to(roomName).emit(event, data);
            return true;
        }
        
        console.log(`User ${userId} not found or not connected - message not delivered`);
        return false;
    };

    // Helper to broadcast online users
    io.broadcastOnlineUsers = () => {
        const onlineUsersList = Array.from(onlineUsers);
        io.emit('online_users_updated', { onlineUsers: onlineUsersList });
    };

    // Helper to get online status
    io.isUserOnline = (userId) => {
        return onlineUsers.has(userId);
    };

    io.on('connection', (socket) => {
        console.log('New socket connection attempt from:', socket.handshake.address);
        
        // JWT authentication
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            console.log('Socket connection rejected - no token provided');
            socket.disconnect(true);
            return;
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.AUTH_SECRET);
            userId = decoded.id;
            console.log('Socket authenticated for user:', userId);
        } catch (err) {
            console.log('Socket authentication failed:', err.message);
            socket.disconnect(true);
            return;
        }
        
        // Map userId to socket and mark as online
        userSockets.set(userId, socket);
        onlineUsers.add(userId);
        socket.userId = userId;
        console.log(`User ${userId} connected with socket ${socket.id}`);

        // Join a personal room for direct messaging
        socket.join(`user_${userId}`);

        // Emit user status change to all connected clients
        socket.broadcast.emit('user_status_changed', { 
            userId, 
            isOnline: true 
        });

        // Send current online users to the newly connected user
        socket.emit('online_users_updated', { 
            onlineUsers: Array.from(onlineUsers) 
        });

        // Handle instant message event (optional, for direct socket messages)
        socket.on('send_message', (data) => {
            // data: { conversationId, text, formatting }
            // You can implement direct DB save and emit here if you want
            // For now, just emit to recipient if provided
            if (data && data.toUserId) {
                io.emitToUser(data.toUserId, 'new_message', {
                    type: 'new_message',
                    conversationId: data.conversationId,
                    message: data
                });
            }
        });

        // Handle typing indicators
        socket.on('typing_start', (data) => {
            // data: { conversationId, userId }
            if (data && data.conversationId) {
                socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
                    userId: userId,
                    conversationId: data.conversationId,
                    isTyping: true
                });
            }
        });

        socket.on('typing_stop', (data) => {
            // data: { conversationId, userId }
            if (data && data.conversationId) {
                socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
                    userId: userId,
                    conversationId: data.conversationId,
                    isTyping: false
                });
            }
        });

        // Handle joining conversation rooms for typing indicators
        socket.on('join_conversation', (data) => {
            if (data && data.conversationId) {
                socket.join(`conversation_${data.conversationId}`);
            }
        });

        socket.on('leave_conversation', (data) => {
            if (data && data.conversationId) {
                socket.leave(`conversation_${data.conversationId}`);
            }
        });

        socket.on('disconnect', () => {
            userSockets.delete(userId);
            onlineUsers.delete(userId);
            console.log(`User ${userId} disconnected from socket ${socket.id}`);
            
            // Emit user status change to all connected clients
            socket.broadcast.emit('user_status_changed', { 
                userId, 
                isOnline: false 
            });
        });
    });

    // Attach to app for REST access
    if (app) {
        app.set('io', io);
        app.set('userSockets', userSockets);
        app.set('onlineUsers', onlineUsers);
        console.log('Socket.IO instance attached to Express app');
    } else {
        console.log('Warning: No app provided to attach Socket.IO instance');
    }

    return io;
}
