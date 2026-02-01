const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const ProfiledFastTreeSearchBot = require('../src/ProfiledFastTreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Profile FastTreeSearchBot to see where time is spent
 */

async function runProfile() {
  console.log('='.repeat(70));
  console.log('PERFORMANCE PROFILING - FastTreeSearchBot');
  console.log('='.repeat(70));
  console.log('Running a single battle with detailed timing...\n');

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const profiledBot = new ProfiledFastTreeSearchBot('ProfiledBot', {
    verbose: false,
    maxMovesToConsider: 3
  });

  const randomBot = new RandomBot('RandomBot');

  const simulator = new EngineBattleSimulator(
    profiledBot,
    randomBot,
    team1,
    team2,
    { verbose: false }
  );

  console.log('Starting battle...');
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

  // Print detailed stats
  profiledBot.printStats();

  // Calculate and show overhead
  const stats = profiledBot.getStats();
  const simStats = stats.simulator;

  console.log('\n' + '='.repeat(70));
  console.log('OVERHEAD ANALYSIS');
  console.log('='.repeat(70));

  const totalSimTime = simStats.cloneTime + simStats.makeChoicesTime + simStats.evaluateTime;
  const totalSearchTime = stats.search.totalSearchTime;
  const overhead = totalSearchTime - totalSimTime;

  console.log('\nTime Breakdown:');
  console.log(`  Total search time:      ${totalSearchTime.toFixed(2)}ms`);
  console.log(`  Total simulation time:  ${totalSimTime.toFixed(2)}ms`);
  console.log(`  Search overhead:        ${overhead.toFixed(2)}ms (${(overhead / totalSearchTime * 100).toFixed(1)}%)`);

  console.log('\nPer-Turn Averages:');
  console.log(`  Search per turn:        ${(totalSearchTime / result.turns).toFixed(2)}ms`);
  console.log(`  Simulations per turn:   ${(simStats.simulateCalls / result.turns).toFixed(1)}`);
  console.log(`  Clones per turn:        ${(simStats.cloneCalls / result.turns).toFixed(1)}`);
  console.log(`  Evaluations per turn:   ${(simStats.evaluateCalls / result.turns).toFixed(1)}`);

  console.log('\nBottleneck Analysis:');
  const bottlenecks = [
    { name: 'Cloning', time: simStats.cloneTime, pct: simStats.cloneTime / totalSimTime * 100 },
    { name: 'MakeChoices', time: simStats.makeChoicesTime, pct: simStats.makeChoicesTime / totalSimTime * 100 },
    { name: 'Evaluation', time: simStats.evaluateTime, pct: simStats.evaluateTime / totalSimTime * 100 },
    { name: 'Search Overhead', time: overhead, pct: overhead / totalSearchTime * 100 }
  ].sort((a, b) => b.time - a.time);

  bottlenecks.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name.padEnd(20)} ${b.time.toFixed(2)}ms (${b.pct.toFixed(1)}%)`);
  });

  console.log('\nOptimization Opportunities:');
  if (bottlenecks[0].name === 'Cloning') {
    console.log('  ⚠ Cloning is the biggest bottleneck');
    console.log('    - JSON serialize: ' + simStats.jsonSerializeTime.toFixed(2) + 'ms');
    console.log('    - JSON deserialize: ' + simStats.jsonDeserializeTime.toFixed(2) + 'ms');
    console.log('    → Consider caching or reducing clone depth');
  }
  if (bottlenecks[0].name === 'MakeChoices') {
    console.log('  ⚠ Battle simulation is the biggest bottleneck');
    console.log('    → Already using optimal engine, limited optimization available');
  }
  if (bottlenecks[0].name === 'Evaluation') {
    console.log('  ⚠ State evaluation is the biggest bottleneck');
    console.log('    → Consider simplifying evaluation function');
  }

  console.log('\n' + '='.repeat(70));
  console.log('PERFORMANCE SUMMARY');
  console.log('='.repeat(70));
  console.log(`Overall: ${(battleTime / result.turns).toFixed(2)}ms per turn is EXCELLENT!`);
  console.log(`Current bottleneck: ${bottlenecks[0].name}`);
  console.log(`Potential speedup: ${(bottlenecks[0].time / totalSearchTime * 100).toFixed(1)}% if optimized`);
  console.log('='.repeat(70));
}

runProfile().catch(console.error);
