const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'youclip.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        
        db.serialize(() => {
            // Users table - tambah kolom google_id dan picture
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                password TEXT,
                google_id TEXT UNIQUE,
                picture TEXT,
                display_name TEXT,
                caption_brand TEXT,
                credits INTEGER DEFAULT 15,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, () => {
                // Default admin
                db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
                    if (!row) {
                        db.run("INSERT INTO users (username, password, credits, role) VALUES ('admin', 'admin123', 9999, 'admin')");
                        console.log('✅ Admin default dibuat');
                    }
                });
                
                // Coba tambah kolom baru jika belum ada (untuk DB lama)
                db.run("ALTER TABLE users ADD COLUMN google_id TEXT", () => {});
                db.run("ALTER TABLE users ADD COLUMN picture TEXT", () => {});
                db.run("ALTER TABLE users ADD COLUMN display_name TEXT", () => {});
                db.run("ALTER TABLE users ADD COLUMN caption_brand TEXT", () => {});
            });

            // Clips table
            db.run(`CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                url TEXT,
                title TEXT,
                thumbnail TEXT,
                status TEXT DEFAULT 'processing',
                layout TEXT DEFAULT 'auto_magic',
                auto_subtitle INTEGER DEFAULT 1,
                caption_preset TEXT DEFAULT 'viral_neon',
                caption_brand TEXT,
                sub_clips TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Tambah kolom ke clips jika belum ada
            db.run("ALTER TABLE clips ADD COLUMN user_id INTEGER", () => {});
            db.run("ALTER TABLE clips ADD COLUMN layout TEXT DEFAULT 'auto_magic'", () => {});
            db.run("ALTER TABLE clips ADD COLUMN auto_subtitle INTEGER DEFAULT 1", () => {});
            db.run("ALTER TABLE clips ADD COLUMN caption_preset TEXT DEFAULT 'viral_neon'", () => {});
            db.run("ALTER TABLE clips ADD COLUMN caption_brand TEXT", () => {});
            db.run("ALTER TABLE clips ADD COLUMN sub_clips TEXT", () => {});

            // Tickets table
            db.run(`CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                subject TEXT,
                category TEXT,
                message TEXT,
                status TEXT DEFAULT 'Open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Tambah kolom baru ke tickets jika belum ada
            db.run("ALTER TABLE tickets ADD COLUMN user_id INTEGER", () => {});
            db.run("ALTER TABLE tickets ADD COLUMN category TEXT", () => {});
            db.run("ALTER TABLE tickets ADD COLUMN message TEXT", () => {});

            // Transactions table
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                package_name TEXT,
                amount INTEGER,
                price INTEGER,
                status TEXT DEFAULT 'Pending',
                payment_method TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Withdrawals table
            db.run(`CREATE TABLE IF NOT EXISTS withdrawals (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                amount INTEGER,
                method TEXT,
                destination TEXT,
                status TEXT DEFAULT 'Pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run("ALTER TABLE withdrawals ADD COLUMN user_id INTEGER", () => {});

            // Packages table
            db.run(`CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                price INTEGER,
                credits INTEGER,
                description TEXT,
                badge TEXT,
                is_popular BOOLEAN DEFAULT 0
            )`, () => {
                db.get("SELECT COUNT(*) as count FROM packages", (err, row) => {
                    if (row && row.count === 0) {
                        db.run("INSERT INTO packages (name, price, credits, description, badge) VALUES ('Starter', 15000, 10, 'Untuk pemula', '')");
                        db.run("INSERT INTO packages (name, price, credits, description, badge, is_popular) VALUES ('Creator', 25000, 22, 'Pilihan populer', '', 1)");
                        db.run("INSERT INTO packages (name, price, credits, description, badge) VALUES ('Pro', 99000, 100, 'Value terbaik', 'Best Value')");
                        console.log('✅ Default packages seeded');
                    }
                });
            });

            // Notifications table
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT,
                message TEXT,
                type TEXT DEFAULT 'info',
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });
    }
});

module.exports = db;
