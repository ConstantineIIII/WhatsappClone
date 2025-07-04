const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./database');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Serve uploaded files
app.use('/api/uploads', express.static('uploads'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await db.healthCheck();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: health
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test uploads endpoint
app.get('/api/test-uploads', (req, res) => {
  res.json({
    message: 'Uploads endpoint is working',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, full_name, email, profile_picture_url, is_online, last_seen FROM users ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

app.get('/api/chats', async (req, res) => {
  try {
    const result = await db.query(`
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
      GROUP BY c.id, c.name, c.is_group, c.created_at, u.full_name
      ORDER BY c.updated_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats',
      error: error.message
    });
  }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT 
        m.id,
        m.content,
        m.message_type,
        m.media_url,
        m.is_edited,
        m.created_at,
        u.id as sender_id,
        u.username as sender_username,
        u.full_name as sender_name,
        u.profile_picture_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.chat_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [chatId, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      data: result.rows.reverse(), // Reverse to get chronological order
      count: result.rows.length,
      chatId,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { chatId, senderId, content, messageType = 'text', mediaUrl = null } = req.body;
    
    if (!chatId || !senderId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: chatId, senderId, content'
      });
    }
    
    const result = await db.query(`
      INSERT INTO messages (chat_id, sender_id, content, message_type, media_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [chatId, senderId, content, messageType, mediaUrl]);
    
    // Cache the message in Redis for quick access
    const messageKey = `message:${result.rows[0].id}`;
    await db.redisSet(messageKey, JSON.stringify({
      id: result.rows[0].id,
      chatId,
      senderId,
      content,
      messageType,
      mediaUrl,
      createdAt: result.rows[0].created_at
    }), 3600); // Cache for 1 hour
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Redis cache example
app.get('/api/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await db.redisGet(key);
    
    if (value) {
      res.json({
        success: true,
        data: JSON.parse(value),
        source: 'cache'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Key not found in cache'
      });
    }
  } catch (error) {
    console.error('Error fetching from cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch from cache',
      error: error.message
    });
  }
});

app.post('/api/cache/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value, expireSeconds = 3600 } = req.body;
    
    await db.redisSet(key, JSON.stringify(value), expireSeconds);
    
    res.json({
      success: true,
      message: 'Value cached successfully',
      key,
      expireSeconds
    });
  } catch (error) {
    console.error('Error setting cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set cache',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile('public/admin/index.html', { root: __dirname + '/../' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Clone API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API documentation: http://localhost:${PORT}/api/`);
});

module.exports = app; 