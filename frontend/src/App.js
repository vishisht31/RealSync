import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import Auth from './components/Auth';
import './App.css';

const API_BASE_URL = 'https://realsync-yp12.onrender.com';
const socket = io(API_BASE_URL, { autoConnect: false }); // Prevent auto-connection

function App() {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [username, setUsername] = useState(localStorage.getItem('username'));
    const [documentTitle, setDocumentTitle] = useState('');
    const [documentContent, setDocumentContent] = useState('');
    const [currentDocumentId, setCurrentDocumentId] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [documentVersions, setDocumentVersions] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'editor'
    const editorRef = useRef(null);

    const fetchDocuments = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/documents`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setDocuments(data);
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                console.error('Error fetching documents:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    }, [token]);

    const fetchDocumentVersions = useCallback(async (docId) => {
        if (!token || !docId) return;
        try {
            const response = await fetch(`${API_BASE_URL}/documents/${docId}/versions`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setDocumentVersions(data);
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                console.error(`Error fetching versions for ${docId}:`, response.statusText);
            }
        } catch (error) {
            console.error(`Error fetching versions for ${docId}:`, error);
        }
    }, [token]);

    // Handle Socket.io connection on token presence
    useEffect(() => {
        if (token && username && !socket.connected) {
            socket.auth = { username }; // Pass username for disconnect handling
            socket.connect();
        }

        return () => {
            if (socket.connected) {
                socket.disconnect();
            }
        };
    }, [token, username]);

    // Fetch all documents on component mount or token change
    useEffect(() => {
        if (token) {
            fetchDocuments();
        }
    }, [token, fetchDocuments]);

    // Socket.io effects for real-time updates
    useEffect(() => {
        if (!token) return;

        socket.on('receive-changes', (changes) => {
            if (editorRef.current && changes !== documentContent) {
                setDocumentContent(changes);
            }
        });

        socket.on('document-saved', (updatedDoc) => {
            console.log('Document saved by server:', updatedDoc);
            fetchDocuments(); // Refresh the list of documents
            if (currentDocumentId === updatedDoc._id) {
                fetchDocumentVersions(updatedDoc._id);
            }
        });

        socket.on('documents-updated', () => {
            console.log('Documents list updated by server, refetching...');
            fetchDocuments(); // Trigger a refresh of all documents
        });

        socket.on('active-users-update', (users) => {
            setActiveUsers(users);
        });

        socket.on('save-error', (message) => {
            console.error('Save error:', message);
            alert(message);
        });

        return () => {
            socket.off('receive-changes');
            socket.off('document-saved');
            socket.off('documents-updated');
            socket.off('active-users-update');
            socket.off('save-error');
        };
    }, [token, documentContent, currentDocumentId, fetchDocuments, fetchDocumentVersions]);

    const handleAuthSuccess = (newToken, newUsername) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('username', newUsername);
        setToken(newToken);
        setUsername(newUsername);
        socket.auth = { username: newUsername }; // Set username for socket immediately
        if (!socket.connected) {
            socket.connect();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setToken(null);
        setUsername(null);
        setDocuments([]);
        setDocumentContent('');
        setDocumentTitle('');
        setCurrentDocumentId(null);
        setDocumentVersions([]);
        setActiveUsers([]);
        setCurrentView('dashboard');
        if (socket.connected) {
            socket.disconnect();
        }
    };

    const handleTitleChange = (e) => {
        setDocumentTitle(e.target.value);
    };

    const handleContentChange = (e) => {
        const newContent = e.target.value;
        setDocumentContent(newContent);
        if (currentDocumentId) {
            socket.emit('send-changes', { documentId: currentDocumentId, changes: newContent });
        }
    };

    const createDocument = async () => {
        if (!token) return alert('Please log in to create a document.');
        if (!documentTitle.trim()) return alert('Please enter a document title.');
        
        try {
            const response = await fetch(`${API_BASE_URL}/documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title: documentTitle, content: '' }),
            });
            const newDoc = await response.json();
            if (response.ok) {
                setDocuments([...documents, newDoc]);
                // Automatically open the new document
                loadDocument(newDoc);
                setDocumentTitle(''); // Clear title input after creation
                socket.emit('new-document-created', newDoc); // Notify others
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                alert(`Error creating document: ${newDoc.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Error creating document:', error);
            alert('Failed to create document.');
        }
    };

    const loadDocument = async (doc) => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/documents/${doc._id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const fullDoc = await response.json();
                setDocumentTitle(fullDoc.title);
                setDocumentContent(fullDoc.content);
                setCurrentDocumentId(fullDoc._id);
                setCurrentView('editor'); // Switch to editor view
                fetchDocumentVersions(fullDoc._id);
                socket.emit('join-document', fullDoc._id, username); // Pass username when joining
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                alert(`Error loading document: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error loading document:', error);
            alert('Failed to load document.');
        }
    };

    const saveDocument = () => {
        if (currentDocumentId) {
            socket.emit('save-document', { documentId: currentDocumentId, content: documentContent });
        } else {
            alert('Please create or load a document first.');
        }
    };

    const revertDocument = async (versionIndex) => {
        if (!currentDocumentId || !token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/documents/${currentDocumentId}/revert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ versionIndex })
            });
            const data = await response.json();
            if (response.ok) {
                setDocumentContent(data.content); // Update editor with reverted content
                fetchDocumentVersions(currentDocumentId); // Refresh versions
                alert('Document reverted successfully!');
            } else if (response.status === 401 || response.status === 403) {
                handleLogout();
            } else {
                alert(`Error reverting document: ${data.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Error reverting document:', error);
            alert('Failed to revert document.');
        }
    };

    const goBackToDashboard = () => {
        setCurrentView('dashboard');
        setCurrentDocumentId(null);
        setDocumentContent('');
        setDocumentVersions([]);
        setActiveUsers([]);
    };

    if (!token) {
        return <Auth onAuthSuccess={handleAuthSuccess} />;
    }

    // Dashboard View
    if (currentView === 'dashboard') {
        return (
            <div className="App">
                <div className="header">
                    <h1>RealSync</h1>
                    {username && <p>Welcome, {username}!</p>}
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                </div>
                
                <div className="document-controls">
                    <input
                        type="text"
                        placeholder="Document Title"
                        value={documentTitle}
                        onChange={handleTitleChange}
                    />
                    <button onClick={createDocument}>Create New Document</button>
                </div>

                <div className="document-list">
                    <h2>Existing Documents</h2>
                    {documents.length === 0 && <p>No documents yet. Create one!</p>}
                    <ul>
                        {documents.map((doc) => (
                            <li key={doc._id}>
                                <div className="document-info">
                                    <strong>{doc.title}</strong>
                                    <br />
                                    <small>Last updated: {new Date(doc.updatedAt).toLocaleString()}</small>
                                </div>
                                <button 
                                    className="open-button"
                                    onClick={() => loadDocument(doc)}
                                >
                                    Open
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    }

    // Editor View
    return (
        <div className="document-editor-page">
            <div className="document-editor-header">
                <h2>{documentTitle || 'Untitled Document'}</h2>
                <div>
                    <button onClick={saveDocument} className="document-controls button" style={{marginRight: '10px'}}>
                        Save Document
                    </button>
                    <button onClick={goBackToDashboard} className="back-button">
                        Back to Dashboard
                    </button>
                </div>
            </div>

            <div className="editor-and-versions-container">
                <div className="editor-container">
                    <textarea
                        ref={editorRef}
                        value={documentContent}
                        onChange={handleContentChange}
                        placeholder="Start typing here..."
                        rows="20"
                        cols="80"
                    ></textarea>
                </div>
                <div className="version-history">
                    <h2>Version History</h2>
                    {documentVersions.length === 0 && <p>No versions available.</p>}
                    <ul>
                        {documentVersions.map((version, index) => (
                            <li key={index}>
                                Version {index + 1} ({new Date(version.timestamp).toLocaleString()})
                                <button onClick={() => revertDocument(index)} className="revert-button">
                                    Revert
                                </button>
                            </li>
                        ))}
                    </ul>
                    {activeUsers.length > 0 && (
                        <div className="active-users">
                            <h3>Active Users</h3>
                            <ul>
                                {activeUsers.map((user, index) => (
                                    <li key={index}>{user}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;