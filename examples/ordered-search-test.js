const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const OrderedDeepSearchBot = require('../src/OrderedDeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test OrderedDeepSearchBot (4-ply with move ordering only) vs RandomBot
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: OrderedDeepSearchBot vs RandomBot...\n`);
  console.log('Improvement: Move ordering only (KO moves first, then by damage)\n');

  let orderedWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const orderedBot = new OrderedDeepSearchBot('OrderedBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? orderedBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : orderedBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'OrderedBot') {
      orderedWins++;
      totalNodes += orderedBot.nodesEvaluated;
      totalPrunes += orderedBot.pruneCount;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += orderedBot.nodesEvaluated;
      totalPrunes += orderedBot.pruneCount;
    } else {
      draws++;
    }

    const currentWinRate = (orderedWins / (i + 1) * 100).toFixed(1);
    const pruneEff = orderedBot.pruneCount > 0 ?
      (orderedBot.pruneCount / orderedBot.nodesEvaluated * 100).toFixed(1) : '0.0';
    console.log(`${i + 1}/${numBattles} - OrderedBot: ${currentWinRate}% (nodes: ${orderedBot.nodesEvaluated}, prunes: ${orderedBot.pruneCount}, eff: ${pruneEff}%)`);
  }

  const avgNodes = totalNodes / numBattles;
  const avgPrunes = totalPrunes / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`ORDERED SEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`OrderedBot (4-ply):      ${orderedWins.toString().padStart(2)} wins (${(orderedWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandomBot:               ${randomWins.toString().padStart(2)} wins (${(randomWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws:                   ${draws.toString().padStart(2)}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average alpha-beta prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);

  console.log('\n📊 Performance Comparison:');
  console.log('  DeepSearchBot (4-ply, no ordering):  70.0% (13.9% prune eff)');
  console.log(`  OrderedBot (4-ply, with ordering):   ${(orderedWins / numBattles * 100).toFixed(1)}% (${(avgPrunes / avgNodes * 100).toFixed(1)}% prune eff)`);

  const winRate = orderedWins / numBattles * 100;
  const improvement = winRate - 70;

  if (winRate >= 75) {
    console.log(`\n🎯 Target achieved! +${improvement.toFixed(1)}% over baseline`);
  } else if (winRate > 70) {
    console.log(`\n✓ Improvement! +${improvement.toFixed(1)}% over baseline`);
  } else if (winRate === 70) {
    console.log('\n→ Same performance as baseline (70%)');
  } else {
    console.log(`\n⚠ Slight degradation (${improvement.toFixed(1)}%)`);
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
