import React, { useState } from 'react';

const Sidebar = ({ user, chats, users, selectedChat, onSelectChat, onCreateChat, onLogout, darkMode, setDarkMode, onProfileClick }) => {
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);

  // Debug logging
  console.log('Sidebar received chats:', chats, 'Type:', typeof chats, 'Is Array:', Array.isArray(chats));

  // Ensure chats is always an array
  const safeChats = Array.isArray(chats) ? chats : [];

  const filteredUsers = (users || []).filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChatName = (chat) => {
    if (chat.is_group === false) {
      const otherParticipant = chat.participants?.find(p => p.id !== user.id);
      return otherParticipant?.full_name || otherParticipant?.username || 'Unknown User';
    }
    return chat.name || 'Group Chat';
  };

  const getChatAvatar = (chat) => {
    if (chat.is_group === false) {
      const otherParticipant = chat.participants?.find(p => p.id !== user.id);
      if (otherParticipant?.profile_picture_url) {
        return (
          <img src={otherParticipant.profile_picture_url} alt={otherParticipant.full_name || otherParticipant.username} className="w-8 h-8 rounded-full object-cover" />
        );
      }
      return (
        <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-semibold">
          {otherParticipant?.full_name?.charAt(0) || otherParticipant?.username?.charAt(0) || '?'}
        </div>
      );
    }
    // Group icon
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-blue-500">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
    );
  };

  const handleGroupUserToggle = (userId) => {
    setSelectedGroupUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreateGroup = () => {
    if (!groupName.trim() || selectedGroupUsers.length === 0) return;
    onCreateChat({
      isGroup: true,
      name: groupName.trim(),
      participantIds: selectedGroupUsers
    });
    setShowNewGroup(false);
    setGroupName('');
    setSelectedGroupUsers([]);
    setSearchTerm('');
  };

  return (
    <div className="sidebar w-[320px] min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-700 flex flex-col">
      {/* Header */}
      <div className="bg-green-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onProfileClick}
              className="w-10 h-10 p-0 bg-transparent border-none cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-white bg-opacity-20 flex items-center justify-center">
                {user.profile_picture_url ? (
                  <img src={user.profile_picture_url} alt="Profile" className="w-full h-full object-cover" style={{ display: 'block' }} />
                ) : (
                  <span className="text-lg font-semibold">
                    {user.full_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                  </span>
                )}
              </div>
            </button>
            <div>
              <h3 className="font-semibold">{user.full_name || user.username}</h3>
              <p className="text-sm text-green-100">Online</p>
            </div>
          </div>
          {/* Dark mode toggle button */}
          <button
            onClick={() => setDarkMode(dm => !dm)}
            className="ml-2 p-2 rounded-full bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors flex items-center justify-center focus:outline-none"
            title="Toggle dark mode"
          >
            <span className="relative w-6 h-6 block">
              <span
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${darkMode ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`}
                style={{ zIndex: 2 }}
              >
                {/* Moon icon */}
                <svg className="w-6 h-6 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
                </svg>
              </span>
              <span
                className={`absolute inset-0 transition-transform duration-500 ease-in-out ${darkMode ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
                style={{ zIndex: 1 }}
              >
                {/* Sun icon */}
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 6.95l-1.41-1.41M6.46 6.46L5.05 5.05m12.02 0l-1.41 1.41M6.46 17.54l-1.41 1.41" />
                </svg>
              </span>
            </span>
          </button>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* New Chat & New Group Buttons (moved outside header) */}
      <div className="p-4 border-b border-gray-200 flex space-x-2">
        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>New Chat</span>
        </button>
        <button
          onClick={() => setShowNewGroup(!showNewGroup)}
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>New Group</span>
        </button>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  onCreateChat(user.id);
                  setShowNewChat(false);
                  setSearchTerm('');
                }}
                className="w-full flex items-center space-x-3 p-2 hover:bg-gray-200 rounded-md transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-green-500 text-white flex items-center justify-center text-sm font-semibold">
                  {user.profile_picture_url ? (
                    <img src={user.profile_picture_url} alt={user.full_name || user.username} className="w-full h-full object-cover" style={{ display: 'block' }} />
                  ) : (
                    <span>{user.full_name?.charAt(0) || user.username?.charAt(0)}</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{user.full_name || user.username}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black">
          <div className="mb-3">
            <input
              type="text"
              placeholder="Group name..."
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
            />
          </div>
          <div className="mb-2">
            <input
              type="text"
              placeholder="Search users..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2 mb-2">
            {filteredUsers.map(u => (
              <label key={u.id} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroupUsers.includes(u.id)}
                  onChange={() => handleGroupUserToggle(u.id)}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
                <span>{u.full_name || u.username}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleCreateGroup}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            disabled={!groupName.trim() || selectedGroupUsers.length === 0}
          >
            Create Group
          </button>
        </div>
      )}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {safeChats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No chats yet</p>
            <p className="text-sm">Start a new conversation!</p>
          </div>
        ) : (
          safeChats.map(chat => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`w-full flex items-center space-x-3 p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                selectedChat?.id === chat.id ? 'bg-gray-300 dark:bg-gray-900' : ''
              }`}
            >
              <div>
                {getChatAvatar(chat)}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-white">{getChatName(chat)}</p>
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage?.content || 'No messages yet'}
                </p>
              </div>
              {chat.unreadCount > 0 && (
                <div className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {chat.unreadCount}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar; 