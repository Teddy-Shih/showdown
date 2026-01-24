const OUBattleSimulator = require('../src/OUBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MinimaxBot = require('../src/MinimaxBot');
const ouTeams = require('../data/ou-teams');

/**
 * Test MinimaxBot vs RandomBot in Gen 9 OU
 * This tests if strategic position evaluation beats random play
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
    console.log('GEN 9 OU BATTLE STATISTICS - MINIMAX BOT');
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

async function runMinimaxTest(numBattles = 100) {
  console.log('='.repeat(70));
  console.log('GEN 9 OU BATTLE SIMULATION - MINIMAX BOT TEST');
  console.log('='.repeat(70));
  console.log(`Bot Comparison: MinimaxBot vs RandomBot`);
  console.log(`Teams: Smogon OU Sample Teams (rotating)`);
  console.log(`MinimaxBot Features:`);
  console.log(`  - Position evaluation (HP, Pokemon count, status, boosts)`);
  console.log(`  - Strategic move selection (setup, hazards, recovery)`);
  console.log(`  - Context-aware play (risk when behind, safe when ahead)`);
  console.log(`Running ${numBattles} battles...`);
  console.log('');

  // Create bots
  const minimaxBot = new MinimaxBot('MinimaxBot');
  const randomBot = new RandomBot('RandomBot');

  // Track statistics
  const stats = new BattleStats('MinimaxBot', 'RandomBot');

  // Get teams
  const allTeams = ouTeams.getAllTeams();

  // Run battles
  for (let i = 0; i < numBattles; i++) {
    // Rotate teams to test different matchups
    const team1 = allTeams[i % allTeams.length];
    const team2 = allTeams[(i + 1) % allTeams.length];

    const simulator = new OUBattleSimulator(
      minimaxBot,
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

  console.log('\nComparison to Previous Results:');
  console.log('  SmartDamageBot vs RandomBot: 46% vs 54% (OU)');
  console.log(`  MinimaxBot vs RandomBot:     ${statsData.bot1WinRate}% vs ${statsData.bot2WinRate}% (OU)`);
  console.log('');

  if (parseFloat(statsData.bot1WinRate) > 54) {
    const improvement = (parseFloat(statsData.bot1WinRate) - 46).toFixed(2);
    console.log(`✓ MinimaxBot beats random play! (+${improvement}% vs SmartBot)`);
    console.log(`  Strategic position evaluation makes a significant difference!`);
  } else if (parseFloat(statsData.bot1WinRate) > 50) {
    console.log(`✓ MinimaxBot achieves >50% win rate vs random`);
    console.log(`  Better than SmartBot's 46%, but room for improvement`);
  } else {
    console.log(`⚠ MinimaxBot did not exceed 50% (needs tuning)`);
  }

  console.log('\n📝 Key Insights:');
  console.log('- Position evaluation considers: HP, Pokemon count, status, boosts');
  console.log('- Strategic moves valued: Setup (Swords Dance), Hazards (Stealth Rock)');
  console.log('- Context-aware: Plays safer when ahead, riskier when behind');
  console.log('');

  return stats.getStats();
}

// Parse command line arguments
const numBattles = parseInt(process.argv[2]) || 100;

// Run the comparison
runMinimaxTest(numBattles).catch(console.error);
