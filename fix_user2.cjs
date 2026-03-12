const sqlite3 = require('better-sqlite3');
const db = sqlite3('./database.sqlite');
const result = db.prepare("UPDATE users SET password = '12345678' WHERE username = 'nabilrobbani6@gmail.com'").run();
console.log('Updated rows:', result.changes);
const users = db.prepare("SELECT id, username, password, role, credits FROM users").all();
console.log('All users:', JSON.stringify(users, null, 2));
db.close();
