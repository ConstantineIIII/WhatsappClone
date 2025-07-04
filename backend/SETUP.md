# WhatsApp Clone Database Setup Guide

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Node.js (v16 or higher)
- Git (optional)

### Step 1: Start the Database
```bash
# Navigate to the project directory
cd "Whatsapp Clone"

# Start the database services
docker-compose up -d
```

### Step 2: Verify Services
```bash
# Check if services are running
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs redis
```

### Step 3: Install Dependencies
```bash
# Install Node.js dependencies
npm install
```

### Step 4: Set Up Environment
```bash
# Copy environment file
cp env.example .env

# Edit .env file with your configuration
# (Optional: modify database credentials, ports, etc.)
```

### Step 5: Test the API
```bash
# Start the API server
npm run dev

# Test the health endpoint
curl http://localhost:3000/health
```

## 📊 Database Schema

The database includes these main tables:

### Users
- User accounts with profiles
- Online status tracking
- Contact information

### Chats
- Individual and group conversations
- Chat metadata and settings

### Messages
- All chat messages
- Support for text, media, files
- Message status tracking

### Chat Participants
- Users in each chat
- Admin roles for group chats

### Message Status
- Delivery and read receipts
- Message tracking per user

## 🔧 Configuration

### Environment Variables
Copy `env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_clone
DB_USER=whatsapp_user
DB_PASSWORD=whatsapp_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Application
PORT=3000
JWT_SECRET=your-secret-key
```

### Production Setup
For production, use the production Docker Compose file:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🛠️ Useful Commands

### Database Management
```bash
# Start database
npm run db:start

# Stop database
npm run db:stop

# Backup database
npm run db:backup

# Connect to PostgreSQL
docker exec -it whatsapp_clone_db psql -U whatsapp_user -d whatsapp_clone

# Connect to Redis
docker exec -it whatsapp_clone_redis redis-cli
```

### Development
```bash
# Start development server
npm run dev

# Run tests
npm test

# View logs
docker-compose logs -f
```

## 📡 API Endpoints

### Health Check
- `GET /health` - Check service status

### Users
- `GET /api/users` - List all users

### Chats
- `GET /api/chats` - List all chats
- `GET /api/chats/:chatId/messages` - Get chat messages

### Messages
- `POST /api/messages` - Send a message

### Cache
- `GET /api/cache/:key` - Get cached value
- `POST /api/cache/:key` - Set cached value

## 🔍 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the port
netstat -ano | findstr :5432
netstat -ano | findstr :6379

# Kill the process or change ports in docker-compose.yml
```

#### Docker Not Running
```bash
# Start Docker Desktop
# Then run:
docker-compose up -d
```

#### Database Connection Issues
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs postgres

# Restart services
docker-compose restart
```

#### Permission Issues (Windows)
- Run Docker Desktop as Administrator
- Ensure WSL2 is properly configured

### Reset Everything
```bash
# Stop and remove everything
docker-compose down -v

# Remove all containers and volumes
docker system prune -a --volumes

# Start fresh
docker-compose up -d
```

## 📈 Performance Tips

### PostgreSQL Optimization
- The `postgresql.conf` file is optimized for production
- Connection pooling is configured
- Proper indexes are created

### Redis Optimization
- Memory limit set to 256MB
- Persistence enabled with AOF
- LRU eviction policy

### Application Optimization
- Rate limiting enabled
- Connection pooling
- Caching with Redis

## 🔒 Security Considerations

### Development
- Default passwords are used for convenience
- No SSL enabled by default

### Production
- Change all default passwords
- Enable SSL/TLS
- Use environment variables for secrets
- Enable authentication for Redis
- Configure proper firewall rules

## 📚 Next Steps

1. **Build the Frontend**
   - Create a React/Vue/Angular frontend
   - Implement real-time messaging with WebSockets

2. **Add Authentication**
   - Implement JWT authentication
   - Add user registration/login

3. **File Upload**
   - Set up file storage (AWS S3, etc.)
   - Handle media messages

4. **Real-time Features**
   - WebSocket connections
   - Online status updates
   - Typing indicators

5. **Advanced Features**
   - Message encryption
   - Push notifications
   - Voice/video calls

## 🆘 Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Verify Docker is running
3. Check port availability
4. Review the troubleshooting section above
5. Check the README.md for more details

## 📝 License

This project is for educational purposes. Feel free to modify and use as needed. 