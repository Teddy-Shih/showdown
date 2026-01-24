const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const ImprovedDeepSearchBot = require('../src/ImprovedDeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

/**
 * Test ImprovedDeepSearchBot and log losses
 * Improvements tested:
 * 1. Opponent tracking from turn 1
 * 2. Loop detection to avoid move spamming
 * 3. Guaranteed search execution
 * 4. Progress-aware evaluation
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: ImprovedDeepSearchBot vs RandomBot\n`);
  console.log('Improvements:');
  console.log('  ✓ Opponent tracking from turn 1 (estimated moveset)');
  console.log('  ✓ Loop detection (avoid spamming same move 3+ times)');
  console.log('  ✓ Guaranteed search execution');
  console.log('  ✓ Progress-aware evaluation\n');

  let improvedWins = 0;
  let randomWins = 0;
  let draws = 0;
  let totalNodes = 0;
  let totalPrunes = 0;
  const lossLogs = [];

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const improvedBot = new ImprovedDeepSearchBot('ImprovedBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? improvedBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : improvedBot;
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

    if (result.winner === 'ImprovedBot') {
      improvedWins++;
      totalNodes += improvedBot.nodesEvaluated;
      totalPrunes += improvedBot.pruneCount;
      console.log(`Battle ${i + 1}: ImprovedBot WON in ${result.turns} turns (nodes: ${improvedBot.nodesEvaluated})`);
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      totalNodes += improvedBot.nodesEvaluated;
      totalPrunes += improvedBot.pruneCount;
      console.log(`Battle ${i + 1}: ImprovedBot LOST in ${result.turns} turns ❌ (nodes: ${improvedBot.nodesEvaluated})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          nodes: improvedBot.nodesEvaluated,
          prunes: improvedBot.pruneCount
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
  console.log(`IMPROVED SEARCH RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`ImprovedBot:  ${improvedWins} wins (${(improvedWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`RandomBot:    ${randomWins} wins (${(randomWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:        ${draws}`);
  console.log('='.repeat(75));
  console.log(`Average nodes evaluated: ${avgNodes.toFixed(0)}`);
  console.log(`Average prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`Prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);

  console.log('\n📊 Performance Comparison:');
  console.log('  DeepSearchBot (baseline):      70.0% (13.9% prune, 194 nodes)');
  console.log('  OrderedDeepSearchBot:          70.0% (18.5% prune, 90 nodes)');
  console.log(`  ImprovedBot (with fixes):      ${(improvedWins / numBattles * 100).toFixed(1)}% (${(avgPrunes / avgNodes * 100).toFixed(1)}% prune, ${avgNodes.toFixed(0)} nodes)`);

  const improvement = (improvedWins / numBattles * 100) - 70;

  if ((improvedWins / numBattles * 100) >= 75) {
    console.log(`\n🎯 Target achieved! +${improvement.toFixed(1)}% over baseline`);
  } else if ((improvedWins / numBattles * 100) > 70) {
    console.log(`\n✓ Improvement! +${improvement.toFixed(1)}% over baseline`);
  } else if ((improvedWins / numBattles * 100) === 70) {
    console.log('\n→ Same as baseline (70%)');
  } else {
    console.log(`\n⚠ Degradation (${improvement.toFixed(1)}%)`);
  }

  // Save loss logs
  if (lossLogs.length > 0) {
    const logFile = `improved-loss-logs-${Date.now()}.txt`;
    let logContent = `ImprovedDeepSearchBot Loss Analysis\n`;
    logContent += `Total Battles: ${numBattles}\n`;
    logContent += `Losses: ${lossLogs.length}\n`;
    logContent += `Win Rate: ${(improvedWins / numBattles * 100).toFixed(1)}%\n`;
    logContent += `\nFixes Applied:\n`;
    logContent += `- Opponent tracking from turn 1\n`;
    logContent += `- Loop detection (no move spam)\n`;
    logContent += `- Guaranteed search execution\n`;
    logContent += `- Progress-aware evaluation\n`;
    logContent += `\n${'='.repeat(80)}\n\n`;

    for (const loss of lossLogs) {
      logContent += `BATTLE ${loss.battleNumber} - LOSS\n`;
      logContent += `Turns: ${loss.turns}\n`;
      logContent += `Nodes: ${loss.stats.nodes}\n`;
      logContent += `Prunes: ${loss.stats.prunes}\n`;
      logContent += `\nBattle Log:\n`;
      logContent += loss.log.join('\n');
      logContent += `\n\n${'='.repeat(80)}\n\n`;
    }

    fs.writeFileSync(logFile, logContent);
    console.log(`\n📝 Saved ${lossLogs.length} loss logs to: ${logFile}`);

    // Print summary
    if (lossLogs.length > 0) {
      console.log(`\n📋 Loss Summary:`);
      lossLogs.forEach((loss, idx) => {
        console.log(`   Battle ${loss.battleNumber}: ${loss.turns} turns, ${loss.stats.nodes} nodes, ${loss.stats.prunes} prunes`);
      });
    }
  } else {
    console.log('\n🎉 Perfect record! No losses!');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
