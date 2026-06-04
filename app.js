const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const https = require('https');
require('dotenv').config();

const app = express();
const DATA_FILE = './db/data.json';

// Telegram Bot Configuration (set via environment variable)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Jellyfin Configuration (set via environment variable)
const JELLYFIN_URL = process.env.JELLYFIN_URL || 'http://65.21.197.246:8096';
const JELLYFIN_API_KEY = process.env.JELLYFIN_API_KEY || 'b54906fda5c5432ab6cdac3e4f566c2e';

// Load or initialize data
let data = {
    admins: [],
    resellers: [],
    clients: [],
    messages: [],
    creditTransactions: [],
    contentRequests: []
};

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

loadData();

// Create default admin if none exists
if (data.admins.length === 0) {
    data.admins.push({
        id: 1,
        username: 'admin',
        password: bcrypt.hashSync('admin123', 10),
        createdAt: new Date().toISOString()
    });
    saveData();
}

// Helper to generate IDs
function nextId(arr) {
    return arr.length > 0 ? Math.max(...arr.map(x => x.id)) + 1 : 1;
}

// Jellyfin API Helper - Fixed version
async function jellyfinRequest(endpoint, method = 'GET', body = null) {
    const url = `${JELLYFIN_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'X-Emby-Token': JELLYFIN_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        console.log(`Jellyfin API: ${method} ${url}`);
        const response = await fetch(url, options);
        console.log(`Jellyfin Status: ${response.status}`);
        
        // Always try to read the response
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`Jellyfin Data:`, JSON.stringify(data).substring(0, 200));
            return data;
        } else {
            const text = await response.text();
            console.log(`Jellyfin Text:`, text.substring(0, 200));
            if (!text || text.trim() === '') {
                return response.ok ? {} : null;
            }
            try {
                return JSON.parse(text);
            } catch {
                return response.ok ? {} : null;
            }
        }
    } catch (err) {
        console.error(`Jellyfin API Error: ${endpoint}`, err.message);
        return null;
    }
}

// Enable Jellyfin User
async function enableJellyfinUser(jellyfinId) {
    if (!jellyfinId) return;
    
    await jellyfinRequest(`/Users/${jellyfinId}/Policy`, 'POST', {
        IsAdministrator: false,
        IsHidden: false,
        IsDisabled: false,
        EnableAllDevices: true,
        EnableAllFolders: true,
        EnableAllChannels: false,
        EnableRemoteAccess: true,
        EnableMediaPlayback: true,
        EnableLiveTvAccess: true,
        EnableLiveTvManagement: false,
        EnableContentDownloading: false,
        EnableSyncTranscoding: false,
        EnableMediaConversion: false,
        AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
        PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"
    });
}

// Disable Jellyfin User
async function disableJellyfinUser(jellyfinId) {
    if (!jellyfinId) return;
    
    await jellyfinRequest(`/Users/${jellyfinId}/Policy`, 'POST', {
        IsAdministrator: false,
        IsHidden: true,
        IsDisabled: true,
        EnableAllDevices: false,
        EnableAllFolders: false,
        EnableAllChannels: false,
        EnableRemoteAccess: false,
        EnableMediaPlayback: false,
        EnableLiveTvAccess: false,
        EnableLiveTvManagement: false,
        EnableContentDownloading: false,
        EnableSyncTranscoding: false,
        EnableMediaConversion: false,
        AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
        PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"
    });
}

// Create Jellyfin User - Direct implementation
async function createJellyfinUser(username, password = '') {
    const userPassword = password || Math.random().toString(36).slice(-8);
    
    try {
        console.log(`Creating Jellyfin user: ${username}`);
        
        // Create user - direct fetch
        const createResponse = await fetch(`${JELLYFIN_URL}/Users/New`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': JELLYFIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Name: username,
                Password: userPassword
            })
        });
        
        const createText = await createResponse.text();
        console.log(`Create response: ${createResponse.status} - ${createText.substring(0, 200)}`);
        
        if (!createText || createText.trim() === '') {
            console.error('Jellyfin returned empty response for user creation');
            return null;
        }
        
        const result = JSON.parse(createText);
        if (!result || !result.Id) {
            console.error('Failed to create Jellyfin user:', result);
            return null;
        }
        
        const userId = result.Id;
        console.log(`Created Jellyfin user: ${username} (${userId})`);
        
        // Set policy
        const policyResponse = await fetch(`${JELLYFIN_URL}/Users/${userId}/Policy`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': JELLYFIN_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                IsAdministrator: false,
                IsHidden: true,
                IsDisabled: false,
                EnableAllDevices: true,
                EnableAllFolders: true,
                EnableAllChannels: false,
                EnableRemoteAccess: true,
                EnableMediaPlayback: true,
                EnableContentDownloading: false,
                EnableSyncTranscoding: false,
                EnableMediaConversion: false,
                AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
                PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"
            })
        });
        
        console.log(`Policy response: ${policyResponse.status}`);
        
        return userId;
    } catch (err) {
        console.error('Error creating Jellyfin user:', err);
        return null;
    }
}

// Disable Jellyfin User
async function disableJellyfinUser(jellyfinId) {
    if (!jellyfinId) return;
    
    await jellyfinRequest(`/Users/${jellyfinId}/Policy`, 'POST', {
        IsAdministrator: false,
        IsHidden: true,
        IsDisabled: true,
        EnableAllDevices: false,
        EnableAllFolders: false,
        EnableAllChannels: false,
        EnableRemoteAccess: false,
        EnableMediaPlayback: false,
        EnableLiveTvAccess: false,
        EnableLiveTvManagement: false,
        AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
        PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider"
    });
}

// Enable Jellyfin User (re-activate after expiry)
async function enableJellyfinUser(jellyfinId) {
    if (!jellyfinId) return;
    
    await jellyfinRequest(`/Users/${jellyfinId}/Policy`, 'POST', {
        IsAdministrator: false,
        IsHidden: false,
        IsDisabled: false,
        EnableAllDevices: true,
        EnableAllFolders: true,
        EnableAllChannels: false,
        EnableRemoteAccess: true,
        EnableMediaPlayback: true,
        EnableAudioPlaybackTranscoding: true,
        EnableVideoPlaybackTranscoding: true,
        EnablePlaybackRemuxing: true,
        EnableContentDownloading: false,
        EnableSyncTranscoding: false,
        EnableMediaConversion: false,
        EnableContentDeletion: false,
        EnableRemoteControlOfOtherUsers: false,
        EnableSharedDeviceControl: false,
        EnableLiveTvManagement: false,
        EnableLiveTvAccess: true,
        EnableContentDownloading: false,
        EnableSyncTranscoding: false,
        EnableMediaConversion: false,
        EnableContentDeletion: false,
        EnableRemoteControlOfOtherUsers: false,
        EnableUserPreferenceAccess: true,
        AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
        PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
        SyncPlayAccess: "None"
    });
}

// Delete Jellyfin User
async function deleteJellyfinUser(jellyfinId) {
    if (!jellyfinId) return;
    
    await jellyfinRequest(`/Users/${jellyfinId}`, 'DELETE');
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'steam-fusion-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.set('view engine', 'ejs');

// Auth middleware
function requireAdmin(req, res, next) {
    if (req.session.adminId) return next();
    res.redirect('/login');
}

function requireReseller(req, res, next) {
    if (!req.session.resellerId) return res.redirect('/login');
    
    // Check if reseller is active
    const reseller = data.resellers.find(r => r.id === req.session.resellerId);
    if (!reseller || reseller.active === false) {
        req.session.destroy();
        return res.redirect('/login?disabled=1');
    }
    
    next();
}

// ========== LOGIN ROUTES ==========

app.get('/', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin');
    if (req.session.resellerId) return res.redirect('/reseller');
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    const error = req.query.disabled ? 'Your account has been disabled. Please contact support.' : null;
    res.render('login', { error });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Get client IP - handle IPv6-mapped IPv4 format
    let clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.connection?.remoteAddress ||
                   req.ip ||
                   'Unknown';
    
    // Remove IPv6 prefix if present (::ffff:)
    if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
    }
    
    // Check admin
    const admin = data.admins.find(a => a.username === username);
    if (admin && bcrypt.compareSync(password, admin.password)) {
        req.session.adminId = admin.id;
        req.session.userType = 'admin';
        return res.redirect('/admin');
    }
    
    // Check reseller
    const reseller = data.resellers.find(r => r.username === username && r.active);
    if (reseller && bcrypt.compareSync(password, reseller.password)) {
        req.session.resellerId = reseller.id;
        req.session.userType = 'reseller';
        
        // Store previous login before updating
        if (reseller.lastLogin) {
            reseller.previousLogin = reseller.lastLogin;
            reseller.previousIp = reseller.lastIp;
        }
        
        // Update current login info
        reseller.lastLogin = new Date().toISOString();
        reseller.lastIp = clientIp;
        saveData();
        
        return res.redirect('/reseller');
    }
    
    res.render('login', { error: 'Invalid username or password' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ========== ADMIN ROUTES ==========

app.get('/admin', requireAdmin, async (req, res) => {
    // Helper function to convert country code to flag emoji
    const countryCodeToFlag = (code) => {
        if (!code || code.length !== 2) return '🌍';
        const base = 127397;
        return String.fromCodePoint(base + code.charCodeAt(0)) + String.fromCodePoint(base + code.charCodeAt(1));
    };
    
    // Get country flags for resellers
    const resellersWithFlags = await Promise.all(data.resellers.map(async (r) => {
        const clients = data.clients.filter(c => c.resellerId === r.id);
        
        let countryCode = '';
        let countryName = 'Unknown';
        let countryFlag = '🌍';
        
        if (r.lastIp && r.lastIp !== 'Unknown' && !r.lastIp.startsWith('127.') && !r.lastIp.startsWith('192.168.') && !r.lastIp.startsWith('10.') && !r.lastIp.startsWith('::')) {
            try {
                const response = await fetch(`http://ip-api.com/json/${r.lastIp}?fields=status,country,countryCode`);
                const ipData = await response.json();
                if (ipData.status === 'success' && ipData.countryCode) {
                    countryCode = ipData.countryCode.toUpperCase();
                    countryName = ipData.country || 'Unknown';
                    countryFlag = countryCodeToFlag(countryCode);
                }
            } catch (err) {
                console.error('IP lookup error:', err);
            }
        }
        
        return {
            ...r,
            clientCount: clients.length,
            paidCount: clients.filter(c => c.isPaid).length,
            countryCode,
            countryName,
            countryFlag
        };
    }));
    
    const totalCredits = data.resellers.reduce((sum, r) => sum + r.credits, 0);
    const totalClients = data.clients.length;
    
    // Add reseller name to each content request
    const pendingRequests = data.contentRequests
        .filter(cr => cr.status === 'pending')
        .map(cr => {
            const reseller = data.resellers.find(r => r.id === cr.resellerId);
            return {
                ...cr,
                reseller_name: reseller ? reseller.username : 'Unknown'
            };
        });
    
    res.render('admin/dashboard', { 
        resellers: resellersWithFlags, 
        totalCredits,
        totalClients,
        contentRequests: pendingRequests,
        adminId: req.session.adminId
    });
});

// Get country from IP (using ip-api.com free API)
async function getCountryFromIp(ip) {
    if (!ip || ip === 'Unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return { country: 'Local', countryCode: '🌍' };
    }
    
    try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode`);
        const data = await response.json();
        
        if (data.status === 'success') {
            // Convert country code to flag emoji
            const flag = data.countryCode?.toUpperCase().replace(/./g, char => 
                String.fromCodePoint(127397 + char.charCodeAt(0))
            ) || '🌍';
            return { country: data.country, flag };
        }
    } catch (err) {
        console.error('IP lookup error:', err);
    }
    
    return { country: 'Unknown', flag: '🌍' };
}

// Get all resellers (for dropdowns)
app.get('/admin/resellers', requireAdmin, (req, res) => {
    const resellers = data.resellers.map(r => ({
        id: r.id,
        username: r.username,
        clientCount: data.clients.filter(c => c.resellerId === r.id).length
    }));
    res.json(resellers);
});

// Create reseller
app.post('/admin/reseller/create', requireAdmin, (req, res) => {
    const { username, password, note } = req.body;
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password are required' });
    }
    
    if (data.resellers.some(r => r.username === username)) {
        return res.json({ success: false, error: 'Username already exists' });
    }
    
    const reseller = {
        id: nextId(data.resellers),
        username,
        password: bcrypt.hashSync(password, 10),
        note: note || '',
        credits: 0,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: req.session.adminId
    };
    
    data.resellers.push(reseller);
    saveData();
    res.json({ success: true });
});

// Add credits to reseller
app.post('/admin/reseller/credits', requireAdmin, (req, res) => {
    const { resellerId, credits, trialCredits } = req.body;
    const reseller = data.resellers.find(r => r.id === parseInt(resellerId));
    
    if (!reseller) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    // Add regular credits
    if (credits && parseInt(credits) !== 0) {
        const amount = parseInt(credits);
        reseller.credits += amount;
        
        data.creditTransactions.push({
            id: nextId(data.creditTransactions),
            resellerId: parseInt(resellerId),
            amount,
            type: 'add',
            note: 'Added by admin',
            createdAt: new Date().toISOString(),
            createdBy: req.session.adminId
        });
    }
    
    // Add trial credits
    if (trialCredits && parseInt(trialCredits) !== 0) {
        reseller.trialCredits = (reseller.trialCredits || 0) + parseInt(trialCredits);
    }
    
    saveData();
    res.json({ 
        success: true,
        credits: reseller.credits,
        trialCredits: reseller.trialCredits || 0
    });
});

// Toggle reseller active status
app.post('/admin/reseller/toggle', requireAdmin, (req, res) => {
    const { resellerId } = req.body;
    const reseller = data.resellers.find(r => r.id === parseInt(resellerId));
    
    if (reseller) {
        reseller.active = reseller.active === false ? true : false;
        console.log(`Toggled reseller ${reseller.username} to active=${reseller.active}`);
        saveData();
        res.json({ success: true, active: reseller.active });
    } else {
        res.json({ success: false, error: 'Reseller not found' });
    }
});

// Delete reseller and all their clients
app.post('/admin/reseller/delete', requireAdmin, (req, res) => {
    const { resellerId } = req.body;
    const resellerIndex = data.resellers.findIndex(r => r.id === parseInt(resellerId));
    
    if (resellerIndex === -1) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    const reseller = data.resellers[resellerIndex];
    
    // Delete all clients from Jellyfin
    const clients = data.clients.filter(c => c.resellerId === parseInt(resellerId));
    for (const client of clients) {
        if (client.jellyfinId) {
            deleteJellyfinUser(client.jellyfinId);
        }
    }
    
    // Remove clients from data
    data.clients = data.clients.filter(c => c.resellerId !== parseInt(resellerId));
    
    // Remove reseller from data
    data.resellers.splice(resellerIndex, 1);
    
    // Remove related messages and content requests
    data.messages = data.messages.filter(m => m.toId !== parseInt(resellerId) && m.fromId !== parseInt(resellerId));
    data.contentRequests = data.contentRequests.filter(cr => cr.resellerId !== parseInt(resellerId));
    data.creditTransactions = data.creditTransactions.filter(t => t.resellerId !== parseInt(resellerId));
    
    saveData();
    res.json({ success: true });
});

// Send note to reseller
app.post('/admin/message/send', requireAdmin, (req, res) => {
    const { resellerId, message } = req.body;
    
    data.messages.push({
        id: nextId(data.messages),
        fromType: 'admin',
        fromId: req.session.adminId,
        toType: 'reseller',
        toId: parseInt(resellerId),
        message,
        read: false,
        createdAt: new Date().toISOString()
    });
    
    saveData();
    res.json({ success: true });
});

// Get reseller details
app.get('/admin/reseller/:id', requireAdmin, (req, res) => {
    const reseller = data.resellers.find(r => r.id === parseInt(req.params.id));
    const clients = data.clients.filter(c => c.resellerId === parseInt(req.params.id));
    const transactions = data.creditTransactions
        .filter(t => t.resellerId === parseInt(req.params.id))
        .slice(-10)
        .reverse();
    
    res.json({ reseller, clients, transactions });
});

// Get all clients for admin
app.get('/admin/clients', requireAdmin, async (req, res) => {
    // Get last activity from Jellyfin
    let jellyfinUsers = [];
    try {
        const response = await fetch(`${JELLYFIN_URL}/Users`, {
            headers: { 'X-Emby-Token': JELLYFIN_API_KEY }
        });
        const text = await response.text();
        if (text && text.trim()) {
            jellyfinUsers = JSON.parse(text);
        }
    } catch (err) {
        console.error('Error fetching Jellyfin users:', err);
    }
    
    // Create a map of jellyfinId -> lastActivityDate
    const activityMap = {};
    jellyfinUsers.forEach(u => {
        if (u.Id && u.LastActivityDate) {
            activityMap[u.Id] = u.LastActivityDate;
        }
    });
    
    const clients = data.clients.map(c => {
        const reseller = data.resellers.find(r => r.id === c.resellerId);
        const endDate = new Date(c.trialEnd);
        const now = new Date();
        return {
            ...c,
            resellerName: reseller ? reseller.username : 'Unknown',
            isExpired: endDate < now,
            lastWatched: activityMap[c.jellyfinId] || null,
            ipHistory: c.ipHistory || [],
            lastIp: c.lastIp || null
        };
    }).sort((a, b) => {
        // Sort by last watched (most recent first)
        if (a.lastWatched && b.lastWatched) {
            return new Date(b.lastWatched) - new Date(a.lastWatched);
        }
        if (a.lastWatched) return -1;
        if (b.lastWatched) return 1;
        return 0;
    });
    
    res.json(clients);
});

// Track client IP when they access content (called from Jellyfin webhook or manually)
app.post('/admin/client/track-ip', requireAdmin, (req, res) => {
    const { clientId, ip } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId));
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Initialize ipHistory if not exists
    if (!client.ipHistory) {
        client.ipHistory = [];
    }
    
    // Add IP to history (keep last 5)
    client.ipHistory.unshift({
        ip: ip,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 5 IPs
    if (client.ipHistory.length > 5) {
        client.ipHistory = client.ipHistory.slice(0, 5);
    }
    
    // Also update lastIp
    client.lastIp = ip;
    
    saveData();
    res.json({ success: true });
});

// Update client expiry date (admin)
app.post('/admin/client/update-expiry', requireAdmin, async (req, res) => {
    const { clientId, newExpiryDate } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId));
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    const oldExpiry = client.trialEnd;
    client.trialEnd = new Date(newExpiryDate).toISOString();
    
    // If extending and was expired, re-enable on Jellyfin
    if (new Date(newExpiryDate) > new Date() && new Date(oldExpiry) < new Date()) {
        if (client.jellyfinId) {
            await enableJellyfinUser(client.jellyfinId);
        }
    }
    
    saveData();
    res.json({ success: true, newExpiry: client.trialEnd });
});

// Update client note (admin)
app.post('/admin/client/update-note', requireAdmin, (req, res) => {
    const { clientId, note } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId));
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    client.note = note || '';
    saveData();
    res.json({ success: true, note: client.note });
});

// Transfer client to another reseller (admin)
app.post('/admin/client/transfer', requireAdmin, (req, res) => {
    const { clientId, newResellerId } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId));
    const newReseller = data.resellers.find(r => r.id === parseInt(newResellerId));
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    if (!newReseller) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    const oldResellerId = client.resellerId;
    client.resellerId = parseInt(newResellerId);
    
    saveData();
    res.json({ 
        success: true, 
        client: client.username,
        oldResellerId: oldResellerId,
        newResellerId: newResellerId,
        newResellerName: newReseller.username
    });
});

// Get expiring clients (within 3 days)
app.get('/admin/expiring-clients', requireAdmin, (req, res) => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const expiringClients = data.clients.filter(c => {
        const endDate = new Date(c.trialEnd);
        return endDate >= now && endDate <= threeDaysFromNow;
    }).map(c => {
        const reseller = data.resellers.find(r => r.id === c.resellerId);
        return {
            ...c,
            resellerName: reseller ? reseller.username : 'Unknown',
            daysUntilExpiry: Math.ceil((new Date(c.trialEnd) - now) / (1000 * 60 * 60 * 24))
        };
    });
    
    res.json(expiringClients);
});

// Toggle client (admin)
app.post('/admin/client/toggle', requireAdmin, async (req, res) => {
    const { clientId } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId));
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Toggle disabled status
    client.disabled = client.disabled ? false : true;
    
    // Update Jellyfin - disable/enable user
    if (client.jellyfinId) {
        if (client.disabled) {
            await disableJellyfinUser(client.jellyfinId);
        } else {
            await enableJellyfinUser(client.jellyfinId);
        }
    }
    
    saveData();
    res.json({ success: true, disabled: client.disabled });
});

// Delete client (admin)
app.post('/admin/client/delete', requireAdmin, async (req, res) => {
    const { clientId } = req.body;
    const clientIndex = data.clients.findIndex(c => c.id === parseInt(clientId));
    
    if (clientIndex === -1) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    const client = data.clients[clientIndex];
    
    // Delete from Jellyfin
    if (client.jellyfinId) {
        await deleteJellyfinUser(client.jellyfinId);
    }
    
    // Remove from data
    data.clients.splice(clientIndex, 1);
    saveData();
    
    res.json({ success: true });
});

// Get reseller login credentials (for admin to share)
app.get('/admin/reseller/:id/credentials', requireAdmin, (req, res) => {
    const reseller = data.resellers.find(r => r.id === parseInt(req.params.id));
    
    if (!reseller) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    // Return username and a placeholder for password (admin can reset password)
    res.json({
        success: true,
        username: reseller.username,
        note: reseller.note || '',
        createdAt: reseller.createdAt,
        loginUrl: `${req.protocol}://${req.get('host')}`
    });
});

// Reset reseller password
app.post('/admin/reseller/reset-password', requireAdmin, (req, res) => {
    const { resellerId, newPassword } = req.body;
    const reseller = data.resellers.find(r => r.id === parseInt(resellerId));
    
    if (!reseller) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    const password = newPassword || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    reseller.password = bcrypt.hashSync(password, 10);
    
    saveData();
    res.json({ success: true, username: reseller.username, password: password });
});

// Answer content request
app.post('/admin/content-request/respond', requireAdmin, (req, res) => {
    const { requestId, status, response } = req.body;
    const request = data.contentRequests.find(cr => cr.id === parseInt(requestId));
    
    if (request) {
        request.status = status;
        request.adminResponse = response;
        request.resolvedAt = new Date().toISOString();
        request.resolvedBy = req.session.adminId;
        
        // Notify reseller
        data.messages.push({
            id: nextId(data.messages),
            fromType: 'admin',
            fromId: req.session.adminId,
            toType: 'reseller',
            toId: request.resellerId,
            message: `Your content request has been ${status}. Admin response: ${response}`,
            read: false,
            createdAt: new Date().toISOString()
        });
        
        saveData();
    }
    
    res.json({ success: true });
});

// ========== RESELLER ROUTES ==========

app.get('/reseller', requireReseller, async (req, res) => {
    const reseller = data.resellers.find(r => r.id === req.session.resellerId);
    
    // Get country name from current IP
    let countryName = 'Unknown';
    if (reseller.lastIp && reseller.lastIp !== 'Unknown' && !reseller.lastIp.startsWith('127.') && !reseller.lastIp.startsWith('192.168.') && !reseller.lastIp.startsWith('10.')) {
        try {
            const response = await fetch(`http://ip-api.com/json/${reseller.lastIp}?fields=status,country`);
            const ipData = await response.json();
            if (ipData.status === 'success') {
                countryName = ipData.country || 'Unknown';
            }
        } catch (err) {
            console.error('IP lookup error:', err);
        }
    }
    
    // Get country name from previous IP
    let previousCountryName = 'Unknown';
    if (reseller.previousIp && reseller.previousIp !== 'Unknown' && !reseller.previousIp.startsWith('127.') && !reseller.previousIp.startsWith('192.168.') && !reseller.previousIp.startsWith('10.')) {
        try {
            const response = await fetch(`http://ip-api.com/json/${reseller.previousIp}?fields=status,country`);
            const ipData = await response.json();
            if (ipData.status === 'success') {
                previousCountryName = ipData.country || 'Unknown';
            }
        } catch (err) {
            console.error('IP lookup error:', err);
        }
    }
    
    const resellerWithCountry = { ...reseller, countryName, previousCountryName };
    
    // Get last activity from Jellyfin
    let jellyfinUsers = [];
    try {
        const response = await fetch(`${JELLYFIN_URL}/Users`, {
            headers: { 'X-Emby-Token': JELLYFIN_API_KEY }
        });
        const text = await response.text();
        if (text && text.trim()) {
            jellyfinUsers = JSON.parse(text);
        }
    } catch (err) {
        console.error('Error fetching Jellyfin users:', err);
    }
    
    // Create a map of jellyfinId -> lastActivityDate
    const activityMap = {};
    jellyfinUsers.forEach(u => {
        if (u.Id && u.LastActivityDate) {
            activityMap[u.Id] = u.LastActivityDate;
        }
    });
    
    const clients = data.clients.filter(c => c.resellerId === req.session.resellerId).map(c => {
        const endDate = new Date(c.trialEnd);
        const now = new Date();
        return {
            ...c,
            isExpired: endDate < now,
            daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)),
            lastWatched: activityMap[c.jellyfinId] || null
        };
    });
    const messages = data.messages
        .filter(m => m.toType === 'reseller' && m.toId === req.session.resellerId)
        .reverse();
    const contentRequests = data.contentRequests
        .filter(cr => cr.resellerId === req.session.resellerId)
        .reverse();
    
    res.render('reseller/dashboard', { 
        reseller: resellerWithCountry, 
        clients, 
        messages,
        contentRequests,
        canGiveTrial: (reseller.trialCredits || 0) >= 1
    });
});

// Add one month to a date (handles month-end properly)
function addMonths(date, months) {
    const result = new Date(date);
    const expectedMonth = result.getMonth() + months;
    result.setMonth(expectedMonth);
    
    // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28/29, not Mar 3)
    if (result.getMonth() !== expectedMonth % 12) {
        // Set to last day of previous month
        result.setDate(0); // Last day of previous month
    }
    
    return result;
}

// Create trial (24 hours)
app.post('/reseller/trial/create', requireReseller, async (req, res) => {
    const { username, password } = req.body;
    const reseller = data.resellers.find(r => r.id === req.session.resellerId);
    
    // Check trial credits (not regular credits)
    if ((reseller.trialCredits || 0) < 1) {
        return res.json({ success: false, error: 'Insufficient trial credits. You need 1 trial credit to create a trial.' });
    }
    
    if (!username) {
        return res.json({ success: false, error: 'Username is required' });
    }
    
    // Check if username exists locally
    const localExists = data.clients.some(c => c.username.toLowerCase() === username.toLowerCase());
    if (localExists) {
        return res.json({ success: false, error: 'Username already exists. Please choose a different username.' });
    }
    
    // Check if username exists on Jellyfin
    try {
        const jellyfinUsers = await jellyfinRequest('/Users');
        if (jellyfinUsers && Array.isArray(jellyfinUsers)) {
            const jellyfinExists = jellyfinUsers.some(u => u.Name.toLowerCase() === username.toLowerCase());
            if (jellyfinExists) {
                return res.json({ success: false, error: 'Username already exists on Jellyfin. Please choose a different username.' });
            }
        }
    } catch (err) {
        console.error('Error checking Jellyfin users:', err);
        // Continue anyway - we'll try to create the user
    }
    
    // Generate password if not provided
    const userPassword = password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    
    // Create user on Jellyfin
    const jellyfinId = await createJellyfinUser(username, userPassword);
    
    if (!jellyfinId) {
        return res.json({ success: false, error: 'Failed to create user on Jellyfin. Please try again.' });
    }
    
    // Deduct trial credit
    reseller.trialCredits = (reseller.trialCredits || 0) - 1;
    
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours trial
    
    data.clients.push({
        id: nextId(data.clients),
        jellyfinId,
        username,
        password: userPassword, // Store password for reseller to share
        resellerId: req.session.resellerId,
        trialStart: now.toISOString(),
        trialEnd: trialEnd.toISOString(),
        isPaid: false,
        createdAt: now.toISOString()
    });
    
    saveData();
    res.json({ 
        success: true, 
        trialEnd: trialEnd.toISOString(), 
        jellyfinId,
        username,
        password: userPassword,
        jellyfinUrl: JELLYFIN_URL,
        trialCreditsLeft: reseller.trialCredits
    });
});

// Extend trial by adding months (gives trial credit back)
app.post('/reseller/trial/extend', requireReseller, async (req, res) => {
    const { clientId, months } = req.body;
    const reseller = data.resellers.find(r => r.id === req.session.resellerId);
    const monthsToAdd = parseInt(months) || 1;
    
    console.log(`Extend request: clientId=${clientId}, months=${monthsToAdd}, reseller.credits=${reseller?.credits}, reseller.trialCredits=${reseller?.trialCredits}`);
    
    if (!reseller) {
        return res.json({ success: false, error: 'Reseller not found' });
    }
    
    if (reseller.credits < monthsToAdd) {
        return res.json({ success: false, error: `Insufficient credits. You need ${monthsToAdd} credits but have ${reseller.credits}.` });
    }
    
    const client = data.clients.find(c => c.id === parseInt(clientId) && c.resellerId === req.session.resellerId);
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Calculate new end date
    const now = new Date();
    const currentEnd = new Date(client.trialEnd);
    
    // Start from current end if not expired, otherwise from now
    let baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = addMonths(baseDate, monthsToAdd);
    
    console.log(`Extending client ${client.username}: currentEnd=${currentEnd.toISOString()}, newEnd=${newEnd.toISOString()}`);
    
    client.trialEnd = newEnd.toISOString();
    client.isPaid = true;
    
    // Enable user on Jellyfin if disabled
    if (client.jellyfinId) {
        await enableJellyfinUser(client.jellyfinId);
    }
    
    // Deduct credits
    reseller.credits -= monthsToAdd;
    
    // Give trial credit back (1 per month extended)
    reseller.trialCredits = (reseller.trialCredits || 0) + monthsToAdd;
    
    data.creditTransactions.push({
        id: nextId(data.creditTransactions),
        resellerId: req.session.resellerId,
        amount: -monthsToAdd,
        type: 'deduct',
        note: `Extended trial for client ${client.username} by ${monthsToAdd} month(s)`,
        createdAt: new Date().toISOString()
    });
    
    saveData();
    console.log(`Extended successfully. Credits: ${reseller.credits}, TrialCredits: ${reseller.trialCredits}, New end: ${newEnd.toISOString()}`);
    res.json({ 
        success: true, 
        newEnd: newEnd.toISOString(),
        creditsLeft: reseller.credits,
        trialCreditsLeft: reseller.trialCredits,
        trialCreditsReceived: monthsToAdd
    });
});

// Get expiring clients for reseller (within 3 days)
app.get('/reseller/expiring-clients', requireReseller, (req, res) => {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const expiringClients = data.clients.filter(c => {
        const endDate = new Date(c.trialEnd);
        return c.resellerId === req.session.resellerId && 
               endDate >= now && 
               endDate <= threeDaysFromNow;
    }).map(c => {
        return {
            ...c,
            daysUntilExpiry: Math.ceil((new Date(c.trialEnd) - now) / (1000 * 60 * 60 * 24))
        };
    });
    
    res.json(expiringClients);
});

// Get expired clients for reseller
app.get('/reseller/expired-clients', requireReseller, (req, res) => {
    const now = new Date();
    
    const expiredClients = data.clients.filter(c => {
        const endDate = new Date(c.trialEnd);
        return c.resellerId === req.session.resellerId && endDate < now;
    });
    
    res.json(expiredClients);
});

// Reset client password (reseller)
app.post('/reseller/client/reset-password', requireReseller, async (req, res) => {
    const { clientId } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId) && c.resellerId === req.session.resellerId);
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Generate new password
    const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    
    // Update on Jellyfin
    if (client.jellyfinId) {
        try {
            await jellyfinRequest(`/Users/${client.jellyfinId}/Password`, 'POST', {
                Id: client.jellyfinId,
                NewPw: newPassword
            });
        } catch (err) {
            console.error('Error resetting Jellyfin password:', err);
        }
    }
    
    // Update in local data
    client.password = newPassword;
    saveData();
    
    res.json({ success: true, password: newPassword, username: client.username });
});

// Update client note (reseller)
app.post('/reseller/client/update-note', requireReseller, (req, res) => {
    const { clientId, note } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId) && c.resellerId === req.session.resellerId);
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    client.note = note || '';
    saveData();
    res.json({ success: true, note: client.note });
});

// Get credit history for reseller
app.get('/reseller/credit-history', requireReseller, (req, res) => {
    const history = data.creditTransactions
        .filter(t => t.resellerId === req.session.resellerId)
        .map(t => {
            const admin = data.admins.find(a => a.id === t.createdBy);
            return {
                ...t,
                adminName: admin ? admin.username : 'System'
            };
        })
        .reverse();
    
    res.json(history);
});

// Get credit history for admin
app.get('/admin/credit-history', requireAdmin, (req, res) => {
    const history = data.creditTransactions
        .map(t => {
            const reseller = data.resellers.find(r => r.id === t.resellerId);
            const admin = data.admins.find(a => a.id === t.createdBy);
            return {
                ...t,
                resellerName: reseller ? reseller.username : 'Unknown',
                adminName: admin ? admin.username : 'System'
            };
        })
        .reverse();
    
    res.json(history);
});

// Backup endpoint
app.get('/admin/backup', requireAdmin, (req, res) => {
    const backup = {
        timestamp: new Date().toISOString(),
        admins: data.admins,
        resellers: data.resellers,
        clients: data.clients,
        messages: data.messages,
        creditTransactions: data.creditTransactions,
        contentRequests: data.contentRequests
    };
    
    res.json(backup);
});
app.post('/reseller/content-request', requireReseller, (req, res) => {
    const { request } = req.body;
    
    if (!request) {
        return res.json({ success: false, error: 'Request is required' });
    }
    
    data.contentRequests.push({
        id: nextId(data.contentRequests),
        resellerId: req.session.resellerId,
        requestText: request,
        status: 'pending',
        adminResponse: null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null
    });
    
    saveData();
    res.json({ success: true });
});

// Get client credentials (for reseller to share)
app.get('/reseller/client/:id/credentials', requireReseller, (req, res) => {
    const client = data.clients.find(c => c.id === parseInt(req.params.id) && c.resellerId === req.session.resellerId);
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Track IP viewing credentials
    let clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.connection?.remoteAddress ||
                   req.ip ||
                   'Unknown';
    
    // Remove IPv6 prefix if present
    if (clientIp && clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
    }
    
    // Initialize ipHistory if not exists
    if (!client.ipHistory) {
        client.ipHistory = [];
    }
    
    // Add IP to history if different from last
    if (client.ipHistory.length === 0 || client.ipHistory[0].ip !== clientIp) {
        client.ipHistory.unshift({
            ip: clientIp,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 5 IPs
        if (client.ipHistory.length > 5) {
            client.ipHistory = client.ipHistory.slice(0, 5);
        }
        
        // Also update lastIp
        client.lastIp = clientIp;
        saveData();
    }
    
    res.json({
        success: true,
        username: client.username,
        password: client.password,
        jellyfinUrl: JELLYFIN_URL,
        expires: client.trialEnd,
        note: client.note || ''
    });
});

// Toggle client (enable/disable)
app.post('/reseller/client/toggle', requireReseller, async (req, res) => {
    const { clientId } = req.body;
    const client = data.clients.find(c => c.id === parseInt(clientId) && c.resellerId === req.session.resellerId);
    
    if (!client) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    // Toggle disabled status
    client.disabled = client.disabled ? false : true;
    
    // Update Jellyfin - disable/enable user
    if (client.jellyfinId) {
        if (client.disabled) {
            await disableJellyfinUser(client.jellyfinId);
        } else {
            await enableJellyfinUser(client.jellyfinId);
        }
    }
    
    saveData();
    res.json({ success: true, disabled: client.disabled });
});

// Delete client
app.post('/reseller/client/delete', requireReseller, async (req, res) => {
    const { clientId } = req.body;
    const clientIndex = data.clients.findIndex(c => c.id === parseInt(clientId) && c.resellerId === req.session.resellerId);
    
    if (clientIndex === -1) {
        return res.json({ success: false, error: 'Client not found' });
    }
    
    const client = data.clients[clientIndex];
    
    // Delete from Jellyfin
    if (client.jellyfinId) {
        await deleteJellyfinUser(client.jellyfinId);
    }
    
    // Remove from local data
    data.clients.splice(clientIndex, 1);
    saveData();
    
    res.json({ success: true });
});

// Mark message as read
app.post('/reseller/message/read', requireReseller, (req, res) => {
    const { messageId } = req.body;
    const message = data.messages.find(m => m.id === parseInt(messageId));
    
    if (message && message.toId === req.session.resellerId) {
        message.read = true;
        saveData();
    }
    
    res.json({ success: true });
});

// ========== CRON JOB: Disable expired trials ==========

// Run this check periodically (could also be external cron)
async function checkExpiredTrials() {
    const now = new Date();
    let changed = false;
    
    for (const client of data.clients) {
        const endDate = new Date(client.trialEnd);
        
        if (endDate < now && client.jellyfinId) {
            // Trial expired - disable on Jellyfin
            await disableJellyfinUser(client.jellyfinId);
            client.expired = true;
            changed = true;
        }
    }
    
    if (changed) {
        saveData();
        console.log('✅ Checked and disabled expired trials');
    }
}

// Run every 30 minutes to reduce Jellyfin load
setInterval(checkExpiredTrials, 30 * 60 * 1000);

// ========== API ROUTES ==========

// Get chart data for admin dashboard
app.get('/api/chart/resellers', requireAdmin, (req, res) => {
    const chartData = data.resellers.map(r => {
        const clientCount = data.clients.filter(c => c.resellerId === r.id).length;
        return {
            username: r.username,
            client_count: clientCount
        };
    });
    
    res.json(chartData);
});

// Start server
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
    console.log(`🚀 Steam Fusion running on http://localhost:${PORT}`);
    console.log(`👤 Admin login: admin / admin123`);
    console.log(`📺 Jellyfin: ${JELLYFIN_URL}`);
});

// Telegram backup function
async function sendTelegramBackup() {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('Telegram backup skipped: No bot token or chat ID configured');
        return;
    }
    
    const backup = {
        timestamp: new Date().toISOString(),
        admins: data.admins.length,
        resellers: data.resellers.length,
        clients: data.clients.length,
        totalCredits: data.resellers.reduce((sum, r) => sum + r.credits, 0),
        transactions: data.creditTransactions.length
    };
    
    const message = `💾 **Steam Fusion Weekly Backup**

📅 Date: ${new Date().toLocaleDateString('en-ZA')}
📊 Stats:
• Resellers: ${backup.resellers}
• Clients: ${backup.clients}
• Total Credits: ${backup.totalCredits}
• Transactions: ${backup.transactions}

Full backup attached.`;
    
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const backupData = JSON.stringify({
        ...backup,
        fullData: data
    }, null, 2);
    
    const body = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="chat_id"`,
        '',
        TELEGRAM_CHAT_ID,
        `--${boundary}`,
        `Content-Disposition: form-data; name="caption"`,
        '',
        message,
        `--${boundary}`,
        `Content-Disposition: form-data; name="document"; filename="backup-${new Date().toISOString().split('T')[0]}.json"`,
        `Content-Type: application/json`,
        '',
        backupData,
        `--${boundary}--`
    ].join('\r\n');
    
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendDocument`,
        method: 'POST',
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(body)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ Telegram backup sent successfully');
                    resolve(true);
                } else {
                    console.error('❌ Telegram backup failed:', data);
                    resolve(false);
                }
            });
        });
        req.on('error', (err) => {
            console.error('❌ Telegram backup error:', err);
            resolve(false);
        });
        req.write(body);
        req.end();
    });
}

// Weekly backup (every 7 days at 2 AM)
const BACKUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
let lastBackup = Date.now();

setInterval(async () => {
    if (Date.now() - lastBackup >= BACKUP_INTERVAL) {
        console.log('📦 Running weekly backup...');
        await sendTelegramBackup();
        lastBackup = Date.now();
    }
}, 60 * 60 * 1000); // Check every hour