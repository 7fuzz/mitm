const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

/**
 * Cross-platform launcher for mitmdump within the virtual environment.
 * Handles the difference between 'bin' (POSIX) and 'Scripts' (Windows) directories.
 */

const isWin = os.platform() === 'win32';
const venvPath = path.join(process.cwd(), 'scripts', 'venv');
const mitmdump = isWin 
  ? path.join(venvPath, 'Scripts', 'mitmdump.exe')
  : path.join(venvPath, 'bin', 'mitmdump');

const args = ['-s', path.join(process.cwd(), 'scripts', 'bridge.py')];

// Pass through any additional arguments (like -p port)
const extraArgs = process.argv.slice(2);
const finalArgs = [...args, ...extraArgs];

console.log(`[PROXY] Launching: ${mitmdump}`);

const proxy = spawn(mitmdump, finalArgs, { 
  stdio: 'inherit',
  // On Windows, shell: true can help with executable resolution but can interfere with signal propagation.
  // Using absolute path to .exe is generally safer without shell: true.
  shell: false 
});

proxy.on('exit', (code) => {
  process.exit(code || 0);
});

// Ensure child process is killed when this launcher receives a signal
const cleanup = (signal) => {
  if (proxy) {
    proxy.kill(signal);
  }
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGHUP', () => cleanup('SIGHUP'));
