const express = require('express');
const Joi = require('joi');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

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

// Note: Profile picture upload endpoints removed for cloud-free deployment
// The profile_picture_url field in the database is kept for future cloud storage implementation

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