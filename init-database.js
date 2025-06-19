
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

async function initializeDatabase() {
    const client = new MongoClient('mongodb://localhost:27017', {
        useUnifiedTopology: true,
        useNewUrlParser: true
    });

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('chatgpt_codes');

        // Create collections
        await db.createCollection('users');
        await db.createCollection('verification_codes');
        await db.createCollection('access_logs');
        await db.createCollection('admin_users');
        await db.createCollection('active_sessions');
        await db.createCollection('blocked_ips');
        await db.createCollection('settings');

        // Create indexes
        await db.collection('verification_codes').createIndex({ email: 1 });
        await db.collection('verification_codes').createIndex(
            { createdAt: 1 },
            { expireAfterSeconds: 600 }
        );
        await db.collection('users').createIndex(
            { email: 1 },
            { unique: true }
        );
        await db.collection('admin_users').createIndex(
            { username: 1 },
            { unique: true }
        );
        await db.collection('active_sessions').createIndex({ email: 1 });
        await db.collection('active_sessions').createIndex({ sessionId: 1 });
        await db.collection('active_sessions').createIndex(
            { lastActivity: 1 },
            { expireAfterSeconds: 86400 } // 24 hours
        );
        await db.collection('blocked_ips').createIndex(
            { address: 1 },
            { unique: true }
        );
        await db.collection('settings').createIndex(
            { key: 1 },
            { unique: true }
        );

        // Create default admin user
        const adminExists = await db.collection('admin_users').findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('Dev7766@#$', 10);
            await db.collection('admin_users').insertOne({
                username: 'admin',
                password: hashedPassword,
                isAdmin: true,
                createdAt: new Date(),
                lastLogin: null
            });
            console.log('✅ Default admin user created (username: admin, password: Dev7766@#$)');
        } else {
            console.log('✅ Admin user already exists');
        }

        // Create default global settings
        const globalSettingsExists = await db.collection('settings').findOne({ key: 'globalSessionSettings' });
        if (!globalSettingsExists) {
            await db.collection('settings').insertOne({
                key: 'globalSessionSettings',
                maxSessions: 3,
                sessionDuration: 5,
                createdAt: new Date()
            });
            console.log('✅ Default global session settings created');
        } else {
            console.log('✅ Global session settings already exist');
        }

        console.log('✅ Database initialized successfully');

    } catch (error) {
        console.error('❌ Database initialization error:', error);
    } finally {
        await client.close();
    }
}

if (require.main === module) {
    initializeDatabase();
}

module.exports = { initializeDatabase };
