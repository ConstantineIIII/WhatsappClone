import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Profile = ({ user, onBack }) => {
  const { updateProfile } = useAuth();
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    profile_picture_url: user?.profile_picture_url || ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  }, [selectedFile]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setMessage('');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('profile_picture', file);

    const response = await axios.post('/users/profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    return response.data.data.profile_picture_url;
  };

  const saveProfile = async () => {
    setLoading(true);
    setMessage('');

    try {
      let profilePictureUrl = profile.profile_picture_url;

      // Upload new image if selected
      if (selectedFile) {
        profilePictureUrl = await uploadImage(selectedFile);
      }

      // Update profile
      const updateData = {
        full_name: profile.full_name,
        bio: profile.bio
      };
      
      // Only include profile_picture_url if it has a value
      if (profilePictureUrl) {
        updateData.profile_picture_url = profilePictureUrl;
      }
      
      console.log('Sending profile update data:', updateData);
      const response = await axios.put('/users/profile', updateData);

      const data = response.data;
      setProfile(prev => ({
        ...prev,
        profile_picture_url: profilePictureUrl
      }));
      setSelectedFile(null);
      setPreviewUrl('');
      setIsEditing(false);
      setMessage('Profile updated successfully!');
      
      // Update user context
      await updateProfile(data.data);

    } catch (error) {
      setMessage(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setProfile({
      full_name: user?.full_name || '',
      username: user?.username || '',
      email: user?.email || '',
      bio: user?.bio || '',
      profile_picture_url: user?.profile_picture_url || ''
    });
    setSelectedFile(null);
    setPreviewUrl('');
    setIsEditing(false);
    setMessage('');
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n.charAt(0)).join('').toUpperCase() || '?';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white transition-colors duration-700">
      <div className="max-w-2xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Profile</h1>
        </div>

        {/* Profile Picture Section */}
        <div className="mb-8 text-center">
          <div className="relative inline-block">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mx-auto mb-4">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : profile.profile_picture_url ? (
                <img src={profile.profile_picture_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-green-500 text-white flex items-center justify-center text-4xl font-bold">
                  {getInitials(profile.full_name)}
                </div>
              )}
            </div>
            {isEditing && (
              <label className="absolute bottom-0 right-0 bg-green-500 text-white p-2 rounded-full cursor-pointer hover:bg-green-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {isEditing && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Click the camera icon to upload a new photo
            </p>
          )}
        </div>

        {/* Profile Form */}
        <div className="space-y-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            {isEditing ? (
              <input
                type="text"
                name="full_name"
                value={profile.full_name}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-black text-black dark:text-white"
                placeholder="Enter your full name"
              />
            ) : (
              <p className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                {profile.full_name || 'Not set'}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <p className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500">
              {profile.username}
            </p>
            <p className="text-xs text-gray-400 mt-1">Username cannot be changed</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <p className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-500">
              {profile.email}
            </p>
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-2">Bio</label>
            {isEditing ? (
              <textarea
                name="bio"
                value={profile.bio}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-black text-black dark:text-white resize-none"
                placeholder="Tell us about yourself..."
                maxLength={500}
              />
            ) : (
              <p className="px-4 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[60px]">
                {profile.bio || 'No bio added yet'}
              </p>
            )}
            {isEditing && (
              <p className="text-xs text-gray-400 mt-1">
                {profile.bio.length}/500 characters
              </p>
            )}
          </div>

          {/* Message */}
          {message && (
            <div className={`p-3 rounded-lg text-sm ${
              message.includes('successfully') 
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            {isEditing ? (
              <>
                <button
                  onClick={saveProfile}
                  disabled={loading}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={loading}
                  className="flex-1 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile; 