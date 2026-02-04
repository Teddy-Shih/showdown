const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const Depth4SearchBot = require('../src/Depth4SearchBot');
const OptimizedDepth4Bot = require('../src/OptimizedDepth4Bot');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Compare Original Depth4 vs Optimized Depth4 vs Depth6
 * Shows the impact of transposition tables and move ordering
 */

async function runBot(BotClass, botName, depth, options = {}) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TESTING: ${botName}`);
  console.log('='.repeat(70));

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const bot = new BotClass(botName, {
    verbose: false,
    maxMovesToConsider: 3,
    ...options
  });

  const randomBot = new RandomBot('RandomBot');

  const simulator = new EngineBattleSimulator(
    bot,
    randomBot,
    team1,
    team2,
    { verbose: false }
  );

  console.log(`Running battle...\n`);
  const battleStart = performance.now();
  const result = await simulator.runBattle();
  const battleTime = performance.now() - battleStart;

  console.log(`Winner: ${result.winner}, Turns: ${result.turns}, Time: ${(battleTime / 1000).toFixed(2)}s`);

  const stats = bot.getStats();
  const simStats = stats.simulator;

  return {
    name: botName,
    depth,
    winner: result.winner,
    turns: result.turns,
    totalTime: battleTime,
    timePerTurn: battleTime / result.turns,
    avgSearchTime: stats.search.avgSearchTime,
    avgNodes: stats.search.avgNodesExplored || 0,
    ttHits: simStats.ttHits || 0,
    ttMisses: simStats.ttMisses || 0,
    ttHitRate: simStats.ttHitRate || '0%',
    prunes: stats.search.alphaBetaPrunes || 0,
    nodesPruned: stats.search.nodesExplored > 0 ? (stats.search.alphaBetaPrunes / stats.search.nodesExplored * 100).toFixed(1) : '0'
  };
}

async function main() {
  console.log('='.repeat(70));
  console.log('OPTIMIZATION COMPARISON');
  console.log('='.repeat(70));
  console.log('Comparing: Original Depth4 vs Optimized Depth4 vs Depth6\n');

  const results = [];

  // Test Original Depth 4
  results.push(await runBot(
    Depth4SearchBot,
    'Original-D4',
    4,
    { maxDepth: 4 }
  ));

  // Test Optimized Depth 4
  results.push(await runBot(
    OptimizedDepth4Bot,
    'Optimized-D4',
    4,
    {
      maxDepth: 4,
      useTranspositionTable: true,
      useMoveOrdering: true
    }
  ));

  // Test Depth 6
  results.push(await runBot(
    Depth6SearchBot,
    'Depth-6',
    6,
    {}
  ));

  // Print comparison table
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(70));

  console.log('\n' + 'Bot'.padEnd(20) + 'Depth'.padEnd(8) + 'Time/Turn'.padEnd(15) + 'Nodes'.padEnd(12) + 'TT Hit%'.padEnd(12) + 'Prune%');
  console.log('-'.repeat(70));

  results.forEach(r => {
    console.log(
      r.name.padEnd(20) +
      r.depth.toString().padEnd(8) +
      `${r.timePerTurn.toFixed(0)}ms`.padEnd(15) +
      r.avgNodes.toFixed(0).padEnd(12) +
      (r.ttHitRate || 'N/A').padEnd(12) +
      (r.nodesPruned || 'N/A') + '%'
    );
  });

  console.log('\n' + '='.repeat(70));
  console.log('OPTIMIZATION IMPACT');
  console.log('='.repeat(70));

  const original = results[0];
  const optimized = results[1];
  const depth6 = results[2];

  console.log('\n📊 Original Depth4 → Optimized Depth4:');
  const speedup = (original.timePerTurn / optimized.timePerTurn).toFixed(2);
  const nodeReduction = ((original.avgNodes - optimized.avgNodes) / original.avgNodes * 100).toFixed(1);

  console.log(`  ⚡ Speedup:              ${speedup}x faster`);
  console.log(`  📉 Node reduction:       ${nodeReduction}% fewer nodes`);
  console.log(`  🎯 TT hit rate:          ${optimized.ttHitRate}`);
  console.log(`  ✂️  Prune rate:           ${optimized.nodesPruned}%`);

  if (parseFloat(speedup) > 1.3) {
    console.log(`  ✅ Optimizations are EFFECTIVE (${speedup}x improvement)`);
  } else {
    console.log(`  ⚠️  Optimizations are modest (${speedup}x improvement)`);
  }

  console.log('\n📊 Optimized Depth4 → Depth6:');
  const d4ToD6Slowdown = (depth6.timePerTurn / optimized.timePerTurn).toFixed(2);
  const nodeIncrease = (depth6.avgNodes / optimized.avgNodes).toFixed(2);

  console.log(`  🐢 Slowdown:             ${d4ToD6Slowdown}x slower`);
  console.log(`  📈 Node increase:        ${nodeIncrease}x more nodes`);
  console.log(`  🎯 TT hit rate:          ${depth6.ttHitRate}`);
  console.log(`  ✂️  Prune rate:           ${depth6.nodesPruned}%`);

  if (depth6.timePerTurn < 1000) {
    console.log(`  🎉 Depth 6 is PRACTICAL (${depth6.timePerTurn.toFixed(0)}ms per turn)`);
  } else if (depth6.timePerTurn < 3000) {
    console.log(`  ✅ Depth 6 is USABLE (${(depth6.timePerTurn / 1000).toFixed(2)}s per turn)`);
  } else {
    console.log(`  ❌ Depth 6 is TOO SLOW (${(depth6.timePerTurn / 1000).toFixed(2)}s per turn)`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('KEY INSIGHTS');
  console.log('='.repeat(70));

  console.log('\n1. Transposition Tables:');
  console.log(`   - Reduced redundant evaluations by ${optimized.ttHitRate}`);
  console.log(`   - Most effective at deeper depths`);

  console.log('\n2. Move Ordering:');
  console.log(`   - Improved alpha-beta pruning to ${optimized.nodesPruned}%`);
  console.log(`   - Reduced node exploration by ${nodeReduction}%`);

  console.log('\n3. Depth 6 Feasibility:');
  if (depth6.timePerTurn < 2000) {
    console.log(`   - ✅ Depth 6 is practical with optimizations`);
    console.log(`   - Can search 3 full turns ahead`);
    console.log(`   - Provides significant strategic advantage`);
  } else {
    console.log(`   - ⚠️  Depth 6 needs more optimization`);
    console.log(`   - Consider @pkmn/engine migration for 5-10x speedup`);
    console.log(`   - Or use depth 4 for real-time play`);
  }

  console.log('\n4. Next Steps:');
  console.log(`   - Current depth 6 time: ${(depth6.timePerTurn / 1000).toFixed(2)}s/turn`);
  console.log(`   - With @pkmn/engine: ~${(depth6.timePerTurn / 5000).toFixed(2)}s/turn (estimated)`);
  console.log(`   - Depth 8 would need: ~${((depth6.timePerTurn / 1000) * Math.pow(depth6.avgNodes / optimized.avgNodes, 2/3)).toFixed(1)}s/turn`);

  console.log('\n' + '='.repeat(70));
}

main().catch(console.error);
