
const { MongoClient } = require('mongodb');

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
