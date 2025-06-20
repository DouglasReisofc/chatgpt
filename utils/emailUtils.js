const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

function parseImapConnection(str) {
  // Allow host strings like "{imap.example.com:993/imap/ssl}INBOX"
  if (!str || !str.includes('{')) {
    return { host: str, port: undefined, tls: undefined, box: 'INBOX' };
  }
  const match = str.match(/^\{([^:}]+)(?::(\d+))?(?:\/[^}]*)?\}(.+)?$/i);
  if (!match) {
    return { host: str, port: undefined, tls: undefined, box: 'INBOX' };
  }
  const [, host, port, box] = match;
  const tls = /ssl|tls/i.test(str);
  return {
    host,
    port: port ? parseInt(port, 10) : undefined,
    tls,
    box: box || 'INBOX'
  };
}

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

  let mailbox = 'INBOX';
  if (imapCfg.host && imapCfg.host.includes('{')) {
    const parsed = parseImapConnection(imapCfg.host);
    if (parsed.host) imapCfg.host = parsed.host;
    if (parsed.port) imapCfg.port = parsed.port;
    if (typeof parsed.tls === 'boolean') imapCfg.tls = parsed.tls;
    mailbox = parsed.box || 'INBOX';
  }

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
    await connection.openBox(mailbox);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const searchCriteria = [
      ['FROM', 'noreply@tm.openai.com'],
      ['SINCE', yesterday]
    ];
    const messages = await connection.search(searchCriteria, {
      bodies: ['HEADER', 'TEXT'],
      struct: true
    });
    messages.sort((a, b) => b.attributes.date - a.attributes.date);

    const codes = [];
    for (const msg of messages) {
      let body = '';
      const textPart = imaps.getParts(msg.attributes.struct).find(p => p.type === 'text' && !p.disposition);
      if (textPart) {
        body = await connection.getPartData(msg, textPart);
      } else {
        const text = msg.parts.find(p => p.which === 'TEXT');
        body = text ? text.body : '';
      }

      const parsed = await simpleParser(body).catch(() => ({}));
      const content = parsed.text || parsed.html || body;
      const mCode = content.match(/(?:Your ChatGPT code is|=)\s*(\d{6})/);
      if (!mCode) continue;

      const header = msg.parts.find(p => p.which === 'HEADER');
      const headerText = header ? header.body : '';
      let emailAddr = '';
      let m = /X-X-Forwarded-For:\s*(.+)/i.exec(headerText);
      if (m) {
        for (const fwd of m[1].split(',')) {
          const t = fwd.trim();
          if (t.includes('@') && t !== 'aanniitaas@gmail.com') {
            emailAddr = t;
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
      emailAddr = emailAddr.replace(/\s*aanniitaas@gmail.com\s*/i, '').trim();

      if (!email || emailAddr.toLowerCase() === email.toLowerCase()) {
        const record = { code: mCode[1], email: emailAddr || 'E-mail não encontrado', fetchedAt: new Date() };
        codes.push(record);
        await db.collection('codes').insertOne(record).catch(() => {});
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

module.exports = { getTransporter, fetchImapCodes };
