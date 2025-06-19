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

// Import routes
const authRoutes = require('./rotas/auth');
const codesRoutes = require('./rotas/codes');

// Use routes
app.use('/', authRoutes);
app.use('/codes', codesRoutes);

// MongoDB connection
let db;
const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'chatgpt_codes';

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(mongoUrl, { 
      useUnifiedTopology: true,
      useNewUrlParser: true 
    });
    await client.connect();
    db = client.db(dbName);
    console.log('✅ Connected to MongoDB');
    
    // Ensure collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes('verification_codes')) {
      await db.createCollection('verification_codes');
      await db.collection('verification_codes').createIndex({ email: 1 });
      await db.collection('verification_codes').createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
    }
    
    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
    }
    
    if (!collectionNames.includes('access_logs')) {
      await db.createCollection('access_logs');
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('Please make sure MongoDB is running on localhost:27017');
    process.exit(1);
  }
}

// Make db available to routes
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Initialize MongoDB connection and start server
connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
