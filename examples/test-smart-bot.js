const CompetitiveBattleSimulator = require('../src/CompetitiveBattleSimulator');
const RandomBot = require('../src/RandomBot');
const SmartDamageBot = require('../src/SmartDamageBot');

async function runTest() {
  console.log('Starting test: SmartDamageBot vs RandomBot...');
  const smartBot = new SmartDamageBot('SmartBot');
  const randBot = new RandomBot('RandBot');

  let smartWins = 0;
  let randWins = 0;
  let draws = 0;

  const numBattles = parseInt(process.argv[2]) || 100;
  console.log(`Running ${numBattles} battles...\n`);

  for (let i = 0; i < numBattles; i++) {
    const sim = new CompetitiveBattleSimulator(smartBot, randBot, 'gen9randombattle', {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'SmartBot') smartWins++;
    else if (result.winner === 'RandBot') randWins++;
    else draws++;

    if ((i + 1) % 10 === 0 || i === 0) {
      const smartPct = (smartWins / (i + 1) * 100).toFixed(1);
      const randPct = (randWins / (i + 1) * 100).toFixed(1);
      process.stdout.write(`${i + 1}/${numBattles} - SmartBot: ${smartPct}% | RandBot: ${randPct}%\n`);
    }
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log(`SmartBot wins: ${smartWins} (${(smartWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandBot wins: ${randWins} (${(randWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws: ${draws} (${(draws / numBattles * 100).toFixed(2)}%)`);

  const improvement = ((smartWins - randWins) / numBattles * 100).toFixed(2);
  console.log(`\nNet advantage: ${improvement}% for SmartBot`);
}

runTest().catch(console.error);
