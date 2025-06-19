const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('🔍 Checking MongoDB installation...');

function checkMongoInstalled() {
    try {
        execSync('mongod --version', { stdio: 'pipe' });
        console.log('✅ MongoDB is installed and available in PATH');
        return true;
    } catch (error) {
        console.log('❌ MongoDB not found in PATH');
        return false;
    }
}

function checkMongoRunning() {
    try {
        const result = execSync('netstat -an | findstr "27017"', { stdio: 'pipe', encoding: 'utf8' });
        if (result.includes('27017')) {
            console.log('✅ MongoDB is running on port 27017');
            return true;
        }
    } catch (error) {
        // Command failed or no output
    }
    console.log('❌ MongoDB is not running on port 27017');
    return false;
}

function startMongoDB() {
    try {
        console.log('🚀 Starting MongoDB...');
        
        // Create directories if they don't exist
        if (!fs.existsSync('mongodb-data')) {
            fs.mkdirSync('mongodb-data', { recursive: true });
        }
        if (!fs.existsSync('mongodb-logs')) {
            fs.mkdirSync('mongodb-logs', { recursive: true });
        }
        
        // Start MongoDB in background
        const mongod = spawn('mongod', ['--config', 'mongod.conf'], {
            detached: true,
            stdio: 'ignore'
        });
        
        mongod.unref();
        
        // Wait a bit and check if it started
        setTimeout(() => {
            if (checkMongoRunning()) {
                console.log('✅ MongoDB started successfully');
            } else {
                console.log('❌ Failed to start MongoDB');
                console.log('Try running manually: mongod --config mongod.conf');
            }
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error starting MongoDB:', error.message);
        console.log('\n📋 Manual steps:');
        console.log('1. Open Command Prompt as Administrator');
        console.log('2. Run: mongod --config mongod.conf');
        console.log('3. Keep the window open and run: npm start');
    }
}

function showInstallInstructions() {
    console.log('\n📋 MongoDB Installation Instructions:');
    console.log('1. Download MongoDB Community Edition:');
    console.log('   https://www.mongodb.com/try/download/community');
    console.log('2. Run the installer and follow the setup wizard');
    console.log('3. During installation, check "Add MongoDB to PATH"');
    console.log('4. Or manually add to PATH: C:\\Program Files\\MongoDB\\Server\\[version]\\bin');
    console.log('5. Restart your command prompt');
    console.log('6. Run: npm install (to re-run this check)');
}

async function main() {
    const isInstalled = checkMongoInstalled();
    
    if (!isInstalled) {
        showInstallInstructions();
        return;
    }
    
    const isRunning = checkMongoRunning();
    
    if (!isRunning) {
        startMongoDB();
    }
}

if (require.main === module) {
    main();
}

module.exports = { checkMongoInstalled, checkMongoRunning, startMongoDB };
