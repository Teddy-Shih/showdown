const fs = require('fs');

const logFile = '/root/.claude/projects/-home-user-showdown/ca6db9ae-f5ac-46f6-9559-65e37504933a/tool-results/toolu_01AMZKZjEYcDkjnXNPYefJgq.txt';
const content = fs.readFileSync(logFile, 'utf-8');

// Extract Battle 3
const battle3Start = content.indexOf('Battle 3 - TypeAwareBot');
const battle4Start = content.indexOf('Battle 4 - TypeAwareBot');
const battle3 = content.substring(battle3Start, battle4Start);

// Parse turns
const lines = battle3.split('\n');
let currentTurn = 0;
const turns = {};

for (const line of lines) {
  if (line.includes('--- Turn')) {
    const match = line.match(/Turn (\d+)/);
    if (match) {
      currentTurn = parseInt(match[1]);
      if (!turns[currentTurn]) {
        turns[currentTurn] = [];
      }
    }
  } else if (line.trim() && currentTurn > 0 && !line.includes('---')) {
    turns[currentTurn].push(line.trim());
  }
}

// Display key turns
console.log('BATTLE 3 - KEY TURNS\n');
console.log('='.repeat(80));

for (const turn of [11, 12, 13, 17, 18, 19, 20]) {
  console.log(`\nTurn ${turn}:`);
  if (turns[turn]) {
    // Deduplicate and show only TypeAwareBot actions
    const actions = turns[turn].filter(line => line.includes('TypeAwareBot'));
    const unique = [...new Set(actions)];
    unique.forEach(action => console.log(`  ${action}`));
  }
}
