import React, { useState } from 'react';
import './Auth.css';

function Auth({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        const endpoint = isLogin ? 'api/user/login' : 'api/user/register';
        try {
            const response = await fetch(`http://localhost:5000/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || (isLogin ? 'Login successful!' : 'Registration successful! Please log in.'));
                if (isLogin) {
                    onAuthSuccess(data.token, data.username);
                }
                // For registration, clear fields and switch to login after success
                if (!isLogin) {
                    setUsername('');
                    setPassword('');
                    setIsLogin(true);
                }
            } else {
                setMessage(data.error || 'An error occurred.');
            }
        } catch (error) {
            console.error('Auth error:', error);
            setMessage('Network error or server unreachable.');
        }
    };

    return (
        <div className="auth-container">
            <h2>{isLogin ? 'Login' : 'Register'}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Username:</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">{isLogin ? 'Login' : 'Register'}</button>
            </form>
            <p onClick={() => setIsLogin(!isLogin)} className="toggle-auth">
                {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
            </p>
            {message && <p className="auth-message">{message}</p>}
        </div>
    );
}

export default Auth; 