/**
 * Test TypeAwareBot with type effectiveness and switch intelligence
 * Runs battles and provides detailed loss analysis
 */

const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const TypeAwareBot = require('../src/TypeAwareBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: TypeAwareBot vs RandomBot\n`);
  console.log('New Features:');
  console.log('  ✓ Type effectiveness scoring (150x weight)');
  console.log('  ✓ Proactive switch intelligence');
  console.log('  ✓ Type matchup analysis (offensive + defensive)');
  console.log('  ✓ HP preservation bonus (exponential)');
  console.log('  ✓ Switch evaluation in search tree\n');

  let typeAwareWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;
  let totalSwitches = 0;
  const lossLogs = [];

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : typeAwareBot;
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
      totalNodes += typeAwareBot.nodesEvaluated;
      totalPrunes += typeAwareBot.pruneCount;
      totalSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot WON in ${result.turns} turns (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += typeAwareBot.nodesEvaluated;
      totalPrunes += typeAwareBot.pruneCount;
      totalSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot LOST in ${result.turns} turns ❌ (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          nodes: typeAwareBot.nodesEvaluated,
          prunes: typeAwareBot.pruneCount,
          switches: typeAwareBot.switchBreaks,
          moveHistory: [...typeAwareBot.moveHistory]
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  const avgNodes = totalNodes / numBattles;
  const avgPrunes = totalPrunes / numBattles;
  const avgSwitches = totalSwitches / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`TYPE AWARE RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`TypeAwareBot: ${typeAwareWins} wins (${(typeAwareWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`RandomBot:    ${randomWins} wins (${(randomWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:        ${draws}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);
  console.log(`Average proactive switches: ${avgSwitches.toFixed(1)}`);

  console.log('\n📊 Performance Progression:');
  console.log('  DeepSearchBot (baseline):      70.0%');
  console.log('  FixedBot (loop fixes):         80.0%');
  console.log(`  TypeAwareBot (type+switch):    ${(typeAwareWins / numBattles * 100).toFixed(1)}%`);

  const improvement = (typeAwareWins / numBattles * 100) - 80;
  if (improvement > 0) {
    console.log(`\n→ IMPROVED by ${improvement.toFixed(1)}% 🎯`);
  } else if (improvement < 0) {
    console.log(`\n→ DEGRADED by ${Math.abs(improvement).toFixed(1)}% ⚠️`);
  } else {
    console.log(`\n→ Same as FixedBot (80.0%)`);
  }

  // Save loss logs
  if (lossLogs.length > 0) {
    const logLines = [];
    logLines.push('TypeAwareBot Loss Analysis');
    logLines.push(`Total Battles: ${numBattles}`);
    logLines.push(`Losses: ${lossLogs.length}`);
    logLines.push(`Win Rate: ${(typeAwareWins / numBattles * 100).toFixed(1)}%`);
    logLines.push('');
    logLines.push('New Features:');
    logLines.push('- Type effectiveness scoring (150x weight)');
    logLines.push('- Proactive switch intelligence');
    logLines.push('- Type matchup analysis (offensive + defensive)');
    logLines.push('- HP preservation bonus (exponential)');
    logLines.push('');
    logLines.push('='.repeat(80));
    logLines.push('');

    lossLogs.forEach(loss => {
      logLines.push(`BATTLE ${loss.battleNumber} - LOSS`);
      logLines.push(`Turns: ${loss.turns}`);
      logLines.push(`Nodes: ${loss.stats.nodes}`);
      logLines.push(`Prunes: ${loss.stats.prunes}`);
      logLines.push(`Proactive Switches: ${loss.stats.switches}`);
      logLines.push(`Move History: ${loss.stats.moveHistory.join(', ')}`);
      logLines.push('');
      logLines.push('Battle Log:');
      logLines.push(loss.log.join('\n'));
      logLines.push('');
      logLines.push('='.repeat(80));
      logLines.push('');
    });

    const filename = `type-aware-losses-${Date.now()}.txt`;
    fs.writeFileSync(filename, logLines.join('\n'));
    console.log();
    console.log(`📝 Saved ${lossLogs.length} loss log(s) to: ${filename}`);

    console.log();
    console.log('📋 Loss Summary:');
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battleNumber}: ${loss.turns} turns, ${loss.stats.nodes} nodes, ${loss.stats.switches} proactive switches`);
    });
  } else {
    console.log();
    console.log('🎉 Perfect 100% win rate! No losses to analyze.');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
