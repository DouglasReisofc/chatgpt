const express = require('express');
const imaps = require('imap-simple');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const path = require('path');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');

const app = express();
app.set('trust proxy', true);
const port = process.env.PORT || 8000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// MongoDB connection
let db;
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'chatgpt_codes';

// Import database initialization
const { initializeDatabase } = require('./init-database');

// Connect to MongoDB with retry logic
async function connectToMongoDB() {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      console.log(`🔗 Attempting to connect to MongoDB (attempt ${retries + 1}/${maxRetries})...`);

      const client = new MongoClient(mongoUrl, {
        useUnifiedTopology: true,
        useNewUrlParser: true,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });

      await client.connect();
      db = client.db(dbName);
      console.log('✅ Connected to MongoDB successfully');

      // Initialize database collections and indexes
      await initializeDatabase();

      return;

    } catch (error) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries} failed:`, error.message);

      if (retries >= maxRetries) {
        console.error('❌ Failed to connect to MongoDB after multiple attempts');
        console.log('\n📋 Troubleshooting steps:');
        console.log('1. Make sure MongoDB is installed and added to your PATH');
        console.log('2. Run: start.bat (to start MongoDB and the application)');
        console.log('3. Or manually start MongoDB: mongod --config mongod.conf');
        console.log('4. Download MongoDB from: https://www.mongodb.com/try/download/community');
        process.exit(1);
      }

      console.log(`⏳ Retrying in 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Import routes
const authRoutes = require('./rotas/auth');
const adminRoutes = require('./rotas/admin');

// Use routes
app.use('/', authRoutes);

// Disable express-ejs-layouts for admin routes
app.use('/admin/*', (req, res, next) => {
  app.set('layout', '');
  next();
});

app.use('/admin', adminRoutes);

// Initialize MongoDB connection and start server
connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
