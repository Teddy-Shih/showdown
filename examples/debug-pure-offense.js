const OUBattleSimulator = require('../src/OUBattleSimulator');
const SmartDamageBot = require('../src/SmartDamageBot');
const RandomBot = require('../src/RandomBot');
const pureOffenseTeams = require('../data/pure-offense-teams');

async function debugTest() {
  console.log('Starting debug test with 10 battles\n');

  const smartBot = new SmartDamageBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');
  const teams = pureOffenseTeams.getAllTeams();

  for (let i = 0; i < 10; i++) {
    console.log(`\nBattle ${i + 1} starting...`);
    const team1 = teams[i % teams.length];
    const team2 = teams[(i + 1) % teams.length];

    const sim = new OUBattleSimulator(smartBot, randomBot, team1, team2, {
      verbose: false,
      maxTurns: 100
    });

    try {
      const start = Date.now();
      const result = await sim.runBattle();
      const elapsed = Date.now() - start;

      console.log(`Battle ${i + 1} complete: Winner=${result.winner}, Turns=${result.turns}, Time=${elapsed}ms`);
    } catch (error) {
      console.error(`Battle ${i + 1} ERROR:`, error.message);
    }
  }

  console.log('\nDebug test complete!');
}

debugTest().catch(console.error);
