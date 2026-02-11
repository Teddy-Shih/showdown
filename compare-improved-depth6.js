const CompetitiveBattleSimulator = require('./src/CompetitiveBattleSimulator');
const Depth6SearchBot = require('./src/Depth6SearchBot');
const ImprovedDepth6Bot = require('./src/ImprovedDepth6Bot');

/**
 * Compare Depth6SearchBot (baseline) vs ImprovedDepth6Bot (with time-bounded search and opponent prediction)
 */

class DetailedBattleStats {
  constructor(bot1Name, bot2Name) {
    this.bot1Name = bot1Name;
    this.bot2Name = bot2Name;
    this.bot1Wins = 0;
    this.bot2Wins = 0;
    this.draws = 0;
    this.totalTurns = 0;
    this.battlesCompleted = 0;
    this.turnCounts = [];
    this.battleRecords = []; // Store detailed info about each battle
  }

  recordBattle(result, battleNumber) {
    this.battlesCompleted++;
    this.totalTurns += result.turns;
    this.turnCounts.push(result.turns);

    const record = {
      battleNumber,
      winner: result.winner,
      turns: result.turns,
      bot1: result.bot1Name,
      bot2: result.bot2Name,
      finalState: result.finalState
    };

    this.battleRecords.push(record);

    if (result.winner === this.bot1Name) {
      this.bot1Wins++;
    } else if (result.winner === this.bot2Name) {
      this.bot2Wins++;
    } else {
      this.draws++;
    }
  }

  getStats() {
    const avgTurns = this.totalTurns / this.battlesCompleted;
    const bot1WinRate = (this.bot1Wins / this.battlesCompleted * 100).toFixed(2);
    const bot2WinRate = (this.bot2Wins / this.battlesCompleted * 100).toFixed(2);
    const drawRate = (this.draws / this.battlesCompleted * 100).toFixed(2);

    return {
      battlesCompleted: this.battlesCompleted,
      bot1Wins: this.bot1Wins,
      bot2Wins: this.bot2Wins,
      draws: this.draws,
      bot1WinRate: bot1WinRate,
      bot2WinRate: bot2WinRate,
      drawRate: drawRate,
      avgTurns: avgTurns.toFixed(2),
      minTurns: Math.min(...this.turnCounts),
      maxTurns: Math.max(...this.turnCounts)
    };
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(80));
    console.log('BATTLE STATISTICS');
    console.log('='.repeat(80));
    console.log(`Total Battles: ${stats.battlesCompleted}`);
    console.log('');
    console.log(`${this.bot1Name}:`);
    console.log(`  Wins: ${stats.bot1Wins} (${stats.bot1WinRate}%)`);
    console.log('');
    console.log(`${this.bot2Name}:`);
    console.log(`  Wins: ${stats.bot2Wins} (${stats.bot2WinRate}%)`);
    console.log('');
    console.log(`Draws: ${stats.draws} (${stats.drawRate}%)`);
    console.log('');
    console.log('Turn Statistics:');
    console.log(`  Average: ${stats.avgTurns} turns`);
    console.log(`  Min: ${stats.minTurns} turns`);
    console.log(`  Max: ${stats.maxTurns} turns`);
    console.log('='.repeat(80));
  }

  printProgress(current, total) {
    const percent = (current / total * 100).toFixed(1);
    const barLength = 40;
    const filled = Math.floor(barLength * current / total);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    const bot1WinRate = this.battlesCompleted > 0
      ? (this.bot1Wins / this.battlesCompleted * 100).toFixed(1)
      : '0.0';
    const bot2WinRate = this.battlesCompleted > 0
      ? (this.bot2Wins / this.battlesCompleted * 100).toFixed(1)
      : '0.0';

    process.stdout.write(
      `\r[${bar}] ${current}/${total} (${percent}%) | ` +
      `${this.bot1Name}: ${bot1WinRate}% | ${this.bot2Name}: ${bot2WinRate}%`
    );
  }

  getLosses(botName) {
    return this.battleRecords.filter(record =>
      record.winner !== botName && record.winner !== 'draw'
    );
  }

  printDetailedResults() {
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED BATTLE RESULTS');
    console.log('='.repeat(80));

    this.battleRecords.forEach(record => {
      const winSymbol = record.winner === this.bot1Name ? '✓' :
                       record.winner === this.bot2Name ? '✗' : '=';
      console.log(`Battle ${record.battleNumber}: ${winSymbol} Winner: ${record.winner} (${record.turns} turns)`);
    });

    console.log('='.repeat(80));
  }

  analyzeLosses(botName) {
    const losses = this.getLosses(botName);

    console.log('\n' + '='.repeat(80));
    console.log(`LOSS ANALYSIS FOR ${botName.toUpperCase()}`);
    console.log('='.repeat(80));
    console.log(`Total Losses: ${losses.length}`);
    console.log('');

    if (losses.length === 0) {
      console.log('No losses to analyze!');
      return;
    }

    losses.forEach(loss => {
      console.log(`\nBattle ${loss.battleNumber}:`);
      console.log(`  Winner: ${loss.winner}`);
      console.log(`  Turns: ${loss.turns}`);
      console.log(`  Final State: ${JSON.stringify(loss.finalState, null, 2)}`);
    });

    console.log('='.repeat(80));
  }
}

async function runComparison(numBattles = 10) {
  console.log('='.repeat(80));
  console.log('BOT COMPARISON: ImprovedDepth6Bot vs Depth6SearchBot (Baseline)');
  console.log('='.repeat(80));
  console.log('\nImprovedDepth6Bot Features:');
  console.log('  • Time-bounded search (3 second limit)');
  console.log('  • Opponent move prediction (considers top 2 likely moves)');
  console.log('  • Heuristic-based move scoring for opponent');
  console.log('');
  console.log('Depth6SearchBot (Baseline) Features:');
  console.log('  • Pure minimax search to depth 6');
  console.log('  • Assumes optimal opponent play');
  console.log('  • No time limit (may take longer)');
  console.log('');
  console.log(`Running ${numBattles} battles...`);
  console.log('');

  // Track statistics
  const stats = new DetailedBattleStats('ImprovedDepth6Bot', 'Depth6SearchBot');

  // Run battles
  for (let i = 0; i < numBattles; i++) {
    // Create fresh bot instances for each battle
    const improvedBot = new ImprovedDepth6Bot('ImprovedDepth6Bot', {
      verbose: false,
      timeLimit: 3000,
      useOpponentPrediction: true,
      opponentMovesConsider: 2
    });

    const baselineBot = new Depth6SearchBot('Depth6SearchBot', {
      verbose: false
    });

    const simulator = new CompetitiveBattleSimulator(
      improvedBot,
      baselineBot,
      'gen9randombattle',
      { verbose: false, maxTurns: 100 }
    );

    try {
      console.log(`\nBattle ${i + 1}/${numBattles}...`);
      const result = await simulator.runBattle();
      stats.recordBattle(result, i + 1);

      console.log(`  Winner: ${result.winner} in ${result.turns} turns`);

      stats.printProgress(i + 1, numBattles);
    } catch (error) {
      console.error(`\nError in battle ${i + 1}:`, error.message);
    }
  }

  console.log('\n'); // New line after progress bar

  // Print results
  stats.printStats();
  stats.printDetailedResults();

  // Analyze losses for ImprovedDepth6Bot
  stats.analyzeLosses('ImprovedDepth6Bot');

  // Analysis
  const statsData = stats.getStats();
  console.log('\n' + '='.repeat(80));
  console.log('ANALYSIS');
  console.log('='.repeat(80));

  if (statsData.bot1WinRate > statsData.bot2WinRate) {
    const improvement = (statsData.bot1WinRate - statsData.bot2WinRate).toFixed(2);
    console.log(`✓ ImprovedDepth6Bot outperforms Depth6SearchBot by ${improvement} percentage points`);
    console.log('');
    console.log('Key Insights:');
    console.log('  • Time-bounded search provides more consistent move timing');
    console.log('  • Opponent prediction focuses search on likely responses');
    console.log('  • Heuristics help prune unlikely branches efficiently');
  } else if (statsData.bot2WinRate > statsData.bot1WinRate) {
    const decline = (statsData.bot2WinRate - statsData.bot1WinRate).toFixed(2);
    console.log(`✗ ImprovedDepth6Bot underperforms baseline by ${decline} percentage points`);
    console.log('');
    console.log('Possible Issues:');
    console.log('  • Time limit may be too restrictive, limiting search depth');
    console.log('  • Opponent prediction may be inaccurate or misguided');
    console.log('  • Heuristics may not align with actual opponent behavior');
    console.log('  • Pruning too aggressively may miss critical moves');
  } else {
    console.log('= Performance is roughly equivalent');
    console.log('');
    console.log('Considerations:');
    console.log('  • ImprovedDepth6Bot may have better time consistency');
    console.log('  • Sample size may be too small to detect differences');
  }

  console.log('='.repeat(80));
}

// Run with 10 battles
runComparison(10).then(() => {
  console.log('\nComparison complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
