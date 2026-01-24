const OUBattleSimulator = require('../src/OUBattleSimulator');
const MinimaxBot = require('../src/MinimaxBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

/**
 * Debug MinimaxBot to see what moves it's selecting
 */

// Patch MinimaxBot to add logging
const originalChooseMove = MinimaxBot.prototype.chooseMove;
MinimaxBot.prototype.chooseMove = function(request) {
  const active = request.active && request.active[0];
  if (active && active.moves) {
    console.log('\n--- MinimaxBot Move Selection ---');
    console.log('Available moves:', active.moves.map(m => m.move).join(', '));

    // Evaluate each move
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (ourPokemon) {
      active.moves.forEach((moveData, i) => {
        if (!moveData.disabled && moveData.pp > 0) {
          try {
            const score = this.evaluateMove(moveData, ourPokemon, request);
            console.log(`  ${moveData.move}: score=${score.toFixed(1)}`);
          } catch (e) {
            console.log(`  ${moveData.move}: ERROR - ${e.message}`);
          }
        }
      });
    }
  }

  const choice = originalChooseMove.call(this, request);
  console.log(`MinimaxBot choice: ${choice}`);
  return choice;
};

async function debugTest() {
  console.log('Starting debug test with verbose output\n');

  const minimaxBot = new MinimaxBot('MinimaxBot');
  const randomBot = new RandomBot('RandomBot');

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  const sim = new OUBattleSimulator(minimaxBot, randomBot, team1, team2, {
    verbose: true,
    maxTurns: 100
  });

  const result = await sim.runBattle();

  console.log('\nResult:', result);
}

debugTest().catch(console.error);
