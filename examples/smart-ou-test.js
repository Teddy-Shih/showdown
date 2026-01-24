const OUBattleSimulator = require('../src/OUBattleSimulator');
const RandomBot = require('../src/RandomBot');
const SmartBot = require('../src/SmartBot');
const ouTeams = require('../data/ou-teams');

async function quickTest() {
  const numBattles = parseInt(process.argv[2]) || 100;
  console.log(`Running ${numBattles} OU battles: SmartBot vs RandomBot...\n`);

  const smartBot = new SmartBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');
  const teams = ouTeams.getAllTeams();

  let smartWins = 0;
  let randWins = 0;
  let draws = 0;

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
      else draws++;

      if ((i + 1) % 10 === 0) {
        const smartPct = (smartWins / (i + 1) * 100).toFixed(1);
        console.log(`${i + 1}/${numBattles} - SmartBot: ${smartPct}%`);
      }
    } catch (error) {
      console.error(`Error in battle ${i + 1}:`, error.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SMART OU RESULTS - ${numBattles} BATTLES`);
  console.log(`${'='.repeat(60)}`);
  console.log(`SmartBot:  ${smartWins} wins (${(smartWins/numBattles*100).toFixed(2)}%)`);
  console.log(`RandomBot: ${randWins} wins (${(randWins/numBattles*100).toFixed(2)}%)`);
  console.log(`Draws:     ${draws}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nComparison:`);
  console.log(`  SmartDamageBot (old): 46%`);
  console.log(`  SmartBot (new):       ${(smartWins/numBattles*100).toFixed(2)}%`);

  if (smartWins / numBattles > 0.50) {
    console.log(`\n✓ SmartBot BEATS random play!`);
  } else {
    console.log(`\n⚠ Still below 50% (needs improvement)`);
  }
}

quickTest().catch(console.error);
