const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Serve static files (your HTML, CSS, client-side JS)
app.use(express.static('public')); // Assuming your client-side files are in a 'public' folder

let currentChemicalStructureData = ''; // Store the current state of the drawing

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send the current structure to the newly connected user
    socket.emit('initialStructure', currentChemicalStructureData);

    // Listen for drawing updates from clients
    socket.on('drawingUpdate', (drawingData) => {
        console.log('Received drawing update:', drawingData.length > 50 ? drawingData.substring(0, 50) + '...' : drawingData); // Log a snippet
        currentChemicalStructureData = drawingData; // Update the server's state

        // Broadcast the update to all other connected clients
        socket.broadcast.emit('drawingUpdate', drawingData);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});