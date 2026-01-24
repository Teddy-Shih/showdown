const OUBattleSimulator = require('../src/OUBattleSimulator');
const SmartDamageBot = require('../src/SmartDamageBot');
const RandomBot = require('../src/RandomBot');
const pureOffenseTeams = require('../data/pure-offense-teams');

async function fastTest() {
  const numBattles = parseInt(process.argv[2]) || 100;
  console.log(`Running ${numBattles} pure offense battles...\n`);

  const smartBot = new SmartDamageBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');
  const teams = pureOffenseTeams.getAllTeams();

  let smartWins = 0;
  let randWins = 0;
  let draws = 0;
  let totalTurns = 0;

  const startTime = Date.now();

  for (let i = 0; i < numBattles; i++) {
    const team1 = teams[i % teams.length];
    const team2 = teams[(i + 1) % teams.length];

    const sim = new OUBattleSimulator(smartBot, randomBot, team1, team2, {
      verbose: false,
      maxTurns: 100
    });

    try {
      const result = await sim.runBattle();
      totalTurns += result.turns;

      if (result.winner === 'SmartBot') smartWins++;
      else if (result.winner === 'RandomBot') randWins++;
      else draws++;

      if ((i + 1) % 10 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const smartPct = (smartWins / (i + 1) * 100).toFixed(1);
        console.log(`${i + 1}/${numBattles} - SmartBot: ${smartPct}% - Time: ${elapsed}s`);
      }
    } catch (error) {
      console.error(`Error in battle ${i + 1}:`, error.message);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgTurns = (totalTurns / numBattles).toFixed(1);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`PURE OFFENSE RESULTS - ${numBattles} BATTLES`);
  console.log(`${'='.repeat(60)}`);
  console.log(`SmartBot:  ${smartWins} wins (${(smartWins/numBattles*100).toFixed(2)}%)`);
  console.log(`RandomBot: ${randWins} wins (${(randWins/numBattles*100).toFixed(2)}%)`);
  console.log(`Draws:     ${draws}`);
  console.log(`Avg Turns: ${avgTurns}`);
  console.log(`Time:      ${elapsed}s (${(elapsed/numBattles).toFixed(2)}s per battle)`);
  console.log(`${'='.repeat(60)}`);
}

fastTest().catch(console.error);
