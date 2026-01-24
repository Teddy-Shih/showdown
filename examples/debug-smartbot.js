const OUBattleSimulator = require('../src/OUBattleSimulator');
const SmartBot = require('../src/SmartBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Debug SmartBot to see what moves it's selecting
 */

// Patch SmartBot to add logging
const originalChooseMove = SmartBot.prototype.chooseMove;
SmartBot.prototype.chooseMove = function(request) {
  const active = request.active && request.active[0];
  if (active && active.moves) {
    console.log('\n--- SmartBot Move Selection ---');
    console.log('Available moves:', active.moves.map(m => m.move).join(', '));
  }

  const choice = originalChooseMove.call(this, request);
  console.log(`SmartBot choice: ${choice}`);
  return choice;
};

async function debugTest() {
  console.log('Starting debug test with verbose output\n');

  const smartBot = new SmartBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  const sim = new OUBattleSimulator(smartBot, randomBot, team1, team2, {
    verbose: true,
    maxTurns: 100
  });

  const result = await sim.runBattle();

  console.log('\nResult:', result);
}

debugTest().catch(console.error);
