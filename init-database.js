
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
        await db.createCollection('codes');
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
        await db.collection('codes').createIndex({ fetchedAt: 1 });
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

        // Create default session limit settings
        await db.collection('settings').updateOne(
            { key: 'sessionLimit' },
            {
                $setOnInsert: { createdAt: new Date() },
                $set: {
                    limitEnabled: true,
                    durationEnabled: true,
                    maxSessions: 3,
                    sessionDuration: 5
                }
            },
            { upsert: true }
        );
        console.log('✅ Session limit ensured');

        // Create default messages settings
        await db.collection('settings').updateOne(
            { key: 'messages' },
            {
                $setOnInsert: { createdAt: new Date() },
                $set: {
                    sessionLimitReached:
                        'Limite de sessões atingido. Faça logout em outro dispositivo.',
                    sessionExpired: 'Sessão expirada. Faça login novamente.',
                    invalidCode: 'Código inválido.',
                    ipBlocked:
                        'No momento nosso sistema enfrenta uma manutenção por favor tente novamente mais tarde'
                }
            },
            { upsert: true }
        );
        console.log('✅ System messages ensured');

        // Create default email configuration
        await db.collection('settings').updateOne(
            { key: 'emailConfig' },
            {
                $setOnInsert: { createdAt: new Date() },
                $set: {
                    smtp: {
                        host: 'smtp.gmail.com',
                        port: 465,
                        secure: true,
                        user: 'contactgestorvip@gmail.com',
                        pass: 'aoqmdezazknbbpg'
                    },
                    imap: {
                        host: 'imap.uhserver.com',
                        port: 993,
                        tls: true,
                        user: 'financeiro@clubevip.net',
                        pass: 'CYRSG6vT86ZVfe'
                    }
                }
            },
            { upsert: true }
        );
        console.log('✅ Email configuration ensured');

        await db.collection('settings').updateOne(
            { key: 'codeDisplayLimit' },
            {
                $setOnInsert: { createdAt: new Date() },
                $set: { limit: 5 }
            },
            { upsert: true }
        );
        console.log('✅ Code display limit ensured');


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
