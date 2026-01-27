const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

/**
 * Focused test: Field tracking ON vs OFF
 * Run more games to confirm field tracking is the culprit
 */

class ConfigurableTypeAwareBot extends TypeAwareBot {
  constructor(name, enableFieldTracking = true) {
    super(name);
    this.enableFieldTracking = enableFieldTracking;
  }

  processBattleMessage(message) {
    if (!this.enableFieldTracking) {
      // Only process basic messages (no weather, terrain, field conditions)
      const lines = message.split('\n');
      for (const line of lines) {
        if (line.includes('|switch|') || line.includes('|drag|')) {
          this.processSwitch(line);
        }
        if (line.includes('|-damage|')) {
          this.processDamage(line);
        }
        if (line.includes('|move|')) {
          this.processMove(line);
        }
        if (line.includes('|turn|')) {
          this.turnNumber++;
          // Skip decrementFieldConditions()
        }
        if (line.includes('|-sidestart|')) {
          this.processHazard(line);
        }
        if (line.includes('|-status|')) {
          this.processStatus(line);
        }
        if (line.includes('|-curestatus|')) {
          this.processCureStatus(line);
        }
        if (line.includes('|-boost|') || line.includes('|-unboost|')) {
          this.processBoost(line);
        }
      }
      return;
    }
    // Normal processing with field tracking
    super.processBattleMessage(message);
  }
}

async function testConfiguration(enableFieldTracking, numGames) {
  let wins = 0;
  let team1Wins = 0;
  let team2Wins = 0;
  const team1Games = numGames / 2;
  const team2Games = numGames / 2;

  for (let i = 0; i < numGames; i++) {
    const isTeam1 = i % 2 === 0;
    const team = isTeam1 ? TEAM_SPECS_GHOLDENGO : TEAM_ANTIMETA_LANDO;
    const opponent = isTeam1 ? TEAM_ANTIMETA_LANDO : TEAM_SPECS_GHOLDENGO;

    const typeAwareBot = new ConfigurableTypeAwareBot('TypeAwareBot', enableFieldTracking);
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
      if (isTeam1) {
        team1Wins++;
      } else {
        team2Wins++;
      }
    }
  }

  return {
    wins,
    total: numGames,
    winRate: (wins / numGames * 100).toFixed(1),
    team1: { wins: team1Wins, games: team1Games, rate: (team1Wins / team1Games * 100).toFixed(1) },
    team2: { wins: team2Wins, games: team2Games, rate: (team2Wins / team2Games * 100).toFixed(1) }
  };
}

async function main() {
  const gamesPerConfig = 30; // 15 per team

  console.log('='.repeat(80));
  console.log('FIELD TRACKING IMPACT TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${gamesPerConfig} games per configuration (${gamesPerConfig/2} per team)`);
  console.log();

  console.log('Testing: Field tracking ENABLED (current implementation)...');
  const withFieldTracking = await testConfiguration(true, gamesPerConfig);
  console.log(`  Overall: ${withFieldTracking.wins}/${withFieldTracking.total} (${withFieldTracking.winRate}%)`);
  console.log(`  Team 1: ${withFieldTracking.team1.wins}/${withFieldTracking.team1.games} (${withFieldTracking.team1.rate}%)`);
  console.log(`  Team 2: ${withFieldTracking.team2.wins}/${withFieldTracking.team2.games} (${withFieldTracking.team2.rate}%)`);
  console.log();

  console.log('Testing: Field tracking DISABLED...');
  const withoutFieldTracking = await testConfiguration(false, gamesPerConfig);
  console.log(`  Overall: ${withoutFieldTracking.wins}/${withoutFieldTracking.total} (${withoutFieldTracking.winRate}%)`);
  console.log(`  Team 1: ${withoutFieldTracking.team1.wins}/${withoutFieldTracking.team1.games} (${withoutFieldTracking.team1.rate}%)`);
  console.log(`  Team 2: ${withoutFieldTracking.team2.wins}/${withoutFieldTracking.team2.games} (${withoutFieldTracking.team2.rate}%)`);
  console.log();

  console.log('='.repeat(80));
  console.log('COMPARISON');
  console.log('='.repeat(80));
  console.log();

  const overallDelta = parseFloat(withoutFieldTracking.winRate) - parseFloat(withFieldTracking.winRate);
  const team1Delta = parseFloat(withoutFieldTracking.team1.rate) - parseFloat(withFieldTracking.team1.rate);
  const team2Delta = parseFloat(withoutFieldTracking.team2.rate) - parseFloat(withFieldTracking.team2.rate);

  console.log(`Overall: ${withFieldTracking.winRate}% → ${withoutFieldTracking.winRate}% (${overallDelta > 0 ? '+' : ''}${overallDelta.toFixed(1)} pp)`);
  console.log(`Team 1:  ${withFieldTracking.team1.rate}% → ${withoutFieldTracking.team1.rate}% (${team1Delta > 0 ? '+' : ''}${team1Delta.toFixed(1)} pp)`);
  console.log(`Team 2:  ${withFieldTracking.team2.rate}% → ${withoutFieldTracking.team2.rate}% (${team2Delta > 0 ? '+' : ''}${team2Delta.toFixed(1)} pp)`);
  console.log();

  if (overallDelta > 5) {
    console.log('✓ CONFIRMED: Field tracking hurts performance significantly');
    console.log(`  Disabling it improves win rate by ${overallDelta.toFixed(1)} percentage points`);
  } else if (overallDelta < -5) {
    console.log('✗ Field tracking actually helps performance');
  } else {
    console.log('~ Field tracking has minimal impact (< 5 pp difference)');
  }
  console.log();

  console.log('='.repeat(80));
  console.log('RECOMMENDATION');
  console.log('='.repeat(80));
  console.log();

  if (overallDelta > 3) {
    console.log('→ Disable field tracking (terrain, weather, Trick Room)');
    console.log('→ Keep priority tracking and coverage evaluation');
    console.log('→ This should restore performance closer to baseline');
  } else {
    console.log('→ Field tracking is not the main issue');
    console.log('→ Further investigation needed');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
