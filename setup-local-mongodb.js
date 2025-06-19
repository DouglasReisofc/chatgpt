const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync, spawn } = require('child_process');
const os = require('os');
const AdmZip = require('adm-zip');

console.log('🚀 Setting up Local MongoDB for Node.js');
console.log('=====================================');

const platform = os.platform();
const arch = os.arch();
const projectRoot = __dirname;
const mongoDir = path.join(projectRoot, 'mongodb-local');
const mongoDataDir = path.join(projectRoot, 'mongodb-data');
const mongoLogsDir = path.join(projectRoot, 'mongodb-logs');

// MongoDB download URLs for different platforms
const mongoUrls = {
    'win32-x64': 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.4.zip',
    'win32-ia32': 'https://fastdl.mongodb.org/windows/mongodb-windows-i686-7.0.4.zip',
    'darwin-x64': 'https://fastdl.mongodb.org/osx/mongodb-macos-x86_64-7.0.4.tgz',
    'darwin-arm64': 'https://fastdl.mongodb.org/osx/mongodb-macos-arm64-7.0.4.tgz',
    'linux-x64': 'https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.4.tgz'
};

function getPlatformKey() {
    const key = `${platform}-${arch}`;
    if (mongoUrls[key]) {
        return key;
    }
    // Fallback for common cases
    if (platform === 'win32') return 'win32-x64';
    if (platform === 'darwin') return 'darwin-x64';
    if (platform === 'linux') return 'linux-x64';
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading MongoDB from ${url}...`);
        const file = fs.createWriteStream(dest);

        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }

            const totalSize = parseInt(response.headers['content-length'], 10);
            let downloadedSize = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
                process.stdout.write(`\r📥 Downloading... ${percent}%`);
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n✅ Download completed');
                resolve();
            });

            file.on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        }).on('error', reject);
    });
}

function extractArchive(archivePath, extractDir) {
    console.log('📦 Extracting MongoDB...');

    if (archivePath.endsWith('.zip')) {
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(extractDir, true);
    } else if (archivePath.endsWith('.tgz') || archivePath.endsWith('.tar.gz')) {
        execSync(`tar -xzf "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
    }

    console.log('✅ Extraction completed');
}

function findMongodPath() {
    const possiblePaths = [
        path.join(mongoDir, 'bin', 'mongod.exe'),
        path.join(mongoDir, 'bin', 'mongod'),
    ];

    // Look for mongod in subdirectories
    if (fs.existsSync(mongoDir)) {
        const subdirs = fs.readdirSync(mongoDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const subdir of subdirs) {
            possiblePaths.push(
                path.join(mongoDir, subdir, 'bin', 'mongod.exe'),
                path.join(mongoDir, subdir, 'bin', 'mongod')
            );
        }
    }

    for (const mongodPath of possiblePaths) {
        if (fs.existsSync(mongodPath)) {
            return mongodPath;
        }
    }

    return null;
}

async function setupLocalMongoDB() {
    try {
        // Create directories
        [mongoDir, mongoDataDir, mongoLogsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`✅ Created directory: ${dir}`);
            }
        });

        // Check if MongoDB is already installed locally
        let mongodPath = findMongodPath();

        if (!mongodPath) {
            console.log('📥 MongoDB not found locally, downloading...');

            const platformKey = getPlatformKey();
            const mongoUrl = mongoUrls[platformKey];
            const fileName = path.basename(mongoUrl);
            const downloadPath = path.join(projectRoot, fileName);

            // Download MongoDB
            await downloadFile(mongoUrl, downloadPath);

            // Extract MongoDB
            extractArchive(downloadPath, mongoDir);

            // Clean up download file
            fs.unlinkSync(downloadPath);

            // Find mongod path after extraction
            mongodPath = findMongodPath();

            if (!mongodPath) {
                throw new Error('Could not find mongod executable after extraction');
            }
        }

        console.log(`✅ MongoDB found at: ${mongodPath}`);

        // Create local MongoDB configuration
        const localMongoConfig = `
storage:
  dbPath: ${mongoDataDir.replace(/\\/g, '/')}
  journal:
    enabled: true

systemLog:
  destination: file
  path: ${path.join(mongoLogsDir, 'mongod.log').replace(/\\/g, '/')}
  logAppend: true

net:
  port: 27017
  bindIp: 127.0.0.1

processManagement:
  fork: false
`;

        fs.writeFileSync(path.join(projectRoot, 'mongod-local.conf'), localMongoConfig);
        console.log('✅ Created local MongoDB configuration');

        // Create start script for local MongoDB
        const startLocalScript = platform === 'win32' ? `
@echo off
echo Starting Local MongoDB...
"${mongodPath}" --config "%~dp0mongod-local.conf"
` : `
#!/bin/bash
echo "Starting Local MongoDB..."
"${mongodPath}" --config "$(dirname "$0")/mongod-local.conf"
`;

        const scriptName = platform === 'win32' ? 'start-local-mongodb.bat' : 'start-local-mongodb.sh';
        const scriptPath = path.join(projectRoot, scriptName);
        fs.writeFileSync(scriptPath, startLocalScript);

        if (platform !== 'win32') {
            execSync(`chmod +x "${scriptPath}"`);
        }

        console.log(`✅ Created local MongoDB start script: ${scriptName}`);

        return { mongodPath, scriptPath };

    } catch (error) {
        console.error('❌ Error setting up local MongoDB:', error.message);
        throw error;
    }
}

if (require.main === module) {
    setupLocalMongoDB().then(() => {
        console.log('\n🎉 Local MongoDB setup completed!');
        console.log('You can now start the application with: npm start');
    }).catch(error => {
        console.error('Setup failed:', error.message);
        process.exit(1);
    });
}

module.exports = { setupLocalMongoDB, findMongodPath };
