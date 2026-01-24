const BattleSimulator = require('../src/BattleSimulator');

/**
 * Example: Run a simple random battle between two teams
 * Both players use random move selection
 */

async function main() {
  console.log('Starting Pokemon Showdown Battle Simulation');
  console.log('Both players using random move selection');
  console.log('Teams are randomly generated\n');

  // Create a battle simulator with Gen 9 Random Battle format
  const simulator = new BattleSimulator('gen9randombattle');

  try {
    const result = await simulator.runBattle();

    console.log('\n' + '='.repeat(60));
    console.log('BATTLE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Winner: ${result.winner || 'Draw'}`);
    console.log(`Total Turns: ${result.turns}`);
    console.log(`Battle Ended Normally: ${result.ended}`);

  } catch (error) {
    console.error('Error running battle:', error);
    console.error(error.stack);
  }
}

// Run the battle
main().catch(console.error);
