const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const FastTreeSearchBot = require('../src/FastTreeSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test FastTreeSearchBot - 2-ply minimax with engine
 */

async function runTest() {
  console.log('Testing FastTreeSearchBot (2-ply minimax)\n');

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const treeBot = new FastTreeSearchBot('FastTree', {
    verbose: true,
    maxMovesToConsider: 3
  });
  const randomBot = new RandomBot('Random');

  const simulator = new EngineBattleSimulator(
    treeBot,
    randomBot,
    team1,
    team2,
    { verbose: true }
  );

  console.log('Starting battle...\n');
  const startTime = Date.now();
  const result = await simulator.runBattle();
  const totalTime = Date.now() - startTime;

  console.log('\n' + '='.repeat(60));
  console.log('BATTLE RESULT');
  console.log('='.repeat(60));
  console.log(`Winner: ${result.winner || 'Draw'}`);
  console.log(`Turns: ${result.turns}`);
  console.log(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Time per turn: ${(totalTime / result.turns).toFixed(0)}ms`);
  console.log('='.repeat(60));
}

runTest().catch(console.error);
