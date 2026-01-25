const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

const team1 = TEAM_SPECS_GHOLDENGO;
const team2 = TEAM_ANTIMETA_LANDO;

/**
 * Run a single detailed battle to inspect moves and Pokemon
 */

async function main() {
  const battleNum = parseInt(process.argv[2]) || 1;

  console.log('='.repeat(80));
  console.log(`DETAILED SINGLE BATTLE #${battleNum}`);
  console.log('='.repeat(80));
  console.log();
  console.log('TypeAwareBot (Team 1) vs TreeSearchBot (Team 2)');
  console.log();

  const typeAwareBot = new TypeAwareBot('TypeAwareBot');
  const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

  const sim = new StatefulBattleSimulator(typeAwareBot, treeSearchBot, team1, team2, {
    verbose: true,  // Enable verbose output
    maxTurns: 100
  });

  const result = await sim.runBattle();

  console.log();
  console.log('='.repeat(80));
  console.log('BATTLE RESULT');
  console.log('='.repeat(80));
  console.log(`Winner: ${result.winner}`);
  console.log(`Turns: ${result.turns}`);
  console.log();
  console.log('TypeAwareBot Stats:');
  console.log(`  Nodes evaluated: ${typeAwareBot.nodesEvaluated}`);
  console.log(`  Prunes: ${typeAwareBot.pruneCount}`);
  console.log(`  Switches: ${typeAwareBot.switchBreaks}`);
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Error:', err);
  console.error(err.stack);
  process.exit(1);
});
