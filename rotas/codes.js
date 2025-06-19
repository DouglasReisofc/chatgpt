const express = require('express');
const router = express.Router();
const imaps = require('imap-simple');

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/');
  }
  next();
}

// IMAP configuration
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

// Fetch emails function
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

// Routes
router.get('/', requireAuth, async (req, res) => {
  try {
    const codes = await fetchEmails();
    const db = req.db;
    
    const stats = {
      totalUsers: await db.collection('users').countDocuments(),
      totalLogins: await db.collection('access_logs').countDocuments({ action: 'verification_success' }),
      todayLogins: await db.collection('access_logs').countDocuments({
        action: 'verification_success',
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

module.exports = router;
