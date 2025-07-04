const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config();

// PostgreSQL Configuration
let postgresConfig;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL (Render format)
  postgresConfig = {
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
} else {
  // Use individual environment variables (local development)
  postgresConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whatsapp_clone',
    user: process.env.DB_USER || 'whatsapp_user',
    password: process.env.DB_PASSWORD || 'whatsapp_password',
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
}

// Create PostgreSQL connection pool
const postgresPool = new Pool(postgresConfig);

// PostgreSQL connection event handlers
postgresPool.on('connect', (client) => {
  console.log('✅ Connected to PostgreSQL database');
});

postgresPool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Redis Configuration
let redisConfig;

if (process.env.REDIS_URL) {
  // Use REDIS_URL (Render format)
  redisConfig = {
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('❌ Redis max retry attempts reached');
          return false;
        }
        return Math.min(retries * 100, 3000);
      }
    }
  };
} else {
  // Use individual environment variables (local development)
  redisConfig = {
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('❌ Redis max retry attempts reached');
          return false;
        }
        return Math.min(retries * 100, 3000);
      }
    },
    password: process.env.REDIS_PASSWORD
  };
}

// Create Redis client
const redisClient = redis.createClient(redisConfig);

// Redis connection event handlers
redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis connection error:', err);
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('end', () => {
  console.log('❌ Redis connection ended');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Connect to Redis
redisClient.connect().catch(err => {
  console.error('❌ Failed to connect to Redis:', err);
});

// Database utility functions
const db = {
  // PostgreSQL queries
  async query(text, params) {
    const start = Date.now();
    try {
      const res = await postgresPool.query(text, params);
      const duration = Date.now() - start;
      console.log(`📊 Executed query: ${text} (${duration}ms)`);
      return res;
    } catch (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
  },

  // Get a client from the pool
  async getClient() {
    return await postgresPool.connect();
  },

  // Redis operations
  async redisGet(key) {
    try {
      if (!redisClient.isReady) {
        console.log('🔄 Redis not ready, attempting to connect...');
        await redisClient.connect();
      }
      return await redisClient.get(key);
    } catch (error) {
      console.error('❌ Redis GET error:', error);
      throw error;
    }
  },

  async redisSet(key, value, expireSeconds = null) {
    try {
      if (!redisClient.isReady) {
        console.log('🔄 Redis not ready, attempting to connect...');
        await redisClient.connect();
      }
      if (expireSeconds) {
        return await redisClient.setEx(key, expireSeconds, value);
      } else {
        return await redisClient.set(key, value);
      }
    } catch (error) {
      console.error('❌ Redis SET error:', error);
      throw error;
    }
  },

  async redisDel(key) {
    try {
      if (!redisClient.isReady) {
        console.log('🔄 Redis not ready, attempting to connect...');
        await redisClient.connect();
      }
      return await redisClient.del(key);
    } catch (error) {
      console.error('❌ Redis DEL error:', error);
      throw error;
    }
  },

  async redisExists(key) {
    try {
      if (!redisClient.isReady) {
        console.log('🔄 Redis not ready, attempting to connect...');
        await redisClient.connect();
      }
      return await redisClient.exists(key);
    } catch (error) {
      console.error('❌ Redis EXISTS error:', error);
      throw error;
    }
  },

  // Health check
  async healthCheck() {
    try {
      // Check PostgreSQL
      const pgResult = await this.query('SELECT NOW()');
      
      // Check Redis
      await this.redisSet('health_check', 'ok', 10);
      const redisResult = await this.redisGet('health_check');
      
      return {
        postgres: pgResult.rows[0] ? 'healthy' : 'unhealthy',
        redis: redisResult === 'ok' ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return {
        postgres: 'unhealthy',
        redis: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  },

  // Close connections
  async close() {
    try {
      await postgresPool.end();
      await redisClient.quit();
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error closing database connections:', error);
    }
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await db.close();
  process.exit(0);
});

module.exports = db; 