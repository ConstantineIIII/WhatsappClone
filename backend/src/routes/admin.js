const express = require('express');
const Joi = require('joi');
const db = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication and admin middleware to all routes
router.use(authenticateToken, requireAdmin);

// Validation schemas
const userUpdateSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).optional(),
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
  isAdmin: Joi.boolean().optional(),
  isOnline: Joi.boolean().optional(),
  statusMessage: Joi.string().max(500).optional()
});

const systemStatsSchema = Joi.object({
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional()
});

// Get all users (admin only)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT id, username, email, full_name, phone_number, profile_picture_url,
             status_message, is_online, last_seen, created_at, updated_at, is_admin
      FROM users
    `;
    let countQuery = 'SELECT COUNT(*) FROM users';
    let params = [];
    let paramCount = 0;

    // Add search filter
    if (search) {
      paramCount++;
      const searchFilter = `WHERE (username ILIKE $${paramCount} OR email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
      query += ` ${searchFilter}`;
      countQuery += ` ${searchFilter}`;
      params.push(`%${search}%`);
    }

    // Add sorting
    const validSortFields = ['username', 'email', 'full_name', 'created_at', 'last_seen', 'is_online'];
    const validSortOrders = ['ASC', 'DESC'];
    
    if (validSortFields.includes(sortBy) && validSortOrders.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ' ORDER BY created_at DESC';
    }

    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    // Execute queries
    const [usersResult, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, search ? params.slice(0, -2) : [])
    ]);

    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalUsers,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Get user details (admin only)
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await db.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.phone_number, 
             u.profile_picture_url, u.status_message, u.is_online, 
             u.last_seen, u.created_at, u.updated_at, u.is_admin,
             COUNT(DISTINCT c.id) as total_chats,
             COUNT(DISTINCT m.id) as total_messages,
             COUNT(DISTINCT s.id) as active_sessions
      FROM users u
      LEFT JOIN chat_participants cp ON u.id = cp.user_id
      LEFT JOIN chats c ON cp.chat_id = c.id
      LEFT JOIN messages m ON u.id = m.sender_id
      LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = true
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's recent activity
    const activityResult = await db.query(`
      SELECT 'message' as type, m.created_at, m.content as details, c.name as chat_name
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.sender_id = $1
      UNION ALL
      SELECT 'login' as type, s.created_at, s.device_info as details, NULL as chat_name
      FROM user_sessions s
      WHERE s.user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);

    const user = userResult.rows[0];
    user.recentActivity = activityResult.rows;

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Admin user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
});

// Update user (admin only)
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { error, value } = userUpdateSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { fullName, email, phoneNumber, isAdmin, isOnline, statusMessage } = value;

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email is already taken by another user'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    if (fullName !== undefined) {
      paramCount++;
      updateFields.push(`full_name = $${paramCount}`);
      params.push(fullName);
    }

    if (email !== undefined) {
      paramCount++;
      updateFields.push(`email = $${paramCount}`);
      params.push(email);
    }

    if (phoneNumber !== undefined) {
      paramCount++;
      updateFields.push(`phone_number = $${paramCount}`);
      params.push(phoneNumber);
    }

    if (isAdmin !== undefined) {
      paramCount++;
      updateFields.push(`is_admin = $${paramCount}`);
      params.push(isAdmin);
    }

    if (isOnline !== undefined) {
      paramCount++;
      updateFields.push(`is_online = $${paramCount}`);
      params.push(isOnline);
    }

    if (statusMessage !== undefined) {
      paramCount++;
      updateFields.push(`status_message = $${paramCount}`);
      params.push(statusMessage);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(userId);

    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, full_name, phone_number, 
                status_message, is_online, last_seen, is_admin, updated_at
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Admin user update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
});

// Delete user (admin only)
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const userResult = await db.query('SELECT id, username FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Delete user (cascade will handle related data)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUserId: userId,
        deletedUsername: userResult.rows[0].username
      }
    });

  } catch (error) {
    console.error('Admin user delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// Get system statistics (admin only)
router.get('/stats', async (req, res) => {
  try {
    const { error, value } = systemStatsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { startDate, endDate } = value;
    let dateFilter = '';
    let params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE created_at BETWEEN $1 AND $2';
      params = [startDate, endDate];
    }

    // Get various statistics
    const [
      userStats,
      messageStats,
      chatStats,
      onlineUsers,
      recentActivity
    ] = await Promise.all([
      // User statistics
      db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_online = true THEN 1 END) as online_users,
          COUNT(CASE WHEN is_admin = true THEN 1 END) as admin_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_month
        FROM users
        ${dateFilter}
      `, params),

      // Message statistics
      db.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '24 hours' THEN 1 END) as messages_today,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as messages_week,
          COUNT(CASE WHEN message_type != 'text' THEN 1 END) as media_messages
        FROM messages
        ${dateFilter}
      `, params),

      // Chat statistics
      db.query(`
        SELECT 
          COUNT(*) as total_chats,
          COUNT(CASE WHEN is_group = true THEN 1 END) as group_chats,
          COUNT(CASE WHEN is_group = false THEN 1 END) as individual_chats,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_chats_week
        FROM chats
        ${dateFilter}
      `, params),

      // Currently online users
      db.query(`
        SELECT id, username, full_name, last_seen
        FROM users 
        WHERE is_online = true 
        ORDER BY last_seen DESC
        LIMIT 10
      `),

      // Recent system activity
      db.query(`
        SELECT 
          'user_registration' as type,
          u.created_at,
          u.username as details
        FROM users u
        WHERE u.created_at >= CURRENT_DATE - INTERVAL '7 days'
        UNION ALL
        SELECT 
          'message_sent' as type,
          m.created_at,
          CONCAT(u.username, ': ', LEFT(m.content, 50)) as details
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.created_at >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 20
      `)
    ]);

    res.json({
      success: true,
      data: {
        users: userStats.rows[0],
        messages: messageStats.rows[0],
        chats: chatStats.rows[0],
        onlineUsers: onlineUsers.rows,
        recentActivity: recentActivity.rows,
        dateRange: { startDate, endDate }
      }
    });

  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system statistics',
      error: error.message
    });
  }
});

// Get system logs (admin only)
router.get('/logs', async (req, res) => {
  try {
    const { type = 'all', limit = 50 } = req.query;

    let query = `
      SELECT 
        'session' as log_type,
        s.created_at,
        u.username,
        s.device_info,
        s.ip_address,
        CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END as status
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
    `;

    if (type === 'sessions') {
      query += ' ORDER BY s.created_at DESC LIMIT $1';
    } else {
      // For now, we'll return session logs. In a real system, you'd have a proper logging table
      query += ' ORDER BY s.created_at DESC LIMIT $1';
    }

    const result = await db.query(query, [parseInt(limit)]);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        total: result.rows.length,
        type,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Admin logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system logs',
      error: error.message
    });
  }
});

// Ban/unban user (admin only)
router.post('/users/:userId/ban', async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned, reason } = req.body;

    if (typeof banned !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Banned status must be a boolean'
      });
    }

    // Prevent admin from banning themselves
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot ban your own account'
      });
    }

    // Update user banned status
    await db.query(
      'UPDATE users SET is_banned = $1, banned_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [banned, reason || null, userId]
    );

    // If banning, invalidate all active sessions
    if (banned) {
      await db.query(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [userId]
      );
    }

    res.json({
      success: true,
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
      data: {
        userId,
        banned,
        reason
      }
    });

  } catch (error) {
    console.error('Admin ban user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user ban status',
      error: error.message
    });
  }
});

// Get admin dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const [
      userCounts,
      messageCounts,
      chatCounts,
      recentUsers,
      topChatters,
      systemHealth
    ] = await Promise.all([
      // User counts by time
      db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_users
        FROM users 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `),

      // Message counts by time
      db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as messages
        FROM messages 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `),

      // Chat counts by time
      db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_chats
        FROM chats 
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `),

      // Recent user registrations
      db.query(`
        SELECT username, email, created_at, is_online
        FROM users 
        ORDER BY created_at DESC 
        LIMIT 10
      `),

      // Top message senders
      db.query(`
        SELECT 
          u.username,
          u.full_name,
          COUNT(m.id) as message_count
        FROM users u
        JOIN messages m ON u.id = m.sender_id
        WHERE m.created_at >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY u.id, u.username, u.full_name
        ORDER BY message_count DESC
        LIMIT 10
      `),

      // System health check
      db.healthCheck()
    ]);

    res.json({
      success: true,
      data: {
        userGrowth: userCounts.rows,
        messageActivity: messageCounts.rows,
        chatGrowth: chatCounts.rows,
        recentUsers: recentUsers.rows,
        topChatters: topChatters.rows,
        systemHealth
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
});

module.exports = router; 