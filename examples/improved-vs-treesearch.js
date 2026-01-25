/**
 * Test ImprovedTypeAwareBot vs StatefulTreeSearchBot
 * Compare with original TypeAwareBot results
 */

const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const ImprovedTypeAwareBot = require('../src/ImprovedTypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: ImprovedTypeAwareBot vs StatefulTreeSearchBot\n`);
  console.log('Improvements Applied:');
  console.log('  ✓ More aggressive switch threshold (-3 → -2)');
  console.log('  ✓ Earlier HP-based switching (30 HP → 50 HP)');
  console.log('  ✓ Increased HP preservation bonus (80 → 120)');
  console.log('  ✓ Move diversity penalty for repetition');
  console.log('  ✓ Team HP total consideration');
  console.log('  ✓ "Being walled" detection\n');

  let improvedWins = 0;
  let treeSearchWins = 0;
  let draws = 0;
  let totalImprovedNodes = 0;
  let totalImprovedPrunes = 0;
  let totalImprovedSwitches = 0;
  const lossLogs = [];

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const improvedBot = new ImprovedTypeAwareBot('ImprovedBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? improvedBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : improvedBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    // Capture battle log
    const battleLog = [];
    const originalWrite = console.log;

    console.log = (...args) => {
      battleLog.push(args.join(' '));
      originalWrite(...args);
    };

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: true,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    console.log = originalWrite;

    if (result.winner === 'ImprovedBot') {
      improvedWins++;
      totalImprovedNodes += improvedBot.nodesEvaluated;
      totalImprovedPrunes += improvedBot.pruneCount;
      totalImprovedSwitches += improvedBot.switchBreaks;
      console.log(`Battle ${i + 1}: ImprovedBot WON in ${result.turns} turns (nodes: ${improvedBot.nodesEvaluated}, switches: ${improvedBot.switchBreaks})`);
    } else if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
      totalImprovedNodes += improvedBot.nodesEvaluated;
      totalImprovedPrunes += improvedBot.pruneCount;
      totalImprovedSwitches += improvedBot.switchBreaks;
      console.log(`Battle ${i + 1}: ImprovedBot LOST in ${result.turns} turns ❌ (nodes: ${improvedBot.nodesEvaluated}, switches: ${improvedBot.switchBreaks})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          nodes: improvedBot.nodesEvaluated,
          prunes: improvedBot.pruneCount,
          switches: improvedBot.switchBreaks,
          moveHistory: [...improvedBot.moveHistory]
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  const avgNodes = totalImprovedNodes / numBattles;
  const avgPrunes = totalImprovedPrunes / numBattles;
  const avgSwitches = totalImprovedSwitches / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`IMPROVED VS TREESEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`ImprovedBot:      ${improvedWins} wins (${(improvedWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`TreeSearchBot:    ${treeSearchWins} wins (${(treeSearchWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:            ${draws}`);
  console.log('='.repeat(75));
  console.log(`ImprovedBot avg nodes: ${avgNodes.toFixed(0)}`);
  console.log(`ImprovedBot avg prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`ImprovedBot prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);
  console.log(`ImprovedBot avg switches: ${avgSwitches.toFixed(1)}`);

  console.log('\n📊 Performance Comparison:');
  console.log('  TypeAwareBot (original):   60.0% (6-4) vs TreeSearchBot');
  console.log(`  ImprovedBot (with fixes):  ${(improvedWins / numBattles * 100).toFixed(1)}% (${improvedWins}-${treeSearchWins}) vs TreeSearchBot`);

  const improvement = (improvedWins / numBattles * 100) - 60;
  if (improvement > 0) {
    console.log(`\n→ IMPROVED by ${improvement.toFixed(1)}% 🎯`);
  } else if (improvement < 0) {
    console.log(`\n→ DEGRADED by ${Math.abs(improvement).toFixed(1)}% ⚠️`);
  } else {
    console.log(`\n→ Same as original (60.0%)`);
  }

  // Save loss logs if any
  if (lossLogs.length > 0) {
    const logLines = [];
    logLines.push('ImprovedTypeAwareBot vs StatefulTreeSearchBot - Loss Analysis');
    logLines.push(`Total Battles: ${numBattles}`);
    logLines.push(`ImprovedBot Losses: ${lossLogs.length}`);
    logLines.push(`Win Rate: ${(improvedWins / numBattles * 100).toFixed(1)}%`);
    logLines.push('');
    logLines.push('Improvements Applied:');
    logLines.push('- More aggressive switch threshold (-3 → -2)');
    logLines.push('- Earlier HP-based switching (30 HP → 50 HP)');
    logLines.push('- Increased HP preservation bonus (80 → 120)');
    logLines.push('- Move diversity penalty');
    logLines.push('- Team HP total consideration');
    logLines.push('- "Being walled" detection');
    logLines.push('');
    logLines.push('='.repeat(80));
    logLines.push('');

    lossLogs.forEach(loss => {
      logLines.push(`BATTLE ${loss.battleNumber} - LOSS`);
      logLines.push(`Turns: ${loss.turns}`);
      logLines.push(`Nodes: ${loss.stats.nodes}`);
      logLines.push(`Prunes: ${loss.stats.prunes}`);
      logLines.push(`Switches: ${loss.stats.switches}`);
      logLines.push(`Move History: ${loss.stats.moveHistory.join(', ')}`);
      logLines.push('');
      logLines.push('Battle Log:');
      logLines.push(loss.log.join('\n'));
      logLines.push('');
      logLines.push('='.repeat(80));
      logLines.push('');
    });

    const filename = `improved-vs-treesearch-losses-${Date.now()}.txt`;
    fs.writeFileSync(filename, logLines.join('\n'));
    console.log();
    console.log(`📝 Saved ${lossLogs.length} loss log(s) to: ${filename}`);

    console.log();
    console.log('📋 Loss Summary:');
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battleNumber}: ${loss.turns} turns, ${loss.stats.nodes} nodes, ${loss.stats.switches} switches`);
    });

    // Compare node counts
    const avgLossNodes = lossLogs.reduce((sum, l) => sum + l.stats.nodes, 0) / lossLogs.length;
    console.log();
    console.log('🔍 Node Count Analysis:');
    console.log(`   Average nodes in losses: ${avgLossNodes.toFixed(0)}`);
    if (avgLossNodes === 2804) {
      console.log(`   ⚠️ Still hitting 2804-node cap!`);
    } else {
      console.log(`   ✓ Node cap issue resolved (was 2804, now ${avgLossNodes.toFixed(0)})`);
    }

    // Compare switches
    const avgLossSwitches = lossLogs.reduce((sum, l) => sum + l.stats.switches, 0) / lossLogs.length;
    console.log();
    console.log('🔄 Switch Behavior:');
    console.log(`   Original avg switches in losses: 1.3`);
    console.log(`   Improved avg switches in losses: ${avgLossSwitches.toFixed(1)}`);
    if (avgLossSwitches > 1.3) {
      console.log(`   ✓ More aggressive switching (+${(avgLossSwitches - 1.3).toFixed(1)})`);
    }

  } else {
    console.log();
    console.log('🎉 Perfect 100% win rate! No losses to analyze.');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
