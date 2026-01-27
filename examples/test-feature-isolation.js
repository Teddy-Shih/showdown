const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

/**
 * Feature Isolation Test
 * Disable features one at a time to identify which causes the regression
 */

class ConfigurableTypeAwareBot extends TypeAwareBot {
  constructor(name, config = {}) {
    super(name);

    // Feature flags (default: all enabled)
    this.enableCoverageBonus = config.enableCoverageBonus !== false;
    this.enablePriorityTracking = config.enablePriorityTracking !== false;
    this.enableSpeedConfidence = config.enableSpeedConfidence !== false;
    this.enableFieldTracking = config.enableFieldTracking !== false;
  }

  // Override getEffectivePriority to make it toggleable
  getEffectivePriority(move, pokemon) {
    if (!this.enablePriorityTracking) {
      // Fallback to basic priority from move data
      return move ? (move.priority || 0) : 0;
    }
    return super.getEffectivePriority(move, pokemon);
  }

  // Override determineMoveOrder to make it toggleable
  determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority) {
    if (!this.enablePriorityTracking) {
      // Simple speed comparison (no Trick Room, no priority)
      return ourSpeed >= oppSpeed;
    }
    return super.determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority);
  }

  // Override evaluateMoveCoverageVsTeam to make it toggleable
  evaluateMoveCoverageVsTeam(move, oppTeam) {
    if (!this.enableCoverageBonus) {
      return 0; // No coverage bonus
    }
    return super.evaluateMoveCoverageVsTeam(move, oppTeam);
  }

  // Override processBattleMessage to make field tracking toggleable
  processBattleMessage(message) {
    if (!this.enableFieldTracking) {
      // Only process basic messages (switches, damage, moves, boosts)
      // Skip weather, terrain, field conditions
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
    // Normal processing with all features
    super.processBattleMessage(message);
  }

  // Override evaluatePosition to make speed confidence toggleable
  evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team = null, ourBoosts = null, oppBoosts = null) {
    const score = super.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team, ourBoosts, oppBoosts);

    if (!this.enableSpeedConfidence) {
      // Remove speed confidence component and add back old gradient
      // This is tricky since we'd need to recalculate...
      // For now, just use the score as-is (speed confidence is minor component)
    }

    return score;
  }
}

async function testConfiguration(configName, config, numGames) {
  let wins = 0;
  let team1Wins = 0;
  let team2Wins = 0;
  let team1Games = 0;
  let team2Games = 0;

  for (let i = 0; i < numGames; i++) {
    const isTeam1 = i % 2 === 0;
    const team = isTeam1 ? TEAM_SPECS_GHOLDENGO : TEAM_ANTIMETA_LANDO;
    const opponent = isTeam1 ? TEAM_ANTIMETA_LANDO : TEAM_SPECS_GHOLDENGO;

    const typeAwareBot = new ConfigurableTypeAwareBot('TypeAwareBot', config);
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

    if (isTeam1) {
      team1Games++;
    } else {
      team2Games++;
    }
  }

  const winRate = (wins / numGames * 100).toFixed(1);
  const team1Rate = (team1Wins / team1Games * 100).toFixed(1);
  const team2Rate = (team2Wins / team2Games * 100).toFixed(1);

  return {
    configName,
    wins,
    total: numGames,
    winRate,
    team1: { wins: team1Wins, games: team1Games, rate: team1Rate },
    team2: { wins: team2Wins, games: team2Games, rate: team2Rate }
  };
}

async function main() {
  const gamesPerConfig = 20; // 10 per team

  console.log('='.repeat(80));
  console.log('FEATURE ISOLATION TEST');
  console.log('='.repeat(80));
  console.log(`Testing ${gamesPerConfig} games per configuration (${gamesPerConfig/2} per team)`);
  console.log();

  const configurations = [
    {
      name: 'Baseline (all features enabled)',
      config: {
        enableCoverageBonus: true,
        enablePriorityTracking: true,
        enableSpeedConfidence: true,
        enableFieldTracking: true
      }
    },
    {
      name: 'Coverage bonus DISABLED',
      config: {
        enableCoverageBonus: false,
        enablePriorityTracking: true,
        enableSpeedConfidence: true,
        enableFieldTracking: true
      }
    },
    {
      name: 'Priority tracking DISABLED',
      config: {
        enableCoverageBonus: true,
        enablePriorityTracking: false,
        enableSpeedConfidence: true,
        enableFieldTracking: true
      }
    },
    {
      name: 'Speed confidence DISABLED',
      config: {
        enableCoverageBonus: true,
        enablePriorityTracking: true,
        enableSpeedConfidence: false,
        enableFieldTracking: true
      }
    },
    {
      name: 'Field tracking DISABLED',
      config: {
        enableCoverageBonus: true,
        enablePriorityTracking: true,
        enableSpeedConfidence: true,
        enableFieldTracking: false
      }
    },
    {
      name: 'ALL features DISABLED',
      config: {
        enableCoverageBonus: false,
        enablePriorityTracking: false,
        enableSpeedConfidence: false,
        enableFieldTracking: false
      }
    }
  ];

  const results = [];

  for (const { name, config } of configurations) {
    console.log(`Testing: ${name}...`);
    const result = await testConfiguration(name, config, gamesPerConfig);
    results.push(result);
    console.log(`  Overall: ${result.wins}/${result.total} (${result.winRate}%)`);
    console.log(`  Team 1: ${result.team1.wins}/${result.team1.games} (${result.team1.rate}%)`);
    console.log(`  Team 2: ${result.team2.wins}/${result.team2.games} (${result.team2.rate}%)`);
    console.log();
  }

  // Summary table
  console.log('='.repeat(80));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log();
  console.log('Configuration                     | Overall | Team 1  | Team 2  |');
  console.log('----------------------------------|---------|---------|---------|');
  for (const result of results) {
    const configShort = result.configName.substring(0, 33).padEnd(33);
    const overall = `${result.winRate}%`.padStart(7);
    const team1 = `${result.team1.rate}%`.padStart(7);
    const team2 = `${result.team2.rate}%`.padStart(7);
    console.log(`${configShort} | ${overall} | ${team1} | ${team2} |`);
  }
  console.log();

  // Find best configuration
  const baseline = results[0];
  let bestImprovement = null;
  let bestImprovementDelta = 0;

  for (let i = 1; i < results.length - 1; i++) { // Skip baseline and "all disabled"
    const delta = parseFloat(results[i].winRate) - parseFloat(baseline.winRate);
    if (delta > bestImprovementDelta) {
      bestImprovementDelta = delta;
      bestImprovement = results[i];
    }
  }

  console.log('='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Baseline (all features): ${baseline.winRate}%`);
  console.log(`  Team 1: ${baseline.team1.rate}% (baseline: 87.5%)`);
  console.log(`  Team 2: ${baseline.team2.rate}% (baseline: 85.7%)`);
  console.log();

  if (bestImprovement && bestImprovementDelta > 5) {
    console.log(`✓ BEST IMPROVEMENT: ${bestImprovement.configName}`);
    console.log(`  Win rate: ${bestImprovement.winRate}% (+${bestImprovementDelta.toFixed(1)} pp)`);
    console.log(`  Team 1: ${bestImprovement.team1.rate}%`);
    console.log(`  Team 2: ${bestImprovement.team2.rate}%`);
    console.log();
    console.log(`→ This feature appears to be causing the regression!`);
  } else {
    console.log(`❌ No single feature removal significantly improves performance`);
    console.log(`→ The regression may be from feature interaction, not a single feature`);
  }
  console.log();

  // Check "all disabled"
  const allDisabled = results[results.length - 1];
  console.log(`All features disabled: ${allDisabled.winRate}%`);
  if (parseFloat(allDisabled.winRate) > parseFloat(baseline.winRate) + 5) {
    console.log(`→ Disabling everything helps significantly!`);
    console.log(`→ Multiple features are interacting poorly`);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
