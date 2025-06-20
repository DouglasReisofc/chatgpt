// test-imap.js
const Imap = require('imap');

const imap = new Imap({
    user: 'financeiro@clubevip.net',
    password: 'CYRSG6vT86ZVfe',
    host: 'imap.uhserver.com',
    port: 993,
    tls: true,
    connTimeout: 10000,    // 10s
    authTimeout: 5000      // 5s
});

imap.once('ready', () => {
    console.log('✅ Conectado ao IMAP com sucesso!');
    imap.status('INBOX', (err, box) => {
        if (err) {
            console.error('❌ Erro ao obter status da INBOX:', err);
        } else {
            console.log(`📬 Mensagens na INBOX: ${box.messages.total}`);
        }
        imap.end();
    });
});

imap.once('error', err => {
    console.error('❌ Falha na conexão IMAP:', err.message || err);
});

imap.once('end', () => {
    console.log('🔒 Conexão IMAP encerrada.');
});

// Inicia a conexão
imap.connect();
