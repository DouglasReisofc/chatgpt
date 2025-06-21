const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🚀 Automated Setup for ChatGPT Codes System');
console.log('==========================================');

// Setup local MongoDB automatically
async function setupLocalMongo() {
    try {
        const { setupLocalMongoDB } = require('./setup-local-mongodb');
        await setupLocalMongoDB();
        console.log('✅ Local MongoDB setup completed');
    } catch (error) {
        console.error('❌ Local MongoDB setup failed:', error.message);
        console.log('Will continue with manual MongoDB setup instructions...');
    }
}

// Run local MongoDB setup
setupLocalMongo();

const isWindows = os.platform() === 'win32';
const projectRoot = __dirname;

// Create necessary directories
const dirs = [
    path.join(projectRoot, 'mongodb-data'),
    path.join(projectRoot, 'mongodb-logs')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    }
});

// Create MongoDB configuration
const mongoConfig = `
storage:
  dbPath: ${path.join(projectRoot, 'mongodb-data').replace(/\\/g, '/')}
  journal:
    enabled: true

systemLog:
  destination: file
  path: ${path.join(projectRoot, 'mongodb-logs', 'mongod.log').replace(/\\/g, '/')}
  logAppend: true

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  fork: false
`;

fs.writeFileSync(path.join(projectRoot, 'mongod.conf'), mongoConfig);
console.log('✅ Created MongoDB configuration');

// Create Windows start script
const startBat = `
@echo off
echo Starting MongoDB...
echo Please wait, this may take a few moments...

REM Check if MongoDB is already running
netstat -an | findstr "27017" > nul
IF %ERRORLEVEL% EQU 0 (
    echo MongoDB is already running on port 27017
) ELSE (
    start "MongoDB" /B mongod --config "%~dp0mongod.conf"
    echo Started MongoDB server
    timeout /t 5 /nobreak > nul
)

REM Start the Node.js application
echo Starting Node.js application...
npm start
`;

fs.writeFileSync(path.join(projectRoot, 'start.bat'), startBat);
console.log('✅ Created Windows start script');

// Update package.json scripts
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = require(packageJsonPath);

packageJson.scripts = {
    ...packageJson.scripts,
    "postinstall": "node install.js",
    "start": isWindows ? "start.bat" : "bash start-mongodb.sh && node index.js",
    "dev": isWindows ? "nodemon index.js" : "nodemon index.js"
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json scripts');

// Create database initialization script
const initDbScript = `
const { MongoClient } = require('mongodb');

async function initializeDatabase() {
    const client = new MongoClient('mongodb://127.0.0.1:27017', {
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
        await db.createCollection('codes');
        
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
        await db.collection('codes').createIndex(
            { email: 1, code: 1 },
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
`;

fs.writeFileSync(path.join(projectRoot, 'init-database.js'), initDbScript);
console.log('✅ Created database initialization script');

// Installation instructions
console.log('\n📋 Installation Steps:');
console.log('1. Download and install MongoDB Community Edition from:');
console.log('   https://www.mongodb.com/try/download/community');
console.log('2. Add MongoDB bin directory to your system PATH:');
console.log('   Usually: C:\\Program Files\\MongoDB\\Server\\[version]\\bin');
console.log('\n🎉 Setup complete! To start the application:');
console.log('1. Run: npm install');
console.log('2. Run: npm start');
