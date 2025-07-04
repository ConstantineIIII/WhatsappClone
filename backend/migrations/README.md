# Database Migration System

This directory contains the database migration system for the WhatsApp Clone application, designed for production deployment.

## Files Overview

### Migration Files
- `001_create_initial_schema.sql` - Initial database schema creation
- `002_seed_initial_data.sql` - Initial data seeding (admin user and sample data)
- `deploy.sql` - Master deployment script that runs all migrations

### Deployment Scripts
- `../scripts/deploy-database.js` - Node.js deployment script
- `../scripts/deploy-database.sh` - Bash deployment script

## Usage

### For Production Deployment (Recommended)

Use the Node.js deployment script for production:

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run deployment
npm run db:deploy

# Or run directly
node scripts/deploy-database.js
```

### For Local Development

```bash
# Start local database
npm run db:start

# Deploy to local database
DATABASE_URL="postgresql://whatsapp_user:whatsapp_password@localhost:5432/whatsapp_clone" npm run db:deploy
```

### Script Options

```bash
# Test database connection only
npm run db:deploy:test

# Verify existing deployment
npm run db:deploy:verify

# Force deployment (even if already deployed)
node scripts/deploy-database.js --force

# Show help
node scripts/deploy-database.js --help
```

## Migration System Features

### Smart Deployment
- **Idempotent**: Safe to run multiple times
- **Migration tracking**: Uses `schema_migrations` table
- **Rollback protection**: Won't overwrite existing data
- **Verification**: Automatic deployment verification

### Database Schema
The deployment creates the following tables:
- `users` - User accounts and profiles
- `chats` - Individual and group conversations
- `messages` - All chat messages
- `chat_participants` - Users in each chat
- `message_status` - Message delivery/read status
- `contacts` - User contact lists
- `user_sessions` - Authentication sessions
- `schema_migrations` - Migration tracking

### Performance Optimizations
- **Indexes**: Comprehensive indexing for all common queries
- **Triggers**: Automatic `updated_at` timestamp updates
- **Views**: Optimized views for common data access patterns
- **Constraints**: Foreign key constraints for data integrity

## Default Data

The deployment includes:

### Admin User
- **Email**: `kalel@whatsappclone.com`
- **Password**: `KalelKalel1!`
- **Role**: Admin
- **Bio**: "Admin of WhatsApp Clone - Managing the system with care"

### Sample Users (for testing)
- **John Doe** (`john@example.com`) - Password: `password123`
- **Jane Smith** (`jane@example.com`) - Password: `password123`
- **Bob Wilson** (`bob@example.com`) - Password: `password123`

### Sample Data
- Two sample chats with messages
- Contact relationships between users
- Online status simulation

## Environment Variables

Required environment variables:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

Optional environment variables:

```bash
NODE_ENV=production  # Enables SSL for database connections
```

## Render Deployment

For Render deployment, add this to your build command:

```bash
npm run db:deploy
```

Or use the raw command:

```bash
node scripts/deploy-database.js
```

Make sure to set the `DATABASE_URL` environment variable in your Render service settings.

## Troubleshooting

### Connection Issues
```bash
# Test connection
npm run db:deploy:test

# Check logs
node scripts/deploy-database.js --test-only
```

### Migration Issues
```bash
# Verify deployment
npm run db:deploy:verify

# Check specific tables
psql $DATABASE_URL -c "SELECT * FROM schema_migrations;"
```

### Force Redeploy
```bash
# If needed, force redeploy
node scripts/deploy-database.js --force
```

## Manual Migration

If you need to run migrations manually:

```sql
-- Connect to your database
psql $DATABASE_URL

-- Run the deployment script
\i migrations/deploy.sql

-- Verify
SELECT * FROM schema_migrations;
SELECT COUNT(*) FROM users;
```

## Development

To add new migrations:

1. Create a new migration file: `003_your_migration.sql`
2. Add it to the `deploy.sql` script
3. Test locally
4. Deploy to production

## Schema Views

The system creates helpful views:

### `chat_list_view`
Optimized view for displaying chat lists with last messages.

### `user_profiles_view`
Public user profiles excluding sensitive data.

## Database Backup

Before major deployments:

```bash
# Backup database
npm run db:backup

# Or manually
pg_dump $DATABASE_URL > backup.sql
```

## Security Notes

- All passwords are hashed with bcrypt
- Database connections use SSL in production
- Admin user has secure default password
- Sample data is clearly marked for testing only

## Support

For issues with database deployment:

1. Check the deployment logs
2. Verify environment variables
3. Test database connectivity
4. Review migration files for syntax errors
5. Check database permissions

The deployment system is designed to be robust and provide clear error messages for troubleshooting. 