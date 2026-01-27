const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

async function main() {
  const typeAwareBot = new TypeAwareBot('TypeAwareBot');
  const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

  const sim = new StatefulBattleSimulator(
    typeAwareBot,
    treeSearchBot,
    TEAM_SPECS_GHOLDENGO,
    TEAM_ANTIMETA_LANDO,
    {
      verbose: true,
      maxTurns: 100
    }
  );

  console.log('Running single battle with verbose output...\n');
  const result = await sim.runBattle();

  console.log('\n' + '='.repeat(80));
  console.log('BATTLE RESULT');
  console.log('='.repeat(80));
  console.log(`Winner: ${result.winner}`);
  console.log(`Turns: ${result.turns}`);
  console.log(`TypeAwareBot nodes: ${typeAwareBot.nodesEvaluated}`);
  console.log(`TypeAwareBot switches: ${typeAwareBot.switchBreaks}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
