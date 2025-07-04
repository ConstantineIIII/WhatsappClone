#!/usr/bin/env node

/**
 * WhatsApp Clone Database Deployment Script (Node.js)
 * This script handles database setup and migration for production deployment
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Utility functions for colored output
const print = {
    status: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// Check if required environment variables are set
function checkEnvVars() {
    const requiredVars = ['DATABASE_URL'];
    
    for (const varName of requiredVars) {
        if (!process.env[varName]) {
            print.error(`Environment variable ${varName} is not set`);
            process.exit(1);
        }
    }
}

// Test database connection
async function testDbConnection() {
    print.status('Testing database connection...');
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        print.success('Database connection established');
        return true;
    } catch (error) {
        print.error(`Cannot connect to database: ${error.message}`);
        return false;
    }
}

// Run database migrations
async function runMigrations() {
    print.status('Running database migrations...');
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        
        // Read and execute the deployment script
        const deployScript = fs.readFileSync(
            path.join(__dirname, '../migrations/deploy.sql'),
            'utf8'
        );
        
        await client.query(deployScript);
        await client.end();
        
        print.success('Database migrations completed successfully');
        return true;
    } catch (error) {
        print.error(`Database migrations failed: ${error.message}`);
        return false;
    }
}

// Verify database deployment
async function verifyDeployment() {
    print.status('Verifying database deployment...');
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        
        // Check if schema_migrations table exists
        try {
            await client.query('SELECT COUNT(*) FROM schema_migrations');
        } catch (error) {
            print.error('Schema migrations table not found');
            return false;
        }
        
        // Check if admin user exists
        const adminResult = await client.query(
            "SELECT COUNT(*) FROM users WHERE is_admin = true AND email = 'kalel@whatsappclone.com'"
        );
        
        if (parseInt(adminResult.rows[0].count) === 0) {
            print.error('Admin user not found');
            return false;
        }
        
        // Check if all required tables exist
        const tables = ['users', 'chats', 'messages', 'chat_participants', 'message_status', 'contacts', 'user_sessions'];
        
        for (const table of tables) {
            try {
                await client.query(`SELECT COUNT(*) FROM ${table}`);
            } catch (error) {
                print.error(`Table ${table} not found`);
                return false;
            }
        }
        
        await client.end();
        print.success('Database verification completed');
        return true;
    } catch (error) {
        print.error(`Database verification failed: ${error.message}`);
        return false;
    }
}

// Show deployment summary
async function showSummary() {
    print.status('Deployment Summary:');
    console.log('====================');
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        
        // Get counts
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const chatCount = await client.query('SELECT COUNT(*) FROM chats');
        const messageCount = await client.query('SELECT COUNT(*) FROM messages');
        const migrationCount = await client.query('SELECT COUNT(*) FROM schema_migrations');
        
        console.log(`Users: ${userCount.rows[0].count}`);
        console.log(`Chats: ${chatCount.rows[0].count}`);
        console.log(`Messages: ${messageCount.rows[0].count}`);
        console.log(`Migrations applied: ${migrationCount.rows[0].count}`);
        console.log('====================');
        
        await client.end();
        print.success('Database ready for production!');
    } catch (error) {
        print.error(`Failed to get deployment summary: ${error.message}`);
    }
}

// Check if database is already deployed
async function isAlreadyDeployed() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    try {
        await client.connect();
        await client.query('SELECT 1 FROM schema_migrations LIMIT 1');
        await client.end();
        return true;
    } catch (error) {
        return false;
    }
}

// Show help
function showHelp() {
    console.log('WhatsApp Clone Database Deployment Script (Node.js)');
    console.log('');
    console.log('Usage: node deploy-database.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  -h, --help       Show this help message');
    console.log('  -t, --test-only  Only test database connection');
    console.log('  -v, --verify     Only verify existing deployment');
    console.log('  -f, --force      Force deployment even if tables exist');
    console.log('');
    console.log('Environment Variables:');
    console.log('  DATABASE_URL     PostgreSQL connection string (required)');
    console.log('');
    console.log('Examples:');
    console.log('  node deploy-database.js                    # Full deployment');
    console.log('  node deploy-database.js --test-only        # Test connection only');
    console.log('  node deploy-database.js --verify           # Verify deployment only');
    console.log('  DATABASE_URL=postgres://... node deploy-database.js  # With custom database URL');
}

// Main execution function
async function main() {
    const args = process.argv.slice(2);
    
    // Parse command line arguments
    const options = {
        testOnly: args.includes('-t') || args.includes('--test-only'),
        verifyOnly: args.includes('-v') || args.includes('--verify'),
        forceDeploy: args.includes('-f') || args.includes('--force'),
        help: args.includes('-h') || args.includes('--help')
    };
    
    // Show help if requested
    if (options.help) {
        showHelp();
        return;
    }
    
    print.status('Starting WhatsApp Clone Database Deployment');
    print.status('===========================================');
    
    // Check environment variables
    checkEnvVars();
    
    // Test database connection
    if (!await testDbConnection()) {
        print.error('Database connection failed. Please check your DATABASE_URL.');
        process.exit(1);
    }
    
    // If test-only mode, exit here
    if (options.testOnly) {
        print.success('Database connection test completed successfully');
        return;
    }
    
    // If verify-only mode, skip migrations
    if (options.verifyOnly) {
        const isValid = await verifyDeployment();
        process.exit(isValid ? 0 : 1);
    }
    
    // Check if database is already deployed (unless force deploy)
    if (!options.forceDeploy) {
        if (await isAlreadyDeployed()) {
            print.warning('Database appears to be already deployed');
            print.status('Use --force to redeploy or --verify to check deployment');
            return;
        }
    }
    
    // Run migrations
    if (!await runMigrations()) {
        print.error('Database deployment failed');
        process.exit(1);
    }
    
    // Verify deployment
    if (!await verifyDeployment()) {
        print.error('Database verification failed');
        process.exit(1);
    }
    
    // Show summary
    await showSummary();
    
    print.success('Database deployment completed successfully!');
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    print.error(`Uncaught exception: ${error.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    print.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

// Run the main function
if (require.main === module) {
    main().catch((error) => {
        print.error(`Deployment failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { main }; 