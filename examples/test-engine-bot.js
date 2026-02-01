const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const EngineTreeSearchBot = require('../src/EngineTreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test EngineTreeSearchBot with engine-based simulation
 * Compare performance against RandomBot baseline
 */

async function runTest() {
  console.log('Testing EngineTreeSearchBot with @pkmn/sim Battle engine\n');

  const numBattles = 5;
  let engineWins = 0;
  let randomWins = 0;
  let draws = 0;
  const turnCounts = [];
  const searchTimes = [];

  for (let i = 0; i < numBattles; i++) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Battle ${i + 1}/${numBattles}`);
    console.log('='.repeat(60));

    // Use sample OU teams
    const allTeams = ouTeams.getAllTeams();
    const team1 = allTeams[i % allTeams.length];
    const team2 = allTeams[(i + 1) % allTeams.length];

    const engineBot = new EngineTreeSearchBot('EngineBot', {
      searchDepth: 2,
      verbose: false
    });

    const randomBot = new RandomBot('RandomBot');

    const simulator = new EngineBattleSimulator(
      engineBot,
      randomBot,
      team1,
      team2,
      { verbose: true }
    );

    const startTime = Date.now();
    const result = await simulator.runBattle();
    const totalTime = Date.now() - startTime;

    turnCounts.push(result.turns);

    if (result.winner === 'EngineBot') {
      engineWins++;
    } else if (result.winner === 'RandomBot') {
      randomWins++;
    } else {
      draws++;
    }

    console.log(`\nBattle completed in ${(totalTime / 1000).toFixed(2)}s`);
    console.log(`Average time per turn: ${(totalTime / result.turns).toFixed(0)}ms`);

    searchTimes.push(totalTime / result.turns);
  }

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS - ENGINE TREE SEARCH BOT');
  console.log('='.repeat(70));
  console.log(`Total Battles: ${numBattles}`);
  console.log('');
  console.log('EngineTreeSearchBot:');
  console.log(`  Wins: ${engineWins} (${(engineWins / numBattles * 100).toFixed(1)}%)`);
  console.log('');
  console.log('RandomBot:');
  console.log(`  Wins: ${randomWins} (${(randomWins / numBattles * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`Draws: ${draws}`);
  console.log('');
  console.log('Turn Statistics:');
  console.log(`  Average: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)} turns`);
  console.log(`  Min: ${Math.min(...turnCounts)} turns`);
  console.log(`  Max: ${Math.max(...turnCounts)} turns`);
  console.log('');
  console.log('Performance:');
  console.log(`  Average time per turn: ${(searchTimes.reduce((a, b) => a + b, 0) / searchTimes.length).toFixed(0)}ms`);
  console.log('='.repeat(70));
}

runTest().catch(console.error);
