const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

/**
 * Test each team individually to see performance patterns
 */

async function testTeam(teamName, team, opponent, numGames) {
  let wins = 0;

  for (let i = 0; i < numGames; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const simulator = new StatefulBattleSimulator(
      typeAwareBot,
      treeSearchBot,
      team,
      opponent,
      { verbose: false }
    );

    const result = await simulator.runBattle();

    if (result.winner === 'TypeAwareBot') {
      wins++;
    }
  }

  const winRate = (wins / numGames * 100).toFixed(1);
  console.log(`${teamName}: ${wins}/${numGames} wins (${winRate}%)`);

  return wins;
}

async function main() {
  const gamesPerTeam = 20;

  console.log('='.repeat(80));
  console.log('TEAM-SPECIFIC PERFORMANCE TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${gamesPerTeam} games per team\n`);

  console.log('Team 1 (Offensive - TEAM_SPECS_GHOLDENGO):');
  console.log('  - Baxcalibur (Dragon Dance setup)');
  console.log('  - Choice Specs Gholdengo (wallbreaker)');
  console.log('  - Great Tusk (fast attacker + hazards)');
  console.log('  - Choice Scarf Iron Valiant (revenge killer)');
  console.log('  - Rotom-Wash (pivot with Thunder Wave)');
  console.log('  - Kingambit (Swords Dance setup)');
  console.log();

  const team1Wins = await testTeam(
    'Team 1 vs Team 2',
    TEAM_SPECS_GHOLDENGO,
    TEAM_ANTIMETA_LANDO,
    gamesPerTeam
  );

  console.log();

  console.log('Team 2 (Defensive - TEAM_ANTIMETA_LANDO):');
  console.log('  - Hatterene (Magic Bounce, bulky)');
  console.log('  - Magnezone (Iron Defense wall)');
  console.log('  - Slowking (Regenerator pivot)');
  console.log('  - Frosmoth (Quiver Dance + Aurora Veil)');
  console.log('  - Landorus-T (Choice Scarf revenge killer)');
  console.log('  - Zapdos-Galar (Choice Band wallbreaker)');
  console.log();

  const team2Wins = await testTeam(
    'Team 2 vs Team 1',
    TEAM_ANTIMETA_LANDO,
    TEAM_SPECS_GHOLDENGO,
    gamesPerTeam
  );

  console.log();
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Team 1 (Offensive): ${team1Wins}/${gamesPerTeam} (${(team1Wins/gamesPerTeam*100).toFixed(1)}%)`);
  console.log(`Team 2 (Defensive): ${team2Wins}/${gamesPerTeam} (${(team2Wins/gamesPerTeam*100).toFixed(1)}%)`);
  console.log();

  if (team1Wins < team2Wins - 3) {
    console.log('❌ Team 1 underperforming significantly');
  } else if (team2Wins < team1Wins - 3) {
    console.log('❌ Team 2 underperforming significantly');
  } else {
    console.log('✓ Teams performing similarly');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
