const EngineBattleSimulator = require('./src/EngineBattleSimulator');
const Depth6SearchBot = require('./src/Depth6SearchBot');
const ImprovedDepth6Bot = require('./src/ImprovedDepth6Bot');
const ouTeams = require('./data/ou-teams');
const fs = require('fs');

/**
 * Proper comparison between Depth6SearchBot (baseline) and ImprovedDepth6Bot
 * Uses EngineBattleSimulator which properly sets up battle instances for minimax search
 */

class ComparisonStats {
  constructor() {
    this.battles = [];
    this.improvedWins = 0;
    this.baselineWins = 0;
    this.draws = 0;
  }

  recordBattle(battleNum, result, improvedStats, baselineStats) {
    const record = {
      battleNum,
      winner: result.winner,
      turns: result.turns,
      improvedStats,
      baselineStats
    };

    this.battles.push(record);

    if (result.winner === 'ImprovedDepth6Bot') {
      this.improvedWins++;
    } else if (result.winner === 'Depth6SearchBot') {
      this.baselineWins++;
    } else {
      this.draws++;
    }
  }

  printSummary() {
    const total = this.battles.length;
    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Battles: ${total}`);
    console.log('');
    console.log(`ImprovedDepth6Bot: ${this.improvedWins} wins (${(this.improvedWins / total * 100).toFixed(1)}%)`);
    console.log(`Depth6SearchBot: ${this.baselineWins} wins (${(this.baselineWins / total * 100).toFixed(1)}%)`);
    console.log(`Draws: ${this.draws} (${(this.draws / total * 100).toFixed(1)}%)`);
    console.log('='.repeat(80));

    // Detailed battle results
    console.log('\nBattle-by-Battle Results:');
    this.battles.forEach(b => {
      const symbol = b.winner === 'ImprovedDepth6Bot' ? '✓' :
                     b.winner === 'Depth6SearchBot' ? '✗' : '=';
      console.log(`  ${symbol} Battle ${b.battleNum}: ${b.winner} (${b.turns} turns)`);
    });
  }

  analyzeLosses() {
    const losses = this.battles.filter(b => b.winner === 'Depth6SearchBot');

    console.log('\n' + '='.repeat(80));
    console.log('LOSS ANALYSIS FOR IMPROVEDDEPTH6BOT');
    console.log('='.repeat(80));
    console.log(`Total Losses: ${losses.length}\n`);

    if (losses.length === 0) {
      console.log('No losses to analyze!\n');
      return;
    }

    // Calculate averages for losses
    const avgLossTurns = losses.reduce((sum, l) => sum + l.turns, 0) / losses.length;
    const avgLossTimeouts = losses.reduce((sum, l) => sum + (l.improvedStats.improved?.timeouts || 0), 0) / losses.length;
    const avgLossSearchTime = losses.reduce((sum, l) => sum + (l.improvedStats.search?.avgSearchTime || 0), 0) / losses.length;
    const avgLossNodes = losses.reduce((sum, l) => sum + (l.improvedStats.search?.avgNodesExplored || 0), 0) / losses.length;

    console.log('Loss Statistics:');
    console.log(`  Average turns in losses:       ${avgLossTurns.toFixed(1)}`);
    console.log(`  Average timeouts per loss:     ${avgLossTimeouts.toFixed(2)}`);
    console.log(`  Average search time per loss:  ${avgLossSearchTime.toFixed(2)}ms`);
    console.log(`  Average nodes per loss:        ${avgLossNodes.toFixed(0)}`);
    console.log('');

    // Detailed loss breakdown
    losses.forEach((loss, idx) => {
      console.log(`Loss ${idx + 1} (Battle ${loss.battleNum}):`);
      console.log(`  Turns: ${loss.turns}`);
      console.log(`  ImprovedBot timeouts: ${loss.improvedStats.improved?.timeouts || 0}`);
      console.log(`  ImprovedBot avg search: ${loss.improvedStats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`  ImprovedBot avg nodes: ${loss.improvedStats.search?.avgNodesExplored?.toFixed(0) || 'N/A'}`);
      console.log(`  BaselineBot avg search: ${loss.baselineStats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms`);
      console.log(`  BaselineBot avg nodes: ${loss.baselineStats.search?.avgNodesExplored?.toFixed(0) || 'N/A'}`);
      console.log('');
    });

    console.log('='.repeat(80));
  }

  analyzePerformance() {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE ANALYSIS');
    console.log('='.repeat(80));

    // Compare search statistics
    const improvedAvgSearchTime = this.battles.reduce((sum, b) =>
      sum + (b.improvedStats.search?.avgSearchTime || 0), 0) / this.battles.length;
    const baselineAvgSearchTime = this.battles.reduce((sum, b) =>
      sum + (b.baselineStats.search?.avgSearchTime || 0), 0) / this.battles.length;

    const improvedAvgNodes = this.battles.reduce((sum, b) =>
      sum + (b.improvedStats.search?.avgNodesExplored || 0), 0) / this.battles.length;
    const baselineAvgNodes = this.battles.reduce((sum, b) =>
      sum + (b.baselineStats.search?.avgNodesExplored || 0), 0) / this.battles.length;

    const totalTimeouts = this.battles.reduce((sum, b) =>
      sum + (b.improvedStats.improved?.timeouts || 0), 0);

    console.log('\nSearch Time Comparison:');
    console.log(`  ImprovedDepth6Bot avg:  ${improvedAvgSearchTime.toFixed(2)}ms`);
    console.log(`  Depth6SearchBot avg:    ${baselineAvgSearchTime.toFixed(2)}ms`);
    console.log(`  Time difference:        ${(improvedAvgSearchTime - baselineAvgSearchTime).toFixed(2)}ms`);
    console.log(`  Speedup factor:         ${(baselineAvgSearchTime / improvedAvgSearchTime).toFixed(2)}x`);

    console.log('\nNodes Explored Comparison:');
    console.log(`  ImprovedDepth6Bot avg:  ${improvedAvgNodes.toFixed(0)}`);
    console.log(`  Depth6SearchBot avg:    ${baselineAvgNodes.toFixed(0)}`);
    console.log(`  Node difference:        ${(improvedAvgNodes - baselineAvgNodes).toFixed(0)}`);
    console.log(`  Node reduction:         ${(100 - improvedAvgNodes / baselineAvgNodes * 100).toFixed(1)}%`);

    console.log('\nTime-Bounded Search Stats:');
    console.log(`  Total timeouts:         ${totalTimeouts}`);
    console.log(`  Timeout rate:           ${(totalTimeouts / this.battles.length).toFixed(2)} per battle`);

    console.log('='.repeat(80));
  }
}

async function runComparison(numBattles = 10) {
  console.log('='.repeat(80));
  console.log('IMPROVED DEPTH6BOT VS DEPTH6SEARCHBOT COMPARISON');
  console.log('='.repeat(80));
  console.log('\nFeatures:');
  console.log('  ImprovedDepth6Bot:');
  console.log('    • Time-bounded search (3 second limit per move)');
  console.log('    • Opponent move prediction (top 2 likely moves)');
  console.log('    • Heuristic-based opponent move scoring');
  console.log('');
  console.log('  Depth6SearchBot (baseline):');
  console.log('    • Pure minimax search to depth 6');
  console.log('    • Assumes optimal opponent play');
  console.log('    • No time limit');
  console.log('');

  const stats = new ComparisonStats();
  const allTeams = ouTeams.getAllTeams();

  for (let i = 0; i < numBattles; i++) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`BATTLE ${i + 1}/${numBattles}`);
    console.log('='.repeat(80));

    // Alternate teams for variety
    const team1 = allTeams[i % allTeams.length];
    const team2 = allTeams[(i + 1) % allTeams.length];

    // Alternate which bot goes first
    const improved = new ImprovedDepth6Bot('ImprovedDepth6Bot', {
      verbose: false,
      timeLimit: 3000,
      useOpponentPrediction: true,
      opponentMovesConsider: 2
    });

    const baseline = new Depth6SearchBot('Depth6SearchBot', {
      verbose: false
    });

    const simulator = i % 2 === 0
      ? new EngineBattleSimulator(improved, baseline, team1, team2, { verbose: false })
      : new EngineBattleSimulator(baseline, improved, team1, team2, { verbose: false });

    try {
      const battleStart = performance.now();
      const result = await simulator.runBattle();
      const battleTime = performance.now() - battleStart;

      console.log(`Winner: ${result.winner} in ${result.turns} turns (${(battleTime / 1000).toFixed(1)}s)`);

      // Get stats
      const improvedStats = improved.getStats();
      const baselineStats = baseline.getStats();

      console.log(`  ImprovedBot: ${improvedStats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms/search, ${improvedStats.improved?.timeouts || 0} timeouts`);
      console.log(`  BaselineBot: ${baselineStats.search?.avgSearchTime?.toFixed(2) || 'N/A'}ms/search`);

      stats.recordBattle(i + 1, result, improvedStats, baselineStats);
    } catch (error) {
      console.error(`Error in battle ${i + 1}:`, error.message);
    }
  }

  stats.printSummary();
  stats.analyzePerformance();
  stats.analyzeLosses();

  // Final analysis
  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSIONS');
  console.log('='.repeat(80));

  const winRate = stats.improvedWins / (stats.improvedWins + stats.baselineWins) * 100;

  if (winRate > 55) {
    console.log('\n✓ ImprovedDepth6Bot shows significant improvement!');
    console.log('  Time-bounded search and opponent prediction are effective.');
  } else if (winRate >= 45) {
    console.log('\n= Performance is roughly equivalent.');
    console.log('  Key benefit: More consistent timing with time-bounded search.');
  } else {
    console.log('\n✗ ImprovedDepth6Bot underperforms the baseline.');
    console.log('  Possible issues:');
    console.log('    • Time limit too restrictive (3s may not be enough)');
    console.log('    • Opponent prediction heuristics inaccurate');
    console.log('    • Considering only 2 opponent moves too aggressive');
  }

  console.log('='.repeat(80));
}

runComparison(10).then(() => {
  console.log('\n✓ Comparison complete!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  console.error(error.stack);
  process.exit(1);
});
