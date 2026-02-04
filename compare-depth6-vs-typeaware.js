const CompetitiveBattleSimulator = require('./src/CompetitiveBattleSimulator');
const Depth6SearchBot = require('./src/Depth6SearchBot');
const ImprovedTypeAwareBot = require('./src/ImprovedTypeAwareBot');

/**
 * Compare Depth6SearchBot vs ImprovedTypeAwareBot
 *
 * This comparison tests whether deeper search (6-ply) outperforms
 * a shallower but faster heuristic-based approach (4-ply).
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
    this.battleDetails = [];
  }

  recordBattle(result, battleNum) {
    this.battlesCompleted++;
    this.totalTurns += result.turns;
    this.turnCounts.push(result.turns);

    const detail = {
      battleNum,
      winner: result.winner,
      turns: result.turns,
      reason: result.reason || 'Unknown'
    };

    this.battleDetails.push(detail);

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
      `D6: ${bot1WinRate}% | TypeAware: ${bot2WinRate}%`
    );
  }

  printDetailedAnalysis() {
    console.log('\n' + '='.repeat(70));
    console.log('DETAILED ANALYSIS');
    console.log('='.repeat(70));

    console.log('\nBattle-by-Battle Results:');
    for (const detail of this.battleDetails) {
      const winnerSymbol = detail.winner === this.bot1Name ? '✓' :
                          detail.winner === this.bot2Name ? '✗' : '≈';
      console.log(`  Battle ${detail.battleNum}: ${winnerSymbol} ${detail.winner || 'Draw'} (${detail.turns} turns)`);
    }

    console.log('\nTheoretical Analysis:');
    console.log('Why Depth6SearchBot might lose despite deeper search:');
    console.log('');
    console.log('1. COMPUTATIONAL COST vs ACCURACY TRADEOFF');
    console.log('   - Depth6 searches 6 plies (3 full turns) vs TypeAware\'s 4 plies (2 turns)');
    console.log('   - Exponential growth: ~8x more nodes at depth 6 vs depth 4');
    console.log('   - Time constraints may force Depth6 to prune more aggressively');
    console.log('   - Reduced branching (maxMovesToConsider=3) may miss critical moves');
    console.log('');
    console.log('2. EVALUATION FUNCTION QUALITY');
    console.log('   - Both bots use similar evaluation functions');
    console.log('   - TypeAware has battle-tested heuristics (HP preservation, type matchups)');
    console.log('   - Deeper search doesn\'t help if evaluation at leaf nodes is inaccurate');
    console.log('   - TypeAware\'s "being walled" detection and switch logic may be superior');
    console.log('');
    console.log('3. HORIZON EFFECT');
    console.log('   - Even at depth 6, tactical sequences beyond 3 turns aren\'t seen');
    console.log('   - Both bots suffer from evaluation function limitations at leaf nodes');
    console.log('   - Setup moves, stat boosts, and multi-turn strategies are poorly valued');
    console.log('');
    console.log('4. MOVE ORDERING AND PRUNING ARTIFACTS');
    console.log('   - Depth6 relies heavily on transposition tables and alpha-beta pruning');
    console.log('   - Aggressive pruning may cut off winning lines');
    console.log('   - Move ordering heuristics might be suboptimal for Pokemon battles');
    console.log('   - Only considering top 3 moves per side can miss critical options');
    console.log('');
    console.log('5. RANDOM BATTLE DYNAMICS');
    console.log('   - Random battles have high variance due to team composition');
    console.log('   - Some matchups heavily favor one team regardless of play quality');
    console.log('   - Type advantages can dominate over search depth');
    console.log('   - Team synergy matters more than individual move quality');
    console.log('');
    console.log('6. SWITCHING DECISIONS');
    console.log('   - TypeAware has sophisticated switch logic with multiple triggers');
    console.log('   - Depth6 inherits OptimizedDepth4Bot switching, which may be basic');
    console.log('   - Proactive switching can be more valuable than deeper move search');
    console.log('   - TypeAware tracks damage history to detect "walling" situations');
    console.log('');
    console.log('7. PRACTICAL IMPLEMENTATIONS ISSUES');
    console.log('   - Depth6 may timeout or run slowly, affecting decision quality');
    console.log('   - TypeAware makes faster decisions with more CPU time for evaluation');
    console.log('   - Transposition table collisions can reduce Depth6 effectiveness');
    console.log('   - Memory constraints may limit table size');
    console.log('');
    console.log('='.repeat(70));
  }
}

async function runComparison(numBattles = 20) {
  console.log('='.repeat(70));
  console.log('BOT COMPARISON: Depth6SearchBot vs ImprovedTypeAwareBot');
  console.log('='.repeat(70));
  console.log(`Running ${numBattles} battles...`);
  console.log('');
  console.log('Depth6SearchBot Configuration:');
  console.log('  - Search depth: 6 plies (3 full turns)');
  console.log('  - Transposition tables: Enabled');
  console.log('  - Move ordering: Enabled');
  console.log('  - Max moves considered: 3 per side');
  console.log('');
  console.log('ImprovedTypeAwareBot Configuration:');
  console.log('  - Search depth: 4 plies (2 full turns)');
  console.log('  - Advanced switch logic');
  console.log('  - Wall detection');
  console.log('  - Move diversity tracking');
  console.log('');

  // Create bots
  const depth6Bot = new Depth6SearchBot('Depth6Bot');
  const typeAwareBot = new ImprovedTypeAwareBot('TypeAwareBot');

  // Track statistics
  const stats = new DetailedBattleStats('Depth6Bot', 'TypeAwareBot');

  // Run battles
  for (let i = 0; i < numBattles; i++) {
    const simulator = new CompetitiveBattleSimulator(
      depth6Bot,
      typeAwareBot,
      'gen9randombattle',
      { verbose: false, maxTurns: 100 }
    );

    try {
      const result = await simulator.runBattle();
      stats.recordBattle(result, i + 1);

      // Show progress
      stats.printProgress(i + 1, numBattles);
    } catch (error) {
      console.error(`\nError in battle ${i + 1}:`, error.message);
    }
  }

  console.log('\n'); // New line after progress bar
  stats.printStats();
  stats.printDetailedAnalysis();

  // Final analysis
  const statsData = stats.getStats();
  console.log('\nCONCLUSION:');

  if (statsData.bot1WinRate > statsData.bot2WinRate) {
    const improvement = (statsData.bot1WinRate - statsData.bot2WinRate).toFixed(2);
    console.log(`✓ Depth6SearchBot outperforms ImprovedTypeAwareBot by ${improvement} percentage points`);
    console.log(`  Deeper search provides measurable advantage despite computational costs.`);
  } else if (statsData.bot2WinRate > statsData.bot1WinRate) {
    const diff = (statsData.bot2WinRate - statsData.bot1WinRate).toFixed(2);
    console.log(`✗ ImprovedTypeAwareBot outperforms Depth6SearchBot by ${diff} percentage points`);
    console.log(`  This suggests that search depth alone doesn't guarantee better performance.`);
    console.log(`  Likely factors: evaluation quality, switch decisions, or computational constraints.`);
  } else {
    console.log(`≈ Both bots performed equally`);
    console.log(`  Search depth advantage balanced by other factors.`);
  }

  console.log('');
}

// Parse command line arguments
const numBattles = parseInt(process.argv[2]) || 20;

// Run the comparison
runComparison(numBattles).catch(console.error);
