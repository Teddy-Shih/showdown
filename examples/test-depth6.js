const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test Depth6SearchBot - 6-ply search with full optimizations
 *
 * This tests whether depth 6 is practical with transposition tables and move ordering.
 * Target: 1-3 seconds per turn (acceptable for non-real-time play)
 */

async function testDepth6() {
  console.log('='.repeat(70));
  console.log('DEPTH 6 SEARCH BOT TEST');
  console.log('='.repeat(70));
  console.log('6-ply minimax with transposition tables + move ordering\n');

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const depth6Bot = new Depth6SearchBot('Depth6Bot', {
    verbose: true,
    maxMovesToConsider: 3,
    useTranspositionTable: true,
    useMoveOrdering: true
  });

  const randomBot = new RandomBot('RandomBot');

  const simulator = new EngineBattleSimulator(
    depth6Bot,
    randomBot,
    team1,
    team2,
    { verbose: false }
  );

  console.log('Starting battle (Depth6SearchBot vs RandomBot)...');
  console.log('Note: This will be slower than depth 4, expect 1-3s per turn\n');

  const battleStart = performance.now();
  const result = await simulator.runBattle();
  const battleTime = performance.now() - battleStart;

  console.log('\n' + '='.repeat(70));
  console.log('BATTLE RESULTS');
  console.log('='.repeat(70));
  console.log(`Winner:           ${result.winner || 'Draw'}`);
  console.log(`Turns:            ${result.turns}`);
  console.log(`Total time:       ${(battleTime / 1000).toFixed(2)}s`);
  console.log(`Time per turn:    ${(battleTime / result.turns / 1000).toFixed(2)}s`);
  console.log('='.repeat(70));

  depth6Bot.printStats();

  const stats = depth6Bot.getStats();
  const simStats = stats.simulator;

  console.log('\n' + '='.repeat(70));
  console.log('DEPTH 6 ANALYSIS');
  console.log('='.repeat(70));

  const avgTurnTime = battleTime / result.turns;
  const ttTotal = simStats.ttHits + simStats.ttMisses;
  const ttSavings = simStats.ttHits * simStats.avgCloneTime;

  console.log('\nSearch Performance:');
  console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms (${(stats.search.avgSearchTime / 1000).toFixed(2)}s)`);
  console.log(`  Avg nodes explored:     ${stats.search.avgNodesExplored.toFixed(0)}`);
  console.log(`  Nodes per second:       ${(stats.search.nodesExplored / (battleTime / 1000)).toFixed(0)}`);

  console.log('\nOptimization Impact:');
  console.log(`  TT hit rate:            ${simStats.ttHitRate}`);
  console.log(`  TT time saved:          ${(ttSavings / 1000).toFixed(2)}s (${(ttSavings / stats.search.totalSearchTime * 100).toFixed(1)}%)`);
  console.log(`  Alpha-beta prunes:      ${stats.search.alphaBetaPrunes}`);
  console.log(`  Prune rate:             ${(stats.search.alphaBetaPrunes / stats.search.nodesExplored * 100).toFixed(1)}%`);

  console.log('\nComplexity Metrics:');
  const avgBranching = Math.pow(stats.search.avgNodesExplored, 1/6);
  console.log(`  Effective branching:    ~${avgBranching.toFixed(2)}`);
  console.log(`  Table utilization:      ${(simStats.ttSize / depth6Bot.simulator.maxTableSize * 100).toFixed(1)}%`);

  console.log('\n' + '='.repeat(70));
  console.log('FEASIBILITY ASSESSMENT');
  console.log('='.repeat(70));

  if (avgTurnTime < 1000) {
    console.log('\n🎉 EXCELLENT: Depth 6 is under 1 second per turn!');
    console.log('   This is fast enough for competitive play!');
  } else if (avgTurnTime < 3000) {
    console.log('\n✅ GOOD: Depth 6 is under 3 seconds per turn.');
    console.log('   Acceptable for analysis and non-real-time play.');
  } else if (avgTurnTime < 5000) {
    console.log('\n⚠️  SLOW: Depth 6 is under 5 seconds per turn.');
    console.log('   Usable but may be frustrating for interactive play.');
  } else {
    console.log('\n❌ TOO SLOW: Depth 6 takes over 5 seconds per turn.');
    console.log('   Consider using depth 4 instead, or migrating to @pkmn/engine.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(70));

  const nodesPerMs = stats.search.nodesExplored / stats.search.totalSearchTime;
  const estimatedD8Time = Math.pow(stats.search.avgNodesExplored, 8/6) / nodesPerMs;

  console.log('\nProjected Performance:');
  console.log(`  Depth 8 estimate:       ~${(estimatedD8Time / 1000).toFixed(1)}s per turn`);
  console.log(`  For faster depth 6:     Migrate to @pkmn/engine (5-10x speedup expected)`);

  if (ttTotal > 0 && simStats.ttHits / ttTotal < 0.3) {
    console.log(`\n💡 TIP: TT hit rate is low (${simStats.ttHitRate}). Consider:`);
    console.log('   - Increasing table size');
    console.log('   - Improving hash function');
  }

  if (stats.search.alphaBetaPrunes / stats.search.nodesExplored < 0.4) {
    console.log('\n💡 TIP: Prune rate is low. Consider:');
    console.log('   - Improving move ordering heuristics');
    console.log('   - Using iterative deepening');
  }

  console.log('\n' + '='.repeat(70));
}

testDepth6().catch(console.error);
