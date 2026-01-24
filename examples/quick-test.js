const CompetitiveBattleSimulator = require('../src/CompetitiveBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MaxDamageBot = require('../src/MaxDamageBot');

async function runQuickTest() {
  console.log('Starting quick test...');
  const maxBot = new MaxDamageBot('MaxBot');
  const randBot = new RandomBot('RandBot');

  let maxWins = 0;
  let randWins = 0;
  let draws = 0;

  const numBattles = parseInt(process.argv[2]) || 10;
  console.log(`Running ${numBattles} battles...`);

  for (let i = 0; i < numBattles; i++) {
    const sim = new CompetitiveBattleSimulator(maxBot, randBot, 'gen9randombattle', {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'MaxBot') maxWins++;
    else if (result.winner === 'RandBot') randWins++;
    else draws++;

    if ((i + 1) % 10 === 0 || i === 0) {
      const maxPct = (maxWins / (i + 1) * 100).toFixed(1);
      const randPct = (randWins / (i + 1) * 100).toFixed(1);
      process.stdout.write(`${i + 1}/${numBattles} - MaxBot: ${maxPct}% | RandBot: ${randPct}%\n`);
    }
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log(`MaxBot wins: ${maxWins} (${(maxWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandBot wins: ${randWins} (${(randWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws: ${draws} (${(draws / numBattles * 100).toFixed(2)}%)`);
}

runQuickTest().catch(console.error);
