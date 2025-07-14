import { Server } from 'socket.io';
import { corsOptions } from './corsOptions.js';
import jwt from 'jsonwebtoken';
// import { env } from '../env.mjs';

// In-memory map of userId to socket
const userSockets = new Map();

export function setupSocketIO(server) {
    const io = new Server(server, {
        cors: corsOptions
    });

    // Helper to emit to a user by userId
    io.emitToUser = (userId, event, data) => {
        const socket = userSockets.get(userId);
        if (socket) {
            socket.emit(event, data);
        }
    };

    io.on('connection', (socket) => {
        // JWT authentication
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            socket.disconnect(true);
            return;
        }
        let userId;
        try {
            const decoded = jwt.verify(token, process.env.AUTH_SECRET);
            userId = decoded.id;
        } catch (err) {
            socket.disconnect(true);
            return;
        }
        // Map userId to socket
        userSockets.set(userId, socket);
        socket.userId = userId;
        console.log(`User ${userId} connected with socket ${socket.id}`);

        // Join a personal room for direct messaging
        socket.join(`user_${userId}`);

        // Handle instant message event (optional, for direct socket messages)
        socket.on('send_message', (data) => {
            // data: { conversationId, text, formatting }
            // You can implement direct DB save and emit here if you want
            // For now, just emit to recipient if provided
            if (data && data.toUserId) {
                io.emitToUser(data.toUserId, 'new_message', data);
            }
        });

        socket.on('disconnect', () => {
            userSockets.delete(userId);
            console.log(`User ${userId} disconnected from socket ${socket.id}`);
        });
    });

    // Attach to app for REST access
    if (server.app) {
        server.app.set('io', io);
        server.app.set('userSockets', userSockets);
    }

    return io;
}
