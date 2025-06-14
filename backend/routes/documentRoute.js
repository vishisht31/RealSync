import express from "express";

import authToken from "../middlewares/auth.js";
import { createDocument, fetchAllDocuments, fetchOneDocument, getDocumentVersions, revertToVersion, updateDocument } from "../controllers/documents.js";

const documentRouter=express.Router()

// Create a new document
documentRouter.post('/createDocument', authToken, createDocument); //done

// Get all documents (now accessible by any authenticated user)
documentRouter.get('/fetchAllDocuments', authToken, fetchAllDocuments); //done

// Get a single document by ID (now accessible by any authenticated user)
documentRouter.get('/:id', authToken, fetchOneDocument); //done

// Update a document by ID and save new version (now editable by any authenticated user)
documentRouter.put('/:id', authToken, updateDocument); 

// Get document versions (now accessible by any authenticated user)
documentRouter.get('/:id/versions', authToken, getDocumentVersions); //done

// Revert to a specific version (now accessible by any authenticated user)
documentRouter.post('/:id/revert', authToken, revertToVersion); //done

export default documentRouter