const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'contactgestorvip@gmail.com',
    pass: 'aoqmdezazknbbpgf'
  }
});

// Generate a random 6-digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Routes
router.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/codes');
  }
  res.render('login', { 
    title: 'Login',
    user: null
  });
});

router.post('/api/login', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const code = generateCode();
    const db = req.db;
    
    // Store verification code in MongoDB
    await db.collection('verification_codes').deleteMany({ email }); // Remove old codes
    await db.collection('verification_codes').insertOne({
      email,
      code,
      createdAt: new Date()
    });

    // Send verification code via email
    await transporter.sendMail({
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

    // Log access attempt
    await db.collection('access_logs').insertOne({
      email,
      action: 'verification_code_sent',
      timestamp: new Date(),
      ip: req.ip
    });

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

router.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const db = req.db;
    // Find verification code in MongoDB
    const verificationRecord = await db.collection('verification_codes').findOne({ email, code });
    
    if (!verificationRecord) {
      await db.collection('access_logs').insertOne({
        email,
        action: 'verification_failed',
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
      action: 'verification_success',
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

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
