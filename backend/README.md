# WhatsApp Clone - Complete Backend & Admin System

This project includes a complete backend system for a WhatsApp clone with PostgreSQL database, Redis caching, authentication, and a comprehensive admin panel.

## Prerequisites

- Docker
- Docker Compose
- Node.js (for the application)

## Quick Start

1. **Clone or navigate to this directory**
   ```bash
   cd "Whatsapp Clone"
   ```

2. **Start the database services**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   ```bash
   cp env.example .env
   ```

5. **Start the backend server**
   ```bash
   npm run dev
   ```

6. **Access the admin panel**
   ```
   http://localhost:3000/admin
   ```

7. **Verify the services are running**
   ```bash
   docker-compose ps
   ```

## System Architecture

### Backend Features
- **Authentication System**: JWT-based authentication with session management
- **User Management**: Registration, login, profile management
- **Chat System**: Individual and group chats with participant management
- **Messaging**: Real-time messaging with message status tracking
- **Admin Panel**: Comprehensive admin interface for system management
- **Caching**: Redis-based caching for improved performance
- **Security**: Rate limiting, input validation, and secure password handling

### Database Schema

The database includes the following tables:

- **users**: User accounts with authentication and admin roles
- **chats**: Individual and group chat rooms
- **chat_participants**: Users participating in chats with admin roles
- **messages**: All chat messages with media support
- **message_status**: Message delivery and read status tracking
- **contacts**: User contact lists
- **user_sessions**: Authentication sessions and device tracking

## Connection Details

### PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: whatsapp_clone
- **Username**: whatsapp_user
- **Password**: whatsapp_password

### Redis
- **Host**: localhost
- **Port**: 6379

## Environment Configuration

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Update the `.env` file with your specific configuration values.

## Admin Panel

### Access
- **URL**: `http://localhost:3000/admin`
- **Username**: `Kalel`
- **Email**: `kalel@whatsappclone.com`
- **Password**: `KalelKalel1!`

### Features
- **Dashboard**: System overview with real-time statistics
- **User Management**: View, edit, delete, and ban users
- **Chat Management**: Monitor and manage conversations
- **Message Management**: Search and moderate messages
- **System Statistics**: Detailed analytics and reports
- **System Logs**: Monitor user activity and system events

### Admin Capabilities
- View all users and their details
- Edit user profiles and roles
- Delete users and their data
- Ban/unban users
- Monitor system statistics
- View user activity logs
- Manage chat participants
- Moderate messages

## Database Management

### Connect to PostgreSQL
```bash
docker exec -it whatsapp_clone_db psql -U whatsapp_user -d whatsapp_clone
```

### View database logs
```bash
docker-compose logs postgres
```

### Reset the database
```bash
docker-compose down -v
docker-compose up -d
```

## Sample Data

The database is initialized with sample data including:
- 3 sample users (John Doe, Jane Smith, Bob Wilson)
- A sample chat between John and Jane
- Sample messages in the chat

## Useful Commands

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (WARNING: This will delete all data)
```bash
docker-compose down -v
```

### View running containers
```bash
docker ps
```

### Access PostgreSQL shell
```bash
docker exec -it whatsapp_clone_db psql -U whatsapp_user -d whatsapp_clone
```

### Backup database
```bash
docker exec whatsapp_clone_db pg_dump -U whatsapp_user whatsapp_clone > backup.sql
```

### Restore database
```bash
docker exec -i whatsapp_clone_db psql -U whatsapp_user -d whatsapp_clone < backup.sql
```

## Development

### Adding new tables
1. Edit the `init.sql` file
2. Add your new table definitions
3. Restart the containers: `docker-compose down && docker-compose up -d`

### Modifying existing schema
1. Stop the containers: `docker-compose down`
2. Remove volumes: `docker-compose down -v`
3. Update `init.sql` with your changes
4. Restart: `docker-compose up -d`

## Troubleshooting

### Port already in use
If you get a port conflict error, you can modify the ports in `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"  # Change 5432 to 5433
```

### Permission issues
On Windows, you might need to run Docker Desktop as administrator.

### Database connection issues
1. Check if containers are running: `docker-compose ps`
2. Check logs: `docker-compose logs postgres`
3. Verify network connectivity: `docker network ls`

## Next Steps

Once your database is running, you can:

1. Connect your application to the database using the connection details above
2. Use an ORM like Prisma, TypeORM, or Sequelize
3. Implement WebSocket connections for real-time messaging
4. Add authentication and authorization
5. Implement file upload functionality for media messages

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/refresh` - Refresh JWT token

### Users & Chats
- `GET /api/users` - List all users (public)
- `GET /api/chats` - List user's chats
- `GET /api/chats/:chatId` - Get chat details
- `POST /api/chats` - Create new chat
- `PUT /api/chats/:chatId` - Update chat
- `POST /api/chats/:chatId/participants` - Add participant
- `DELETE /api/chats/:chatId/participants/:userId` - Remove participant
- `POST /api/chats/:chatId/leave` - Leave chat

### Messages
- `GET /api/messages/chat/:chatId` - Get chat messages
- `POST /api/messages` - Send a message
- `PUT /api/messages/:messageId` - Edit message
- `DELETE /api/messages/:messageId` - Delete message
- `GET /api/messages/:messageId/status` - Get message status
- `POST /api/messages/:messageId/read` - Mark as read
- `GET /api/messages/search` - Search messages

### Admin (Admin only)
- `GET /api/admin/users` - List all users with pagination
- `GET /api/admin/users/:userId` - Get user details
- `PUT /api/admin/users/:userId` - Update user
- `DELETE /api/admin/users/:userId` - Delete user
- `POST /api/admin/users/:userId/ban` - Ban/unban user
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/logs` - System logs
- `GET /api/admin/dashboard` - Admin dashboard data

### Health & Cache
- `GET /health` - Check service status
- `GET /api/cache/:key` - Get cached value
- `POST /api/cache/:key` - Set cached value

## Security Notes

- Change default passwords in production
- Use environment variables for sensitive data
- Enable SSL for database connections in production
- Regularly backup your database
- Monitor database performance and logs 