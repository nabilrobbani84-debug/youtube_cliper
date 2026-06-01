const fs = require('fs');
const path = require('path');

const nextDir = path.join(process.cwd(), '.next');

try {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log('Cleaned stale .next cache');
  }
} catch (error) {
  console.error('Failed to clean .next cache:', error.message);
  process.exitCode = 1;
}
