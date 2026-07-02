const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static("public"));

const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Track users in a simple map (In production, use Redis)
const users = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join a generic "voice" room
    socket.join('voice-room');

    // Notify others of new user
    socket.to('voice-room').emit('userJoined', { id: socket.id });

    // Update user list
    io.to('voice-room').emit('updateUsers', Array.from(users.keys()).concat([socket.id]));

    // Handle Audio Streaming (Binary Buffer is much better than Base64)
    socket.on('audioChunk', (buffer) => {
        socket.to('voice-room').emit('audioChunk', buffer);
    });

    socket.on('muteStatus', (data) => {
        socket.to('voice-room').emit('userMuteStatus', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        users.delete(socket.id);
        io.to('voice-room').emit('updateUsers', Array.from(users.keys()));
        io.to('voice-room').emit('userLeft', { id: socket.id });
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});