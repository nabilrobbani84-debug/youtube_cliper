const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'youclip.sqlite'));

// Check sub_clips URLs for the clip with real renders
db.get("SELECT id, url, sub_clips FROM clips WHERE id='37a0b2e4-b1a3-4ced-ac61-928e47507183'", (err, row) => {
  if (err) { console.error(err); db.close(); return; }
  const subClips = JSON.parse(row.sub_clips);
  console.log('YouTube URL:', row.url);
  console.log('\nSub-clips URLs:');
  subClips.forEach((c, i) => console.log(`  [${i+1}] ${c.url}`));
  db.close();
});
