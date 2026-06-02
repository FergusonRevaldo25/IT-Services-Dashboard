const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { 
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

const db = new sqlite3.Database('./backend/itpro.db');

// Create all tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        phone TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        order_number TEXT UNIQUE,
        total_amount REAL,
        tax REAL,
        delivery_fee REAL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'unpaid',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        service_name TEXT,
        quantity INTEGER,
        price REAL,
        FOREIGN KEY(order_id) REFERENCES orders(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_name TEXT,
        user_email TEXT,
        message TEXT,
        is_admin INTEGER DEFAULT 0,
        is_anydesk_request INTEGER DEFAULT 0,
        anydesk_id TEXT,
        status TEXT DEFAULT 'unread',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        price REAL,
        category TEXT,
        image TEXT,
        is_active INTEGER DEFAULT 1
    )`);

    // Insert sample services
    db.get(`SELECT COUNT(*) as count FROM services`, [], (err, row) => {
        if (row && row.count === 0) {
            const services = [
                ['AnyDesk Support', '24/7 remote assistance via AnyDesk', 49, 'Remote Support', 'anydesk-support.jpg'],
                ['Virus Removal', 'Complete malware and virus cleanup', 79, 'Security', 'virus-removal.jpg'],
                ['Software Installation', 'Any software installation', 39, 'Software', 'software-install.jpg'],
                ['Hardware Diagnosis', 'Full hardware checkup', 59, 'Hardware', 'hardware-diagnosis.jpg'],
                ['Network Setup', 'Router & WiFi configuration', 99, 'Network', 'network-setup.jpg'],
                ['Data Recovery', 'Lost data recovery', 149, 'Data', 'data-recovery.jpg']
            ];
            services.forEach(s => {
                db.run(`INSERT INTO services (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)`, s);
            });
            console.log('✅ Sample services added');
        }
    });
});

// ============ AUTHENTICATION ============

app.post('/api/signup', async (req, res) => {
    const { username, email, password, full_name, phone } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(`INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)`,
            [username, email, hashedPassword, full_name, phone],
            function(err) {
                if (err) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                res.json({ message: 'User created successfully', userId: this.lastID });
            });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);
        
        // IMPORTANT: Make sure isAdmin is set correctly
        const isAdminValue = user.is_admin === 1;
        
        const token = jwt.sign(
            { id: user.id, email: user.email, isAdmin: isAdminValue }, 
            'my-secret-key-12345', 
            { expiresIn: '7d' }
        );
        
        console.log('User logged in:', email, 'isAdmin:', isAdminValue);
        
        res.json({ 
            message: 'Login successful', 
            token, 
            user: { 
                id: user.id, 
                username: user.username, 
                email: user.email, 
                full_name: user.full_name, 
                isAdmin: isAdminValue
            } 
        });
    });
});

// ============ VERIFY TOKEN MIDDLEWARE ============
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    console.log('Auth header received:', authHeader ? 'Yes' : 'No');
    
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Invalid token format' });
    }
    
    try {
        const decoded = jwt.verify(token, 'my-secret-key-12345');
        req.userId = decoded.id;
        req.isAdmin = decoded.isAdmin;
        console.log('Token verified for user:', decoded.email, 'isAdmin:', decoded.isAdmin);
        next();
    } catch (error) {
        console.log('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
}

function requireAdmin(req, res, next) {
    if (!req.isAdmin) {
        console.log('Admin access denied for user:', req.userId);
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// ============ ADMIN ROUTES ============

app.get('/api/admin/stats', verifyToken, requireAdmin, (req, res) => {
    db.get(`SELECT COUNT(*) as total_users FROM users`, [], (err, users) => {
        db.get(`SELECT COUNT(*) as total_orders, COALESCE(SUM(total_amount), 0) as revenue FROM orders WHERE payment_status = 'paid'`, [], (err, orders) => {
            db.get(`SELECT COUNT(*) as pending_orders FROM orders WHERE status = 'pending'`, [], (err, pending) => {
                db.get(`SELECT COUNT(*) as unread_chats FROM chat_messages WHERE status = 'unread' AND is_admin = 0`, [], (err, unread) => {
                    res.json({
                        total_users: users?.total_users || 0,
                        total_orders: orders?.total_orders || 0,
                        revenue: orders?.revenue || 0,
                        pending_orders: pending?.pending_orders || 0,
                        unread_chats: unread?.unread_chats || 0
                    });
                });
            });
        });
    });
});

app.get('/api/admin/orders', verifyToken, requireAdmin, (req, res) => {
    db.all(`SELECT o.*, u.username, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC`, [], (err, orders) => {
        res.json(orders || []);
    });
});

app.put('/api/admin/orders/:id/status', verifyToken, requireAdmin, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Status updated' });
    });
});

app.get('/api/admin/users', verifyToken, requireAdmin, (req, res) => {
    db.all(`SELECT id, username, email, full_name, phone, is_admin, created_at, last_login FROM users`, [], (err, users) => {
        res.json(users || []);
    });
});

app.get('/api/admin/chats', verifyToken, requireAdmin, (req, res) => {
    db.all(`SELECT * FROM chat_messages ORDER BY created_at DESC`, [], (err, messages) => {
        res.json(messages || []);
    });
});

app.put('/api/admin/chats/:id/read', verifyToken, requireAdmin, (req, res) => {
    db.run(`UPDATE chat_messages SET status = 'read' WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Marked as read' });
    });
});

// ============ SOCKET.IO CHAT ============
let onlineAdmins = [];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    socket.on('identify', (data) => {
        console.log('User identified:', data.userName, 'isAdmin:', data.isAdmin);
        if (data.isAdmin) {
            onlineAdmins.push(socket.id);
            console.log('Admin online. Total admins:', onlineAdmins.length);
        }
    });
    
    socket.on('send-message', (data) => {
        console.log('New message from:', data.userName);
        db.run(`INSERT INTO chat_messages (user_id, user_name, message) VALUES (?, ?, ?)`,
            [data.userId, data.userName, data.message]);
        io.emit('new-user-message', data);
    });
    
    socket.on('anydesk-request', (data) => {
        const anydeskId = Math.floor(Math.random() * 900000000) + 100000000;
        console.log('AnyDesk request from:', data.userName, 'ID:', anydeskId);
        db.run(`INSERT INTO chat_messages (user_id, user_name, message, is_anydesk_request, anydesk_id) VALUES (?, ?, ?, 1, ?)`,
            [data.userId, data.userName, 'AnyDesk remote support requested', anydeskId]);
        io.emit('anydesk-request-alert', { user_name: data.userName, anydesk_id: anydeskId });
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        onlineAdmins = onlineAdmins.filter(id => id !== socket.id);
    });
});

// ============ CREATE USERS ============
async function createUsers() {
    const adminPass = await bcrypt.hash('admin123', 10);
    const demoPass = await bcrypt.hash('demo123', 10);
    
    db.get(`SELECT * FROM users WHERE email = 'admin@itpro.com'`, [], (err, user) => {
        if (!user) {
            db.run(`INSERT INTO users (username, email, password, full_name, is_admin) VALUES (?, ?, ?, ?, ?)`,
                ['admin', 'admin@itpro.com', adminPass, 'System Admin', 1]);
            console.log('✅ Admin created: admin@itpro.com / admin123');
        }
    });
    
    db.get(`SELECT * FROM users WHERE email = 'demo@itpro.com'`, [], (err, user) => {
        if (!user) {
            db.run(`INSERT INTO users (username, email, password, full_name, is_admin) VALUES (?, ?, ?, ?, ?)`,
                ['demo', 'demo@itpro.com', demoPass, 'Demo User', 0]);
            console.log('✅ Demo user created: demo@itpro.com / demo123');
        }
    });
}

// ============ START SERVER ============
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
═══════════════════════════════════════════════════════════════
   🚀 IT PRO SOLUTIONS BACKEND SERVER RUNNING                 
   📍 Server: http://localhost:${PORT}                          
   💬 Real-time Chat: ACTIVE                                  
   🔐 Admin: admin@itpro.com / admin123                       
═══════════════════════════════════════════════════════════════
    `);
    createUsers();
});
