const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/youclip.sqlite');
db.run("UPDATE users SET password = '12345678' WHERE username = 'nabilrobbani6@gmail.com'", function(err) {
  if (err) console.error('Error:', err);
  else console.log('Changes:', this.changes);
  db.all("SELECT id, username, password, role, credits FROM users", [], (err2, rows) => {
    console.log('Users:', JSON.stringify(rows, null, 2));
    db.close();
    process.exit(0);
  });
});
