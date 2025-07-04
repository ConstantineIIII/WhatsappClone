const express = require('express');
const Joi = require('joi');
const db = require('../database');
const { authenticateToken, updateUserStatus } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken, updateUserStatus);

// Validation schemas
const createChatSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  isGroup: Joi.boolean().default(false),
  participantIds: Joi.array().items(Joi.string().uuid()).min(1).required()
});

const updateChatSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  isGroup: Joi.boolean().optional()
});

const addParticipantSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  isAdmin: Joi.boolean().default(false)
});

// Get user's chats
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        c.updated_at,
        u.full_name as created_by_name,
        COUNT(cp.user_id) as participant_count,
        (
          SELECT m.content 
          FROM messages m 
          WHERE m.chat_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT m.created_at 
          FROM messages m 
          WHERE m.chat_id = c.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM messages m 
          WHERE m.chat_id = c.id 
          AND m.created_at > (
            SELECT COALESCE(MAX(ms.updated_at), '1970-01-01'::timestamp)
            FROM message_status ms
            JOIN messages m2 ON ms.message_id = m2.id
            WHERE m2.chat_id = c.id AND ms.user_id = $1
          )
        ) as unread_count
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE cp.user_id = $1
      GROUP BY c.id, c.name, c.is_group, c.created_at, c.updated_at, u.full_name
      ORDER BY last_message_time DESC NULLS LAST, c.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, parseInt(limit), offset]);

    // Get participants for each chat
    const chatsWithParticipants = await Promise.all(
      result.rows.map(async (chat) => {
        const participantsResult = await db.query(`
          SELECT 
            u.id,
            u.username,
            u.full_name,
            u.profile_picture_url,
            u.is_online,
            u.last_seen,
            cp.joined_at,
            cp.is_admin
          FROM chat_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.chat_id = $1
          ORDER BY cp.joined_at ASC
        `, [chat.id]);
        
        return {
          ...chat,
          participants: participantsResult.rows
        };
      })
    );

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM chats c
      JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE cp.user_id = $1
    `, [req.user.id]);

    const totalChats = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalChats / limit);

    res.json({
      success: true,
      data: {
        chats: chatsWithParticipants,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalChats,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Chats fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats',
      error: error.message
    });
  }
});

// Create new chat
router.post('/', async (req, res) => {
  try {
    const { error, value } = createChatSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { name, isGroup, participantIds } = value;

    // Add current user to participants if not already included
    const allParticipantIds = participantIds.includes(req.user.id) 
      ? participantIds 
      : [...participantIds, req.user.id];

    // Verify all participants exist
    const userCheckResult = await db.query(
      'SELECT id, username, full_name FROM users WHERE id = ANY($1)',
      [allParticipantIds]
    );

    if (userCheckResult.rows.length !== allParticipantIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants not found'
      });
    }

    // Set default chat name for individual chats
    let chatName = name;
    if (!isGroup && allParticipantIds.length === 2 && !name) {
      const otherParticipant = userCheckResult.rows.find(p => p.id !== req.user.id);
      chatName = otherParticipant?.full_name || otherParticipant?.username || 'Chat';
    }

    // For individual chats, check if chat already exists
    if (!isGroup && allParticipantIds.length === 2) {
      const existingChat = await db.query(`
        SELECT c.id, c.name
        FROM chats c
        JOIN chat_participants cp1 ON c.id = cp1.chat_id
        JOIN chat_participants cp2 ON c.id = cp2.chat_id
        WHERE cp1.user_id = $1 AND cp2.user_id = $2
        AND c.is_group = false
      `, [allParticipantIds[0], allParticipantIds[1]]);

      if (existingChat.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Chat already exists',
          data: existingChat.rows[0]
        });
      }
    }

    // Create chat
    const chatResult = await db.query(`
      INSERT INTO chats (name, is_group, created_by)
      VALUES ($1, $2, $3)
      RETURNING id, name, is_group, created_at
    `, [chatName, isGroup, req.user.id]);

    const chat = chatResult.rows[0];

    // Add participants
    const participantValues = allParticipantIds.map((userId, index) => {
      const isAdmin = userId === req.user.id && isGroup; // Creator is admin in group chats
      return `($1, $${index + 2}, ${isAdmin})`;
    }).join(', ');

    const participantParams = [chat.id, ...allParticipantIds];
    await db.query(`
      INSERT INTO chat_participants (chat_id, user_id, is_admin)
      VALUES ${participantValues}
    `, participantParams);

    // Get chat with participant details
    const fullChatResult = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        u.full_name as created_by_name,
        COUNT(cp.user_id) as participant_count
      FROM chats c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.is_group, c.created_at, u.full_name
    `, [chat.id]);

    // Get participants for the new chat
    const participantsResult = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.profile_picture_url,
        u.is_online,
        u.last_seen,
        cp.joined_at,
        cp.is_admin
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.chat_id = $1
      ORDER BY cp.joined_at ASC
    `, [chat.id]);

    const newChat = {
      ...fullChatResult.rows[0],
      participants: participantsResult.rows
    };

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: newChat
    });

  } catch (error) {
    console.error('Chat creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat',
      error: error.message
    });
  }
});

// Get chat details
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

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

    // Get chat details
    const chatResult = await db.query(`
      SELECT 
        c.id,
        c.name,
        c.is_group,
        c.created_at,
        c.updated_at,
        u.full_name as created_by_name,
        COUNT(cp.user_id) as participant_count
      FROM chats c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN chat_participants cp ON c.id = cp.chat_id
      WHERE c.id = $1
      GROUP BY c.id, c.name, c.is_group, c.created_at, c.updated_at, u.full_name
    `, [chatId]);

    if (chatResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Get participants
    const participantsResult = await db.query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        u.profile_picture_url,
        u.is_online,
        u.last_seen,
        cp.joined_at,
        cp.is_admin
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.chat_id = $1
      ORDER BY cp.joined_at ASC
    `, [chatId]);

    const chat = chatResult.rows[0];
    chat.participants = participantsResult.rows;

    res.json({
      success: true,
      data: chat
    });

  } catch (error) {
    console.error('Chat details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat details',
      error: error.message
    });
  }
});

// Update chat
router.put('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { error, value } = updateChatSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    // Check if user is admin or creator
    const permissionCheck = await db.query(`
      SELECT cp.is_admin, c.created_by
      FROM chat_participants cp
      JOIN chats c ON cp.chat_id = c.id
      WHERE cp.chat_id = $1 AND cp.user_id = $2
    `, [chatId, req.user.id]);

    if (permissionCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const { is_admin, created_by } = permissionCheck.rows[0];
    if (!is_admin && created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update this chat'
      });
    }

    const { name, isGroup } = value;

    // Build update query
    const updateFields = [];
    const params = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      params.push(name);
    }

    if (isGroup !== undefined) {
      paramCount++;
      updateFields.push(`is_group = $${paramCount}`);
      params.push(isGroup);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    paramCount++;
    params.push(chatId);

    const query = `
      UPDATE chats 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, is_group, created_at, updated_at
    `;

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      message: 'Chat updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Chat update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chat',
      error: error.message
    });
  }
});

// Add participant to chat
router.post('/:chatId/participants', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { error, value } = addParticipantSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const { userId, isAdmin } = value;

    // Check if user is admin
    const permissionCheck = await db.query(`
      SELECT cp.is_admin, c.is_group
      FROM chat_participants cp
      JOIN chats c ON cp.chat_id = c.id
      WHERE cp.chat_id = $1 AND cp.user_id = $2
    `, [chatId, req.user.id]);

    if (permissionCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const { is_admin, is_group } = permissionCheck.rows[0];
    if (!is_admin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add participants'
      });
    }

    if (!is_group) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add participants to individual chats'
      });
    }

    // Check if user exists
    const userCheck = await db.query(
      'SELECT id, username, full_name FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is already a participant
    const existingParticipant = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );

    if (existingParticipant.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User is already a participant in this chat'
      });
    }

    // Add participant
    await db.query(
      'INSERT INTO chat_participants (chat_id, user_id, is_admin) VALUES ($1, $2, $3)',
      [chatId, userId, isAdmin]
    );

    res.status(201).json({
      success: true,
      message: 'Participant added successfully',
      data: {
        chatId,
        userId,
        username: userCheck.rows[0].username,
        fullName: userCheck.rows[0].full_name,
        isAdmin
      }
    });

  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add participant',
      error: error.message
    });
  }
});

// Remove participant from chat
router.delete('/:chatId/participants/:userId', async (req, res) => {
  try {
    const { chatId, userId } = req.params;

    // Check if user is admin or removing themselves
    const permissionCheck = await db.query(`
      SELECT cp.is_admin, c.is_group, c.created_by
      FROM chat_participants cp
      JOIN chats c ON cp.chat_id = c.id
      WHERE cp.chat_id = $1 AND cp.user_id = $2
    `, [chatId, req.user.id]);

    if (permissionCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this chat'
      });
    }

    const { is_admin, is_group, created_by } = permissionCheck.rows[0];
    const isRemovingSelf = userId === req.user.id;
    const isCreator = created_by === req.user.id;

    if (!is_admin && !isRemovingSelf && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove participants'
      });
    }

    if (!is_group) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove participants from individual chats'
      });
    }

    // Check if user to be removed is a participant
    const participantCheck = await db.query(
      'SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User is not a participant in this chat'
      });
    }

    // Prevent removing the creator if they're the only admin
    if (userId === created_by) {
      const adminCount = await db.query(
        'SELECT COUNT(*) FROM chat_participants WHERE chat_id = $1 AND is_admin = true',
        [chatId]
      );

      if (parseInt(adminCount.rows[0].count) === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the only admin from the chat'
        });
      }
    }

    // Remove participant
    await db.query(
      'DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, userId]
    );

    res.json({
      success: true,
      message: 'Participant removed successfully',
      data: { chatId, userId }
    });

  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove participant',
      error: error.message
    });
  }
});

// Leave chat
router.post('/:chatId/leave', async (req, res) => {
  try {
    const { chatId } = req.params;

    // Check if user is a participant
    const participantCheck = await db.query(`
      SELECT cp.is_admin, c.is_group, c.created_by
      FROM chat_participants cp
      JOIN chats c ON cp.chat_id = c.id
      WHERE cp.chat_id = $1 AND cp.user_id = $2
    `, [chatId, req.user.id]);

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    const { is_admin, is_group, created_by } = participantCheck.rows[0];

    // For individual chats, delete the entire chat
    if (!is_group) {
      await db.query('DELETE FROM chats WHERE id = $1', [chatId]);
      
      res.json({
        success: true,
        message: 'Chat deleted successfully',
        data: { chatId }
      });
      return;
    }

    // For group chats, check if user is the only admin
    if (is_admin && created_by === req.user.id) {
      const adminCount = await db.query(
        'SELECT COUNT(*) FROM chat_participants WHERE chat_id = $1 AND is_admin = true',
        [chatId]
      );

      if (parseInt(adminCount.rows[0].count) === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot leave group as the only admin. Transfer admin role or delete the group.'
        });
      }
    }

    // Remove user from chat
    await db.query(
      'DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    res.json({
      success: true,
      message: 'Left chat successfully',
      data: { chatId }
    });

  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave chat',
      error: error.message
    });
  }
});

module.exports = router; 