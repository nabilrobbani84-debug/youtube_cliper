const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/youclip.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error('Error opening database', err.message); return; }
    console.log('Connected.');
    
    // Update the google user's password so they can login normally
    db.run("UPDATE users SET password = '12345678' WHERE username = 'nabilrobbani6@gmail.com'", function(err) {
        if (err) { console.error('Update error:', err); }
        else { console.log('Updated rows:', this.changes); }
        
        // Show all users
        db.all("SELECT id, username, password, role, credits FROM users", [], (err, rows) => {
            if (err) console.error(err);
            else console.log('All users:', JSON.stringify(rows, null, 2));
            db.close();
            process.exit(0);
        });
    });
});
