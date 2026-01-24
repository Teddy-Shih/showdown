const OUBattleSimulator = require('../src/OUBattleSimulator');
const SmartDamageBot = require('../src/SmartDamageBot');
const RandomBot = require('../src/RandomBot');
const pureOffenseTeams = require('../data/pure-offense-teams');

async function quickTest() {
  console.log('Running quick pure offense test...\n');

  const smartBot = new SmartDamageBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');

  const teams = pureOffenseTeams.getAllTeams();

  let smartWins = 0;
  let randWins = 0;
  const numBattles = parseInt(process.argv[2]) || 10;

  for (let i = 0; i < numBattles; i++) {
    const team1 = teams[i % teams.length];
    const team2 = teams[(i + 1) % teams.length];

    const sim = new OUBattleSimulator(smartBot, randomBot, team1, team2, {
      verbose: false,
      maxTurns: 100
    });

    try {
      const result = await sim.runBattle();

      if (result.winner === 'SmartBot') smartWins++;
      else if (result.winner === 'RandomBot') randWins++;

      console.log(`Battle ${i + 1}: Winner = ${result.winner || 'Draw'}, Turns = ${result.turns}`);
    } catch (error) {
      console.error(`Error in battle ${i + 1}:`, error.message);
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`SmartBot: ${smartWins}/${numBattles} (${(smartWins/numBattles*100).toFixed(1)}%)`);
  console.log(`RandomBot: ${randWins}/${numBattles} (${(randWins/numBattles*100).toFixed(1)}%)`);
}

quickTest().catch(console.error);
