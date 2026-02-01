const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const Depth4SearchBot = require('../src/Depth4SearchBot');
const ProfiledFastTreeSearchBot = require('../src/ProfiledFastTreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Profile Depth 4 search vs Depth 2 search
 * See how much slower it gets with deeper search
 */

async function profileDepth(depth, botClass, botName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PROFILING DEPTH ${depth} SEARCH`);
  console.log('='.repeat(70));

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const searchBot = new botClass(botName, {
    verbose: false,
    maxMovesToConsider: 3,
    maxDepth: depth
  });

  const randomBot = new RandomBot('RandomBot');

  const simulator = new EngineBattleSimulator(
    searchBot,
    randomBot,
    team1,
    team2,
    { verbose: false }
  );

  console.log(`Starting battle (${botName} vs RandomBot)...\n`);
  const battleStart = performance.now();
  const result = await simulator.runBattle();
  const battleTime = performance.now() - battleStart;

  console.log('='.repeat(70));
  console.log('BATTLE RESULTS');
  console.log('='.repeat(70));
  console.log(`Winner:           ${result.winner || 'Draw'}`);
  console.log(`Turns:            ${result.turns}`);
  console.log(`Total time:       ${battleTime.toFixed(2)}ms (${(battleTime / 1000).toFixed(2)}s)`);
  console.log(`Time per turn:    ${(battleTime / result.turns).toFixed(2)}ms`);
  console.log('='.repeat(70));

  searchBot.printStats();

  const stats = searchBot.getStats();
  const simStats = stats.simulator;

  console.log('\n' + '='.repeat(70));
  console.log('DEPTH ' + depth + ' ANALYSIS');
  console.log('='.repeat(70));

  console.log('\nPer-Turn Metrics:');
  console.log(`  Search time:            ${(stats.search.avgSearchTime).toFixed(2)}ms`);
  const avgNodes = stats.search.avgNodesExplored || stats.search.avgPathsExplored || 0;
  console.log(`  Nodes explored:         ${avgNodes.toFixed(1)}`);
  console.log(`  Simulations:            ${(simStats.simulateCalls / result.turns).toFixed(1)}`);
  console.log(`  Clones:                 ${(simStats.cloneCalls / result.turns).toFixed(1)}`);
  console.log(`  Time per simulation:    ${simStats.avgSimulateTime.toFixed(3)}ms`);

  console.log('\nTime Breakdown:');
  const totalSimTime = simStats.cloneTime + simStats.makeChoicesTime + simStats.evaluateTime;
  console.log(`  Total simulation time:  ${totalSimTime.toFixed(2)}ms`);
  console.log(`    - Cloning (${(simStats.cloneTime / totalSimTime * 100).toFixed(1)}%):         ${simStats.cloneTime.toFixed(2)}ms`);
  console.log(`    - MakeChoices (${(simStats.makeChoicesTime / totalSimTime * 100).toFixed(1)}%):    ${simStats.makeChoicesTime.toFixed(2)}ms`);
  console.log(`    - Evaluation (${(simStats.evaluateTime / totalSimTime * 100).toFixed(1)}%):     ${simStats.evaluateTime.toFixed(2)}ms`);

  const totalNodes = stats.search.nodesExplored || stats.search.pathsExplored || 0;
  console.log('\nEfficiency:');
  if (totalNodes > 0) {
    console.log(`  Time per node:          ${(stats.search.totalSearchTime / totalNodes).toFixed(3)}ms`);
    console.log(`  Nodes per second:       ${(totalNodes / (battleTime / 1000)).toFixed(0)}`);
  }

  return {
    depth,
    botName,
    turns: result.turns,
    totalTime: battleTime,
    timePerTurn: battleTime / result.turns,
    avgSearchTime: stats.search.avgSearchTime,
    avgNodes: avgNodes,
    avgSimulations: simStats.simulateCalls / result.turns,
    winner: result.winner
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('DEPTH COMPARISON: 2-PLY vs 4-PLY');
  console.log('='.repeat(70));
  console.log('Testing how search depth affects performance\n');

  const results = [];

  // Profile depth 2
  results.push(await profileDepth(2, ProfiledFastTreeSearchBot, 'Depth2Bot'));

  // Profile depth 4
  results.push(await profileDepth(4, Depth4SearchBot, 'Depth4Bot'));

  // Comparison
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(70));

  console.log('\n' + 'Metric'.padEnd(30) + 'Depth 2'.padEnd(15) + 'Depth 4'.padEnd(15) + 'Ratio');
  console.log('-'.repeat(70));

  const d2 = results[0];
  const d4 = results[1];

  const metrics = [
    { name: 'Time per turn', d2: d2.timePerTurn, d4: d4.timePerTurn, unit: 'ms' },
    { name: 'Avg search time', d2: d2.avgSearchTime, d4: d4.avgSearchTime, unit: 'ms' },
    { name: 'Avg nodes explored', d2: d2.avgNodes, d4: d4.avgNodes, unit: '' },
    { name: 'Avg simulations', d2: d2.avgSimulations, d4: d4.avgSimulations, unit: '' }
  ];

  metrics.forEach(m => {
    const ratio = (m.d4 / m.d2).toFixed(2);
    console.log(
      m.name.padEnd(30) +
      `${m.d2.toFixed(2)}${m.unit}`.padEnd(15) +
      `${m.d4.toFixed(2)}${m.unit}`.padEnd(15) +
      `${ratio}x`
    );
  });

  console.log('\n' + '='.repeat(70));
  console.log('KEY FINDINGS');
  console.log('='.repeat(70));

  const slowdownFactor = (d4.timePerTurn / d2.timePerTurn).toFixed(2);
  const nodeIncrease = (d4.avgNodes / d2.avgNodes).toFixed(2);

  console.log(`\n✓ Depth 4 is ${slowdownFactor}x slower than Depth 2`);
  console.log(`✓ Depth 4 explores ${nodeIncrease}x more nodes`);
  console.log(`✓ Time per turn: ${d2.timePerTurn.toFixed(2)}ms → ${d4.timePerTurn.toFixed(2)}ms`);

  if (d4.timePerTurn < 100) {
    console.log('\n🎉 Depth 4 is STILL under 100ms per turn! Very playable!');
  } else if (d4.timePerTurn < 500) {
    console.log('\n✅ Depth 4 is under 500ms per turn - acceptable for most play');
  } else if (d4.timePerTurn < 1000) {
    console.log('\n⚠️  Depth 4 is under 1 second per turn - slow but usable');
  } else {
    console.log('\n❌ Depth 4 is over 1 second per turn - too slow for real-time play');
  }

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
