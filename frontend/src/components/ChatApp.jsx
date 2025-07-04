import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import axios from 'axios';

const ChatApp = ({ darkMode, setDarkMode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchChats();
    fetchUsers();
  }, []);

  const fetchChats = async () => {
    try {
      const response = await axios.get('/chats');
      console.log('Chats API response:', response.data);
      setChats(response.data.data.chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
      setError('Failed to load chats');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data.data.filter(u => u.id !== user.id));
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (payload) => {
    try {
      let response;
      if (typeof payload === 'string') {
        // Individual chat
        response = await axios.post('/chats', {
          isGroup: false,
          participantIds: [payload]
        });
      } else {
        // Group chat
        response = await axios.post('/chats', payload);
      }
      const newChat = response.data.data;
      setChats(prev => [...prev, newChat]);
      setSelectedChat(newChat);
    } catch (error) {
      if (error.response?.status === 409) {
        const existingChat = error.response.data.data;
        setChats(prev => {
          const chatExists = prev.some(chat => chat.id === existingChat.id);
          if (!chatExists) {
            return [...prev, existingChat];
          }
          return prev;
        });
        setSelectedChat(existingChat);
      } else {
        setError('Failed to create chat');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="chat-container w-full h-full flex">
      <Sidebar
        user={user}
        chats={chats}
        users={users}
        selectedChat={selectedChat}
        onSelectChat={setSelectedChat}
        onCreateChat={createChat}
        onLogout={handleLogout}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onProfileClick={handleProfileClick}
      />
      
      <ChatArea
        chat={selectedChat}
        user={user}
        onChatUpdate={fetchChats}
      />
    </div>
  );
};

export default ChatApp; 