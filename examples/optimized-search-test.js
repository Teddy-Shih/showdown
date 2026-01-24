const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const OptimizedDeepSearchBot = require('../src/OptimizedDeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test OptimizedDeepSearchBot (4-ply with move ordering and enhanced eval) vs RandomBot
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: OptimizedDeepSearchBot vs RandomBot...\n`);
  console.log('Improvements:');
  console.log('  - Move ordering (KO moves first, then by damage)');
  console.log('  - Enhanced evaluation (type advantage, speed, boosts, status)');
  console.log('  - 4-ply minimax with alpha-beta pruning\n');

  let optimizedWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const optimizedBot = new OptimizedDeepSearchBot('OptimizedBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? optimizedBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : optimizedBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'OptimizedBot') {
      optimizedWins++;
      totalNodes += optimizedBot.nodesEvaluated;
      totalPrunes += optimizedBot.pruneCount;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += optimizedBot.nodesEvaluated;
      totalPrunes += optimizedBot.pruneCount;
    } else {
      draws++;
    }

    const currentWinRate = (optimizedWins / (i + 1) * 100).toFixed(1);
    const pruneEff = optimizedBot.pruneCount > 0 ?
      (optimizedBot.pruneCount / optimizedBot.nodesEvaluated * 100).toFixed(1) : '0.0';
    console.log(`${i + 1}/${numBattles} - OptimizedBot: ${currentWinRate}% (nodes: ${optimizedBot.nodesEvaluated}, prunes: ${optimizedBot.pruneCount}, eff: ${pruneEff}%)`);
  }

  const avgNodes = totalNodes / numBattles;
  const avgPrunes = totalPrunes / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`OPTIMIZED SEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`OptimizedBot (4-ply+):   ${optimizedWins.toString().padStart(2)} wins (${(optimizedWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandomBot:               ${randomWins.toString().padStart(2)} wins (${(randomWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws:                   ${draws.toString().padStart(2)}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average alpha-beta prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);

  console.log('\n📊 Performance Comparison:');
  console.log('  SmartDamageBot (baseline):     46%');
  console.log('  SmartBot (heuristics):         50%');
  console.log('  StatefulTreeSearchBot (2-ply): 59%');
  console.log('  DeepSearchBot (4-ply):         70%');
  console.log(`  OptimizedBot (4-ply+):         ${(optimizedWins / numBattles * 100).toFixed(2)}%`);

  const winRate = optimizedWins / numBattles * 100;
  const improvement = winRate - 70;

  if (winRate >= 75) {
    console.log(`\n🎯 Target achieved! +${improvement.toFixed(1)}% over baseline`);
  } else if (winRate > 70) {
    console.log(`\n✓ Improvement! +${improvement.toFixed(1)}% over baseline`);
  } else if (winRate === 70) {
    console.log('\n→ Same performance as baseline (70%)');
  } else {
    console.log('\n⚠ Performance degraded');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
