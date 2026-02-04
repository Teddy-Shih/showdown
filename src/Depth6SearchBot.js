const OptimizedDepth4Bot = require('./OptimizedDepth4Bot');

/**
 * Depth6SearchBot - 6-ply minimax search with transposition tables and move ordering
 *
 * This extends OptimizedDepth4Bot but searches to depth 6 instead of 4.
 * With transposition tables and move ordering, depth 6 becomes practical:
 *
 * Expected performance:
 * - Without optimizations: ~30+ seconds per turn (impractical)
 * - With optimizations: ~1-3 seconds per turn (usable)
 *
 * Performance estimates:
 * - Nodes: ~15,000-30,000 (vs ~100,000+ without optimizations)
 * - TT hit rate: 30-50%
 * - Alpha-beta prunes: 40-60% of branches
 *
 * Why depth 6 is valuable:
 * - Sees 3 full turns ahead (vs 2 turns at depth 4)
 * - Can plan 2-turn KO sequences
 * - Better switch decisions
 * - More accurate position evaluation
 */
class Depth6SearchBot extends OptimizedDepth4Bot {
  constructor(playerName, options = {}) {
    // Set default depth to 6
    const depth6Options = {
      ...options,
      maxDepth: 6,
      maxTableSize: options.maxTableSize || 50000, // Larger TT for depth 6
      maxMovesToConsider: options.maxMovesToConsider || 3 // Still limit branching
    };

    super(playerName, depth6Options);

    // Additional stats specific to depth 6
    this.depth6Stats = {
      avgBranchingFactor: 0,
      maxDepthReached: 0
    };
  }

  searchBestMove() {
    // Track max depth reached
    this.currentMaxDepth = 0;

    const result = super.searchBestMove();

    this.depth6Stats.maxDepthReached = Math.max(
      this.depth6Stats.maxDepthReached,
      this.currentMaxDepth
    );

    return result;
  }

  minimax(battle, lastChoice, depth, alpha, beta, maximizing) {
    // Track max depth for stats
    const depthReached = this.maxDepth - depth;
    if (depthReached > this.currentMaxDepth) {
      this.currentMaxDepth = depthReached;
    }

    // Call parent minimax
    return super.minimax(battle, lastChoice, depth, alpha, beta, maximizing);
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log(`DEPTH 6 SEARCH BOT STATISTICS - ${this.name}`);
    console.log('='.repeat(70));

    console.log('\nSearch Depth Information:');
    console.log(`  Target depth:           ${this.maxDepth}`);
    console.log(`  Max depth reached:      ${this.depth6Stats.maxDepthReached}`);
    console.log(`  Moves considered:       ${this.maxMovesToConsider} per side`);

    console.log('\nOptimizations Enabled:');
    console.log(`  Transposition tables:   ${this.useTranspositionTable ? 'YES' : 'NO'}`);
    console.log(`  Move ordering:          ${this.useMoveOrdering ? 'YES' : 'NO'}`);
    console.log(`  TT size limit:          ${this.simulator.maxTableSize}`);

    console.log('\nSearch Statistics:');
    console.log(`  Total searches:         ${stats.search.searchCalls}`);
    console.log(`  Total search time:      ${stats.search.totalSearchTime.toFixed(2)}ms`);
    console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);
    console.log(`  Total nodes explored:   ${stats.search.nodesExplored}`);
    console.log(`  Avg nodes per search:   ${stats.search.avgNodesExplored.toFixed(1)}`);
    console.log(`  TT cutoffs:             ${stats.search.ttCutoffs}`);
    console.log(`  Alpha-beta prunes:      ${stats.search.alphaBetaPrunes}`);

    // Calculate efficiency metrics
    const simStats = stats.simulator;
    const ttTotal = simStats.ttHits + simStats.ttMisses;
    const pruneRate = stats.search.alphaBetaPrunes / stats.search.nodesExplored;

    console.log('\nEfficiency Metrics:');
    console.log(`  TT hit rate:            ${simStats.ttHitRate}`);
    console.log(`  Prune rate:             ${(pruneRate * 100).toFixed(1)}%`);
    console.log(`  Nodes per second:       ${(stats.search.nodesExplored / (stats.search.totalSearchTime / 1000)).toFixed(0)}`);

    this.simulator.printStats();
  }
}

module.exports = Depth6SearchBot;
