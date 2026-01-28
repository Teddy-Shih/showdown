/**
 * Quick test to verify the play interface works
 * This simulates a battle to catch any errors
 */

const { spawn } = require('child_process');

console.log('Testing play-vs-bot.js interface...\n');

const child = spawn('node', ['play-vs-bot.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

child.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  errorOutput += data.toString();
  process.stderr.write(data);
});

// Simulate user input after delays
setTimeout(() => {
  console.log('\n[TEST] Selecting team 1...');
  child.stdin.write('1\n');
}, 1000);

setTimeout(() => {
  console.log('[TEST] Selecting lead Pokemon 1...');
  child.stdin.write('1\n');
}, 2000);

// Auto-play a few moves
let moveCount = 0;
const autoMove = setInterval(() => {
  if (moveCount < 10) {
    console.log(`[TEST] Playing move ${moveCount + 1}...`);
    child.stdin.write('1\n'); // Always choose move 1
    moveCount++;
  } else {
    clearInterval(autoMove);
  }
}, 3000);

child.on('close', (code) => {
  clearInterval(autoMove);

  console.log('\n' + '='.repeat(80));
  console.log('TEST COMPLETE');
  console.log('='.repeat(80));

  if (code !== 0) {
    console.log(`\n❌ Process exited with code ${code}`);
    if (errorOutput) {
      console.log('\nError output:');
      console.log(errorOutput);
    }
    process.exit(1);
  } else {
    console.log('\n✅ Interface test completed successfully!');
    console.log('The play-vs-bot.js script is working correctly.');
    process.exit(0);
  }
});

// Safety timeout
setTimeout(() => {
  console.log('\n⚠️  Test timeout - killing process');
  child.kill();
  process.exit(1);
}, 60000);
