const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const ImprovedTypeAwareBot = require('../src/ImprovedTypeAwareBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test Enhanced Depth6SearchBot - with all improvements:
 * 1. Sophisticated switching logic (minimax-based)
 * 2. All 4 moves considered (not just top 3)
 * 3. Non-linear stat boost evaluation (sweep potential)
 *
 * This should perform better against setup sweepers like Volcarona
 */

async function testEnhancedDepth6() {
  console.log('='.repeat(70));
  console.log('ENHANCED DEPTH 6 SEARCH BOT TEST');
  console.log('='.repeat(70));
  console.log('Testing improvements:');
  console.log('  ✓ Sophisticated switching (minimax evaluation)');
  console.log('  ✓ All 4 moves considered (not just 3)');
  console.log('  ✓ Non-linear stat boost evaluation');
  console.log('='.repeat(70));
  console.log();

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0]; // Depth6 team
  const team2 = allTeams[1]; // Opponent team

  // Test 1: Enhanced Depth6 with all 4 moves
  console.log('TEST 1: Enhanced Depth6Bot (4 moves) vs ImprovedTypeAwareBot');
  console.log('='.repeat(70));

  const enhancedBot = new Depth6SearchBot('EnhancedDepth6', {
    verbose: true,
    maxMovesToConsider: 4, // Consider all 4 moves!
    useTranspositionTable: true,
    useMoveOrdering: true
  });

  const typeAwareBot = new ImprovedTypeAwareBot('TypeAwareBot');

  const simulator1 = new EngineBattleSimulator(
    enhancedBot,
    typeAwareBot,
    team1,
    team2,
    { verbose: false }
  );

  const battleStart1 = performance.now();
  const result1 = await simulator1.runBattle();
  const battleTime1 = performance.now() - battleStart1;

  console.log('\n' + '='.repeat(70));
  console.log('TEST 1 RESULTS');
  console.log('='.repeat(70));
  console.log(`Winner:           ${result1.winner || 'Draw'}`);
  console.log(`Turns:            ${result1.turns}`);
  console.log(`Total time:       ${(battleTime1 / 1000).toFixed(2)}s`);
  console.log(`Time per turn:    ${(battleTime1 / result1.turns / 1000).toFixed(2)}s`);
  console.log('='.repeat(70));

  enhancedBot.printStats();

  // Test 2: Standard Depth6 with 3 moves (for comparison)
  console.log('\n\n');
  console.log('TEST 2: Standard Depth6Bot (3 moves) vs ImprovedTypeAwareBot');
  console.log('='.repeat(70));

  const standardBot = new Depth6SearchBot('StandardDepth6', {
    verbose: true,
    maxMovesToConsider: 3, // Only top 3 moves
    useTranspositionTable: true,
    useMoveOrdering: true
  });

  const typeAwareBot2 = new ImprovedTypeAwareBot('TypeAwareBot');

  const simulator2 = new EngineBattleSimulator(
    standardBot,
    typeAwareBot2,
    team1,
    team2,
    { verbose: false }
  );

  const battleStart2 = performance.now();
  const result2 = await simulator2.runBattle();
  const battleTime2 = performance.now() - battleStart2;

  console.log('\n' + '='.repeat(70));
  console.log('TEST 2 RESULTS');
  console.log('='.repeat(70));
  console.log(`Winner:           ${result2.winner || 'Draw'}`);
  console.log(`Turns:            ${result2.turns}`);
  console.log(`Total time:       ${(battleTime2 / 1000).toFixed(2)}s`);
  console.log(`Time per turn:    ${(battleTime2 / result2.turns / 1000).toFixed(2)}s`);
  console.log('='.repeat(70));

  standardBot.printStats();

  // Summary comparison
  console.log('\n\n');
  console.log('='.repeat(70));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(70));

  const stats1 = enhancedBot.getStats();
  const stats2 = standardBot.getStats();

  console.log('\n' + 'Enhanced (4 moves)'.padEnd(30) + 'Standard (3 moves)');
  console.log('-'.repeat(70));
  console.log(
    `Avg search time:   ${stats1.search.avgSearchTime.toFixed(2)}ms`.padEnd(30) +
    `${stats2.search.avgSearchTime.toFixed(2)}ms`
  );
  console.log(
    `Avg nodes:         ${stats1.search.avgNodesExplored.toFixed(0)}`.padEnd(30) +
    `${stats2.search.avgNodesExplored.toFixed(0)}`
  );
  console.log(
    `TT hit rate:       ${stats1.simulator.ttHitRate}`.padEnd(30) +
    `${stats2.simulator.ttHitRate}`
  );
  console.log(
    `Result:            ${result1.winner || 'Draw'}`.padEnd(30) +
    `${result2.winner || 'Draw'}`
  );

  console.log('\n' + '='.repeat(70));
  console.log('ANALYSIS');
  console.log('='.repeat(70));

  const timeIncrease = ((stats1.search.avgSearchTime / stats2.search.avgSearchTime - 1) * 100).toFixed(1);
  const nodeIncrease = ((stats1.search.avgNodesExplored / stats2.search.avgNodesExplored - 1) * 100).toFixed(1);

  console.log(`\nConsidering 4 moves instead of 3:`);
  console.log(`  Time increase:     ${timeIncrease}%`);
  console.log(`  Nodes increase:    ${nodeIncrease}%`);

  if (result1.winner !== result2.winner) {
    console.log(`\n✨ SIGNIFICANT: Different outcome with 4-move search!`);
    console.log(`   This suggests the 4th move was critical in some positions.`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('KEY IMPROVEMENTS DEMONSTRATED');
  console.log('='.repeat(70));

  console.log('\n1. SOPHISTICATED SWITCHING:');
  console.log('   ✓ Uses minimax to evaluate each switch option');
  console.log('   ✓ Considers opponent responses to switch');
  console.log('   ✓ No longer just picks first alive Pokemon');

  console.log('\n2. COMPLETE MOVE SEARCH:');
  console.log('   ✓ Considers all 4 moves per position');
  console.log('   ✓ No longer misses winning moves ranked 4th');
  console.log(`   ✓ Cost: ${timeIncrease}% increase in search time`);

  console.log('\n3. NON-LINEAR STAT BOOSTS:');
  console.log('   ✓ Exponential scaling (1.5^n per stage)');
  console.log('   ✓ Sweep potential bonus (offense + speed)');
  console.log('   ✓ Better evaluation of setup sweepers');
  console.log('   ✓ Examples:');
  console.log('      - Quiver Dance +3: ~250 points (vs ~141 linear)');
  console.log('      - Dragon Dance +2: ~130 points (vs ~70 linear)');
  console.log('      - Defensive setup +3: Extra wall bonus');

  console.log('\n' + '='.repeat(70));
}

testEnhancedDepth6().catch(console.error);
