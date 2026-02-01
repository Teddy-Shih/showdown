const EngineMoveSimulator = require('./EngineMoveSimulator');

/**
 * FastTreeSearchBot - 2-ply lookahead using @pkmn/sim
 *
 * Avoids infinite loop detection by:
 * - Limited branching factor (max 3 moves per side)
 * - Flat 2-ply search (no deep recursion)
 * - Single simulation per path
 */
class FastTreeSearchBot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new EngineMoveSimulator();
    this.battleInstance = null;
    this.playerSide = null;
    this.verbose = options.verbose || false;
    this.maxMovesToConsider = options.maxMovesToConsider || 3;
  }

  setBattleInstance(battle, playerSide) {
    this.battleInstance = battle;
    this.playerSide = playerSide;
  }

  chooseMove(request) {
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    if (request.forceSwitch) {
      return this.chooseBestSwitch(request);
    }

    if (!this.battleInstance) {
      return this.fallbackChoice(request);
    }

    const active = request.active[0];
    if (!active || !active.moves || active.moves.length === 0) {
      return 'move 1';
    }

    const startTime = Date.now();
    const bestMove = this.searchBestMove();
    const searchTime = Date.now() - startTime;

    if (this.verbose) {
      console.log(`[${this.name}] Search: ${searchTime}ms, chose: ${bestMove.choice}, score: ${bestMove.score.toFixed(2)}, nodes: ${bestMove.nodesSearched}`);
    }

    return bestMove.choice;
  }

  /**
   * 2-ply minimax search:
   * - Our move
   * - Opponent's response
   * - Evaluate resulting position
   */
  searchBestMove() {
    const ourMoves = this.simulator.getAvailableMoves(this.battleInstance, this.playerSide);
    const oppSide = this.playerSide === 'p1' ? 'p2' : 'p1';
    const oppMoves = this.simulator.getAvailableMoves(this.battleInstance, oppSide);

    if (ourMoves.length === 0) {
      const switches = this.simulator.getAvailableSwitches(this.battleInstance, this.playerSide);
      return {
        choice: switches.length > 0 ? `switch ${switches[0]}` : 'default',
        score: 0,
        nodesSearched: 0
      };
    }

    // Limit branching to avoid infinite loop detection
    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);
    const oppMovesToTry = Math.min(oppMoves.length, this.maxMovesToConsider);

    let bestChoice = 'move 1';
    let bestScore = -Infinity;
    let nodesSearched = 0;

    // For each of our moves
    for (let i = 0; i < movesToTry; i++) {
      const ourChoice = `move ${i + 1}`;
      let worstCaseScore = Infinity; // Opponent will minimize our score

      // Try against each opponent move
      for (let j = 0; j < oppMovesToTry; j++) {
        const oppChoice = `move ${j + 1}`;

        const p1Choice = this.playerSide === 'p1' ? ourChoice : oppChoice;
        const p2Choice = this.playerSide === 'p1' ? oppChoice : ourChoice;

        try {
          // Simulate the immediate turn
          const afterTurn1 = this.simulator.simulateTurn(this.battleInstance, p1Choice, p2Choice);
          nodesSearched++;

          // Check if battle ended
          if (afterTurn1.ended) {
            const score = this.simulator.evaluateState(afterTurn1, this.playerSide);
            worstCaseScore = Math.min(worstCaseScore, score);
            continue;
          }

          // Look ahead one more turn (2-ply total)
          // For simplicity, just evaluate the immediate result
          // Full 2-ply would be: try moves from afterTurn1, but that risks infinite loop
          const score = this.simulator.evaluateState(afterTurn1, this.playerSide);
          worstCaseScore = Math.min(worstCaseScore, score);

        } catch (error) {
          if (this.verbose) {
            console.log(`[${this.name}] Error simulating ${ourChoice} vs ${oppChoice}: ${error.message}`);
          }
          // Assign bad score to this path
          worstCaseScore = Math.min(worstCaseScore, -1000);
        }
      }

      // We want to maximize our worst-case score (minimax)
      if (worstCaseScore > bestScore) {
        bestScore = worstCaseScore;
        bestChoice = ourChoice;
      }
    }

    return {
      choice: bestChoice,
      score: bestScore,
      nodesSearched
    };
  }

  chooseBestSwitch(request) {
    const alivePokemon = request.side.pokemon
      .map((p, idx) => ({ pokemon: p, slot: idx + 1 }))
      .filter(({ pokemon }) => !pokemon.active && pokemon.condition !== '0 fnt');

    if (alivePokemon.length === 0) {
      return 'default';
    }

    return `switch ${alivePokemon[0].slot}`;
  }

  fallbackChoice(request) {
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'move 1';
    }

    for (let i = 0; i < active.moves.length; i++) {
      const move = active.moves[i];
      if (!move.disabled && move.pp > 0) {
        return `move ${i + 1}`;
      }
    }

    return 'move 1';
  }
}

module.exports = FastTreeSearchBot;
