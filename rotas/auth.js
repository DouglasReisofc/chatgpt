const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const axios = require('axios');
const net = require('net');


// Helper to create SMTP transporter from stored settings
async function getTransporter(db) {
  const defaults = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'contactgestorvip@gmail.com',
    pass: 'aoqmdezazknbbpg'
  };
  const config = (await db.collection('settings').findOne({ key: 'emailConfig' })) || {};
  const smtp = Object.assign({}, defaults, config.smtp);
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: !!smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
  });
}

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

// Retrieve verification codes from IMAP using stored configuration
async function fetchImapCodes(db, email, limit = 5) {
  const defaults = {
    host: 'imap.uhserver.com',
    port: 993,
    tls: true,
    user: 'financeiro@clubevip.net',
    pass: 'CYRSG6vT86ZVfe'
  };

  const config = (await db.collection('settings').findOne({ key: 'emailConfig' })) || {};
  const imapCfg = Object.assign({}, defaults, config.imap);

  const imapConfig = {
    imap: {
      user: imapCfg.user,
      password: imapCfg.pass,
      host: imapCfg.host,
      port: imapCfg.port,
      tls: !!imapCfg.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000
    }
  };

  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sinceDate = `${yesterday.getDate()}-${months[yesterday.getMonth()]}-${yesterday.getFullYear()}`;

    // Build search query in the same format as the PHP version
    const searchString = `FROM "noreply@tm.openai.com" SINCE "${sinceDate}"`;
    const messages = await connection.search([searchString], { bodies: ['HEADER', 'TEXT'], struct: true });

    const codes = [];
    messages.sort((a, b) => b.attributes.date - a.attributes.date);

    for (const msg of messages) {
      // Get raw body
      let body = '';
      const textPart = imaps.getParts(msg.attributes.struct).find(p => p.type === 'text' && !p.disposition);
      if (textPart) {
        body = await connection.getPartData(msg, textPart);
      } else {
        const text = msg.parts.find(p => p.which === 'TEXT');
        body = text ? text.body : '';
      }

      // Decode body
      const parsed = await simpleParser(body).catch(() => ({}));
      const content = parsed.text || parsed.html || body;
      const match = content.match(/(?:Your ChatGPT code is|=)\s*(\d{6})/);
      if (!match) continue;

      // Extract email from headers
      const headerPart = msg.parts.find(p => p.which === 'HEADER');
      const headerText = headerPart ? headerPart.body : '';
      let emailAddr = '';
      let m = /X-X-Forwarded-For:\s*(.+)/i.exec(headerText);
      if (m) {
        for (const fwd of m[1].split(',')) {
          const trimmed = fwd.trim();
          if (trimmed.includes('@') && trimmed !== 'aanniitaas@gmail.com') {
            emailAddr = trimmed;
            break;
          }
        }
      }

      if (!emailAddr) {
        m = /Delivered-To:\s*(.+)/i.exec(headerText);
        if (m) emailAddr = m[1].trim();
      }

      if (!emailAddr) {
        m = /To:\s*(.+)/i.exec(headerText);
        if (m) emailAddr = m[1].replace(/.*<([^>]+)>.*/, '$1').trim();
      }

      if (emailAddr.includes('aanniitaas@gmail.com')) {
        emailAddr = emailAddr.replace(/\s*aanniitaas@gmail.com\s*/i, '').trim();
      }

      if (!email || emailAddr.toLowerCase() === email.toLowerCase()) {
        codes.push({ code: match[1], email: emailAddr || 'E-mail não encontrado' });
        if (codes.length >= limit) break;
      }
    }

    connection.end();
    return codes;
  } catch (err) {
    console.error('Error fetching IMAP codes:', err);
    return [];
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
      req.blockedMessage =
        messages.ipBlocked ||
        'No momento nosso sistema enfrenta uma manutenção por favor tente novamente mais tarde';
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

  let errorMessage = req.session.errorMessage || null;
  delete req.session.errorMessage;

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
  const email = req.body.email ? String(req.body.email).trim() : '';
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
    const transporter = await getTransporter(db);
    const smtpStored = ((await db.collection('settings').findOne({ key: 'emailConfig' })) || {}).smtp || {};
    const smtpConf = Object.assign(
      { user: 'contactgestorvip@gmail.com' },
      smtpStored
    );
    const emailResult = await transporter.sendMail({
      from: `"ChatGPT Code System" <${smtpConf.user}>`,
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
  let { email, code } = req.body;
  email = email ? String(email).trim() : '';
  code = code ? String(code).replace(/\D/g, '').trim() : '';
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
    const verificationRecord = await db
      .collection('verification_codes')
      .findOne({ email, code });
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
      sessionData.sessionDuration = sessionDurationMinutes;
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
    const sessionRecord = await db
      .collection('active_sessions')
      .findOne({ email, sessionId });
    if (sessionRecord) {
      const update = { $set: { lastActivity: new Date() } };
      if (sessionRecord.sessionDuration) {
        update.$set.expiresAt = new Date(
          Date.now() + sessionRecord.sessionDuration * 60000
        );
      }
      await db.collection('active_sessions').updateOne({ email, sessionId }, update);
    }

    const limitSetting =
      (await db.collection('settings').findOne({ key: 'codeDisplayLimit' })) ||
      { limit: 5 };
    const codes = await fetchImapCodes(db, email, limitSetting.limit || 5);

    console.log('🔢 Codes available:', codes.length);

    res.render('codes', {
      title: 'ChatGPT Codes',
      codes,
      user: req.session.user,
      expiresAt: sessionRecord && sessionRecord.expiresAt ? sessionRecord.expiresAt.toISOString() : null
    });
  } catch (error) {
    console.error('❌ Error loading codes page:', error);
    res.status(500).send('Error loading codes page');
  }
});

async function handleLogout(req, res) {
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

  const expired = req.body && req.body.expired;
  if (expired) {
    const messages = (await req.db.collection('settings').findOne({ key: 'messages' })) || {};
    req.session.errorMessage = messages.sessionExpired || 'Sessão expirada. Faça login novamente.';
  }
  delete req.session.user;
  req.session.save(() => {
    if (req.xhr || req.headers.accept === 'application/json') {
      res.json({ success: true });
    } else {
      res.redirect('/');
    }
  });
}

router.post('/logout', handleLogout);
router.get('/logout', handleLogout);

// Middleware to check session validity and update last activity
router.use(async (req, res, next) => {
  if (req.session.user) {
    const { email, sessionId } = req.session.user;

    try {
      const sessionRecord = await req.db.collection('active_sessions').findOne({ email, sessionId });

      const sessionLimitSetting = await req.db.collection('settings').findOne({ key: 'sessionLimit' });

      const messages =
        (await req.db.collection('settings').findOne({ key: 'messages' })) || {};

      if (!sessionRecord) {
        console.log('❌ Invalid session detected:', email);
        req.session.errorMessage =
          messages.sessionExpired || 'Sessão expirada. Faça login novamente.';
        delete req.session.user;
        return req.session.save(() => res.redirect('/'));
      }

      if (sessionLimitSetting && sessionLimitSetting.durationEnabled !== false) {
        if (sessionRecord.expiresAt && new Date() > sessionRecord.expiresAt) {
          await req.db.collection('active_sessions').deleteOne({ email, sessionId });
          console.log('⏰ Session expired for:', email);
          req.session.errorMessage =
            messages.sessionExpired || 'Sessão expirada. Faça login novamente.';
          delete req.session.user;
          return req.session.save(() => res.redirect('/'));
        }
      }

      const update = { $set: { lastActivity: new Date() } };
      if (sessionLimitSetting && sessionLimitSetting.durationEnabled !== false && sessionRecord.sessionDuration) {
        update.$set.expiresAt = new Date(Date.now() + sessionRecord.sessionDuration * 60000);
      }
      await req.db.collection('active_sessions').updateOne(
        { email, sessionId },
        update
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
