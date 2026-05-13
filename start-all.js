const { spawn } = require('child_process');

console.log('Starting all services...');

// Start API server
const api = spawn('node', ['dist/app.js'], {
  stdio: 'inherit',
  env: process.env
});

// Start message processor worker
const messageWorker = spawn('node', ['dist/workers/message-processor.js'], {
  stdio: 'inherit',
  env: process.env
});

// Start outbound sender worker
const outboundWorker = spawn('node', ['dist/workers/outbound-sender.js'], {
  stdio: 'inherit',
  env: process.env
});

// Handle process exits
api.on('exit', (code) => {
  console.log(`API exited with code ${code}`);
  process.exit(code);
});

messageWorker.on('exit', (code) => {
  console.log(`Message worker exited with code ${code}`);
});

outboundWorker.on('exit', (code) => {
  console.log(`Outbound worker exited with code ${code}`);
});

// Keep process alive
setInterval(() => {}, 1000);
