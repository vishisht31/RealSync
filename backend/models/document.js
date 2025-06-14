
import mongoose from "mongoose";

// Document Schema
const documentSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    content: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Link to user
    versions: [
        {
            content: { type: String },
            timestamp: { type: Date, default: Date.now },
            // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Optional: to track who made changes
        }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', documentSchema);
export default Document