import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ChatArea = ({ chat, user, onChatUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (chat) {
      fetchMessages();
    }
  }, [chat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    if (!chat) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`/messages/chat/${chat.id}`);
      setMessages(response.data.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat) return;

    setSending(true);
    try {
      const response = await axios.post('/messages', {
        chatId: chat.id,
        content: newMessage.trim(),
        messageType: 'text'
      });

      const message = response.data.data;
      setMessages(prev => [...prev, message]);
      setNewMessage('');
      
      // Update chat list to show last message
      if (onChatUpdate) {
        onChatUpdate();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startRename = () => {
    setIsRenaming(true);
    setRenameValue(chat.name || getChatName());
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue('');
  };

  const saveRename = async () => {
    if (!renameValue.trim()) return;
    
    try {
      await axios.put(`/chats/${chat.id}`, {
        name: renameValue.trim()
      });
      
      // Update the chat object locally
      chat.name = renameValue.trim();
      setIsRenaming(false);
      setRenameValue('');
      
      // Update chat list
      if (onChatUpdate) {
        onChatUpdate();
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
    }
  };

  const handleRenameKeyPress = (e) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  const getChatName = () => {
    if (!chat) return '';
    if (chat.is_group === false) {
      const otherParticipant = chat.participants?.find(p => p.id !== user.id);
      return otherParticipant?.full_name || otherParticipant?.username || 'Unknown User';
    }
    return chat.name || 'Group Chat';
  };

  const getChatAvatar = () => {
    if (!chat) return '';
    if (chat.is_group === false) {
      const otherParticipant = chat.participants?.find(p => p.id !== user.id);
      return otherParticipant?.profile_picture_url ? (
        <img src={otherParticipant.profile_picture_url} alt={otherParticipant.full_name || otherParticipant.username} className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className="w-10 h-10 rounded-full overflow-hidden bg-green-500 text-white flex items-center justify-center text-lg font-semibold">
          {otherParticipant?.full_name?.charAt(0) || otherParticipant?.username?.charAt(0) || '?'}
        </div>
      );
    }
    // Group icon
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-blue-500">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
    );
  };

  // Helper to format message date
  function formatMessageDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = now.toDateString() === date.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return time;
    } else if (isYesterday) {
      return `Yesterday, ${time}`;
    } else {
      // Calculate days difference, ignoring time of day
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));
      if (diffDays >= 2 && diffDays < 7) {
        return `${diffDays} days ago, ${time}`;
      } else {
        return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
      }
    }
  }

  if (!chat) {
    return (
      <div className="chat-area flex-1 min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-700 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <h3 className="text-lg font-medium">Select a chat to start messaging</h3>
            <p className="text-sm">Choose from your conversations or start a new one</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-area flex-1 min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-700 flex flex-col">
      {/* Chat Header */}
      <div className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700 p-4 transition-colors duration-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getChatAvatar()}
            <div>
              {isRenaming ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyPress}
                    onBlur={saveRename}
                    className="font-semibold text-gray-900 bg-transparent border-b border-green-500 focus:outline-none focus:border-green-600"
                    autoFocus
                  />
                  <button
                    onClick={saveRename}
                    className="text-green-600 hover:text-green-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={cancelRename}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{getChatName()}</h3>
                  <button
                    onClick={startRename}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Rename chat"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
              {chat.is_group ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-300">Group chat &bull; {chat.participants?.length || 0} members</p>
                  <p className="text-xs text-gray-400 dark:text-gray-200 truncate max-w-xs">
                    {chat.participants?.map(p => p.full_name || p.username).join(', ')}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-300">Individual chat</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-black transition-colors duration-700">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwn = msg.sender_id === user.id;
            const showAvatar = chat.is_group || !isOwn; // Always show for group, for 1-1 only for other user
            return (
              <div key={msg.id || idx} className={`flex items-end mb-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                {!isOwn && showAvatar && (
                  <div className="mr-2 flex-shrink-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-green-500 text-white flex items-center justify-center text-sm font-semibold">
                      {msg.sender_avatar ? (
                        <img src={msg.sender_avatar} alt={msg.sender_name || msg.sender_username} className="w-full h-full object-cover" style={{ display: 'block' }} />
                      ) : (
                        <span>{msg.sender_name?.charAt(0) || msg.sender_username?.charAt(0) || '?'}</span>
                      )}
                    </div>
                  </div>
                )}
                <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg shadow text-sm break-words ${isOwn ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-100'} transition-colors duration-700`}>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="input-area bg-white dark:bg-black transition-colors duration-700">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-black text-black dark:text-white transition-colors duration-700"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-green-600 text-white p-2 rounded-full hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatArea; 