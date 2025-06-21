const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🚀 MongoDB Auto-Installer');
console.log('========================');

const platform = os.platform();
const arch = os.arch();

console.log(`Platform: ${platform}`);
console.log(`Architecture: ${arch}`);

// Create data directory for MongoDB
const dataDir = path.join(__dirname, 'mongodb-data');
const logsDir = path.join(__dirname, 'mongodb-logs');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created MongoDB data directory');
}

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Created MongoDB logs directory');
}

// Create MongoDB configuration file
const mongoConfig = `
# MongoDB Configuration File
storage:
  dbPath: ${dataDir}
  journal:
    enabled: true

systemLog:
  destination: file
  path: ${path.join(logsDir, 'mongod.log')}
  logAppend: true

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  fork: false
`;

fs.writeFileSync(path.join(__dirname, 'mongod.conf'), mongoConfig);
console.log('✅ Created MongoDB configuration file');

// Create start script
const startScript = platform === 'win32' ? 
`@echo off
echo Starting MongoDB...
mongod --config mongod.conf
` : 
`#!/bin/bash
echo "Starting MongoDB..."
mongod --config mongod.conf
`;

const scriptName = platform === 'win32' ? 'start-mongodb.bat' : 'start-mongodb.sh';
fs.writeFileSync(path.join(__dirname, scriptName), startScript);

if (platform !== 'win32') {
  execSync(`chmod +x ${path.join(__dirname, scriptName)}`);
}

console.log(`✅ Created MongoDB start script: ${scriptName}`);

// Create database initialization script
const dbInitScript = `
const { MongoClient } = require('mongodb');

async function initializeDatabase() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('chatgpt_codes');
    
    // Create collections
    await db.createCollection('users');
    await db.createCollection('verification_codes');
    await db.createCollection('access_logs');
    
    console.log('✅ Database and collections created');
    
    // Create indexes
    await db.collection('verification_codes').createIndex({ email: 1 });
    await db.collection('verification_codes').createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 }); // 10 minutes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    console.log('✅ Database indexes created');
    
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

fs.writeFileSync(path.join(__dirname, 'init-database.js'), dbInitScript);
console.log('✅ Created database initialization script');

console.log('\n🎉 MongoDB setup complete!');
console.log('\nNext steps:');
console.log('1. Install MongoDB on your system if not already installed');
console.log('2. Run: npm install');
console.log(`3. Start MongoDB: ./${scriptName}`);
console.log('4. Initialize database: node init-database.js');
console.log('5. Start the application: npm start');

console.log('\nMongoDB Installation Instructions:');
console.log('- Ubuntu/Debian: sudo apt-get install mongodb');
console.log('- CentOS/RHEL: sudo yum install mongodb');
console.log('- macOS: brew install mongodb/brew/mongodb-community');
console.log('- Windows: Download from https://www.mongodb.com/try/download/community');
