-- WhatsApp Clone - Production Deployment Script
-- This script runs all migrations in the correct order for production deployment

\echo 'Starting WhatsApp Clone database deployment...'

-- Create a migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Check if migration 001 has been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001_create_initial_schema') THEN
        \echo 'Applying migration 001: Creating initial schema...'
        
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone_number VARCHAR(20) UNIQUE,
            full_name VARCHAR(100) NOT NULL,
            profile_picture_url TEXT,
            bio TEXT,
            status_message TEXT DEFAULT 'Hey there! I am using WhatsApp Clone',
            password_hash VARCHAR(255) NOT NULL,
            is_online BOOLEAN DEFAULT FALSE,
            is_admin BOOLEAN DEFAULT FALSE,
            is_banned BOOLEAN DEFAULT FALSE,
            banned_reason TEXT,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Chats table (for individual and group chats)
        CREATE TABLE IF NOT EXISTS chats (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(100), -- For group chats
            is_group BOOLEAN DEFAULT FALSE,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Chat participants (for both individual and group chats)
        CREATE TABLE IF NOT EXISTS chat_participants (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN DEFAULT FALSE, -- For group chats
            UNIQUE(chat_id, user_id)
        );

        -- Messages table
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
            sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, file
            media_url TEXT,
            reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
            is_edited BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Message status (delivered, read, etc.)
        CREATE TABLE IF NOT EXISTS message_status (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(message_id, user_id)
        );

        -- User contacts
        CREATE TABLE IF NOT EXISTS contacts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            contact_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            contact_name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, contact_user_id)
        );

        -- User sessions (for authentication)
        CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            session_token VARCHAR(255) UNIQUE NOT NULL,
            device_info TEXT,
            ip_address INET,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
        CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online);
        CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin);

        CREATE INDEX IF NOT EXISTS idx_chats_created_by ON chats(created_by);
        CREATE INDEX IF NOT EXISTS idx_chats_is_group ON chats(is_group);
        CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at);

        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

        CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_participants_admin ON chat_participants(is_admin);

        CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id);
        CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);
        CREATE INDEX IF NOT EXISTS idx_message_status_status ON message_status(status);

        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_contact_user_id ON contacts(contact_user_id);

        CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

        -- Create function to update updated_at timestamp
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $func$ language 'plpgsql';

        -- Create triggers to automatically update updated_at
        DROP TRIGGER IF EXISTS update_users_updated_at ON users;
        CREATE TRIGGER update_users_updated_at 
            BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;
        CREATE TRIGGER update_chats_updated_at 
            BEFORE UPDATE ON chats
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
        CREATE TRIGGER update_messages_updated_at 
            BEFORE UPDATE ON messages
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

        -- Create a view for chat list with latest message
        CREATE OR REPLACE VIEW chat_list_view AS
        SELECT 
            c.id,
            c.name,
            c.is_group,
            c.created_by,
            c.created_at,
            c.updated_at,
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
                FROM chat_participants cp 
                WHERE cp.chat_id = c.id
            ) as participant_count
        FROM chats c;

        -- Create a view for user profiles (excluding sensitive data)
        CREATE OR REPLACE VIEW user_profiles_view AS
        SELECT 
            id,
            username,
            email,
            full_name,
            bio,
            profile_picture_url,
            status_message,
            is_online,
            last_seen,
            created_at
        FROM users
        WHERE is_banned = FALSE;

        -- Record migration
        INSERT INTO schema_migrations (version) VALUES ('001_create_initial_schema');
        
        \echo 'Migration 001 completed successfully.'
    ELSE
        \echo 'Migration 001 already applied, skipping.'
    END IF;
END
$$;

-- Check if migration 002 has been applied
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '002_seed_initial_data') THEN
        \echo 'Applying migration 002: Seeding initial data...'
        
        -- Admin user creation
        -- Password: KalelKalel1! (hashed with bcrypt)
        INSERT INTO users (
            username, 
            email, 
            phone_number, 
            full_name, 
            bio,
            status_message, 
            password_hash, 
            is_admin
        ) VALUES (
            'kalel', 
            'kalel@whatsappclone.com', 
            '+1234567899', 
            'Kalel', 
            'Admin of WhatsApp Clone - Managing the system with care',
            'Available for support',
            '$2a$12$BL.TO6XxyuEajGZn59bkUe7X5rkeAJX5TQtrm7ycVqry5ts2jk8KS', 
            true
        ) ON CONFLICT (email) DO UPDATE SET
            username = EXCLUDED.username,
            phone_number = EXCLUDED.phone_number,
            full_name = EXCLUDED.full_name,
            bio = EXCLUDED.bio,
            status_message = EXCLUDED.status_message,
            password_hash = EXCLUDED.password_hash,
            is_admin = EXCLUDED.is_admin,
            updated_at = CURRENT_TIMESTAMP;

        -- Sample users for testing (password: password123)
        INSERT INTO users (
            username, 
            email, 
            phone_number, 
            full_name, 
            bio,
            status_message, 
            password_hash, 
            is_admin
        ) VALUES 
        (
            'john_doe', 
            'john@example.com', 
            '+1234567890', 
            'John Doe', 
            'Software developer who loves coding and coffee ☕',
            'Hey there! I am using WhatsApp Clone', 
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8O', 
            false
        ),
        (
            'jane_smith', 
            'jane@example.com', 
            '+1234567891', 
            'Jane Smith', 
            'Design enthusiast and creative professional 🎨',
            'Available', 
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8O', 
            false
        ),
        (
            'bob_wilson', 
            'bob@example.com', 
            '+1234567892', 
            'Bob Wilson', 
            'Project manager with a passion for team collaboration 🚀',
            'At work', 
            '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8O', 
            false
        )
        ON CONFLICT (email) DO UPDATE SET
            username = EXCLUDED.username,
            phone_number = EXCLUDED.phone_number,
            full_name = EXCLUDED.full_name,
            bio = EXCLUDED.bio,
            status_message = EXCLUDED.status_message,
            password_hash = EXCLUDED.password_hash,
            updated_at = CURRENT_TIMESTAMP;

        -- Record migration
        INSERT INTO schema_migrations (version) VALUES ('002_seed_initial_data');
        
        \echo 'Migration 002 completed successfully.'
    ELSE
        \echo 'Migration 002 already applied, skipping.'
    END IF;
END
$$;

-- Create sample data only if no chats exist yet
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM chats LIMIT 1) THEN
        \echo 'Creating sample chats and messages...'
        
        -- Create a sample chat between John and Jane
        INSERT INTO chats (name, is_group, created_by) 
        SELECT 'John & Jane', FALSE, u.id
        FROM users u 
        WHERE u.username = 'john_doe';

        -- Add participants to the sample chat
        INSERT INTO chat_participants (chat_id, user_id) 
        SELECT c.id, u.id
        FROM chats c, users u
        WHERE c.name = 'John & Jane' 
            AND u.username IN ('john_doe', 'jane_smith');

        -- Add some sample messages
        INSERT INTO messages (chat_id, sender_id, content) 
        SELECT 
            c.id, 
            u.id, 
            msg.content
        FROM chats c
        CROSS JOIN (
            SELECT 'john_doe' as username, 'Hey Jane! How are you?' as content, 1 as order_num
            UNION ALL
            SELECT 'jane_smith' as username, 'Hi John! I am doing great, thanks!' as content, 2 as order_num
            UNION ALL
            SELECT 'john_doe' as username, 'That is awesome! Want to grab coffee later?' as content, 3 as order_num
            UNION ALL
            SELECT 'jane_smith' as username, 'Sure! How about 3 PM at the usual place?' as content, 4 as order_num
            UNION ALL
            SELECT 'john_doe' as username, 'Perfect! See you there 😊' as content, 5 as order_num
        ) msg
        JOIN users u ON u.username = msg.username
        WHERE c.name = 'John & Jane'
        ORDER BY msg.order_num;

        -- Create a sample group chat
        INSERT INTO chats (name, is_group, created_by) 
        SELECT 'Team Chat', TRUE, u.id
        FROM users u 
        WHERE u.username = 'kalel';

        -- Add all users to the group chat
        INSERT INTO chat_participants (chat_id, user_id, is_admin) 
        SELECT 
            c.id, 
            u.id,
            CASE WHEN u.username = 'kalel' THEN true ELSE false END
        FROM chats c
        CROSS JOIN users u
        WHERE c.name = 'Team Chat' 
            AND u.username IN ('kalel', 'john_doe', 'jane_smith', 'bob_wilson');

        -- Add some group chat messages
        INSERT INTO messages (chat_id, sender_id, content) 
        SELECT 
            c.id, 
            u.id, 
            msg.content
        FROM chats c
        CROSS JOIN (
            SELECT 'kalel' as username, 'Welcome to the team chat everyone!' as content, 1 as order_num
            UNION ALL
            SELECT 'john_doe' as username, 'Thanks for setting this up!' as content, 2 as order_num
            UNION ALL
            SELECT 'jane_smith' as username, 'Great to have a group chat for coordination' as content, 3 as order_num
            UNION ALL
            SELECT 'bob_wilson' as username, 'This will definitely help with project management' as content, 4 as order_num
            UNION ALL
            SELECT 'kalel' as username, 'Feel free to use this for any team discussions or updates' as content, 5 as order_num
        ) msg
        JOIN users u ON u.username = msg.username
        WHERE c.name = 'Team Chat'
        ORDER BY msg.order_num;

        -- Set some users as online for demo purposes
        UPDATE users 
        SET is_online = true, last_seen = CURRENT_TIMESTAMP 
        WHERE username IN ('john_doe', 'jane_smith', 'kalel');

        UPDATE users 
        SET is_online = false, last_seen = CURRENT_TIMESTAMP - INTERVAL '15 minutes' 
        WHERE username = 'bob_wilson';
        
        \echo 'Sample data created successfully.'
    ELSE
        \echo 'Sample data already exists, skipping creation.'
    END IF;
END
$$;

-- Final verification
DO $$
DECLARE
    user_count INTEGER;
    chat_count INTEGER;
    message_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO chat_count FROM chats;
    SELECT COUNT(*) INTO message_count FROM messages;
    
    \echo 'Database deployment completed successfully!'
    \echo 'Summary:'
    RAISE NOTICE 'Users created: %', user_count;
    RAISE NOTICE 'Chats created: %', chat_count;
    RAISE NOTICE 'Messages created: %', message_count;
    
    -- Verify admin user exists
    IF EXISTS (SELECT 1 FROM users WHERE is_admin = true AND email = 'kalel@whatsappclone.com') THEN
        \echo 'Admin user verified: ✓'
    ELSE
        RAISE EXCEPTION 'Admin user creation failed!';
    END IF;
END
$$; 