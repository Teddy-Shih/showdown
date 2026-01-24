const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const DeepSearchBot = require('../src/DeepSearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

/**
 * Test DeepSearchBot and log detailed output when it loses
 */

async function runTest(numBattles) {
  console.log(`Running ${numBattles} OU battles: DeepSearchBot vs RandomBot...\n`);
  console.log('Will save detailed logs for all losses\n');

  let deepSearchWins = 0;
  let randomWins = 0;
  let draws = 0;
  const lossLogs = [];

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  for (let i = 0; i < numBattles; i++) {
    const deepSearchBot = new DeepSearchBot('DeepSearchBot');
    const randomBot = new RandomBot('RandomBot');

    const bot1 = i % 2 === 0 ? deepSearchBot : randomBot;
    const bot2 = i % 2 === 0 ? randomBot : deepSearchBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    // Create custom simulator that captures logs
    const battleLog = [];
    const originalWrite = console.log;

    // Capture console output
    console.log = (...args) => {
      battleLog.push(args.join(' '));
      originalWrite(...args);
    };

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: true,  // Enable verbose mode to capture battle details
      maxTurns: 100
    });

    const result = await sim.runBattle();

    // Restore console.log
    console.log = originalWrite;

    if (result.winner === 'DeepSearchBot') {
      deepSearchWins++;
      console.log(`Battle ${i + 1}: DeepSearchBot WON in ${result.turns} turns`);
    } else if (result.winner === 'RandomBot') {
      randomWins++;
      console.log(`Battle ${i + 1}: DeepSearchBot LOST in ${result.turns} turns ❌`);

      // Save this loss
      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        log: battleLog,
        stats: {
          nodes: deepSearchBot.nodesEvaluated,
          prunes: deepSearchBot.pruneCount
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  console.log(`\n${'='.repeat(75)}`);
  console.log(`RESULTS - ${numBattles} BATTLES`);
  console.log('='.repeat(75));
  console.log(`DeepSearchBot:  ${deepSearchWins} wins (${(deepSearchWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`RandomBot:      ${randomWins} wins (${(randomWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:          ${draws}`);
  console.log('='.repeat(75));

  // Save loss logs to file
  if (lossLogs.length > 0) {
    const logFile = `loss-logs-${Date.now()}.txt`;
    let logContent = `DeepSearchBot Loss Analysis\n`;
    logContent += `Total Battles: ${numBattles}\n`;
    logContent += `Losses: ${lossLogs.length}\n`;
    logContent += `Win Rate: ${(deepSearchWins / numBattles * 100).toFixed(1)}%\n`;
    logContent += `\n${'='.repeat(80)}\n\n`;

    for (const loss of lossLogs) {
      logContent += `BATTLE ${loss.battleNumber} - LOSS\n`;
      logContent += `Turns: ${loss.turns}\n`;
      logContent += `Nodes evaluated: ${loss.stats.nodes}\n`;
      logContent += `Prunes: ${loss.stats.prunes}\n`;
      logContent += `\nBattle Log:\n`;
      logContent += loss.log.join('\n');
      logContent += `\n\n${'='.repeat(80)}\n\n`;
    }

    fs.writeFileSync(logFile, logContent);
    console.log(`\n📝 Saved ${lossLogs.length} loss logs to: ${logFile}`);

    // Print summary of first loss
    if (lossLogs.length > 0) {
      console.log(`\n📋 First Loss Summary (Battle ${lossLogs[0].battleNumber}):`);
      console.log(`   Turns: ${lossLogs[0].turns}`);
      console.log(`   Nodes: ${lossLogs[0].stats.nodes}`);
      console.log(`   Prunes: ${lossLogs[0].stats.prunes}`);
      console.log(`\n   Last 10 lines of battle:`);
      const lines = lossLogs[0].log;
      const last10 = lines.slice(-10);
      last10.forEach(line => console.log(`   ${line}`));
    }
  } else {
    console.log('\n🎉 No losses! Perfect record!');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
