
import express from "express"
import cors from "cors"
import 'dotenv/config'
import http from "http"; // Required for WebSockets
import {Server} from "socket.io"; // Import Socket.io
import userRouter from "./routes/userRoute.js"
import documentRouter from "./routes/documentRoute.js";
import connectDB from "./db/database.js";
import Document from "./models/document.js";
import User from "./models/user.js";



const app = express();
connectDB();
const server = http.createServer(app);
const io =new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});



// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json


// API Routes (now protected for document creation/management)
app.get('/', (req, res) => {
    res.send('Real-time Collaboration Platform Backend');
});


app.use('/api/user',userRouter) //localhost:4040/api/admin/add-doctor
app.use('/api/document',documentRouter) 


// Socket.io for real-time editing and user presence
const activeUsers = {}; // To store active users per document

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join-document', (documentId, username) => {
        socket.join(documentId);
        console.log(`User ${username} joined document: ${documentId}`);

        // Track active users in this document
        if (!activeUsers[documentId]) {
            activeUsers[documentId] = [];
        }
        if (!activeUsers[documentId].includes(username)) {
            activeUsers[documentId].push(username);
        }
        io.to(documentId).emit('active-users-update', activeUsers[documentId]);
    });

    socket.on('send-changes', (data) => {
        io.to(data.documentId).emit('receive-changes', data.changes);
    });

    socket.on('save-document', async (data) => {
        try {
            const { documentId, content } = data;
            const updatedDocument = await Document.findById(documentId);

            if (updatedDocument) {
                updatedDocument.content = content;
                updatedDocument.updatedAt = Date.now();
                if (updatedDocument.versions.length === 0 || updatedDocument.versions[updatedDocument.versions.length - 1].content !== content) {
                    updatedDocument.versions.push({ content: content });
                }
                await updatedDocument.save();
                io.to(documentId).emit('document-saved', updatedDocument);
                console.log(`Document ${documentId} saved.`);
                // Broadcast to all clients that documents might have changed (for list refresh)
                io.emit('documents-updated');
            } else {
                console.error('Document not found for save:', documentId);
                socket.emit('save-error', 'Document not found.');
            }
        } catch (error) {
            console.error('Error saving document:', error);
            socket.emit('save-error', 'Failed to save document.');
        }
    });

    socket.on('new-document-created', (newDoc) => {
        // Broadcast to all clients that a new document has been created
        io.emit('documents-updated');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Remove user from active users list for all rooms they were in
        for (const docId in activeUsers) {
            activeUsers[docId] = activeUsers[docId].filter(user => user !== socket.handshake.query.username);
            io.to(docId).emit('active-users-update', activeUsers[docId]);
            if (activeUsers[docId].length === 0) {
                delete activeUsers[docId]; // Clean up empty document rooms
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 