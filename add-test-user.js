const { MongoClient } = require('mongodb');

async function addTestUser() {
    const client = new MongoClient('mongodb://127.0.0.1:27017', {
        useUnifiedTopology: true,
        useNewUrlParser: true
    });

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');

        const db = client.db('chatgpt_codes');

        // Add test user
        await db.collection('users').updateOne(
            { email: 'test@example.com' },
            {
                $set: {
                    email: 'test@example.com',
                    createdAt: new Date(),
                    verified: false
                }
            },
            { upsert: true }
        );

        console.log('✅ Test user added: test@example.com');

    } catch (error) {
        console.error('❌ Error adding test user:', error);
    } finally {
        await client.close();
    }
}

addTestUser();
