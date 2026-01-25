const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

const team1 = TEAM_SPECS_GHOLDENGO;
const team2 = TEAM_ANTIMETA_LANDO;

/**
 * Test Team-Aware TypeAwareBot v2 vs StatefulTreeSearchBot
 *
 * V2 Changes:
 * - Proper team classification based on actual Pokemon roles
 * - Team 1: OFFENSIVE (2 setup sweepers + 3 wallbreakers)
 * - Team 2: DEFENSIVE (2 defensive pivots + recovery)
 * - Adjusted evaluation weights for each style
 * - Detailed battle logging for losses
 */

async function main() {
  const numBattles = parseInt(process.argv[2]) || 10;

  console.log('='.repeat(80));
  console.log('TEAM-AWARE TYPEAWAREBOT V2 VS STATEFULTREESEARCHBOT');
  console.log('='.repeat(80));
  console.log();
  console.log('🎯 V2 Improvements: Pokemon role-based classification');
  console.log();
  console.log('BASELINE PERFORMANCE (30 games):');
  console.log('  Overall: 53.3% (16-14)');
  console.log('  With Team 1 (Offensive): 40% (6-9)');
  console.log('  With Team 2 (Defensive): 67% (10-5)');
  console.log();
  console.log('V1 TEAM-AWARE (stat-based, FAILED):');
  console.log('  Overall: 40% (4-6)');
  console.log('  With Team 1: 40% (2-3)');
  console.log('  With Team 2: 40% (2-3) - COLLAPSED from 67%!');
  console.log();
  console.log('V2 EXPECTED (role-based classification):');
  console.log('  Team 1 → OFFENSIVE (2 setup sweepers + wallbreakers)');
  console.log('  Team 2 → DEFENSIVE (defensive pivots + walls)');
  console.log('  Expected: Proper differentiation → 55-65% overall');
  console.log();

  console.log('='.repeat(80));
  console.log(`Running ${numBattles} battles...`);
  console.log('='.repeat(80));
  console.log();

  let typeAwareWins = 0;
  let treeSearchWins = 0;
  let draws = 0;
  let totalTypeAwareNodes = 0;
  let totalTypeAwarePrunes = 0;
  let totalTypeAwareSwitches = 0;

  // Track performance by team
  let team1Wins = 0;
  let team1Losses = 0;
  let team2Wins = 0;
  let team2Losses = 0;

  const lossLogs = [];
  const battleLogs = []; // Capture detailed logs for first few losses

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : typeAwareBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const typeAwareTeam = i % 2 === 0 ? team1 : team2;
    const typeAwareTeamNum = i % 2 === 0 ? 1 : 2;

    // Capture battle messages for detailed logging
    const battleMessages = [];
    const originalLog = console.log;
    const captureLog = lossLogs.length < 2; // Capture first 2 losses

    if (captureLog) {
      console.log = (...args) => {
        const msg = args.join(' ');
        battleMessages.push(msg);
        originalLog(...args);
      };
    }

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: captureLog, // Enable verbose for first few battles
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (captureLog) {
      console.log = originalLog; // Restore
    }

    const typeAwareWon = result.winner === 'TypeAwareBot';
    const isLoss = !typeAwareWon && result.winner !== 'draw';

    if (typeAwareWon) {
      typeAwareWins++;
      if (typeAwareTeamNum === 1) team1Wins++;
      else team2Wins++;
    } else if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
      if (typeAwareTeamNum === 1) team1Losses++;
      else team2Losses++;
    } else {
      draws++;
    }

    totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
    totalTypeAwarePrunes += typeAwareBot.pruneCount;
    totalTypeAwareSwitches += typeAwareBot.switchBreaks;

    const status = typeAwareWon ? 'WON' : (result.winner === 'draw' ? 'DRAW' : 'LOST to TreeSearchBot');
    const emoji = typeAwareWon ? '' : (result.winner === 'draw' ? '⚖️' : '❌');

    console.log(`Battle ${i + 1}: TypeAwareBot (Team ${typeAwareTeamNum}) ${status} in ${result.turns} turns ${emoji} (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);

    if (isLoss) {
      lossLogs.push({
        battle: i + 1,
        team: typeAwareTeamNum,
        turns: result.turns,
        nodes: typeAwareBot.nodesEvaluated,
        prunes: typeAwareBot.pruneCount,
        switches: typeAwareBot.switchBreaks
      });

      if (captureLog) {
        battleLogs.push({
          battle: i + 1,
          team: typeAwareTeamNum,
          messages: battleMessages
        });
      }
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('TEAM-AWARE V2 RESULTS');
  console.log('='.repeat(80));
  console.log(`TypeAwareBot:     ${typeAwareWins} wins (${(typeAwareWins/numBattles*100).toFixed(1)}%)`);
  console.log(`TreeSearchBot:    ${treeSearchWins} wins (${(treeSearchWins/numBattles*100).toFixed(1)}%)`);
  console.log(`Draws:            ${draws}`);
  console.log('='.repeat(80));
  console.log(`TypeAwareBot avg nodes: ${Math.round(totalTypeAwareNodes / numBattles)}`);
  console.log(`TypeAwareBot avg prunes: ${Math.round(totalTypeAwarePrunes / numBattles)}`);
  console.log(`TypeAwareBot prune efficiency: ${(totalTypeAwarePrunes / totalTypeAwareNodes * 100).toFixed(1)}%`);
  console.log(`TypeAwareBot avg switches: ${(totalTypeAwareSwitches / numBattles).toFixed(1)}`);
  console.log();

  // Team-specific performance
  console.log('='.repeat(80));
  console.log('PERFORMANCE BY TEAM');
  console.log('='.repeat(80));
  const team1Total = team1Wins + team1Losses;
  const team2Total = team2Wins + team2Losses;
  console.log(`Team 1 (Offensive): ${team1Wins}/${team1Total} wins (${team1Total > 0 ? (team1Wins/team1Total*100).toFixed(1) : '0.0'}%)`);
  console.log(`Team 2 (Defensive): ${team2Wins}/${team2Total} wins (${team2Total > 0 ? (team2Wins/team2Total*100).toFixed(1) : '0.0'}%)`);
  console.log();
  console.log('COMPARISON TO BASELINE:');
  console.log(`  Team 1: Baseline 40% → V2 ${team1Total > 0 ? (team1Wins/team1Total*100).toFixed(1) : '0.0'}% (${team1Total > 0 ? ((team1Wins/team1Total*100 - 40) >= 0 ? '+' : '') + (team1Wins/team1Total*100 - 40).toFixed(1) : '0.0'}%)`);
  console.log(`  Team 2: Baseline 67% → V2 ${team2Total > 0 ? (team2Wins/team2Total*100).toFixed(1) : '0.0'}% (${team2Total > 0 ? ((team2Wins/team2Total*100 - 67) >= 0 ? '+' : '') + (team2Wins/team2Total*100 - 67).toFixed(1) : '0.0'}%)`);
  console.log();

  // Overall comparison
  const baselineOverall = 53.3;
  const currentOverall = typeAwareWins/numBattles*100;
  const improvement = currentOverall - baselineOverall;

  console.log('='.repeat(80));
  console.log('OVERALL COMPARISON');
  console.log('='.repeat(80));
  console.log(`Baseline (30 games):    53.3% (16-14)`);
  console.log(`V1 (stat-based):        40.0% (4-6) - FAILED`);
  console.log(`V2 (role-based):        ${currentOverall.toFixed(1)}% (${typeAwareWins}-${treeSearchWins})`);
  console.log(`Change from baseline:   ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} percentage points`);
  console.log();

  if (improvement >= 10) {
    console.log('✅ SIGNIFICANT IMPROVEMENT! Team-aware V2 is working.');
  } else if (improvement >= 5) {
    console.log('✓ Moderate improvement. Team-aware V2 shows promise.');
  } else if (improvement >= 0) {
    console.log('≈ Marginal improvement. Results inconclusive, may need more games.');
  } else if (improvement >= -5) {
    console.log('⚠️  Slight degradation. Team-aware V2 may need further tuning.');
  } else {
    console.log('❌ Performance DEGRADED. Team-aware V2 needs significant adjustment.');
  }
  console.log();

  if (lossLogs.length > 0) {
    console.log(`📝 Loss Summary (${lossLogs.length} losses):`);
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battle} (Team ${loss.team}): ${loss.turns} turns, ${loss.nodes} nodes, ${loss.switches} switches`);
    });
    console.log();
  }

  // Print detailed battle logs
  if (battleLogs.length > 0) {
    console.log('='.repeat(80));
    console.log('DETAILED BATTLE LOGS (FIRST LOSS)');
    console.log('='.repeat(80));
    console.log();

    const firstLoss = battleLogs[0];
    console.log(`Battle ${firstLoss.battle} - TypeAwareBot (Team ${firstLoss.team}) LOSS`);
    console.log('-'.repeat(80));
    console.log();

    // Print all battle messages
    firstLoss.messages.forEach(msg => {
      console.log(msg);
    });

    console.log();
    console.log('='.repeat(80));
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
