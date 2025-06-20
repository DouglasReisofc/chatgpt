const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const axios = require('axios');
const net = require('net');


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

function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  const privateRanges = [/^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./];
  return privateRanges.some(r => r.test(ip));
}

function isValidIP(ip) {
  return net.isIP(ip) !== 0;
}

function getClientIP(req) {
  let xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    for (const ip of ips) {
      if (isValidIP(ip) && !isPrivateIP(ip)) {
        return ip;
      }
    }
  }

  const proxyHeaders = [
    'cf-connecting-ip',
    'true-client-ip',
    'x-real-ip',
    'x-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];
  for (const header of proxyHeaders) {
    const headerValue = req.headers[header];
    if (headerValue) {
      const ips = headerValue.split(',').map(ip => ip.trim());
      for (const ip of ips) {
        if (isValidIP(ip) && !isPrivateIP(ip)) {
          return ip;
        }
      }
    }
  }

  let directIP = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  if (directIP) {
    if (directIP.startsWith('::ffff:')) directIP = directIP.substring(7);
    if (directIP === '::1') directIP = '127.0.0.1';
    if (directIP.includes(':')) directIP = directIP.split(':')[0];
    if (isValidIP(directIP) && !isPrivateIP(directIP)) {
      return directIP;
    }
  }
  return 'unknown';
}

function resolveClientIP(req) {
  const candidate = req.body?.ip || (req.body?.ipInfo && req.body.ipInfo.ip);
  if (candidate && isValidIP(candidate) && !isPrivateIP(candidate)) {
    return candidate;
  }
  return getClientIP(req);
}

function resolveReferer(req) {
  return (
    req.body?.referer ||
    req.get('referer') ||
    req.headers['origin'] ||
    ''
  );
}

async function getIPInfo(ip) {
  try {
    if (!isValidIP(ip) || isPrivateIP(ip)) {
      return { success: false, message: 'Invalid IP' };
    }
    const { data } = await axios.get(`https://ipwho.is/${ip}`);
    return data && data.success ? data : { success: false, message: data.message || 'Invalid IP' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// Check blocked IP middleware
const checkBlockedIP = async (req, res, next) => {
  try {
    const db = req.db;
    const ip = req.body.ip || (req.body.ipInfo && req.body.ipInfo.ip) || getClientIP(req);
    const blockedIP = await db.collection('blocked_ips').findOne({ address: ip });
    if (blockedIP) {
      const messages = (await db.collection('settings').findOne({ key: 'messages' })) || {};
      req.isIPBlocked = true;
      req.blockedMessage = messages.ipBlocked || 'Seu IP está bloqueado. Entre em contato com o administrador.';
    }
    next();
  } catch (error) {
    console.error('Error checking blocked IP:', error);
    next();
  }
};

// Routes
router.get('/', checkBlockedIP, async (req, res) => {
  if (req.session.user) {
    return res.redirect('/codes');
  }

  const db = req.db;
  const messages =
    (await db.collection('settings').findOne({ key: 'messages' })) || {};

  let errorMessage = null;
  if (req.query.error === 'session_expired') {
    errorMessage =
      messages.sessionExpired || 'Sessão expirada. Faça login novamente.';
  }

  if (req.isIPBlocked) {
    errorMessage = req.blockedMessage;
    return res.status(403).render('login', {
      title: 'Login',
      user: null,
      errorMessage
    });
  }

  res.render('login', {
    title: 'Login',
    user: null,
    errorMessage
  });
});

router.post('/api/login', checkBlockedIP, async (req, res) => {
  const { email } = req.body;
  console.log('📧 Login attempt for email:', email);

  if (req.isIPBlocked) {
    return res.status(403).json({ error: req.blockedMessage });
  }

  if (!email) {
    console.log('❌ No email provided');
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const code = generateCode();
    const db = req.db;

    console.log('🔢 Generated verification code:', code);
    console.log('💾 Checking database connection...');

    if (!db) {
      console.log('❌ Database not connected');
      return res.status(500).json({ error: 'Database connection error' });
    }

    // Check if user exists in admin panel
    const userExists = await db.collection('users').findOne({ email });
    console.log('👤 User exists in database:', userExists ? 'Yes' : 'No');

    if (!userExists) {
      console.log('❌ Email not found in admin panel. User must be added by admin first.');
      return res.status(403).json({ error: 'Email not authorized. Contact administrator.' });
    }

    const sessionLimitSetting = await db.collection('settings').findOne({ key: 'sessionLimit' });
    const messages = (await db.collection('settings').findOne({ key: 'messages' })) || {};
    const limitEnabled =
      !sessionLimitSetting || sessionLimitSetting.limitEnabled !== false;

    if (limitEnabled) {
      const remaining =
        typeof userExists.maxSessions === 'number'
          ? userExists.maxSessions
          : (sessionLimitSetting && sessionLimitSetting.maxSessions) || 3;

      if (remaining <= 0) {
        console.log('❌ Session limit reached (login request):', email);
        await db.collection('access_logs').insertOne({
          email,
          action: 'Limite de sessão atingido',
          timestamp: new Date(),
          ip: resolveClientIP(req),
          country: (req.body.ipInfo && req.body.ipInfo.country) || 'Desconhecido',
          referer: resolveReferer(req),
          ipInfo: req.body.ipInfo || null
        });
        return res
          .status(403)
          .json({ error: messages.sessionLimitReached || 'Limite de sessões atingido. Faça logout em outro dispositivo.' });
      }
    }

    // Store verification code in MongoDB
    console.log('🗑️ Removing old verification codes...');
    await db.collection('verification_codes').deleteMany({ email });

    console.log('💾 Storing new verification code...');
    await db.collection('verification_codes').insertOne({
      email,
      code,
      createdAt: new Date()
    });

    console.log('📤 Sending email...');
    // Send verification code via email
    const emailResult = await transporter.sendMail({
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

    console.log('✅ Email sent successfully:', emailResult.messageId);

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    console.error('❌ Error sending email:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

router.post('/api/verify', checkBlockedIP, async (req, res) => {
  const { email, code } = req.body;
  console.log('🔍 Verification attempt:', { email, code });

  if (req.isIPBlocked) {
    return res.status(403).json({ error: req.blockedMessage });
  }

  if (!email || !code) {
    console.log('❌ Missing email or code');
    return res.status(400).json({ error: 'Email and code are required' });
  }

  try {
    const db = req.db;
    const ip = resolveClientIP(req);
    const referer = resolveReferer(req);
    const ipInfo =
      req.body.ipInfo && req.body.ipInfo.ip === ip
        ? req.body.ipInfo
        : await getIPInfo(ip);
    console.log('💾 Checking database connection...');

    if (!db) {
      console.log('❌ Database not connected');
      return res.status(500).json({ error: 'Database connection error' });
    }

    // Find verification code in MongoDB
    console.log('🔍 Searching for verification code...');
    const verificationRecord = await db.collection('verification_codes').findOne({ email, code });
    console.log('📝 Verification record found:', verificationRecord ? 'Yes' : 'No');

    const messages = (await db.collection('settings').findOne({ key: 'messages' })) || {};
    if (!verificationRecord) {
      console.log('❌ Invalid verification code');
      await db.collection('access_logs').insertOne({
        email,
        action: 'Login falhou',
        timestamp: new Date(),
        ip,
        country: ipInfo.country || 'Desconhecido',
        referer,
        ipInfo
      });
      return res.status(401).json({ error: messages.invalidCode || 'Invalid code' });
    }

    // Remove used verification code
    console.log('🗑️ Removing used verification code...');
    await db.collection('verification_codes').deleteOne({ _id: verificationRecord._id });

    // Create or update user record
    console.log('👤 Updating user record...');
    const user = await db.collection('users').findOne({ email });
    const sessionLimitSetting =
      (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
        limitEnabled: true,
        durationEnabled: true,
        maxSessions: 3,
        sessionDuration: 5
      };

    const currentMax =
      user && typeof user.maxSessions === 'number'
        ? user.maxSessions
        : sessionLimitSetting.maxSessions;

    if (sessionLimitSetting.limitEnabled !== false && currentMax <= 0) {
      console.log('❌ Session limit reached for user:', email);
      await db.collection('access_logs').insertOne({
        email,
        action: 'Limite de sessão atingido',
        timestamp: new Date(),
        ip,
        country: ipInfo.country || 'Desconhecido',
        referer,
        ipInfo
      });
      return res
        .status(403)
        .json({
          error:
            messages.sessionLimitReached ||
            'Limite de sessões atingido. Por favor, faça logout em outro dispositivo.'
        });
    }

    const userUpdate = {
      $set: { lastLogin: new Date(), verified: true }
    };
    if (sessionLimitSetting.limitEnabled !== false) {
      userUpdate.$inc = { maxSessions: -1 };
    }
    const updateQuery = sessionLimitSetting.limitEnabled !== false
      ? { email, maxSessions: { $gt: 0 } }
      : { email };
    const updateResult = await db
      .collection('users')
      .updateOne(updateQuery, userUpdate);

    if (sessionLimitSetting.limitEnabled !== false && updateResult.matchedCount === 0) {
      console.log('❌ Session limit reached for user during update:', email);
      await db.collection('access_logs').insertOne({
        email,
        action: 'Limite de sessão atingido',
        timestamp: new Date(),
        ip,
        country: ipInfo.country || 'Desconhecido',
        referer,
        ipInfo
      });
      return res.status(403).json({ error: messages.sessionLimitReached || 'Limite de sessões atingido. Por favor, faça logout em outro dispositivo.' });
    }

    // Log successful verification with IP details
    console.log('📝 Recording successful verification...');
    // Reuse ip, ipInfo and referer collected above
    await db.collection('access_logs').insertOne({
      email,
      action: 'Login sucesso',
      timestamp: new Date(),
      ip,
      country: ipInfo.country || 'Desconhecido',
      referer,
      ipInfo
    });



    // Set user session
    console.log('🔐 Setting user session...');
    const sessionId = require('crypto').randomBytes(32).toString('hex');
    req.session.user = { email, sessionId };

    // Store session in database
    const sessionDurationMinutes =
      user && typeof user.sessionDuration === 'number'
        ? user.sessionDuration
        : sessionLimitSetting.sessionDuration;
    const now = new Date();
    const sessionData = {
      email,
      sessionId,
      createdAt: now,
      lastActivity: now,
      ip,
      userAgent: req.headers['user-agent']
    };
    if (sessionLimitSetting.durationEnabled !== false) {
      sessionData.expiresAt = new Date(
        now.getTime() + sessionDurationMinutes * 60000
      );
    }
    await db.collection('active_sessions').insertOne(sessionData);

    console.log('✅ Verification successful');
    res.json({ token: 'verified' });
  } catch (error) {
    console.error('❌ Error verifying code:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Codes page route
router.get('/codes', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  try {
    const db = req.db;
    console.log('📊 Loading codes page for user:', req.session.user.email);

    const { email, sessionId } = req.session.user;
    await db.collection('active_sessions').updateOne(
      { email, sessionId },
      { $set: { lastActivity: new Date() } }
    );

    // Sample codes data (in a real implementation, this would come from email parsing)
    const codes = [
      {
        email: 'eflaviaflores@gmail.com',
        code: '857453'
      },
      {
        email: 'eflaviaflores@gmail.com',
        code: '961828'
      },
      {
        email: 'luanadatequila@gmail.com',
        code: '770017'
      }
    ];

    console.log('🔢 Codes available:', codes.length);

    res.render('codes', {
      title: 'ChatGPT Codes',
      codes,
      user: req.session.user
    });
  } catch (error) {
    console.error('❌ Error loading codes page:', error);
    res.status(500).send('Error loading codes page');
  }
});

router.get('/logout', async (req, res) => {
  if (req.session.user) {
    const { email, sessionId } = req.session.user;
    console.log('👋 User logout:', email);

    try {
      // Remove session from database
      await req.db.collection('active_sessions').deleteOne({
        email,
        sessionId
      });

    } catch (error) {
      console.error('❌ Error during logout:', error);
    }
  }

  req.session.destroy();
  res.redirect('/');
});

// Middleware to check session validity and update last activity
router.use(async (req, res, next) => {
  if (req.session.user) {
    const { email, sessionId } = req.session.user;

    try {
      const sessionRecord = await req.db.collection('active_sessions').findOne({ email, sessionId });

      const sessionLimitSetting = await req.db.collection('settings').findOne({ key: 'sessionLimit' });

      if (!sessionRecord) {
        console.log('❌ Invalid session detected:', email);
        req.session.destroy();
        return res.redirect('/?error=session_expired');
      }

      if (sessionLimitSetting && sessionLimitSetting.durationEnabled !== false) {
        if (sessionRecord.expiresAt && new Date() > sessionRecord.expiresAt) {
          await req.db.collection('active_sessions').deleteOne({ email, sessionId });
          console.log('⏰ Session expired for:', email);
          req.session.destroy();
          return res.redirect('/?error=session_expired');
        }
      }


      await req.db.collection('active_sessions').updateOne(
        { email, sessionId },
        { $set: { lastActivity: new Date() } }
      );

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await req.db.collection('active_sessions').deleteMany({
        lastActivity: { $lt: yesterday }
      });

    } catch (error) {
      console.error('❌ Error checking session:', error);
    }
  }
  next();
});

module.exports = router;
