const CompetitiveBattleSimulator = require('./src/CompetitiveBattleSimulator');
const Depth6SearchBot = require('./src/Depth6SearchBot');
const ImprovedDepth6Bot = require('./src/ImprovedDepth6Bot');
const fs = require('fs');

/**
 * Detailed comparison with verbose logging for loss analysis
 */

class DetailedBattleLogger {
  constructor() {
    this.battles = [];
    this.logFile = `detailed-comparison-${Date.now()}.log`;
  }

  logBattle(battleNumber, winner, turns, bot1Stats, bot2Stats, battleLog) {
    const record = {
      battleNumber,
      winner,
      turns,
      bot1Stats,
      bot2Stats,
      battleLog: battleLog ? battleLog.slice(-50) : [] // Last 50 lines
    };

    this.battles.push(record);

    // Write to file
    const logEntry = `
${'='.repeat(80)}
BATTLE ${battleNumber}: Winner: ${winner} (${turns} turns)
${'='.repeat(80)}

Bot1 (ImprovedDepth6Bot) Stats:
${JSON.stringify(bot1Stats, null, 2)}

Bot2 (Depth6SearchBot) Stats:
${JSON.stringify(bot2Stats, null, 2)}

Last 50 Battle Lines:
${battleLog ? battleLog.slice(-50).join('\n') : 'No log available'}

`;

    fs.appendFileSync(this.logFile, logEntry);
  }

  analyzeLosses(losingBotName) {
    const losses = this.battles.filter(b => b.winner !== losingBotName && b.winner !== 'draw');

    console.log('\n' + '='.repeat(80));
    console.log(`DETAILED LOSS ANALYSIS FOR ${losingBotName.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`Total Losses: ${losses.length}\n`);

    if (losses.length === 0) {
      console.log('No losses!');
      return;
    }

    // Analyze patterns
    const avgLossTurns = losses.reduce((sum, l) => sum + l.turns, 0) / losses.length;
    const shortLosses = losses.filter(l => l.turns < 30);
    const longLosses = losses.filter(l => l.turns >= 30);

    console.log('Loss Patterns:');
    console.log(`  Average turns in losses: ${avgLossTurns.toFixed(1)}`);
    console.log(`  Short losses (<30 turns): ${shortLosses.length}`);
    console.log(`  Long losses (≥30 turns): ${longLosses.length}`);
    console.log('');

    // Analyze search statistics
    if (losingBotName === 'ImprovedDepth6Bot') {
      const timeouts = losses.map(l => l.bot1Stats?.improved?.timeouts || 0);
      const avgTimeouts = timeouts.reduce((a, b) => a + b, 0) / timeouts.length;
      const avgSearchTime = losses.map(l => l.bot1Stats?.search?.avgSearchTime || 0)
        .reduce((a, b) => a + b, 0) / losses.length;

      console.log('ImprovedDepth6Bot Loss Statistics:');
      console.log(`  Average timeouts per loss: ${avgTimeouts.toFixed(2)}`);
      console.log(`  Average search time per loss: ${avgSearchTime.toFixed(2)}ms`);
      console.log('');
    }

    losses.forEach((loss, idx) => {
      console.log(`Loss ${idx + 1} (Battle ${loss.battleNumber}):`);
      console.log(`  Turns: ${loss.turns}`);
      console.log(`  Winner: ${loss.winner}`);

      if (losingBotName === 'ImprovedDepth6Bot' && loss.bot1Stats) {
        console.log(`  Timeouts: ${loss.bot1Stats.improved?.timeouts || 0}`);
        console.log(`  Avg search time: ${loss.bot1Stats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms`);
        console.log(`  Nodes explored: ${loss.bot1Stats.search?.avgNodesExplored?.toFixed(0) || 'N/A'}`);
        console.log(`  TT cutoffs: ${loss.bot1Stats.search?.ttCutoffs || 0}`);
      }

      console.log('');
    });

    console.log(`Full details written to: ${this.logFile}`);
    console.log('='.repeat(80));
  }

  printSummary() {
    const wins = this.battles.filter(b => b.winner === 'ImprovedDepth6Bot').length;
    const losses = this.battles.filter(b => b.winner === 'Depth6SearchBot').length;
    const draws = this.battles.filter(b => b.winner === 'draw').length;

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`ImprovedDepth6Bot: ${wins} wins (${(wins / this.battles.length * 100).toFixed(1)}%)`);
    console.log(`Depth6SearchBot: ${losses} wins (${(losses / this.battles.length * 100).toFixed(1)}%)`);
    console.log(`Draws: ${draws} (${(draws / this.battles.length * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));
  }
}

async function runDetailedComparison(numBattles = 10) {
  console.log('='.repeat(80));
  console.log('DETAILED BOT COMPARISON');
  console.log('='.repeat(80));

  const logger = new DetailedBattleLogger();

  for (let i = 0; i < numBattles; i++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`BATTLE ${i + 1}/${numBattles}`);
    console.log('='.repeat(80));

    const improvedBot = new ImprovedDepth6Bot('ImprovedDepth6Bot', {
      verbose: true, // Enable verbose logging
      timeLimit: 3000,
      useOpponentPrediction: true,
      opponentMovesConsider: 2
    });

    const baselineBot = new Depth6SearchBot('Depth6SearchBot', {
      verbose: true // Enable verbose logging
    });

    const simulator = new CompetitiveBattleSimulator(
      improvedBot,
      baselineBot,
      'gen9randombattle',
      { verbose: false, maxTurns: 100 }
    );

    try {
      const result = await simulator.runBattle();

      console.log(`\n✓ Battle ${i + 1} complete: Winner: ${result.winner} in ${result.turns} turns`);

      // Get bot statistics
      const bot1Stats = improvedBot.getStats();
      const bot2Stats = baselineBot.getStats();

      logger.logBattle(i + 1, result.winner, result.turns, bot1Stats, bot2Stats, result.battleLog);

      // Print quick stats
      console.log(`\nImprovedDepth6Bot:`);
      console.log(`  Timeouts: ${bot1Stats.improved?.timeouts || 0}`);
      console.log(`  Avg search time: ${bot1Stats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`  Avg nodes: ${bot1Stats.search?.avgNodesExplored?.toFixed(0) || 'N/A'}`);

      console.log(`\nDepth6SearchBot:`);
      console.log(`  Avg search time: ${bot2Stats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`  Avg nodes: ${bot2Stats.search?.avgNodesExplored?.toFixed(0) || 'N/A'}`);

    } catch (error) {
      console.error(`\n✗ Error in battle ${i + 1}:`, error.message);
    }
  }

  logger.printSummary();
  logger.analyzeLosses('ImprovedDepth6Bot');
}

runDetailedComparison(10).then(() => {
  console.log('\n✓ Detailed comparison complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
