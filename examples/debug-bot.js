const CompetitiveBattleSimulator = require('../src/CompetitiveBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MaxDamageBot = require('../src/MaxDamageBot');

// Patch MaxDamageBot to add logging
const originalChooseMove = MaxDamageBot.prototype.chooseMove;
MaxDamageBot.prototype.chooseMove = function(request) {
  const active = request.active[0];
  if (active && active.moves) {
    console.log('\n--- MaxDamageBot Move Selection ---');
    console.log('Available moves:', active.moves.map(m => m.move).join(', '));

    // Calculate damages
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (ourPokemon) {
      active.moves.forEach((moveData, i) => {
        if (!moveData.disabled && moveData.pp > 0) {
          try {
            const damage = this.estimateDamage(moveData, ourPokemon, request);
            console.log(`  ${moveData.move}: ${damage.toFixed(1)} damage`);
          } catch (e) {
            console.log(`  ${moveData.move}: ERROR - ${e.message}`);
          }
        }
      });
    }
  }

  const choice = originalChooseMove.call(this, request);
  console.log(`Choice: ${choice}`);
  return choice;
};

async function debugBattle() {
  const maxBot = new MaxDamageBot('MaxBot');
  const randBot = new RandomBot('RandBot');

  const sim = new CompetitiveBattleSimulator(maxBot, randBot, 'gen9randombattle', {
    verbose: true,
    maxTurns: 100
  });

  const result = await sim.runBattle();
  console.log('\nResult:', result);
}

debugBattle().catch(console.error);
