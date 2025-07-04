const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Joi = require('joi');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profile-pictures');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Validation schemas
const updateProfileSchema = Joi.object({
  full_name: Joi.string().min(2).max(100).optional(),
  bio: Joi.string().max(500).optional(),
  profile_picture_url: Joi.string().optional()
});

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, username, email, full_name, bio, profile_picture_url, is_online, last_seen, created_at
      FROM users WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        bio: user.bio,
        profile_picture_url: user.profile_picture_url,
        is_online: user.is_online,
        last_seen: user.last_seen,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    console.log('Profile update request body:', req.body);
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      console.log('Validation error:', error.details);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { full_name, bio, profile_picture_url } = value;

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramCount++}`);
      params.push(full_name);
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      params.push(bio);
    }

    if (profile_picture_url !== undefined) {
      updates.push(`profile_picture_url = $${paramCount++}`);
      params.push(profile_picture_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    params.push(req.user.id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, username, email, full_name, bio, profile_picture_url, is_online, last_seen, created_at
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        bio: updatedUser.bio,
        profile_picture_url: updatedUser.profile_picture_url,
        is_online: updatedUser.is_online,
        last_seen: updatedUser.last_seen,
        created_at: updatedUser.created_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Upload profile picture
router.post('/profile-picture', upload.single('profile_picture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Generate URL for the uploaded file - use relative URL to work with Vite proxy
    const profilePictureUrl = `/api/uploads/profile-pictures/${req.file.filename}`;

    // Update user's profile picture URL
    const result = await db.query(`
      UPDATE users 
      SET profile_picture_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, profile_picture_url
    `, [profilePictureUrl, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profile_picture_url: profilePictureUrl
      }
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete uploaded file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
});

// Delete profile picture
router.delete('/profile-picture', async (req, res) => {
  try {
    // Get current profile picture URL
    const userResult = await db.query(
      'SELECT profile_picture_url FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentPictureUrl = userResult.rows[0].profile_picture_url;

    // Remove profile picture URL from database
    await db.query(
      'UPDATE users SET profile_picture_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.user.id]
    );

    // Delete the file if it exists
    if (currentPictureUrl) {
      try {
        // Extract filename from the URL (remove the /api/uploads/profile-pictures/ prefix)
        const urlParts = currentPictureUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const filePath = path.join(__dirname, '../../uploads/profile-pictures', filename);
        await fs.unlink(filePath);
      } catch (fileError) {
        console.error('Failed to delete profile picture file:', fileError);
        // Don't fail the request if file deletion fails
      }
    }

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });

  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: error.message
    });
  }
});

// Get user by ID (for public profile viewing)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await db.query(`
      SELECT id, username, full_name, bio, profile_picture_url, is_online, last_seen
      FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        bio: user.bio,
        profile_picture_url: user.profile_picture_url,
        is_online: user.is_online,
        last_seen: user.last_seen
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
});

module.exports = router; 