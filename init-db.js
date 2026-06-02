const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const db = new sqlite3.Database("./backend/itpro.db");

db.serialize(() => {
    // Create users table
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, email TEXT UNIQUE, password TEXT, full_name TEXT, phone TEXT, is_admin INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME)");
    
    // Create orders table
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, order_number TEXT UNIQUE, total_amount REAL, tax REAL, delivery_fee REAL, status TEXT DEFAULT 'pending', payment_status TEXT DEFAULT 'unpaid', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    
    // Create order_items table
    db.run("CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, service_name TEXT, quantity INTEGER, price REAL)");
    
    // Create chat_messages table with all required columns
    db.run("CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, user_email TEXT, message TEXT, is_admin INTEGER DEFAULT 0, is_anydesk_request INTEGER DEFAULT 0, anydesk_id TEXT, status TEXT DEFAULT 'unread', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    
    // Create services table
    db.run("CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, description TEXT, price REAL, category TEXT, image TEXT, is_active INTEGER DEFAULT 1)");
    
    console.log("Tables created");

    // Insert admin user
    bcrypt.hash("admin123", 10).then(adminPass => {
        db.run("INSERT OR IGNORE INTO users (username, email, password, full_name, is_admin) VALUES ('admin', 'admin@itpro.com', ?, 'System Admin', 1)", [adminPass]);
        
        // Insert demo user
        bcrypt.hash("demo123", 10).then(demoPass => {
            db.run("INSERT OR IGNORE INTO users (username, email, password, full_name, is_admin) VALUES ('demo', 'demo@itpro.com', ?, 'Demo User', 0)", [demoPass]);
            
            // Insert services
            const services = [
                ["AnyDesk Support", "24/7 remote assistance", 49, "Remote Support", "anydesk-support.jpg"],
                ["Virus Removal", "Complete malware cleanup", 79, "Security", "virus-removal.jpg"],
                ["Software Installation", "Any software installation", 39, "Software", "software-install.jpg"],
                ["Hardware Diagnosis", "Full hardware checkup", 59, "Hardware", "hardware-diagnosis.jpg"],
                ["Network Setup", "Router & WiFi configuration", 99, "Network", "network-setup.jpg"],
                ["Data Recovery", "Lost data recovery", 149, "Data", "data-recovery.jpg"]
            ];
            
            services.forEach(s => {
                db.run("INSERT OR IGNORE INTO services (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)", s);
            });
            
            console.log("Admin: admin@itpro.com / admin123");
            console.log("Demo: demo@itpro.com / demo123");
            console.log("Services added");
            db.close();
        });
    });
});
