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
const port = 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from multiple directories
app.use(express.static(path.join(__dirname, '../public')));
app.use('/css', express.static(path.join(__dirname, '../public/css')));
app.use('/js', express.static(path.join(__dirname, '../public/js')));
app.use('/images', express.static(path.join(__dirname, '../public/images')));

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
    console.log('Run: npm run install-mongodb to set up MongoDB');
    process.exit(1);
  }
}

const config = {
  imap: {
    user: 'financeiro@clubevip.net',
    password: 'CYRSG6vT86ZVfe',
    host: 'imap.uhserver.com',
    port: 993,
    tls: true,
    tlsOptions: {
      rejectUnauthorized: false
    },
    authTimeout: 10000,
    connTimeout: 10000
  }
};

// Email configuration for sending verification codes using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: 'contactgestorvip@gmail.com',
    pass: 'aoqmdezazknbbpgf'
  }
});

console.log('Gmail SMTP configured for sending verification codes');

// Generate a random 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/codes');
  }
  res.render('login', { 
    title: 'Login',
    user: null
  });
});

app.get('/codes', requireAuth, async (req, res) => {
  try {
    const codes = await fetchEmails();
    const stats = {
      totalUsers: await db.collection('users').countDocuments(),
      totalLogins: await db.collection('access_logs').countDocuments({ action: { $in: ['Login sucesso', 'verification_success'] } }),
      todayLogins: await db.collection('access_logs').countDocuments({
        action: { $in: ['Login sucesso', 'verification_success'] },
        timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    };
    
    res.render('codes', { 
      title: 'Códigos',
      user: req.session.user,
      codes,
      stats
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.render('codes', { 
      title: 'Códigos',
      user: req.session.user,
      codes: [],
      stats: { totalUsers: 0, totalLogins: 0, todayLogins: 0 },
      error: 'Erro ao carregar dados'
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Login endpoint - sends verification code
app.post('/api/login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const code = generateCode();
    
    // Store verification code in MongoDB
    await db.collection('verification_codes').deleteMany({ email }); // Remove old codes
    await db.collection('verification_codes').insertOne({
      email,
      code,
      createdAt: new Date()
    });

    // Send verification code via email
    const info = await transporter.sendMail({
      from: '"ChatGPT Code System" <contactgestorvip@gmail.com>',
      to: email,
      subject: 'Seu Código de Acesso - ChatGPT',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Código de Verificação</h2>
          <p>Seu código de verificação é:</p>
          <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 3px; margin: 20px 0;">
            ${code}
          </div>
          <p>Este código é válido por 10 minutos.</p>
          <p>Se você não solicitou este código, ignore este email.</p>
        </div>
      `,
      text: `Seu código de verificação é: ${code}. Este código é válido por 10 minutos.`
    });

    console.log('Verification code sent:', code);
    console.log('Email sent to:', email);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify code endpoint
app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    // Find verification code in MongoDB
    const verificationRecord = await db.collection('verification_codes').findOne({ email, code });
    
    if (!verificationRecord) {
      await db.collection('access_logs').insertOne({
        email,
        action: 'Login falhou',
        timestamp: new Date(),
        ip: req.ip
      });
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Remove used verification code
    await db.collection('verification_codes').deleteOne({ _id: verificationRecord._id });

    // Create or update user record
    await db.collection('users').updateOne(
      { email },
      { 
        $set: { 
          email, 
          lastLogin: new Date(),
          verified: true 
        } 
      },
      { upsert: true }
    );

    // Log successful verification
    await db.collection('access_logs').insertOne({
      email,
      action: 'Login sucesso',
      timestamp: new Date(),
      ip: req.ip
    });

    // Set user session
    req.session.user = { email };

    res.json({ token: 'verified' });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

async function fetchEmails() {
  try {
    const connection = await imaps.connect({ imap: config.imap });
    await connection.openBox('INBOX');

    const delay = 24 * 3600 * 1000;
    const yesterday = new Date(Date.now() - delay);
    const searchCriteria = [['FROM', 'noreply@tm.openai.com'], ['SINCE', yesterday.toISOString().slice(0,10)]];
    const fetchOptions = { bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'], struct: true };

    const messages = await connection.search(searchCriteria, fetchOptions);
    const codes = [];

    messages.forEach(item => {
      const all = item.parts.find(part => part.which === 'TEXT');
      const id = item.attributes.uid;
      const idHeader = "Imap-Id: "+id+"\r\n";
      const body = idHeader + all.body;

      const codeMatch = body.match(/(?:Your ChatGPT code is|=)\s*(\d{6})/);
      const code = codeMatch ? codeMatch[1] : null;

      if (code) {
        codes.push({ code });
      }
    });

    connection.end();
    return codes;
  } catch (err) {
    console.error('Error fetching emails:', err);
    return [];
  }
}

// Initialize MongoDB connection and start server
connectToMongoDB().then(() => {
  app.listen(port, () => {
    console.log("Server running on http://localhost:" + port);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
});
