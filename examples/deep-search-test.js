const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const DeepSearchBot = require('../src/DeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test DeepSearchBot (4-ply) vs RandomBot
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: DeepSearchBot (4-ply) vs RandomBot...\n`);

  let deepSearchWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const deepSearchBot = new DeepSearchBot('DeepSearchBot');
    const randomBot = new RandomBot('RandomBot');

    // Alternate which team each bot uses
    const bot1 = i % 2 === 0 ? deepSearchBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : deepSearchBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (result.winner === 'DeepSearchBot') {
      deepSearchWins++;
      totalNodes += deepSearchBot.nodesEvaluated;
      totalPrunes += deepSearchBot.pruneCount;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += deepSearchBot.nodesEvaluated;
      totalPrunes += deepSearchBot.pruneCount;
    } else {
      draws++;
    }

    // Progress update
    const currentWinRate = (deepSearchWins / (i + 1) * 100).toFixed(1);
    console.log(`${i + 1}/${numBattles} - DeepSearchBot: ${currentWinRate}% (nodes: ${deepSearchBot.nodesEvaluated}, prunes: ${deepSearchBot.pruneCount})`);
  }

  const avgNodes = totalNodes / numBattles;
  const avgPrunes = totalPrunes / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`DEEP SEARCH RESULTS - ${numBattles} BATTLES (4-PLY)`);
  console.log('='.repeat(75));
  console.log(`DeepSearchBot (4-ply):  ${deepSearchWins.toString().padStart(2)} wins (${(deepSearchWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`RandomBot:              ${randomWins.toString().padStart(2)} wins (${(randomWins / numBattles * 100).toFixed(2)}%)`);
  console.log(`Draws:                  ${draws.toString().padStart(2)}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average alpha-beta prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);

  console.log('\nComparison:');
  console.log('  SmartDamageBot (old):        46%');
  console.log('  SmartBot (heuristic):        50%');
  console.log('  StatefulTreeSearchBot (2-ply): 59%');
  console.log(`  DeepSearchBot (4-ply):       ${(deepSearchWins / numBattles * 100).toFixed(2)}%`);

  const winRate = deepSearchWins / numBattles * 100;
  if (winRate > 59) {
    console.log('\n✓✓ DeepSearchBot exceeds 2-ply baseline!');
  } else if (winRate > 50) {
    console.log('\n✓ Still exceeds random play');
  } else {
    console.log('\n⚠ Performance degraded');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
