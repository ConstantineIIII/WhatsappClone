import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ChatApp from './components/ChatApp';
import Profile from './components/Profile';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import axios from 'axios';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/chat" element={
              <ProtectedRoute>
                <div className="min-h-screen w-screen flex bg-white dark:bg-black text-black dark:text-white transition-colors duration-700">
                  <ChatApp darkMode={darkMode} setDarkMode={setDarkMode} />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <ProfilePage darkMode={darkMode} setDarkMode={setDarkMode} />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

function ProtectedRoute({ children, darkMode, setDarkMode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  return user ? children : <Navigate to="/login" replace />;
}

function ProfilePage({ darkMode, setDarkMode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/chat');
  };

  return (
    <div className="min-h-screen w-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-700">
      <Profile user={user} onBack={handleBack} />
    </div>
  );
}

export default App;
