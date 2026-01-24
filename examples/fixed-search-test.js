const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const FixedDeepSearchBot = require('../src/FixedDeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

/**
 * Test FixedDeepSearchBot with corrected loop detection
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: FixedDeepSearchBot vs RandomBot\n`);
  console.log('Bug Fixes:');
  console.log('  ✓ CORRECTED loop detection (check before adding to history)');
  console.log('  ✓ Prefer moves not used recently when breaking loops');
  console.log('  ✓ Ensure opponent always has estimated moves');
  console.log('  ✓ Better fallback handling\n');

  let fixedWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;
  const lossLogs = [];
  let totalLoopBreaks = 0;

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const fixedBot = new FixedDeepSearchBot('FixedBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? fixedBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : fixedBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    // Capture logs
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

    // Count loop breaks
    const loopBreaks = fixedBot.moveHistory.length - new Set(fixedBot.moveHistory).size;
    totalLoopBreaks += loopBreaks;

    if (result.winner === 'FixedBot') {
      fixedWins++;
      totalNodes += fixedBot.nodesEvaluated;
      totalPrunes += fixedBot.pruneCount;
      console.log(`Battle ${i + 1}: FixedBot WON in ${result.turns} turns (nodes: ${fixedBot.nodesEvaluated})`);
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += fixedBot.nodesEvaluated;
      totalPrunes += fixedBot.pruneCount;
      console.log(`Battle ${i + 1}: FixedBot LOST in ${result.turns} turns ❌ (nodes: ${fixedBot.nodesEvaluated})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          nodes: fixedBot.nodesEvaluated,
          prunes: fixedBot.pruneCount,
          moveHistory: [...fixedBot.moveHistory]
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  const avgNodes = totalNodes / numBattles;
  const avgPrunes = totalPrunes / numBattles;

  console.log(`\n${'='.repeat(75)}`);
  console.log(`FIXED SEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`FixedBot:     ${fixedWins} wins (${(fixedWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`RandomBot:    ${randomWins} wins (${(randomWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:        ${draws}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);
  console.log(`Total loop breaks detected: ${totalLoopBreaks}`);

  console.log('\n📊 Performance Progression:');
  console.log('  DeepSearchBot (baseline):      70.0%');
  console.log('  ImprovedBot (with bugs):       80.0%');
  console.log(`  FixedBot (bugs fixed):         ${(fixedWins / numBattles * 100).toFixed(1)}%`);

  const improvement = (fixedWins / numBattles * 100) - 80;

  if ((fixedWins / numBattles * 100) >= 85) {
    console.log(`\n🎯🎯 Excellent! +${improvement.toFixed(1)}% over ImprovedBot`);
  } else if ((fixedWins / numBattles * 100) > 80) {
    console.log(`\n✓ Improvement! +${improvement.toFixed(1)}% over ImprovedBot`);
  } else if ((fixedWins / numBattles * 100) === 80) {
    console.log('\n→ Same as ImprovedBot (80%)');
  } else {
    console.log(`\n⚠ Slight regression (${improvement.toFixed(1)}%)`);
  }

  // Save loss logs
  if (lossLogs.length > 0) {
    const logFile = `fixed-loss-logs-${Date.now()}.txt`;
    let logContent = `FixedDeepSearchBot Loss Analysis\n`;
    logContent += `Total Battles: ${numBattles}\n`;
    logContent += `Losses: ${lossLogs.length}\n`;
    logContent += `Win Rate: ${(fixedWins / numBattles * 100).toFixed(1)}%\n`;
    logContent += `\nBug Fixes Applied:\n`;
    logContent += `- Corrected loop detection logic\n`;
    logContent += `- Ensure opponent moves always available\n`;
    logContent += `- Better alternative move selection\n`;
    logContent += `\n${'='.repeat(80)}\n\n`;

    for (const loss of lossLogs) {
      logContent += `BATTLE ${loss.battleNumber} - LOSS\n`;
      logContent += `Turns: ${loss.turns}\n`;
      logContent += `Nodes: ${loss.stats.nodes}\n`;
      logContent += `Prunes: ${loss.stats.prunes}\n`;
      logContent += `Move History: ${loss.stats.moveHistory.join(', ')}\n`;
      logContent += `\nBattle Log:\n`;
      logContent += loss.log.join('\n');
      logContent += `\n\n${'='.repeat(80)}\n\n`;
    }

    fs.writeFileSync(logFile, logContent);
    console.log(`\n📝 Saved ${lossLogs.length} loss logs to: ${logFile}`);

    if (lossLogs.length > 0) {
      console.log(`\n📋 Loss Summary:`);
      lossLogs.forEach((loss, idx) => {
        console.log(`   Battle ${loss.battleNumber}: ${loss.turns} turns, ${loss.stats.nodes} nodes`);
      });
    }
  } else {
    console.log('\n🎉 Perfect record! No losses!');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
