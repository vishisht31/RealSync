import Document from "../models/document.js";


const fetchAllDocuments=async (req, res) => {
    try {
        const documents = await Document.find({}); // Fetch all documents
        res.status(200).json(documents);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const createDocument = async (req, res) => {
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
}

const fetchOneDocument=async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // No owner check here, as it's a shared document
        res.status(200).json(document);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const updateDocument=async (req, res) => {
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
}

const getDocumentVersions= async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.status(200).json(document.versions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const revertToVersion=async (req, res) => {
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
}

export {fetchAllDocuments, createDocument, fetchOneDocument, updateDocument, getDocumentVersions, revertToVersion}