const TranspositionMoveSimulator = require('./TranspositionMoveSimulator');

const WIN_SCORE = 10000;
// Forced-switch nodes don't use up a turn; cap how many can chain in a row
const MAX_SWITCH_CHAIN = 4;

class SearchTimeout extends Error {}

/**
 * OptimizedDepth4Bot - Turn-based alpha-beta search with transposition tables
 * and move ordering.
 *
 * Pokemon turns are simultaneous, so each tree node is a position in which both
 * sides pick a choice and the sim resolves the turn. A node's value is
 *
 *   max over our choices ( min over opponent choices ( value(resulting position) ) )
 *
 * i.e. we assume the opponent answers our choice as well as possible. This is
 * pessimistic (the opponent does not really see our move) but sound, and
 * alpha-beta pruning applies to it directly.
 *
 * - Depth is counted in turns: maxDepth is in plies, one turn = 2 plies.
 * - Forced switches (faints, U-turn) are decision nodes that don't use a turn.
 * - Voluntary switches are considered for both sides on the first turn only,
 *   capped to the best few matchups, to keep the branching factor manageable.
 * - Iterative deepening: searches 1 turn, then 2, ... up to maxTurns, and stops
 *   early when timeLimit runs out, returning the last completed iteration.
 */
class OptimizedDepth4Bot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new TranspositionMoveSimulator({
      maxTableSize: options.maxTableSize || 10000
    });
    this.battleInstance = null;
    this.playerSide = null;
    this.opponentSide = null;
    this.verbose = options.verbose || false;
    this.maxMovesToConsider = options.maxMovesToConsider || 4;
    this.maxDepth = options.maxDepth || 4;
    this.maxTurns = options.maxTurns || Math.ceil(this.maxDepth / 2);
    this.timeLimit = options.timeLimit || Infinity;
    this.considerSwitches = options.considerSwitches !== false;
    this.maxSwitchesToConsider = options.maxSwitchesToConsider ?? 2;
    this.useTranspositionTable = options.useTranspositionTable !== false;
    this.useMoveOrdering = options.useMoveOrdering !== false;

    this.searchStats = {
      totalSearchTime: 0,
      searchCalls: 0,
      nodesExplored: 0,
      ttCutoffs: 0,
      alphaBetaPrunes: 0,
      timeouts: 0,
      totalDepthReached: 0,
      maxDepthReached: 0
    };
  }

  setBattleInstance(battle, playerSide) {
    this.battleInstance = battle;
    this.playerSide = playerSide;
    this.opponentSide = playerSide === 'p1' ? 'p2' : 'p1';
  }

  chooseMove(request) {
    if (!request || request.wait) return 'default';
    if (request.teamPreview) return 'default';

    if (!this.battleInstance) {
      return this.fallbackChoice(request);
    }

    const startTime = performance.now();
    const result = this.searchBestMove();
    const searchTime = performance.now() - startTime;

    this.searchStats.totalSearchTime += searchTime;
    this.searchStats.searchCalls++;

    if (!result) {
      return this.fallbackChoice(request);
    }

    if (this.verbose) {
      const stats = this.simulator.getStats();
      console.log(`[${this.name}] ${result.depth} turn(s): ${searchTime.toFixed(0)}ms, chose: ${result.choice}, score: ${result.score.toFixed(2)}`);
      console.log(`  Nodes: ${result.nodesExplored}, TT hits: ${stats.ttHits}, TT cutoffs: ${this.searchStats.ttCutoffs}, Prunes: ${this.searchStats.alphaBetaPrunes}`);
    }

    return result.choice;
  }

  /**
   * Kept for callers of the old API; forced switches now go through the
   * normal search as a switch-only root node.
   */
  chooseBestSwitch(request) {
    return this.chooseMove(request);
  }

  /**
   * Search the current position and return
   * { choice, score, depth, nodesExplored }, or null if we have nothing to choose.
   */
  searchBestMove() {
    const battle = this.battleInstance;
    this.searchStartTime = performance.now();
    this.nodesThisPath = 0;

    let order = this.getOrderedChoices(battle, this.playerSide, true);
    if (order.length === 0) return null;
    if (order.length === 1) {
      return { choice: order[0].choice, score: 0, depth: 0, nodesExplored: 0 };
    }

    let best = null;
    for (let turns = 1; turns <= this.maxTurns; turns++) {
      try {
        const scores = new Map();
        const result = this.maxMin(battle, turns, -Infinity, Infinity, order, scores, 0, true);
        if (!result.choice) break;
        best = { choice: result.choice.choice, score: result.score, depth: turns };

        // Search the most promising choices first on the next iteration
        const scoreOf = c => (scores.has(c.choice) ? scores.get(c.choice) : -Infinity);
        order = [...order].sort((a, b) => scoreOf(b) - scoreOf(a));

        // A forced win or loss won't change with more depth
        if (Math.abs(result.score) >= WIN_SCORE) break;
      } catch (error) {
        if (error instanceof SearchTimeout) {
          this.searchStats.timeouts++;
          break;
        }
        throw error;
      }
    }

    // Timed out before finishing even one turn: fall back to move ordering
    if (!best) best = { choice: order[0].choice, score: 0, depth: 0 };

    this.searchStats.nodesExplored += this.nodesThisPath;
    this.searchStats.totalDepthReached += best.depth;
    this.searchStats.maxDepthReached = Math.max(this.searchStats.maxDepthReached, best.depth);

    return { ...best, nodesExplored: this.nodesThisPath };
  }

  /**
   * Value of a position from our perspective, searching `turnsLeft` more turns.
   */
  value(battle, turnsLeft, alpha, beta, switchChain) {
    if (battle.ended) {
      // Prefer faster wins and slower losses
      const score = this.simulator.evaluateState(battle, this.playerSide);
      return score > 0 ? score + turnsLeft : score < 0 ? score - turnsLeft : 0;
    }
    if (turnsLeft <= 0) {
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    const alphaOrig = alpha;
    const betaOrig = beta;

    if (this.useTranspositionTable) {
      const entry = this.simulator.ttLookup(battle);
      if (entry && entry.depth >= turnsLeft) {
        if (entry.flag === 'exact') {
          this.searchStats.ttCutoffs++;
          return entry.score;
        } else if (entry.flag === 'lowerbound') {
          alpha = Math.max(alpha, entry.score);
        } else if (entry.flag === 'upperbound') {
          beta = Math.min(beta, entry.score);
        }
        if (alpha >= beta) {
          this.searchStats.ttCutoffs++;
          return entry.score;
        }
      }
    }

    const ourChoices = this.getOrderedChoices(battle, this.playerSide, false);
    const result = this.maxMin(battle, turnsLeft, alpha, beta, ourChoices, null, switchChain, false);

    // Every branch failed to simulate: score the position as it stands
    if (result.score === -Infinity || result.score === Infinity) {
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    if (this.useTranspositionTable) {
      const flag = result.score <= alphaOrig ? 'upperbound'
        : result.score >= betaOrig ? 'lowerbound'
          : 'exact';
      this.simulator.ttStore(battle, turnsLeft, this.playerSide, result.score, flag);
    }

    return result.score;
  }

  /**
   * max over our choices of (min over opponent choices of child value).
   * Records each of our choices' scores in `scores` when given (root only).
   * Returns { score, choice }.
   */
  maxMin(battle, turnsLeft, alpha, beta, ourChoices, scores, switchChain, atRoot) {
    const isTurn = battle[this.playerSide].requestState === 'move' ||
      battle[this.opponentSide].requestState === 'move';

    // Forced-switch resolution doesn't use a turn, but can't chain forever
    const freeNode = !isTurn && switchChain < MAX_SWITCH_CHAIN;
    const childTurns = freeNode ? turnsLeft : turnsLeft - 1;
    const childChain = freeNode ? switchChain + 1 : 0;

    const ours = ourChoices.length ? ourChoices : [null];
    const oppChoices = this.getOrderedChoices(battle, this.opponentSide, atRoot);
    const theirs = oppChoices.length ? oppChoices : [null];

    let best = -Infinity;
    let bestChoice = null;

    for (const ourChoice of ours) {
      let worst = Infinity;

      for (const oppChoice of theirs) {
        this.checkTime();
        const lo = Math.max(alpha, best);
        const hi = Math.min(beta, worst);

        const ourStr = ourChoice ? ourChoice.choice : null;
        const oppStr = oppChoice ? oppChoice.choice : null;
        const child = this.playerSide === 'p1'
          ? this.simulator.applyChoices(battle, ourStr, oppStr)
          : this.simulator.applyChoices(battle, oppStr, ourStr);
        this.nodesThisPath++;
        if (!child) continue;

        const v = this.value(child, childTurns, lo, hi, childChain);
        if (v < worst) worst = v;

        // The opponent can already hold this choice to no better than
        // something we have: stop looking at their other replies
        if (worst <= lo) {
          this.searchStats.alphaBetaPrunes++;
          break;
        }
      }

      if (worst === Infinity) continue;
      if (scores && ourChoice) scores.set(ourChoice.choice, worst);
      if (worst > best) {
        best = worst;
        bestChoice = ourChoice;
      }
      if (best >= beta) {
        this.searchStats.alphaBetaPrunes++;
        break;
      }
    }

    return { score: best, choice: bestChoice };
  }

  /**
   * Legal choices for a player, most promising first.
   * Voluntary switches are only generated on the first turn of the search.
   */
  getOrderedChoices(battle, player, atRoot) {
    const choices = this.simulator.getChoices(battle, player, {
      includeSwitches: atRoot && this.considerSwitches,
      maxSwitches: this.maxSwitchesToConsider
    });
    return player === this.playerSide
      ? this.orderOwnChoices(battle, player, choices)
      : this.orderOpponentChoices(battle, player, choices);
  }

  /**
   * Moves by expected damage (capped at maxMovesToConsider), then switches.
   */
  orderOwnChoices(battle, player, choices) {
    const moves = this.orderMoveChoices(battle, player, choices.filter(c => c.kind === 'move'));
    const others = choices.filter(c => c.kind !== 'move');
    return [...moves.slice(0, this.maxMovesToConsider), ...others];
  }

  /**
   * The opponent's replies, most dangerous first so alpha-beta cuts sooner.
   * Subclasses can override this to plug in an opponent model.
   */
  orderOpponentChoices(battle, player, choices) {
    const moves = this.orderMoveChoices(battle, player, choices.filter(c => c.kind === 'move'));
    return [...moves, ...choices.filter(c => c.kind !== 'move')];
  }

  orderMoveChoices(battle, player, moveChoices) {
    if (!this.useMoveOrdering || moveChoices.length <= 1) return moveChoices;
    const orderedIds = this.simulator.orderMoves(battle, player, moveChoices.map(c => c.id));
    return orderedIds.map(id => moveChoices.find(c => c.id === id));
  }

  checkTime() {
    if (performance.now() - this.searchStartTime > this.timeLimit) {
      throw new SearchTimeout();
    }
  }

  fallbackChoice(request) {
    if (request.forceSwitch) {
      const slot = request.side.pokemon.findIndex(p => !p.active && !p.condition.endsWith(' fnt'));
      return slot >= 0 ? `switch ${slot + 1}` : 'default';
    }

    const active = request.active && request.active[0];
    if (!active || !active.moves) return 'default';

    for (let i = 0; i < active.moves.length; i++) {
      if (!active.moves[i].disabled) {
        return `move ${i + 1}`;
      }
    }
    return 'default';
  }

  getStats() {
    const calls = this.searchStats.searchCalls;
    return {
      search: {
        ...this.searchStats,
        avgSearchTime: calls > 0 ? this.searchStats.totalSearchTime / calls : 0,
        avgNodesExplored: calls > 0 ? this.searchStats.nodesExplored / calls : 0,
        avgDepthReached: calls > 0 ? this.searchStats.totalDepthReached / calls : 0
      },
      simulator: this.simulator.getStats()
    };
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log(`SEARCH BOT STATISTICS - ${this.name}`);
    console.log('='.repeat(70));

    console.log('\nSettings:');
    console.log(`  Max turns searched:   ${this.maxTurns}`);
    console.log(`  Time limit:           ${this.timeLimit === Infinity ? 'none' : this.timeLimit + 'ms'}`);
    console.log(`  Transposition tables: ${this.useTranspositionTable ? 'YES' : 'NO'}`);
    console.log(`  Move ordering:        ${this.useMoveOrdering ? 'YES' : 'NO'}`);
    console.log(`  Voluntary switches:   ${this.considerSwitches ? `first turn, top ${this.maxSwitchesToConsider}` : 'NO'}`);

    console.log('\nSearch Statistics:');
    console.log(`  Total searches:         ${stats.search.searchCalls}`);
    console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);
    console.log(`  Avg nodes per search:   ${stats.search.avgNodesExplored.toFixed(1)}`);
    console.log(`  Avg turns completed:    ${stats.search.avgDepthReached.toFixed(2)} (max ${stats.search.maxDepthReached})`);
    console.log(`  Timeouts:               ${stats.search.timeouts}`);
    console.log(`  TT cutoffs:             ${stats.search.ttCutoffs}`);
    console.log(`  Alpha-beta prunes:      ${stats.search.alphaBetaPrunes}`);

    this.simulator.printStats();
  }
}

OptimizedDepth4Bot.SearchTimeout = SearchTimeout;

module.exports = OptimizedDepth4Bot;
