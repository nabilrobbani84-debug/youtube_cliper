const db = require('./server/db');
db.all("SELECT id, username, password, role, credits FROM users", [], (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
});
