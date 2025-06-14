
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

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey';

app.use(cors());
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://vishishtmaroria31:uoLcFMPE9gyna33C@cluster0.1mpgutm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

const User = mongoose.model('User', userSchema);

// Document Schema
const documentSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    content: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to user
    versions: [
        {
            content: { type: String },
            timestamp: { type: Date, default: Date.now },
        }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); 

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); 
        req.user = user;
        next();
    });
};

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const newUser = new User({ username, password });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ error: 'Username already exists or invalid data' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/', (req, res) => {
    res.send('Real-time Collaboration Platform Backend');
});

app.post('/documents', authenticateToken, async (req, res) => {
    try {
        const { title, content } = req.body;
        const newDocument = new Document({ title, content, owner: req.user.id });
        // Save initial version
        newDocument.versions.push({ content: content || '' });
        await newDocument.save();
        res.status(201).json(newDocument);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all documents
app.get('/documents', authenticateToken, async (req, res) => {
    try {
        const documents = await Document.find({}); // Fetch all documents
        res.status(200).json(documents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single document by ID 
app.get('/documents/:id', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.status(200).json(document);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/documents/:id', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        document.content = content;
        document.updatedAt = Date.now();
        if (document.versions.length === 0 || document.versions[document.versions.length - 1].content !== content) {
            document.versions.push({ content: content });
        }

        await document.save();
        res.status(200).json(document);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/documents/:id/versions', authenticateToken, async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.status(200).json(document.versions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/documents/:id/revert', authenticateToken, async (req, res) => {
    try {
        const { versionIndex } = req.body;
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        if (versionIndex < 0 || versionIndex >= document.versions.length) {
            return res.status(400).json({ error: 'Invalid version index' });
        }

        const targetVersionContent = document.versions[versionIndex].content;
        document.content = targetVersionContent;
        document.updatedAt = Date.now();
        document.versions.push({ content: targetVersionContent, timestamp: new Date() });
        await document.save();

        res.status(200).json(document);
    } catch (err) {
        console.error('Error reverting document:', err);
        res.status(500).json({ error: 'Failed to revert document' });
    }
});

const activeUsers = {}; 

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join-document', (documentId, username) => {
        socket.join(documentId);
        console.log(`User ${username} joined document: ${documentId}`);

        if (!activeUsers[documentId]) {
            activeUsers[documentId] = [];
        }
        if (!activeUsers[documentId].includes(username)) {
            activeUsers[documentId].push(username);
        }
        io.to(documentId).emit('active-users-update', activeUsers[documentId]);
    });

    socket.on('send-changes', (data) => {
        socket.broadcast.to(data.documentId).emit('receive-changes', data.changes);
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
        io.emit('documents-updated');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        for (const docId in activeUsers) {
            activeUsers[docId] = activeUsers[docId].filter(user => user !== socket.handshake.query.username);
            io.to(docId).emit('active-users-update', activeUsers[docId]);
            if (activeUsers[docId].length === 0) {
                delete activeUsers[docId]; 
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 