const OUBattleSimulator = require('../src/OUBattleSimulator');
const TreeSearchBot = require('../src/TreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test TreeSearchBot vs RandomBot in Gen 9 OU
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: TreeSearchBot vs RandomBot...\n`);

  let treeSearchWins = 0;
  let randomWins = 0;
  let draws = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const treeSearchBot = new TreeSearchBot('TreeSearchBot');
    const randomBot = new RandomBot('RandomBot');

    // Alternate which team each bot uses
    const bot1 = i % 2 === 0 ? treeSearchBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : treeSearchBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const sim = new OUBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
    } else {
      draws++;
    }

    // Progress update every 10 battles
    if ((i + 1) % 10 === 0) {
      const currentWinRate = (treeSearchWins / (i + 1) * 100).toFixed(1);
      console.log(`${i + 1}/${numBattles} - TreeSearchBot: ${currentWinRate}%`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TREESEARCH OU RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(60));
  console.log(`TreeSearchBot: ${treeSearchWins.toString().padStart(2)} wins (${(treeSearchWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandomBot:     ${randomWins.toString().padStart(2)} wins (${(randomWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws:         ${draws.toString().padStart(2)}`);
  console.log('='.repeat(60));

  console.log('\nComparison:');
  console.log('  SmartDamageBot (old): 46%');
  console.log('  SmartBot (current):   50%');
  console.log(`  TreeSearchBot (new):  ${(treeSearchWins / numBattles * 100).toFixed(2)}%`);

  const winRate = treeSearchWins / numBattles * 100;
  if (winRate > 50) {
    console.log('\n✓ TreeSearchBot exceeds random play!');
  } else {
    console.log('\n⚠ Still needs improvement');
  }
}

const numBattles = parseInt(process.argv[2]) || 100;
runTest(numBattles).catch(console.error);
