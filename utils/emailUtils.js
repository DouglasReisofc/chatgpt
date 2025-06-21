// utils/emailUtils.js

const nodemailer = require('nodemailer');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * Parse a string like "{host:port/imap/ssl}BOX" into IMAP config.
 */
function parseImapConnection(str) {
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

/**
 * Build a Nodemailer transporter based on settings in MongoDB.
 */
async function getTransporter(db) {
  const defaults = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'contactgestorvip@gmail.com',
    pass: 'aoqmdezazknbbpg'
  };
  const cfg = (await db.collection('settings').findOne({ key: 'emailConfig' })) || {};
  const smtp = { ...defaults, ...cfg.smtp };
  console.log('🚀 SMTP config:', {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure
  });
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: !!smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
  });
}

/**
 * Connect via IMAP, search for messages from the last 24h,
 * extract up to `limit` 6-digit codes, associate each with the true recipient,
 * log each step to console and save to MongoDB.
 */
async function fetchImapCodes(db, email, limit = 5) {
  const defaults = {
    host: 'imap.uhserver.com',
    port: 993,
    tls: true,
    user: 'financeiro@clubevip.net',
    pass: 'CYRSG6vT86ZVfe'
  };
  const cfg = (await db.collection('settings').findOne({ key: 'emailConfig' })) || {};
  const imapCfg = { ...defaults, ...cfg.imap };

  let mailbox = 'INBOX';
  if (imapCfg.host.includes('{')) {
    const p = parseImapConnection(imapCfg.host);
    imapCfg.host = p.host;
    if (p.port) imapCfg.port = p.port;
    imapCfg.tls = p.tls;
    mailbox = p.box;
  }

  console.log(`🔗 Connecting to IMAP ${imapCfg.host}:${imapCfg.port} (tls=${imapCfg.tls})`);

  return new Promise(resolve => {
    const imap = new Imap({
      user: imapCfg.user,
      password: imapCfg.pass,
      host: imapCfg.host,
      port: imapCfg.port,
      tls: !!imapCfg.tls,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 10000
    });

    imap.once('ready', () => {
      console.log('✅ IMAP connection ready');
      imap.openBox(mailbox, false, (err, box) => {
        if (err) {
          console.error('❌ Error opening mailbox:', err);
          imap.end();
          return resolve([]);
        }
        console.log(`📬 Opened mailbox "${mailbox}", total messages: ${box.messages.total}`);

        // Search for messages from the last 24h
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const criteria = [
          ['FROM', 'noreply@tm.openai.com'],
          ['SINCE', since]
        ];
        imap.search(criteria, (err, results) => {
          if (err) {
            console.error('❌ Error searching messages:', err);
            imap.end();
            return resolve([]);
          }
          console.log(`🔍 Found ${results.length} message(s) matching criteria`);
          // Grab only the last `limit` UIDs
          const uids = results.sort((a, b) => a - b).slice(-limit);
          console.log(`✂️  Fetching last ${uids.length} message(s):`, uids);

          const fetcher = imap.fetch(uids, { bodies: ['HEADER', 'TEXT'], struct: true });
          const records = [];

          fetcher.on('message', (msg, seqno) => {
            let headerText = '';
            let bodyText = '';

            msg.on('body', (stream, info) => {
              const chunks = [];
              stream.on('data', chunk => chunks.push(chunk));
              stream.once('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                if (info.which === 'HEADER') {
                  headerText = text;
                } else if (info.which === 'TEXT') {
                  bodyText = text;
                }
              });
            });

            msg.once('end', async () => {
              try {
                // Parse body for 6-digit code
                const parsed = await simpleParser(bodyText);
                const content = parsed.text || parsed.html || bodyText;
                const m = content.match(/\b(\d{6})\b/);
                if (!m) return;

                // Extract the real recipient from headers
                let emailAddr = '';
                let match;
                if ((match = headerText.match(/^X-X-Forwarded-For:\s*(.+)$/gmi))) {
                  // pick first forwarded with '@' and not our system email
                  const list = match[0].split(':')[1].split(',').map(s => s.trim());
                  for (const f of list) {
                    if (f.includes('@') && f !== 'aanniitaas@gmail.com') {
                      emailAddr = f;
                      break;
                    }
                  }
                }
                if (!emailAddr && (match = headerText.match(/^Delivered-To:\s*(.+)$/gmi))) {
                  emailAddr = match[0].split(':')[1].trim();
                }
                if (!emailAddr && (match = headerText.match(/^To:\s*.*<([^>]+)>/gmi))) {
                  emailAddr = match[0].replace(/.*<([^>]+)>.*/, '$1').trim();
                }
                emailAddr = emailAddr.replace(/\s*aanniitaas@gmail.com/i, '').trim();

                console.log(`🔢 Code found: ${m[1]} for ${emailAddr || 'unknown'}`);
                const rec = {
                  code: m[1],
                  email: emailAddr || 'unknown',
                  fetchedAt: new Date()
                };
                await db.collection('codes').insertOne(rec).catch(() => { });
                records.push(rec);
              } catch (e) {
                console.error('⚠️ Error processing message:', e);
              }
            });
          });

          fetcher.once('end', () => {
            console.log('✨ Finished fetching, total codes:', records.length);
            imap.end();
            resolve(records);
          });
        });
      });
    });

    imap.once('error', err => {
      console.error('❌ IMAP connection error:', err);
      resolve([]);
    });

    imap.once('end', () => {
      console.log('🔒 IMAP connection closed');
    });

    imap.connect();
  });
}

async function fetchImapCodesRetry(db, email, limit = 5, attempts = 2) {
  let records = [];
  for (let i = 0; i < attempts; i++) {
    records = await fetchImapCodes(db, email, limit);
    if (records.length > 0) break;
    if (i < attempts - 1) {
      console.log(`🔄 Retry fetching codes (${i + 2}/${attempts})`);
    }
  }
  return records;
}

module.exports = {
  getTransporter,
  fetchImapCodes,
  fetchImapCodesRetry
};
