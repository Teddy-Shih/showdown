const CompetitiveBattleSimulator = require('../src/CompetitiveBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MaxDamageBot = require('../src/MaxDamageBot');

/**
 * Test a single battle with verbose output to debug bot behavior
 */

async function testBattle() {
  const maxDamageBot = new MaxDamageBot('MaxDamageBot');
  const randomBot = new RandomBot('RandomBot');

  const simulator = new CompetitiveBattleSimulator(
    maxDamageBot,
    randomBot,
    'gen9randombattle',
    { verbose: true, maxTurns: 1000 }
  );

  const result = await simulator.runBattle();

  console.log('\nResult:', result);
}

testBattle().catch(console.error);
