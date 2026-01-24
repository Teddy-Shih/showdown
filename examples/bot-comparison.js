const CompetitiveBattleSimulator = require('../src/CompetitiveBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MaxDamageBot = require('../src/MaxDamageBot');

/**
 * Compare two bot strategies over multiple battles
 */

class BattleStats {
  constructor(bot1Name, bot2Name) {
    this.bot1Name = bot1Name;
    this.bot2Name = bot2Name;
    this.bot1Wins = 0;
    this.bot2Wins = 0;
    this.draws = 0;
    this.totalTurns = 0;
    this.battlesCompleted = 0;
    this.turnCounts = [];
  }

  recordBattle(result) {
    this.battlesCompleted++;
    this.totalTurns += result.turns;
    this.turnCounts.push(result.turns);

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

    console.log('\n' + '='.repeat(70));
    console.log('BATTLE STATISTICS');
    console.log('='.repeat(70));
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
    console.log('='.repeat(70));
  }

  printProgress(current, total) {
    const percent = (current / total * 100).toFixed(1);
    const barLength = 40;
    const filled = Math.floor(barLength * current / total);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    // Current win rates
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
}

async function runComparison(numBattles = 1000) {
  console.log('='.repeat(70));
  console.log('BOT COMPARISON: MaxDamageBot vs RandomBot');
  console.log('='.repeat(70));
  console.log(`Running ${numBattles} battles...`);
  console.log('');

  // Create bots
  const maxDamageBot = new MaxDamageBot('MaxDamageBot');
  const randomBot = new RandomBot('RandomBot');

  // Track statistics
  const stats = new BattleStats('MaxDamageBot', 'RandomBot');

  // Run battles
  for (let i = 0; i < numBattles; i++) {
    const simulator = new CompetitiveBattleSimulator(
      maxDamageBot,
      randomBot,
      'gen9randombattle',
      { verbose: false, maxTurns: 100 }
    );

    try {
      const result = await simulator.runBattle();
      stats.recordBattle(result);

      // Show progress every 10 battles
      if ((i + 1) % 10 === 0 || i === numBattles - 1) {
        stats.printProgress(i + 1, numBattles);
      }
    } catch (error) {
      console.error(`\nError in battle ${i + 1}:`, error.message);
    }
  }

  console.log('\n'); // New line after progress bar
  stats.printStats();

  // Analysis
  const statsData = stats.getStats();
  console.log('\nAnalysis:');

  if (statsData.bot1WinRate > statsData.bot2WinRate) {
    const improvement = (statsData.bot1WinRate - statsData.bot2WinRate).toFixed(2);
    console.log(`✓ MaxDamageBot outperforms RandomBot by ${improvement} percentage points`);
    console.log(`  This demonstrates that even simple damage calculation provides`);
    console.log(`  a significant advantage over random play.`);
  } else if (statsData.bot2WinRate > statsData.bot1WinRate) {
    console.log(`✗ RandomBot unexpectedly outperformed MaxDamageBot`);
    console.log(`  This may indicate an issue with the damage calculation logic.`);
  } else {
    console.log(`≈ Both bots performed equally`);
  }

  console.log('');
}

// Parse command line arguments
const numBattles = parseInt(process.argv[2]) || 1000;

// Run the comparison
runComparison(numBattles).catch(console.error);
