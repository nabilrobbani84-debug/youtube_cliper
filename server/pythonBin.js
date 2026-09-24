// ----------------------------------------------------------------
// Cross-platform Python executable resolver
// ----------------------------------------------------------------
// Many environments (Linux, macOS, CI, pyenv setups) expose the
// interpreter only as `python3`, while others (Windows, some venvs)
// expose it as `python`. Hardcoding one name causes silent ENOENT
// failures that make every AI/render feature fall back to samples.
//
// Resolution order:
//   1. PYTHON_BIN environment variable (explicit override)
//   2. First candidate that responds to `--version`
//   3. Fallback to 'python3' (most common on servers)
// ----------------------------------------------------------------
const { execFileSync } = require('child_process');

let cachedPythonBin = null;

function detectPythonBin() {
  if (cachedPythonBin) return cachedPythonBin;

  const candidates = [];
  if (process.env.PYTHON_BIN) candidates.push(process.env.PYTHON_BIN);
  candidates.push('python3', 'python');

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore', timeout: 5000 });
      cachedPythonBin = candidate;
      return cachedPythonBin;
    } catch (e) {
      // try next candidate
    }
  }

  // Last resort — keep something sensible so callers still attempt to run.
  cachedPythonBin = 'python3';
  return cachedPythonBin;
}

module.exports = { detectPythonBin };
