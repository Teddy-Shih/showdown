const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const SimpleEngineBot = require('../src/SimpleEngineBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test SimpleEngineBot - one-ply lookahead with engine
 */

async function runTest() {
  console.log('Testing SimpleEngineBot (1-ply lookahead)\n');

  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  const engineBot = new SimpleEngineBot('SimpleEngine', { verbose: true });
  const randomBot = new RandomBot('Random');

  const simulator = new EngineBattleSimulator(
    engineBot,
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
