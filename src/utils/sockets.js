import { Server } from 'socket.io';
import {corsOptions} from './corsOptions.js';

export function setupSocketIO(server) {
    const io = new Server(server, {
        cors: corsOptions
    });

    // Handle connection
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        // Example: Handle custom events
        // socket.on('message', (data) => {
        //     console.log('Received message:', data);
        //     // Broadcast to all connected clients
        //     io.emit('message', data);
        // });

        // Example: Join a room
        socket.on('join_room', (room) => {
            socket.join(room);
            console.log(`User ${socket.id} joined room: ${room}`);
        });

        // // Example: Send message to specific room
        // socket.on('room_message', ({ room, message }) => {
        //     io.to(room).emit('room_message', {
        //         sender: socket.id,
        //         message
        //     });
        // });

        socket.on("leaveRoom", (roomName) => {
            console.log(`Client ${socket.id} left room ${roomName}`);
            socket.leave(roomName);
        });

        // Handle errors
        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });

    return io;
}
