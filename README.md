# WhatsApp Clone

A full-stack WhatsApp clone built with React, Node.js, PostgreSQL, and Redis.

## 🚀 **Auto-Deployment Enabled**

This project is configured for automatic deployment to Render when changes are pushed to the main branch.

## 🌟 Features

- **Real-time messaging** with WebSocket support
- **User authentication** with JWT tokens
- **Individual and group chats** 
- **Default avatars** with user initials in colored circles
- **Admin panel** for user and system management
- **PostgreSQL database** with comprehensive schema
- **Redis caching** for improved performance
- **Responsive design** with Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS for styling
- Context API for state management
- Axios for API communication

### Backend  
- Node.js with Express
- PostgreSQL for data persistence
- Redis for caching and sessions
- JWT for authentication
- Socket.io for real-time features

### Deployment
- Frontend: Render Static Site
- Backend: Render Web Service  
- Database: Render PostgreSQL
- Cache: Render Redis

## 🔐 Default Credentials

### Admin Access
- **Email**: kalel@whatsappclone.com
- **Password**: KalelKalel1!

### Sample Users
- **Email**: john@example.com, jane@example.com, bob@example.com
- **Password**: password123

## 🏃‍♂️ Local Development

### Prerequisites
- Node.js 16+
- Docker (for local database)
- Git

### Backend Setup
```bash
cd backend
npm install
npm run db:start    # Start PostgreSQL and Redis containers
npm run dev         # Start development server
```

### Frontend Setup
```bash
cd frontend  
npm install
npm run dev         # Start Vite development server
```

### Database Management
```bash
npm run db:deploy       # Deploy database schema and data
npm run db:backup       # Backup database
npm run db:deploy:verify # Verify deployment
```

## 📱 Features Overview

- ✅ User registration and authentication
- ✅ Profile management with default avatars  
- ✅ Individual messaging
- ✅ Group chat creation and management
- ✅ Real-time message delivery
- ✅ Online status indicators
- ✅ Admin panel with user management
- ✅ Responsive mobile-first design
- ✅ Automatic database deployment
- ✅ Production-ready deployment configuration

## 🚀 Deployment

The application is configured for automatic deployment to Render:

1. **Push to main branch** → Automatic deployment triggered
2. **Database migrations** run automatically during backend deployment  
3. **Environment variables** configured in Render dashboard
4. **Health checks** ensure successful deployment

## 📊 Project Structure

```
WhatsappClone/
├── frontend/          # React application
├── backend/           # Node.js API server
│   ├── src/          # Application source code
│   ├── migrations/   # Database migration scripts  
│   └── scripts/      # Deployment and utility scripts
└── public/           # Static admin panel assets
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Last Updated**: Auto-deployment configuration completed

## 🚀 Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **Context API** - State management

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and session management
- **Docker** - Containerization for databases

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)
- **Docker** and **Docker Compose**
- **Git**

## 🛠️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd WhatsappClone
```

### 2. Install Dependencies

**Backend Dependencies:**
```bash
cd backend
npm install
```

**Frontend Dependencies:**
```bash
cd ../frontend
npm install
```

### 3. Environment Configuration

**Backend Environment:**
```bash
cd ../backend
cp env.example .env
```

Edit the `.env` file with your configuration (database credentials, JWT secrets, etc.).

## 🚀 Running the Application

### Start the Application (3 Terminal Windows Required)

**Terminal 1 - Start Database Containers:**
```bash
cd backend
docker-compose up -d
```

**Terminal 2 - Start Backend Server:**
```bash
cd backend
npm run dev
```

**Terminal 3 - Start Frontend Server:**
```bash
cd frontend
npm run dev
```

### 🌐 Access Points

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin
- **Health Check**: http://localhost:3000/health

## 🔧 Available Scripts

### Backend
```bash
npm run dev          # Start development server
npm start           # Start production server
npm test            # Run tests
```

### Frontend
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
```

### Database Management
```bash
cd backend
./scripts/start-db.sh    # Start database containers
./scripts/stop-db.sh     # Stop database containers
./scripts/backup-db.sh   # Backup database
```

## 🐛 Common Issues & Troubleshooting

### Port Already in Use
If you encounter port conflicts:
- Frontend (5173): Change port in `frontend/vite.config.js`
- Backend (3000): Change port in `backend/src/index.js`

### Database Connection Issues
1. Ensure Docker containers are running:
   ```bash
   docker ps
   ```
2. Check container logs:
   ```bash
   docker-compose logs postgres
   docker-compose logs redis
   ```

### Redis Client Connection Errors
- Restart Redis container:
  ```bash
  docker-compose restart redis
  ```

### Package.json Not Found
- Always run `npm run dev` from the respective directory (`backend/` or `frontend/`), not from the root

## 🔍 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user profile

### Messages
- `GET /api/messages/:chatId` - Get messages for a chat
- `POST /api/messages` - Send a new message

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create new chat

## 🎯 Features

- ✅ Real-time messaging
- ✅ User authentication and authorization
- ✅ Profile picture uploads
- ✅ Chat creation and management
- ✅ Admin panel for user management
- ✅ Responsive design
- ✅ Media file sharing

## 🆘 Support

If you encounter any issues or have questions, please:
1. Check the troubleshooting section above
2. Ensure all prerequisites are installed
3. Verify that all servers are running properly
4. Check the console logs for error messages

---

**Note**: Make sure to start the database containers first, then the backend server, and finally the frontend server in that order for the best experience. 