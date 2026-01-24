const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const EnhancedTreeSearchBot = require('../src/EnhancedTreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test EnhancedTreeSearchBot (4-ply with switching) vs RandomBot
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: EnhancedTreeSearchBot (4-ply) vs RandomBot...\n`);

  let enhancedWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const enhancedBot = new EnhancedTreeSearchBot('EnhancedTreeSearchBot');
    const randomBot = new RandomBot('RandomBot');

    // Alternate which team each bot uses
    const bot1 = i % 2 === 0 ? enhancedBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : enhancedBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'EnhancedTreeSearchBot') {
      enhancedWins++;
      totalNodes += enhancedBot.nodesEvaluated;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += enhancedBot.nodesEvaluated;
    } else {
      draws++;
    }

    // Progress update
    const currentWinRate = (enhancedWins / (i + 1) * 100).toFixed(1);
    console.log(`${i + 1}/${numBattles} - EnhancedBot: ${currentWinRate}% (nodes: ${enhancedBot.nodesEvaluated})`);
  }

  const avgNodes = totalNodes / numBattles;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`ENHANCED TREESEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(70));
  console.log(`EnhancedTreeSearchBot (4-ply): ${enhancedWins.toString().padStart(2)} wins (${(enhancedWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandomBot:                      ${randomWins.toString().padStart(2)} wins (${(randomWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws:                          ${draws.toString().padStart(2)}`);
  console.log('='.repeat(70));
  console.log(`Average nodes evaluated per battle: ${avgNodes.toFixed(0)}`);

  console.log('\nComparison:');
  console.log('  SmartDamageBot (old):             46%');
  console.log('  SmartBot (current):               50%');
  console.log('  StatefulTreeSearchBot (2-ply):    59%');
  console.log(`  EnhancedTreeSearchBot (4-ply):    ${(enhancedWins / numBattles * 100).toFixed(2)}%`);

  const winRate = enhancedWins / numBattles * 100;
  if (winRate > 59) {
    console.log('\n✓ EnhancedTreeSearchBot exceeds 2-ply baseline!');
  } else if (winRate > 50) {
    console.log('\n✓ Still exceeds random play');
  } else {
    console.log('\n⚠ Performance degraded');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
