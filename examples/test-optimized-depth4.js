const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const OptimizedDepth4Bot = require('../src/OptimizedDepth4Bot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test OptimizedDepth4Bot with transposition tables and move ordering
 */

async function testOptimizedBot() {
  console.log('='.repeat(70));
  console.log('OPTIMIZED DEPTH 4 BOT TEST');
  console.log('='.repeat(70));
  console.log('Features: Transposition tables + Move ordering\n');

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const optimizedBot = new OptimizedDepth4Bot('OptimizedD4', {
    verbose: true,
    maxMovesToConsider: 3,
    maxDepth: 4,
    useTranspositionTable: true,
    useMoveOrdering: true
  });

  const randomBot = new RandomBot('RandomBot');

  const simulator = new EngineBattleSimulator(
    optimizedBot,
    randomBot,
    team1,
    team2,
    { verbose: false }
  );

  console.log('Starting battle (OptimizedDepth4Bot vs RandomBot)...\n');
  const battleStart = performance.now();
  const result = await simulator.runBattle();
  const battleTime = performance.now() - battleStart;

  console.log('\n' + '='.repeat(70));
  console.log('BATTLE RESULTS');
  console.log('='.repeat(70));
  console.log(`Winner:           ${result.winner || 'Draw'}`);
  console.log(`Turns:            ${result.turns}`);
  console.log(`Total time:       ${battleTime.toFixed(2)}ms (${(battleTime / 1000).toFixed(2)}s)`);
  console.log(`Time per turn:    ${(battleTime / result.turns).toFixed(2)}ms`);
  console.log('='.repeat(70));

  optimizedBot.printStats();

  const stats = optimizedBot.getStats();
  const simStats = stats.simulator;

  console.log('\n' + '='.repeat(70));
  console.log('OPTIMIZATION EFFECTIVENESS');
  console.log('='.repeat(70));

  const ttTotal = simStats.ttHits + simStats.ttMisses;
  const ttSavings = simStats.ttHits * simStats.avgCloneTime;

  console.log('\nTransposition Table Impact:');
  console.log(`  Hit rate:               ${simStats.ttHitRate}`);
  console.log(`  Hits:                   ${simStats.ttHits}`);
  console.log(`  Estimated time saved:   ${ttSavings.toFixed(2)}ms (${(ttSavings / stats.search.totalSearchTime * 100).toFixed(1)}%)`);
  console.log(`  Table size:             ${simStats.ttSize} entries`);

  console.log('\nMove Ordering Impact:');
  console.log(`  Alpha-beta prunes:      ${stats.search.alphaBetaPrunes}`);
  console.log(`  Prune rate:             ${(stats.search.alphaBetaPrunes / stats.search.nodesExplored * 100).toFixed(1)}%`);
  console.log(`  Avg ordering time:      ${simStats.avgMoveOrderingTime.toFixed(3)}ms`);

  console.log('\nPerformance Metrics:');
  console.log(`  Nodes per second:       ${(stats.search.nodesExplored / (battleTime / 1000)).toFixed(0)}`);
  console.log(`  Avg nodes per search:   ${stats.search.avgNodesExplored.toFixed(1)}`);
  console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);

  if (stats.search.avgSearchTime < 300) {
    console.log('\n🎉 Optimized Depth 4 is under 300ms per turn! Very efficient!');
  } else if (stats.search.avgSearchTime < 500) {
    console.log('\n✅ Optimized Depth 4 is under 500ms per turn - good performance!');
  } else {
    console.log('\n⚠️  Search time is still high, but better than unoptimized');
  }

  console.log('\n' + '='.repeat(70));
}

testOptimizedBot().catch(console.error);
