const OUBattleSimulator = require('../src/OUBattleSimulator');
const RandomBot = require('../src/RandomBot');
const SmartDamageBot = require('../src/SmartDamageBot');
const ouTeams = require('../data/ou-teams');

/**
 * Run 1000 battles in Gen 9 OU format with sample teams
 * Compare SmartDamageBot vs RandomBot
 */

class OUBattleStats {
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
    console.log('GEN 9 OU BATTLE STATISTICS - 1000 SIMULATIONS');
    console.log('='.repeat(70));
    console.log(`Format: Gen 9 Singles OU (Smogon Sample Teams)`);
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

async function runOUComparison(numBattles = 1000) {
  console.log('='.repeat(70));
  console.log('GEN 9 OU BATTLE SIMULATION');
  console.log('='.repeat(70));
  console.log(`Bot Comparison: SmartDamageBot vs RandomBot`);
  console.log(`Teams: Smogon OU Sample Teams (rotating)`);
  console.log(`Running ${numBattles} battles...`);
  console.log('');

  // Create bots
  const smartBot = new SmartDamageBot('SmartBot');
  const randomBot = new RandomBot('RandomBot');

  // Track statistics
  const stats = new OUBattleStats('SmartBot', 'RandomBot');

  // Get teams
  const allTeams = ouTeams.getAllTeams();

  // Run battles
  for (let i = 0; i < numBattles; i++) {
    // Rotate teams to test different matchups
    const team1 = allTeams[i % allTeams.length];
    const team2 = allTeams[(i + 1) % allTeams.length];

    const simulator = new OUBattleSimulator(
      smartBot,
      randomBot,
      team1,
      team2,
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
      // Continue with next battle
    }
  }

  console.log('\n'); // New line after progress bar
  stats.printStats();

  // Analysis
  const statsData = stats.getStats();
  console.log('\n📊 Analysis:');

  if (statsData.bot1WinRate > statsData.bot2WinRate) {
    const improvement = (statsData.bot1WinRate - statsData.bot2WinRate).toFixed(2);
    console.log(`✓ SmartDamageBot outperforms RandomBot by ${improvement} percentage points`);
    console.log(`  in competitive Gen 9 OU battles with real team compositions.`);
  } else if (statsData.bot2WinRate > statsData.bot1WinRate) {
    console.log(`✗ RandomBot outperformed SmartDamageBot in this test.`);
  } else {
    console.log(`≈ Both bots performed equally in this test.`);
  }

  console.log('\n📝 Notes:');
  console.log('- Teams used: Smogon OU Sample Teams');
  console.log('- Format: Gen 9 Singles OU');
  console.log('- SmartBot uses: Base Power + STAB + Stats + Accuracy calculation');
  console.log('- RandomBot uses: Random move selection');
  console.log('');

  return stats.getStats();
}

// Parse command line arguments
const numBattles = parseInt(process.argv[2]) || 1000;

// Run the comparison
runOUComparison(numBattles).catch(console.error);
