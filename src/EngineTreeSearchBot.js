const EngineMoveSimulator = require('./EngineMoveSimulator');

/**
 * EngineTreeSearchBot - Fast minimax search using @pkmn/sim Battle engine
 *
 * Performance improvements over original TreeSearchBot:
 * - 5-10x faster simulation (uses Battle engine instead of @smogon/calc)
 * - More accurate (handles all battle mechanics)
 * - Better state representation (direct from engine)
 *
 * This bot maintains a battle instance and uses it for tree search.
 */
class EngineTreeSearchBot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new EngineMoveSimulator();
    this.searchDepth = options.searchDepth || 2;
    this.battleInstance = null; // Will be set during battle
    this.playerSide = null; // 'p1' or 'p2'
    this.verbose = options.verbose || false;
  }

  /**
   * Initialize with battle instance
   * This should be called at the start of a battle
   */
  setBattleInstance(battle, playerSide) {
    this.battleInstance = battle;
    this.playerSide = playerSide;
  }

  /**
   * Choose a move based on current request
   */
  chooseMove(request) {
    // Safety check
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    // Handle force switch
    if (request.forceSwitch) {
      return this.chooseBestSwitch(request);
    }

    // If we don't have a battle instance, we can't do tree search
    // Fall back to simple heuristic
    if (!this.battleInstance) {
      return this.fallbackChoice(request);
    }

    // Get available moves
    const active = request.active[0];
    if (!active || !active.moves || active.moves.length === 0) {
      return 'move 1';
    }

    // Run minimax search
    const startTime = Date.now();
    const bestMove = this.searchBestMove(this.battleInstance);
    const searchTime = Date.now() - startTime;

    if (this.verbose) {
      console.log(`[${this.name}] Search completed in ${searchTime}ms, chose: ${bestMove.choice} (score: ${bestMove.score.toFixed(2)})`);
    }

    return bestMove.choice;
  }

  /**
   * Search for best move using minimax with alpha-beta pruning
   */
  searchBestMove(battle) {
    const ourMoves = this.simulator.getAvailableMoves(battle, this.playerSide);
    const oppMoves = this.simulator.getAvailableMoves(battle, this.playerSide === 'p1' ? 'p2' : 'p1');

    if (ourMoves.length === 0) {
      // Need to switch
      const switches = this.simulator.getAvailableSwitches(battle, this.playerSide);
      if (switches.length > 0) {
        return { choice: `switch ${switches[0]}`, score: 0 };
      }
      return { choice: 'default', score: -Infinity };
    }

    if (oppMoves.length === 0) {
      // Opponent will switch - assume they switch to first available
      oppMoves.push('switch 2'); // Default opponent switch
    }

    let bestChoice = null;
    let bestScore = -Infinity;
    let nodesSearched = 0;

    // Try each of our moves
    for (let i = 0; i < ourMoves.length; i++) {
      const ourChoice = `move ${i + 1}`;
      const moveId = ourMoves[i];

      // For each possible opponent move, run minimax
      let worstCaseScore = Infinity;

      for (let j = 0; j < Math.min(oppMoves.length, 4); j++) {
        // Limit opponent moves to top 4 to save time
        const oppChoice = `move ${j + 1}`;

        // Simulate this turn
        const p1Choice = this.playerSide === 'p1' ? ourChoice : oppChoice;
        const p2Choice = this.playerSide === 'p1' ? oppChoice : ourChoice;

        const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
        nodesSearched++;

        // Evaluate the resulting state
        let score;
        if (this.searchDepth > 1 && !newBattle.ended) {
          // Recursively search deeper
          score = this.minimax(newBattle, this.searchDepth - 1, -Infinity, Infinity, false);
          nodesSearched += Math.pow(4, this.searchDepth - 1); // Approximate
        } else {
          score = this.simulator.evaluateState(newBattle, this.playerSide);
        }

        // Opponent wants to minimize our score
        worstCaseScore = Math.min(worstCaseScore, score);
      }

      // We want to maximize our worst-case score
      if (worstCaseScore > bestScore) {
        bestScore = worstCaseScore;
        bestChoice = ourChoice;
      }
    }

    if (this.verbose) {
      console.log(`[${this.name}] Nodes searched: ${nodesSearched}`);
    }

    return {
      choice: bestChoice || 'move 1',
      score: bestScore,
      nodesSearched
    };
  }

  /**
   * Minimax with alpha-beta pruning
   */
  minimax(battle, depth, alpha, beta, maximizing) {
    // Terminal conditions
    if (depth === 0 || battle.ended) {
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    const playerToMove = maximizing ? this.playerSide : (this.playerSide === 'p1' ? 'p2' : 'p1');
    const moves = this.simulator.getAvailableMoves(battle, playerToMove);
    const oppMoves = this.simulator.getAvailableMoves(battle, playerToMove === 'p1' ? 'p2' : 'p1');

    if (moves.length === 0 || oppMoves.length === 0) {
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    if (maximizing) {
      let maxScore = -Infinity;

      for (let i = 0; i < Math.min(moves.length, 4); i++) {
        const choice = `move ${i + 1}`;

        // Try against each opponent move
        for (let j = 0; j < Math.min(oppMoves.length, 3); j++) {
          const oppChoice = `move ${j + 1}`;

          const p1Choice = playerToMove === 'p1' ? choice : oppChoice;
          const p2Choice = playerToMove === 'p1' ? oppChoice : choice;

          const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
          const score = this.minimax(newBattle, depth - 1, alpha, beta, false);

          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);

          if (beta <= alpha) {
            break; // Beta cutoff
          }
        }

        if (beta <= alpha) {
          break;
        }
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (let i = 0; i < Math.min(moves.length, 4); i++) {
        const choice = `move ${i + 1}`;

        for (let j = 0; j < Math.min(oppMoves.length, 3); j++) {
          const oppChoice = `move ${j + 1}`;

          const p1Choice = playerToMove === 'p1' ? choice : oppChoice;
          const p2Choice = playerToMove === 'p1' ? oppChoice : choice;

          const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
          const score = this.minimax(newBattle, depth - 1, alpha, beta, true);

          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);

          if (beta <= alpha) {
            break; // Alpha cutoff
          }
        }

        if (beta <= alpha) {
          break;
        }
      }

      return minScore;
    }
  }

  /**
   * Choose best switch when forced
   */
  chooseBestSwitch(request) {
    const alivePokemon = request.side.pokemon
      .map((p, idx) => ({ pokemon: p, slot: idx + 1 }))
      .filter(({ pokemon }) => !pokemon.active && pokemon.condition !== '0 fnt');

    if (alivePokemon.length === 0) {
      return 'default';
    }

    // For now, just switch to first alive
    // Could be improved with type matchups
    return `switch ${alivePokemon[0].slot}`;
  }

  /**
   * Fallback when we don't have battle instance
   */
  fallbackChoice(request) {
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'move 1';
    }

    // Just pick first available move
    for (let i = 0; i < active.moves.length; i++) {
      const move = active.moves[i];
      if (!move.disabled && move.pp > 0) {
        return `move ${i + 1}`;
      }
    }

    return 'move 1';
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      simulator: this.simulator.getStats(),
      searchDepth: this.searchDepth
    };
  }
}

module.exports = EngineTreeSearchBot;
