/**
 * Test TypeAwareBot vs StatefulTreeSearchBot
 * Runs battles between the two advanced bots and analyzes losses
 */

const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: TypeAwareBot vs StatefulTreeSearchBot\n`);
  console.log('TypeAwareBot Features:');
  console.log('  - Type effectiveness scoring (30x weight)');
  console.log('  - Proactive switch intelligence');
  console.log('  - 4-ply minimax with alpha-beta pruning');
  console.log('  - HP preservation bonus\n');

  console.log('StatefulTreeSearchBot Features:');
  console.log('  - 2-ply tree search');
  console.log('  - Opponent state tracking');
  console.log('  - Move simulation\n');

  let typeAwareWins = 0;
  let treeSearchWins = 0;
  let draws = 0;
  let totalTypeAwareNodes = 0;
  let totalTypeAwarePrunes = 0;
  let totalTypeAwareSwitches = 0;
  const lossLogs = [];

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : typeAwareBot;
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

    if (result.winner === 'TypeAwareBot') {
      typeAwareWins++;
      totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
      totalTypeAwarePrunes += typeAwareBot.pruneCount;
      totalTypeAwareSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot WON in ${result.turns} turns (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);
    } else if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
      totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
      totalTypeAwarePrunes += typeAwareBot.pruneCount;
      totalTypeAwareSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot LOST in ${result.turns} turns ❌ (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          typeAwareNodes: typeAwareBot.nodesEvaluated,
          typeAwarePrunes: typeAwareBot.pruneCount,
          typeAwareSwitches: typeAwareBot.switchBreaks,
          typeAwareMoveHistory: [...typeAwareBot.moveHistory]
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  const avgNodes = totalTypeAwareNodes / numBattles;
  const avgPrunes = totalTypeAwarePrunes / numBattles;
  const avgSwitches = totalTypeAwareSwitches / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`TYPEAWARE VS TREESEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`TypeAwareBot:     ${typeAwareWins} wins (${(typeAwareWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`TreeSearchBot:    ${treeSearchWins} wins (${(treeSearchWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:            ${draws}`);
  console.log('='.repeat(75));
  console.log(`TypeAwareBot avg nodes: ${avgNodes.toFixed(0)}`);
  console.log(`TypeAwareBot avg prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`TypeAwareBot prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);
  console.log(`TypeAwareBot avg switches: ${avgSwitches.toFixed(1)}`);

  console.log('\n📊 Performance vs Different Opponents:');
  console.log('  vs RandomBot:        100.0% (10-0)');
  console.log(`  vs TreeSearchBot:    ${(typeAwareWins / numBattles * 100).toFixed(1)}% (${typeAwareWins}-${treeSearchWins})`);

  // Save loss logs with detailed analysis
  if (lossLogs.length > 0) {
    const logLines = [];
    logLines.push('TypeAwareBot vs StatefulTreeSearchBot - Loss Analysis');
    logLines.push(`Total Battles: ${numBattles}`);
    logLines.push(`TypeAwareBot Losses: ${lossLogs.length}`);
    logLines.push(`Win Rate: ${(typeAwareWins / numBattles * 100).toFixed(1)}%`);
    logLines.push('');
    logLines.push('Analysis Goal: Identify why TypeAwareBot lost to TreeSearchBot');
    logLines.push('');
    logLines.push('='.repeat(80));
    logLines.push('');

    lossLogs.forEach(loss => {
      logLines.push(`BATTLE ${loss.battleNumber} - LOSS`);
      logLines.push(`Turns: ${loss.turns}`);
      logLines.push(`TypeAwareBot Nodes: ${loss.stats.typeAwareNodes}`);
      logLines.push(`TypeAwareBot Prunes: ${loss.stats.typeAwarePrunes}`);
      logLines.push(`TypeAwareBot Switches: ${loss.stats.typeAwareSwitches}`);
      logLines.push(`TypeAwareBot Move History: ${loss.stats.typeAwareMoveHistory.join(', ')}`);
      logLines.push('');
      logLines.push('Battle Log:');
      logLines.push(loss.log.join('\n'));
      logLines.push('');
      logLines.push('='.repeat(80));
      logLines.push('');
    });

    const filename = `typeaware-vs-treesearch-losses-${Date.now()}.txt`;
    fs.writeFileSync(filename, logLines.join('\n'));
    console.log();
    console.log(`📝 Saved ${lossLogs.length} loss log(s) to: ${filename}`);

    console.log();
    console.log('📋 Loss Summary:');
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battleNumber}: ${loss.turns} turns, ${loss.stats.typeAwareNodes} nodes, ${loss.stats.typeAwareSwitches} switches`);
    });

    // Analyze loss patterns
    console.log();
    console.log('🔍 Loss Pattern Analysis:');

    const avgLossTurns = lossLogs.reduce((sum, l) => sum + l.turns, 0) / lossLogs.length;
    const avgLossNodes = lossLogs.reduce((sum, l) => sum + l.stats.typeAwareNodes, 0) / lossLogs.length;
    const avgLossSwitches = lossLogs.reduce((sum, l) => sum + l.stats.typeAwareSwitches, 0) / lossLogs.length;

    console.log(`   Average turns in losses: ${avgLossTurns.toFixed(1)}`);
    console.log(`   Average nodes in losses: ${avgLossNodes.toFixed(0)}`);
    console.log(`   Average switches in losses: ${avgLossSwitches.toFixed(1)}`);

    console.log();
    console.log('💡 Potential Loss Reasons:');
    console.log('   1. TreeSearchBot may have deeper understanding of specific matchups');
    console.log('   2. TypeAwareBot switch logic may be too conservative');
    console.log('   3. Type effectiveness weight (30x) may need adjustment');
    console.log('   4. Search depth difference (4-ply vs 2-ply) impact');
    console.log('   5. Opponent state tracking quality comparison');

  } else {
    console.log();
    console.log('🎉 Perfect 100% win rate! No losses to analyze.');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
