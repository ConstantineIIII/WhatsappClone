const express = require('express');
const Joi = require('joi');
const db = require('../database');
const { authenticateToken, updateUserStatus } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, updateUserStatus);

// Validation schemas
const sendMessageSchema = Joi.object({
  chatId: Joi.string().uuid().required(),
  content: Joi.string().max(5000).required(),
  messageType: Joi.string().valid('text', 'image', 'video', 'audio', 'file').default('text'),
  mediaUrl: Joi.string().uri().optional(),
  replyToId: Joi.string().uuid().optional()
});

const updateMessageSchema = Joi.object({
  content: Joi.string().max(5000).required()
});

// Get messages for a chat
router.get('/chat/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    const offset = (page - 1) * limit;

    // Check if user is participant
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    let query = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.media_url,
        m.reply_to_id,
        m.is_edited,
        m.created_at,
        m.updated_at,
        u.id as sender_id,
        u.username as sender_username,
        u.full_name as sender_name,
        u.profile_picture_url as sender_avatar,
        ms.status as message_status
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = $1
      WHERE m.chat_id = $2
    `;
    let params = [req.user.id, chatId];

    // Add before filter for pagination
    if (before) {
      query += ' AND m.created_at < $3';
      params.push(before);
    }

    query += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM messages WHERE chat_id = $1',
      [chatId]
    );

    const totalMessages = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalMessages / limit);

    // Mark messages as read
    if (result.rows.length > 0) {
      const messageIds = result.rows.map(msg => msg.id);
      await db.query(`
        INSERT INTO message_status (message_id, user_id, status, updated_at)
        VALUES ${messageIds.map((_, index) => `($${index + 1}, $${messageIds.length + 1}, 'read', CURRENT_TIMESTAMP)`).join(', ')}
        ON CONFLICT (message_id, user_id) 
        DO UPDATE SET status = 'read', updated_at = CURRENT_TIMESTAMP
      `, [...messageIds, req.user.id]);
    }

    res.json({
      success: true,
      data: {
        messages: result.rows.reverse(), // Reverse to get chronological order
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalMessages,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Messages fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Send a message
router.post('/', async (req, res) => {
  try {
    const { error, value } = sendMessageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { chatId, content, messageType, mediaUrl, replyToId } = value;

    // Check if user is participant
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    // If replying to a message, verify it exists and is in the same chat
    if (replyToId) {
      const replyCheck = await db.query(
        'SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2',
        [replyToId, chatId]
      );

      if (replyCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Reply message not found in this chat'
        });
      }
    }

    // Insert message
    const messageResult = await db.query(`
      INSERT INTO messages (chat_id, sender_id, content, message_type, media_url, reply_to_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [chatId, req.user.id, content, messageType, mediaUrl, replyToId]);

    const message = messageResult.rows[0];

    // Get full message details
    const fullMessageResult = await db.query(`
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.media_url,
        m.reply_to_id,
        m.is_edited,
        m.created_at,
        m.updated_at,
        u.id as sender_id,
        u.username as sender_username,
        u.full_name as sender_name,
        u.profile_picture_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1
    `, [message.id]);

    // Update chat's updated_at timestamp
    await db.query(
      'UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [chatId]
    );

    // Cache message in Redis for quick access
    const messageKey = `message:${message.id}`;
    await db.redisSet(messageKey, JSON.stringify(fullMessageResult.rows[0]), 3600);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: fullMessageResult.rows[0]
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Update a message
router.put('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { error, value } = updateMessageSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { content } = value;

    // Check if message exists and user is the sender
    const messageCheck = await db.query(`
      SELECT m.id, m.chat_id, m.sender_id, m.content, m.created_at
      FROM messages m
      WHERE m.id = $1
    `, [messageId]);

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = messageCheck.rows[0];

    if (message.sender_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    // Check if message is too old to edit (e.g., 15 minutes)
    const messageAge = Date.now() - new Date(message.created_at).getTime();
    const maxEditTime = 15 * 60 * 1000; // 15 minutes

    if (messageAge > maxEditTime) {
      return res.status(400).json({
        success: false,
        message: 'Message is too old to edit'
      });
    }

    // Update message
    const result = await db.query(`
      UPDATE messages 
      SET content = $1, is_edited = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, content, is_edited, updated_at
    `, [content, messageId]);

    // Update cache
    const messageKey = `message:${messageId}`;
    const cachedMessage = await db.redisGet(messageKey);
    if (cachedMessage) {
      const messageData = JSON.parse(cachedMessage);
      messageData.content = content;
      messageData.is_edited = true;
      messageData.updated_at = result.rows[0].updated_at;
      await db.redisSet(messageKey, JSON.stringify(messageData), 3600);
    }

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Update message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update message',
      error: error.message
    });
  }
});

// Delete a message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if message exists and user is the sender or admin
    const messageCheck = await db.query(`
      SELECT m.id, m.chat_id, m.sender_id, m.created_at,
             c.created_by, cp.is_admin
      FROM messages m
      JOIN chats c ON m.chat_id = c.id
      LEFT JOIN chat_participants cp ON c.id = cp.chat_id AND cp.user_id = $1
      WHERE m.id = $2
    `, [req.user.id, messageId]);

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const message = messageCheck.rows[0];
    const isSender = message.sender_id === req.user.id;
    const isAdmin = message.is_admin || message.created_by === req.user.id;

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages or need admin privileges'
      });
    }

    // Check if message is too old to delete (e.g., 1 hour for sender, no limit for admin)
    if (isSender && !isAdmin) {
      const messageAge = Date.now() - new Date(message.created_at).getTime();
      const maxDeleteTime = 60 * 60 * 1000; // 1 hour

      if (messageAge > maxDeleteTime) {
        return res.status(400).json({
          success: false,
          message: 'Message is too old to delete'
        });
      }
    }

    // Delete message
    await db.query('DELETE FROM messages WHERE id = $1', [messageId]);

    // Remove from cache
    const messageKey = `message:${messageId}`;
    await db.redisDel(messageKey);

    res.json({
      success: true,
      message: 'Message deleted successfully',
      data: { messageId }
    });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
});

// Get message status
router.get('/:messageId/status', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if user is participant in the chat
    const participantCheck = await db.query(`
      SELECT 1 FROM chat_participants cp
      JOIN messages m ON cp.chat_id = m.chat_id
      WHERE m.id = $1 AND cp.user_id = $2
    `, [messageId, req.user.id]);

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }

    // Get message status for all participants
    const statusResult = await db.query(`
      SELECT 
        ms.user_id,
        ms.status,
        ms.updated_at,
        u.username,
        u.full_name
      FROM message_status ms
      JOIN users u ON ms.user_id = u.id
      WHERE ms.message_id = $1
      ORDER BY ms.updated_at ASC
    `, [messageId]);

    res.json({
      success: true,
      data: {
        messageId,
        status: statusResult.rows
      }
    });

  } catch (error) {
    console.error('Message status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message status',
      error: error.message
    });
  }
});

// Mark message as read
router.post('/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;

    // Check if user is participant in the chat
    const participantCheck = await db.query(`
      SELECT 1 FROM chat_participants cp
      JOIN messages m ON cp.chat_id = m.chat_id
      WHERE m.id = $1 AND cp.user_id = $2
    `, [messageId, req.user.id]);

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this message'
      });
    }

    // Update message status
    await db.query(`
      INSERT INTO message_status (message_id, user_id, status, updated_at)
      VALUES ($1, $2, 'read', CURRENT_TIMESTAMP)
      ON CONFLICT (message_id, user_id) 
      DO UPDATE SET status = 'read', updated_at = CURRENT_TIMESTAMP
    `, [messageId, req.user.id]);

    res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

// Search messages
router.get('/search', async (req, res) => {
  try {
    const { query, chatId, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    let sqlQuery = `
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.media_url,
        m.created_at,
        u.id as sender_id,
        u.username as sender_username,
        u.full_name as sender_name,
        c.id as chat_id,
        c.name as chat_name,
        c.is_group
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN chats c ON m.chat_id = c.id
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = $1 AND m.content ILIKE $2
    `;
    let params = [req.user.id, `%${query}%`];

    if (chatId) {
      sqlQuery += ' AND c.id = $3';
      params.push(chatId);
    }

    sqlQuery += ' ORDER BY m.created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await db.query(sqlQuery, params);

    res.json({
      success: true,
      data: {
        messages: result.rows,
        query,
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Message search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages',
      error: error.message
    });
  }
});

module.exports = router; 