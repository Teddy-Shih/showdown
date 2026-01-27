const TypeAwareBot = require('../src/TypeAwareBot');

const bot = new TypeAwareBot('TestBot');

console.log('Testing determineMoveOrder with debug output');
console.log('='.repeat(80));

console.log(`fieldConditions.trickRoom: ${bot.fieldConditions.trickRoom}`);
console.log();

// Test: 300 speed vs 200 speed, both priority 0
const ourSpeed = 300;
const ourPriority = 0;
const oppSpeed = 200;
const oppPriority = 0;

console.log(`Input: ourSpeed=${ourSpeed}, ourPriority=${ourPriority}, oppSpeed=${oppSpeed}, oppPriority=${oppPriority}`);

// Manual trace
console.log(`\nManual trace:`);
console.log(`  ourPriority (${ourPriority}) > oppPriority (${oppPriority}): ${ourPriority > oppPriority}`);
console.log(`  oppPriority (${oppPriority}) > ourPriority (${ourPriority}): ${oppPriority > ourPriority}`);
console.log(`  fieldConditions.trickRoom: ${bot.fieldConditions.trickRoom}`);
console.log(`  ourSpeed (${ourSpeed}) >= oppSpeed (${oppSpeed}): ${ourSpeed >= oppSpeed}`);

const result = bot.determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority);

console.log(`\nResult: ${result}`);
console.log(`Expected: true`);
console.log(`Test: ${result === true ? 'PASS' : 'FAIL'}`);
