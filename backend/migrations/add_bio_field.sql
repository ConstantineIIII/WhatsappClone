-- Add bio field to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Update existing users with sample bios
UPDATE users SET bio = 'Admin of WhatsApp Clone' WHERE username = 'kalel';
UPDATE users SET bio = 'Software developer who loves coding and coffee' WHERE username = 'john_doe';
UPDATE users SET bio = 'Design enthusiast and creative professional' WHERE username = 'jane_smith';
UPDATE users SET bio = 'Project manager with a passion for team collaboration' WHERE username = 'bob_wilson'; 