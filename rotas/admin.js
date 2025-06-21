
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const { resetAllSessions, startSessionResetCron } = require('../utils/sessionUtils');

const uploadDir = path.join(__dirname, '..', 'public', 'images');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Admin authentication middleware
const requireAdmin = async (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }
    next();
};

// Use custom admin layout and load branding for dashboard pages
const adminLayout = async (req, res, next) => {
    res.locals.layout = 'layouts/admin/main';
    try {
        const branding =
            (await req.db.collection('settings').findOne({ key: 'branding' })) ||
            {
                panelLogoUrl: '',
                cardLogoUrl: '',
                href: 'https://www.contasvip.com.br/',
                panelName: 'ChatGPT Codes'
            };
        res.locals.branding = branding;
        const colors =
            (await req.db.collection('settings').findOne({ key: 'colors' })) || {
                bgStart: '#007bff',
                bgEnd: '#00bcd4',
                cardStart: '#00d4aa',
                cardEnd: '#00a085',
                buttonStart: '#007bff',
                buttonEnd: '#0056b3',
                updateStart: '#ff6b6b',
                updateEnd: '#ee5a24',
                textColor: '#333'
            };
        res.locals.colors = colors;
    } catch (err) {
        res.locals.branding = {
            panelLogoUrl: '',
            cardLogoUrl: '',
            href: 'https://www.contasvip.com.br/',
            panelName: 'ChatGPT Codes'
        };
        res.locals.colors = {
            bgStart: '#007bff',
            bgEnd: '#00bcd4',
            cardStart: '#00d4aa',
            cardEnd: '#00a085',
            buttonStart: '#007bff',
            buttonEnd: '#0056b3',
            updateStart: '#ff6b6b',
            updateEnd: '#ee5a24',
            textColor: '#333'
        };
    }
    next();
};

// Root admin route - redirect to login or dashboard
router.get('/', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/admin/login');
});

// Admin login page
router.get('/login', (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }

    res.render('admin/login_standalone', {
        title: 'Admin Login',
        error: null,
        layout: false
    });
});

// Admin login POST
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const db = req.db;

    try {
        console.log('👤 Admin login attempt:', { username });

        const admin = await db.collection('admin_users').findOne({
            username: username
        });

        console.log('🔍 Found admin user:', admin ? 'Yes' : 'No');

        if (!admin) {
            console.log('❌ Admin user not found');
            return res.render('admin/login_standalone', {
                title: 'Admin Login',
                error: 'Invalid credentials',
                layout: false
            });
        }

        const passwordMatch = await bcrypt.compare(password, admin.password);
        console.log('🔐 Password match:', passwordMatch ? 'Yes' : 'No');

        if (!passwordMatch) {
        return res.render('admin/login_standalone', {
            title: 'Admin Login',
            error: 'Invalid credentials',
            layout: false
        });
        }

        // Update last login
        await db.collection('admin_users').updateOne(
            { _id: admin._id },
            { $set: { lastLogin: new Date() } }
        );

        req.session.admin = {
            id: admin._id,
            username: admin.username,
            isAdmin: true
        };

        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Admin login error:', error);
        res.render('admin/login_standalone', {
            title: 'Admin Login',
            error: 'An error occurred',
            layout: false
        });
    }
});

// Admin dashboard
router.get('/dashboard', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const stats = {
            totalUsers: await db.collection('users').countDocuments(),
            totalLogins: await db.collection('access_logs').countDocuments({ action: { $in: ['Login sucesso', 'verification_success'] } }),
            todayLogins: await db.collection('access_logs').countDocuments({
                action: { $in: ['Login sucesso', 'verification_success'] },
                timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            })
        };

        const recentUsers = await db.collection('users')
            .find()
            .sort({ lastLogin: -1 })
            .limit(10)
            .toArray();

        const recentLogs = await db.collection('access_logs')
            .find()
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();


        let topLimit = parseInt(req.query.topLimit, 10);
        if (isNaN(topLimit) || topLimit <= 0) topLimit = 5;

        const topAccesses = await db.collection('access_logs')
            .aggregate([
                { $match: { action: { $in: ['Login sucesso', 'verification_success'] } } },
                { $group: { _id: '$email', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: topLimit }
            ])
            .toArray();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats,
            recentUsers,
            recentLogs,
            topAccesses,
            topLimit,
            page: 'dashboard'
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Access logs page
router.get('/logs', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        let { limit = '100', page = '1', email = '', action = '' } = req.query;

        let nLimit = parseInt(limit, 10);
        if (isNaN(nLimit) || nLimit < 1) nLimit = 100;
        if (nLimit > 1000) nLimit = 1000;

        let pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        const query = {};
        if (email) query.email = { $regex: email, $options: 'i' };
        if (action) query.action = action;

        const total = await db.collection('access_logs').countDocuments(query);
        const logs = await db
            .collection('access_logs')
            .find(query)
            .sort({ timestamp: -1 })
            .skip((pageNum - 1) * nLimit)
            .limit(nLimit)
            .toArray();

        const actions = await db.collection('access_logs').distinct('action');
        const blockedIps = await db.collection('blocked_ips').find().toArray();

        res.render('admin/logs', {
            title: 'Logs de Acesso',
            logs,
            blockedIps,
            actions,
            filters: { email, action, limit: nLimit },
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / nLimit)
            },
            page: 'logs'
        });
    } catch (error) {
        console.error('Logs page error:', error);
        res.status(500).send('Error loading logs');
    }
});

// Logs JSON for dynamic pagination/search
router.get('/logs/data', requireAdmin, async (req, res) => {
    const db = req.db;
    try {
        let { limit = '100', page = '1', email = '', action = '' } = req.query;

        let nLimit = parseInt(limit, 10);
        if (isNaN(nLimit) || nLimit < 1) nLimit = 100;
        if (nLimit > 1000) nLimit = 1000;

        let pageNum = parseInt(page, 10);
        if (isNaN(pageNum) || pageNum < 1) pageNum = 1;

        const query = {};
        if (email) query.email = { $regex: email, $options: 'i' };
        if (action) query.action = action;

        const total = await db.collection('access_logs').countDocuments(query);
        const logs = await db
            .collection('access_logs')
            .find(query)
            .sort({ timestamp: -1 })
            .skip((pageNum - 1) * nLimit)
            .limit(nLimit)
            .toArray();

        res.json({
            logs,
            total,
            page: pageNum,
            pages: Math.ceil(total / nLimit)
        });
    } catch (error) {
        console.error('Logs data error:', error);
        res.status(500).json({ error: 'Failed to load logs' });
    }
});

// Blocked IPs management page
router.get('/blocked-ips', requireAdmin, adminLayout, async (req, res) => {
    try {
        const blockedIps = await req.db.collection('blocked_ips')
            .find()
            .sort({ blockedAt: -1 })
            .toArray();

        res.render('admin/blocked_ips', {
            title: 'Bloqueio de IPs',
            blockedIps,
            page: 'blocked-ips'
        });
    } catch (error) {
        console.error('Blocked IPs page error:', error);
        res.status(500).send('Error loading blocked IPs');
    }
});

// Fetch detailed IP info from ipwho.is
router.get('/ip-info/:ip', requireAdmin, async (req, res) => {
    const ip = req.params.ip;
    try {
        const { data } = await axios.get(`https://ipwho.is/${ip}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching IP info:', error);
        res.status(500).json({ error: 'Failed to fetch IP info' });
    }
});

// Settings page
router.get('/settings', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const codeLimitSetting =
            (await db.collection('settings').findOne({ key: 'codeDisplayLimit' })) ||
            { limit: 5 };
        const branding =
            (await db.collection('settings').findOne({ key: 'branding' })) ||
            {
                panelLogoUrl: '',
                cardLogoUrl: '',
                href: 'https://www.contasvip.com.br/',
                panelName: 'ChatGPT Codes'
            };
        const colors =
            (await db.collection('settings').findOne({ key: 'colors' })) || {
                bgStart: '#007bff',
                bgEnd: '#00bcd4',
                cardStart: '#00d4aa',
                cardEnd: '#00a085',
                buttonStart: '#007bff',
                buttonEnd: '#0056b3',
                updateStart: '#ff6b6b',
                updateEnd: '#ee5a24',
                textColor: '#333'
            };
        const reloadSetting =
            (await db.collection('settings').findOne({ key: 'autoReload' })) ||
            { enabled: true, limit: 3 };
        const verificationSetting =
            (await db.collection('settings').findOne({ key: 'emailVerification' })) ||
            { enabled: true };
        const resetCronSetting =
            (await db.collection('settings').findOne({ key: 'sessionResetCron' })) ||
            { enabled: false, hours: 24 };
        res.render('admin/settings', {
            title: 'Configurações do Sistema',
            codeLimit: codeLimitSetting.limit || 5,
            branding,
            colors,
            reload: {
                enabled: reloadSetting.enabled !== false,
                limit: reloadSetting.limit || 3
            },
            verification: {
                enabled: verificationSetting.enabled !== false
            },
            resetCron: {
                enabled: resetCronSetting.enabled !== false,
                hours: resetCronSetting.hours || 24
            },
            page: 'settings'
        });
    } catch (error) {
        console.error('Settings error:', error);
        res.status(500).send('Error loading settings');
    }
});

// Session limit settings page
router.get('/code-settings', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const sessionLimit =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };
        res.render('admin/code_settings', {
            title: 'Limite de Sessões',
            sessionLimit,
            page: 'code-settings'
        });
    } catch (error) {
        console.error('Session limit settings error:', error);
        res.status(500).send('Error loading session limit settings');
    }
});

// System messages settings page
router.get('/messages', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const messages =
            (await db.collection('settings').findOne({ key: 'messages' })) || {
                sessionLimitReached:
                    'Limite de sessões atingido. Faça logout em outro dispositivo.',
                sessionExpired: 'Sessão expirada. Faça login novamente.',
                invalidCode: 'Código inválido.',
                ipBlocked:
                    'No momento nosso sistema enfrenta uma manutenção por favor tente novamente mais tarde',
                emailNotAuthorized:
                    'Email não autorizado. Contate o administrador.',
                emailLabel: 'Email'
            };
        res.render('admin/messages', {
            title: 'Mensagens do Sistema',
            messages,
            page: 'messages'
        });
    } catch (error) {
        console.error('Messages settings error:', error);
        res.status(500).send('Error loading messages');
    }
});

// Update system messages
router.post('/messages', requireAdmin, async (req, res) => {
    const { sessionLimitReached, sessionExpired, invalidCode, ipBlocked, emailNotAuthorized, emailLabel } = req.body;
    const db = req.db;

    try {
        await db.collection('settings').updateOne(
            { key: 'messages' },
            {
                $set: {
                    sessionLimitReached,
                    sessionExpired,
                    invalidCode,
                    ipBlocked,
                    emailNotAuthorized,
                    emailLabel
                }
            },
            { upsert: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving messages:', error);
        res.status(500).json({ error: 'Failed to save messages' });
    }
});

// Email configuration page
router.get('/email-settings', requireAdmin, adminLayout, async (req, res) => {
    try {
        const defaults = {
            smtp: {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                user: 'contactgestorvip@gmail.com',
                pass: 'aoqmdezazknbbpg'
            },
            imap: {
                host: 'imap.uhserver.com',
                port: 993,
                tls: true,
                user: 'financeiro@clubevip.net',
                pass: 'CYRSG6vT86ZVfe'
            }
        };
        const config =
            (await req.db.collection('settings').findOne({ key: 'emailConfig' })) ||
            defaults;
        // Merge defaults with stored values to ensure all fields exist
        config.smtp = Object.assign({}, defaults.smtp, config.smtp);
        config.imap = Object.assign({}, defaults.imap, config.imap);
        res.render('admin/email_settings', {
            title: 'Configurações de Email',
            config,
            page: 'email-settings'
        });
    } catch (error) {
        console.error('Email settings error:', error);
        res.status(500).send('Error loading email settings');
    }
});

// Save email configuration
router.post('/email-settings', requireAdmin, async (req, res) => {
    const {
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        imapHost,
        imapPort,
        imapTls,
        imapUser,
        imapPass
    } = req.body;
    try {
        const defaults = {
            smtp: {
                host: 'smtp.gmail.com',
                port: 465,
                secure: true,
                user: 'contactgestorvip@gmail.com',
                pass: 'aoqmdezazknbbpg'
            },
            imap: {
                host: 'imap.uhserver.com',
                port: 993,
                tls: true,
                user: 'financeiro@clubevip.net',
                pass: 'CYRSG6vT86ZVfe'
            }
        };

        const current =
            (await req.db.collection('settings').findOne({ key: 'emailConfig' })) ||
            defaults;

        await req.db.collection('settings').updateOne(
            { key: 'emailConfig' },
            {
                $set: {
                    smtp: {
                        host: smtpHost || current.smtp.host,
                        port: Number(smtpPort) || current.smtp.port,
                        secure:
                            typeof smtpSecure === 'undefined'
                                ? current.smtp.secure
                                : !!smtpSecure,
                        user: smtpUser || current.smtp.user,
                        pass: smtpPass || current.smtp.pass
                    },
                    imap: {
                        host: imapHost || current.imap.host,
                        port: Number(imapPort) || current.imap.port,
                        tls:
                            typeof imapTls === 'undefined'
                                ? current.imap.tls
                                : !!imapTls,
                        user: imapUser || current.imap.user,
                        pass: imapPass || current.imap.pass
                    }
                }
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving email settings:', error);
        res.status(500).json({ error: 'Failed to save email settings' });
    }
});

// Save global session settings
router.post('/settings/session-limit', requireAdmin, async (req, res) => {
    const {
        limitEnabled,
        durationEnabled,
        maxSessions,
        sessionDuration,
        applyToAll
    } = req.body;
    const db = req.db;

    const parsedMax = parseInt(maxSessions);
    const parsedDuration = parseInt(sessionDuration);

    if (
        !Number.isInteger(parsedMax) ||
        parsedMax < 0 ||
        !Number.isInteger(parsedDuration) ||
        parsedDuration <= 0
    ) {
        return res.status(400).json({ error: 'Invalid input values' });
    }

    try {
        await db.collection('settings').updateOne(
            { key: 'sessionLimit' },
            {
                $set: {
                    limitEnabled: !!limitEnabled,
                    durationEnabled: !!durationEnabled,
                    maxSessions: parsedMax,
                    sessionDuration: parsedDuration
                }
            },
            { upsert: true }
        );

        if (applyToAll) {
            await db
                .collection('users')
                .updateMany({}, { $set: { maxSessions: parsedMax, sessionDuration: parsedDuration } });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving session limit:', error);
        res.status(500).json({ error: 'Failed to save session limit' });
    }
});

// Toggle code page access limit

// Block IP
router.post('/settings/block-ip', requireAdmin, async (req, res) => {
    let { ip, ips } = req.body;
    const db = req.db;

    if (!ips) ips = ip;

    if (typeof ips === 'string') {
        ips = ips.split(/[\s,;\n]+/);
    }

    if (!Array.isArray(ips) || ips.length === 0) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    const cleaned = ips.map(i => String(i).trim()).filter(Boolean);
    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid IPs provided' });
    }

    try {
        const existing = await db
            .collection('blocked_ips')
            .find({ address: { $in: cleaned } })
            .toArray();
        const existingSet = new Set(existing.map(b => b.address));
        const toInsert = cleaned
            .filter(i => !existingSet.has(i))
            .map(i => ({
                address: i,
                blockedAt: new Date(),
                blockedBy: req.session.admin.username
            }));
        if (toInsert.length > 0) {
            await db.collection('blocked_ips').insertMany(toInsert);
        }
        res.json({ success: true, blocked: toInsert.length });
    } catch (error) {
        console.error('Error blocking IP:', error);
        res.status(500).json({ error: 'Failed to block IP' });
    }
});

// Unblock IP
router.post('/settings/unblock-ip', requireAdmin, async (req, res) => {
    let { ip, ips } = req.body;
    const db = req.db;

    if (!ips) ips = ip;
    if (typeof ips === 'string') {
        ips = ips.split(/[\s,;\n]+/);
    }

    if (!Array.isArray(ips) || ips.length === 0) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    const cleaned = ips.map(i => String(i).trim()).filter(Boolean);
    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid IPs provided' });
    }

    try {
        const result = await db.collection('blocked_ips').deleteMany({ address: { $in: cleaned } });
        res.json({ success: true, removed: result.deletedCount });
    } catch (error) {
        console.error('Error unblocking IP:', error);
        res.status(500).json({ error: 'Failed to unblock IP' });
    }
});

// Reset all logs
router.post('/settings/reset-logs', requireAdmin, async (req, res) => {
    const db = req.db;

    try {
        await db.collection('access_logs').deleteMany({});
        console.log('All logs reset by admin:', req.session.admin.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting logs:', error);
        res.status(500).json({ error: 'Failed to reset logs' });
    }
});

// Reset all active sessions
router.post('/settings/reset-sessions', requireAdmin, async (req, res) => {
    const db = req.db;

    try {
        await resetAllSessions(db);
        console.log('All sessions reset by admin:', req.session.admin.username);
        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting sessions:', error);
        res.status(500).json({ error: 'Failed to reset sessions' });
    }
});

// Update session reset cron setting
router.post('/settings/reset-cron', requireAdmin, async (req, res) => {
    const { enabled, hours } = req.body;
    const db = req.db;

    const interval = parseInt(hours);
    if (enabled && (!Number.isInteger(interval) || interval <= 0)) {
        return res.status(400).json({ error: 'Invalid hours' });
    }

    try {
        await db.collection('settings').updateOne(
            { key: 'sessionResetCron' },
            { $set: { enabled: !!enabled, hours: interval || 24 } },
            { upsert: true }
        );
        await startSessionResetCron(db);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving reset cron setting:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// Update code display limit
router.post('/settings/code-display-limit', requireAdmin, async (req, res) => {
    const { limit } = req.body;
    const db = req.db;

    const parsed = parseInt(limit);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'Invalid limit' });
    }

    try {
        await db.collection('settings').updateOne(
            { key: 'codeDisplayLimit' },
            { $set: { limit: parsed } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving code display limit:', error);
        res.status(500).json({ error: 'Failed to save limit' });
    }
});

// Update auto reload setting
router.post('/settings/auto-reload', requireAdmin, async (req, res) => {
    const { enabled, limit } = req.body;
    const db = req.db;

    const parsed = parseInt(limit);
    if (enabled && (!Number.isInteger(parsed) || parsed <= 0)) {
        return res.status(400).json({ error: 'Invalid limit' });
    }

    try {
        await db.collection('settings').updateOne(
            { key: 'autoReload' },
            { $set: { enabled: !!enabled, limit: parsed || 0 } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving auto reload setting:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// Update email verification setting
router.post('/settings/email-verification', requireAdmin, async (req, res) => {
    const { enabled } = req.body;
    const db = req.db;

    try {
        await db.collection('settings').updateOne(
            { key: 'emailVerification' },
            { $set: { enabled: !!enabled } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving email verification setting:', error);
        res.status(500).json({ error: 'Failed to save setting' });
    }
});

// Update branding settings (logos and href)
router.post(
    '/settings/branding',
    requireAdmin,
    upload.fields([
        { name: 'panelLogoFile', maxCount: 1 },
        { name: 'cardLogoFile', maxCount: 1 }
    ]),
    async (req, res) => {
        const db = req.db;
        const { panelLogoUrl = '', cardLogoUrl = '', href = '', panelName = '' } = req.body;

        try {
            const update = { href };
            if (panelName) {
                update.panelName = panelName;
            }
            if (req.files && req.files.panelLogoFile && req.files.panelLogoFile[0]) {
                update.panelLogoUrl = '/images/' + req.files.panelLogoFile[0].filename;
            } else {
                update.panelLogoUrl = panelLogoUrl;
            }
            if (req.files && req.files.cardLogoFile && req.files.cardLogoFile[0]) {
                update.cardLogoUrl = '/images/' + req.files.cardLogoFile[0].filename;
            } else {
                update.cardLogoUrl = cardLogoUrl;
            }

            await db.collection('settings').updateOne(
                { key: 'branding' },
                { $set: update },
                { upsert: true }
            );
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving branding:', error);
            res.status(500).json({ error: 'Failed to save branding' });
        }
    }
);

// Update color palette settings
router.post('/settings/colors', requireAdmin, async (req, res) => {
    const db = req.db;
    const {
        bgStart = '#007bff',
        bgEnd = '#00bcd4',
        cardStart = '#00d4aa',
        cardEnd = '#00a085',
        buttonStart = '#007bff',
        buttonEnd = '#0056b3',
        updateStart = '#ff6b6b',
        updateEnd = '#ee5a24',
        textColor = '#333'
    } = req.body;

    try {
        await db.collection('settings').updateOne(
            { key: 'colors' },
            {
                $set: {
                    bgStart,
                    bgEnd,
                    cardStart,
                    cardEnd,
                    buttonStart,
                    buttonEnd,
                    updateStart,
                    updateEnd,
                    textColor
                }
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving colors:', error);
        res.status(500).json({ error: 'Failed to save colors' });
    }
});

// List all users
router.get('/users', requireAdmin, adminLayout, async (req, res) => {
    const db = req.db;
    try {
        const users = await db.collection('users').find().toArray();

        const successCounts = await db
            .collection('access_logs')
            .aggregate([
                {
                    $match: {
                        action: { $in: ['Login sucesso', 'verification_success'] }
                    }
                },
                { $group: { _id: '$email', count: { $sum: 1 } } }
            ])
            .toArray();

        const blockCounts = await db
            .collection('access_logs')
            .aggregate([
                {
                    $match: {
                        action: {
                            $in: ['Limite de sessão atingido', 'session_limit_reached']
                        }
                    }
                },
                { $group: { _id: '$email', count: { $sum: 1 } } }
            ])
            .toArray();

        const fetchCounts = await db
            .collection('access_logs')
            .aggregate([
                { $match: { action: 'Códigos recarregados' } },
                { $group: { _id: '$email', count: { $sum: 1 } } }
            ])
            .toArray();

        const accessMap = Object.fromEntries(
            successCounts.map(c => [c._id, c.count])
        );
        const blockMap = Object.fromEntries(blockCounts.map(c => [c._id, c.count]));
        const fetchMap = Object.fromEntries(fetchCounts.map(c => [c._id, c.count]));

        const decorated = users.map(u => ({
            ...u,
            accessCount: accessMap[u.email] || 0,
            blockedCount: blockMap[u.email] || 0,
            fetchCount: fetchMap[u.email] || 0
        }));

        decorated.sort((a, b) => b.fetchCount - a.fetchCount || b.accessCount - a.accessCount);

        const globalSettings =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };

        res.render('admin/users', {
            title: 'Manage Users',
            users: decorated,
            globalSettings,
            page: 'users'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Error loading users');
    }
});

// Add new user
router.post('/users', requireAdmin, async (req, res) => {
    const db = req.db;
    let { email, emails } = req.body;

    // Support both single email and bulk input
    if (!emails) {
        emails = email;
    }

    if (typeof emails === 'string') {
        emails = emails.split(/[\s,;\n]+/);
    }

    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'No emails provided' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleaned = emails
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e && emailRegex.test(e));

    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid emails provided' });
    }

    try {
        const globalSettings =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };

        const ops = cleaned.map(e => ({
            updateOne: {
                filter: { email: e },
                update: {
                    $setOnInsert: {
                        email: e,
                        verified: true,
                        createdAt: new Date(),
                        lastLogin: null,
                        maxSessions: globalSettings.maxSessions,
                        sessionDuration: globalSettings.sessionDuration
                    }
                },
                upsert: true
            }
        }));

        if (ops.length > 0) {
            await db.collection('users').bulkWrite(ops);
        }

        res.json({ success: true, added: cleaned.length });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Delete users in bulk
router.post('/users/bulk-delete', requireAdmin, async (req, res) => {
    let { emails } = req.body;
    const db = req.db;

    if (typeof emails === 'string') {
        emails = emails.split(/[\s,;\n]+/);
    }

    if (!Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({ error: 'No emails provided' });
    }

    const cleaned = emails
        .map(e => String(e).trim().toLowerCase())
        .filter(e => e);

    if (cleaned.length === 0) {
        return res.status(400).json({ error: 'No valid emails provided' });
    }

    try {
        const result = await db.collection('users').deleteMany({ email: { $in: cleaned } });
        await db.collection('verification_codes').deleteMany({ email: { $in: cleaned } });
        res.json({ success: true, removed: result.deletedCount });
    } catch (error) {
        console.error('Error deleting users:', error);
        res.status(500).json({ error: 'Failed to delete users' });
    }
});

// Delete user
router.delete('/users/:email', requireAdmin, async (req, res) => {
    const { email } = req.params;
    const db = req.db;

    try {
        await db.collection('users').deleteOne({ email });
        await db.collection('verification_codes').deleteMany({ email });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Reset user sessions
router.post('/users/:email/reset-session', requireAdmin, async (req, res) => {
    const { email } = req.params;
    const db = req.db;

    try {
        // Remove any active sessions and pending verification codes
        await db.collection('active_sessions').deleteMany({ email });
        await db.collection('verification_codes').deleteMany({ email });

        // Restore the user's session limits to the global defaults
        const globalSettings =
            (await db.collection('settings').findOne({ key: 'sessionLimit' })) || {
                limitEnabled: true,
                durationEnabled: true,
                maxSessions: 3,
                sessionDuration: 5
            };

        await db.collection('users').updateOne(
            { email },
            {
                $set: {
                    maxSessions: globalSettings.maxSessions,
                    sessionDuration: globalSettings.sessionDuration
                }
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting session:', error);
        res.status(500).json({ error: 'Failed to reset session' });
    }
});

// Update user session settings (maxSessions and sessionDuration)
router.put('/users/:email/session-settings', requireAdmin, async (req, res) => {
    const { email } = req.params;
    let { maxSessions, sessionDuration } = req.body;
    const db = req.db;

    maxSessions = parseInt(maxSessions);
    sessionDuration = parseInt(sessionDuration);

    if (
        !Number.isInteger(maxSessions) ||
        maxSessions < 0 ||
        !Number.isInteger(sessionDuration) ||
        sessionDuration <= 0
    ) {
        return res.status(400).json({ error: 'Invalid input values' });
    }

    try {
        const result = await db.collection('users').updateOne(
            { email },
            { $set: { maxSessions, sessionDuration } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating session settings:', error);
        res.status(500).json({ error: 'Failed to update session settings' });
    }
});

// Admin logout
router.get('/logout', (req, res) => {
    req.session.admin = null;
    res.redirect('/admin/login');
});

module.exports = router;
