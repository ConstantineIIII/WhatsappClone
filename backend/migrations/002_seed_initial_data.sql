-- WhatsApp Clone - Initial Data Seeding
-- Migration: 002_seed_initial_data.sql
-- Description: Seeds the database with initial admin user and sample data

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

-- Create a sample chat between John and Jane
INSERT INTO chats (name, is_group, created_by) 
SELECT 'John & Jane', FALSE, u.id
FROM users u 
WHERE u.username = 'john_doe'
ON CONFLICT DO NOTHING;

-- Add participants to the sample chat
INSERT INTO chat_participants (chat_id, user_id) 
SELECT c.id, u.id
FROM chats c, users u
WHERE c.name = 'John & Jane' 
    AND u.username IN ('john_doe', 'jane_smith')
ON CONFLICT (chat_id, user_id) DO NOTHING;

-- Add some sample messages
INSERT INTO messages (chat_id, sender_id, content) 
SELECT 
    c.id, 
    u.id, 
    msg.content
FROM chats c
CROSS JOIN (
    SELECT 'john_doe' as username, 'Hey Jane! How are you?' as content
    UNION ALL
    SELECT 'jane_smith' as username, 'Hi John! I am doing great, thanks!' as content
    UNION ALL
    SELECT 'john_doe' as username, 'That is awesome! Want to grab coffee later?' as content
    UNION ALL
    SELECT 'jane_smith' as username, 'Sure! How about 3 PM at the usual place?' as content
    UNION ALL
    SELECT 'john_doe' as username, 'Perfect! See you there 😊' as content
) msg
JOIN users u ON u.username = msg.username
WHERE c.name = 'John & Jane'
ORDER BY msg.content;

-- Create a sample group chat
INSERT INTO chats (name, is_group, created_by) 
SELECT 'Team Chat', TRUE, u.id
FROM users u 
WHERE u.username = 'kalel'
ON CONFLICT DO NOTHING;

-- Add all users to the group chat
INSERT INTO chat_participants (chat_id, user_id, is_admin) 
SELECT 
    c.id, 
    u.id,
    CASE WHEN u.username = 'kalel' THEN true ELSE false END
FROM chats c
CROSS JOIN users u
WHERE c.name = 'Team Chat' 
    AND u.username IN ('kalel', 'john_doe', 'jane_smith', 'bob_wilson')
ON CONFLICT (chat_id, user_id) DO NOTHING;

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

-- Update chat updated_at timestamps to reflect recent activity
UPDATE chats 
SET updated_at = CURRENT_TIMESTAMP - INTERVAL '1 hour' 
WHERE name = 'John & Jane';

UPDATE chats 
SET updated_at = CURRENT_TIMESTAMP - INTERVAL '30 minutes' 
WHERE name = 'Team Chat';

-- Add some contacts between users
INSERT INTO contacts (user_id, contact_user_id, contact_name)
SELECT 
    u1.id, 
    u2.id, 
    u2.full_name
FROM users u1
CROSS JOIN users u2
WHERE u1.username = 'john_doe' 
    AND u2.username IN ('jane_smith', 'bob_wilson', 'kalel')
UNION ALL
SELECT 
    u1.id, 
    u2.id, 
    u2.full_name
FROM users u1
CROSS JOIN users u2
WHERE u1.username = 'jane_smith' 
    AND u2.username IN ('john_doe', 'bob_wilson', 'kalel')
UNION ALL
SELECT 
    u1.id, 
    u2.id, 
    u2.full_name
FROM users u1
CROSS JOIN users u2
WHERE u1.username = 'bob_wilson' 
    AND u2.username IN ('john_doe', 'jane_smith', 'kalel')
ON CONFLICT (user_id, contact_user_id) DO NOTHING;

-- Set some users as online for demo purposes
UPDATE users 
SET is_online = true, last_seen = CURRENT_TIMESTAMP 
WHERE username IN ('john_doe', 'jane_smith');

-- Set others as recently seen
UPDATE users 
SET is_online = false, last_seen = CURRENT_TIMESTAMP - INTERVAL '15 minutes' 
WHERE username = 'bob_wilson';

UPDATE users 
SET is_online = true, last_seen = CURRENT_TIMESTAMP 
WHERE username = 'kalel';

COMMENT ON MIGRATION IS 'Initial data seeding with admin user and sample data for testing'; 