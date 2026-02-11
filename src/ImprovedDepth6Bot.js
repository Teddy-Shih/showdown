const Depth6SearchBot = require('./Depth6SearchBot');

/**
 * ImprovedDepth6Bot - Enhanced Depth6SearchBot with time-bounded search and opponent move prediction
 *
 * Key Improvements:
 * 1. Time-bounded search: Stops searching when time limit is reached, returns best move found so far
 * 2. Opponent move prediction: Uses heuristics to predict likely opponent moves instead of pure minimax
 *
 * Time-Bounded Search:
 * - Default time limit: 3000ms (3 seconds) per move
 * - Checks time at each node to avoid timeout
 * - Returns best move found so far if time runs out
 * - Allows for iterative deepening in the future
 *
 * Opponent Move Prediction:
 * - Scores opponent moves by expected utility (damage, setup value, etc.)
 * - Focuses search on most likely opponent responses
 * - Reduces branching factor by considering top N opponent moves
 * - Falls back to minimax for edge cases
 *
 * Expected Benefits:
 * - More consistent move times (avoids timeouts)
 * - Better performance against predictable opponents
 * - More nodes explored in same time (via better pruning)
 */
class ImprovedDepth6Bot extends Depth6SearchBot {
  constructor(playerName, options = {}) {
    super(playerName, options);

    // Time-bounded search settings
    this.timeLimit = options.timeLimit || 3000; // 3 seconds default
    this.searchStartTime = 0;
    this.timeoutReached = false;

    // Opponent prediction settings
    this.useOpponentPrediction = options.useOpponentPrediction !== false;
    this.opponentMovesConsider = options.opponentMovesConsider || 2; // Consider top 2 opponent moves

    // Additional stats
    this.improvedStats = {
      timeouts: 0,
      opponentPredictions: 0,
      predictionAccuracy: []
    };
  }

  chooseMove(request) {
    // Reset timeout flag at start of search
    this.timeoutReached = false;
    this.searchStartTime = performance.now();

    return super.chooseMove(request);
  }

  /**
   * Check if we've exceeded the time limit
   */
  isTimeoutReached() {
    if (this.timeoutReached) return true;

    const elapsed = performance.now() - this.searchStartTime;
    if (elapsed > this.timeLimit) {
      this.timeoutReached = true;
      this.improvedStats.timeouts++;
      return true;
    }

    return false;
  }

  /**
   * Predict which moves the opponent is likely to make
   * Returns moves sorted by likelihood (most likely first)
   */
  predictOpponentMoves(battle, oppPlayer) {
    const moves = this.simulator.getAvailableMoves(battle, oppPlayer);
    if (moves.length === 0) return [];

    // Score each move by expected utility
    const scoredMoves = moves.map(moveId => {
      let score = 0;

      try {
        const oppSide = battle[oppPlayer];
        const ourSide = battle[oppPlayer === 'p1' ? 'p2' : 'p1'];
        const oppActive = oppSide.active[0];
        const ourActive = ourSide.active[0];

        if (!oppActive || !ourActive) return { moveId, score: 0 };

        // Get move data
        const moveSlot = oppActive.moveSlots.find(s => s.id === moveId);
        if (!moveSlot) return { moveId, score: 0 };

        const move = this.simulator.dex.moves.get(moveSlot.id);
        if (!move) return { moveId, score: 0 };

        // Factor 1: Damage potential (most important)
        if (move.category === 'Physical' || move.category === 'Special') {
          // Estimate damage based on base power and type effectiveness
          const basePower = move.basePower || 0;

          // Get type effectiveness
          let effectiveness = 1.0;
          if (ourActive.species && move.type) {
            const defender = this.simulator.dex.species.get(ourActive.species.name);
            if (defender && defender.types) {
              for (const defType of defender.types) {
                const eff = this.simulator.dex.types.get(move.type)?.effectiveness?.[defType];
                if (eff !== undefined) {
                  effectiveness *= eff;
                }
              }
            }
          }

          score += basePower * effectiveness * 2;

          // Bonus for super effective moves
          if (effectiveness >= 2.0) {
            score += 100;
          }

          // Bonus for moves that can KO
          if (basePower * effectiveness > 50 && ourActive.hp < ourActive.maxhp * 0.4) {
            score += 150;
          }
        }

        // Factor 2: Setup moves (stat boosts)
        if (move.boosts) {
          const boostTotal = Object.values(move.boosts).reduce((sum, val) => sum + Math.abs(val), 0);

          // Setup is valuable when opponent has HP advantage
          if (oppActive.hp > oppActive.maxhp * 0.5) {
            score += boostTotal * 30;
          } else {
            // Less valuable when low HP
            score += boostTotal * 10;
          }
        }

        // Factor 3: Status moves
        if (move.status) {
          // Status is valuable against healthy opponents
          if (ourActive.hp > ourActive.maxhp * 0.5 && !ourActive.status) {
            score += 40;
          }
        }

        // Factor 4: Priority moves (when opponent is low HP)
        if (move.priority && move.priority > 0) {
          if (ourActive.hp < ourActive.maxhp * 0.3) {
            score += 80; // High value for finishing blow
          }
        }

        // Factor 5: Recovery moves
        if (move.heal || move.id === 'roost' || move.id === 'recover') {
          if (oppActive.hp < oppActive.maxhp * 0.5) {
            score += 60; // Valuable when low HP
          }
        }

        // Factor 6: Hazard moves (less predictable, lower score)
        if (move.sideCondition) {
          score += 20;
        }

      } catch (error) {
        // If we can't score the move, give it a neutral score
        score = 0;
      }

      return { moveId, score };
    });

    // Sort by score (highest first)
    scoredMoves.sort((a, b) => b.score - a.score);

    this.improvedStats.opponentPredictions++;

    return scoredMoves.map(m => m.moveId);
  }

  minimax(battle, lastChoice, depth, alpha, beta, maximizing) {
    // Check timeout
    if (this.isTimeoutReached()) {
      // Return current evaluation if timeout
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    // Check transposition table first
    if (this.useTranspositionTable && depth > 0) {
      const ttEntry = this.simulator.ttLookup(battle, depth, this.playerSide);
      if (ttEntry) {
        if (ttEntry.depth >= depth) {
          if (ttEntry.flag === 'exact') {
            this.searchStats.ttCutoffs++;
            return ttEntry.score;
          } else if (ttEntry.flag === 'lowerbound') {
            alpha = Math.max(alpha, ttEntry.score);
          } else if (ttEntry.flag === 'upperbound') {
            beta = Math.min(beta, ttEntry.score);
          }

          if (alpha >= beta) {
            this.searchStats.ttCutoffs++;
            return ttEntry.score;
          }
        }
      }
    }

    // Terminal conditions
    if (depth === 0 || battle.ended) {
      this.nodesThisPath++;
      const score = this.simulator.evaluateState(battle, this.playerSide);

      if (this.useTranspositionTable && depth > 0) {
        this.simulator.ttStore(battle, depth, this.playerSide, score, 'exact');
      }

      return score;
    }

    const currentPlayer = maximizing ? this.playerSide : (this.playerSide === 'p1' ? 'p2' : 'p1');
    const oppPlayer = maximizing ? (this.playerSide === 'p1' ? 'p2' : 'p1') : this.playerSide;

    let ourMoves = this.simulator.getAvailableMoves(battle, currentPlayer);
    let oppMoves = this.simulator.getAvailableMoves(battle, oppPlayer);

    if (ourMoves.length === 0 || oppMoves.length === 0) {
      this.nodesThisPath++;
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    // Apply move ordering for our moves
    if (this.useMoveOrdering) {
      ourMoves = this.simulator.orderMoves(battle, currentPlayer, ourMoves);
    }

    // Use opponent prediction for opponent moves
    if (this.useOpponentPrediction && oppPlayer !== this.playerSide) {
      oppMoves = this.predictOpponentMoves(battle, oppPlayer);
    } else if (this.useMoveOrdering) {
      oppMoves = this.simulator.orderMoves(battle, oppPlayer, oppMoves);
    }

    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);
    const oppMovesToTry = Math.min(
      oppMoves.length,
      oppPlayer === this.playerSide ? this.maxMovesToConsider : this.opponentMovesConsider
    );

    let scoreFlag = 'upperbound';

    if (maximizing) {
      let maxScore = -Infinity;

      for (let i = 0; i < movesToTry; i++) {
        if (this.isTimeoutReached()) break;

        const ourMoveId = ourMoves[i];
        const ourSlot = battle[currentPlayer].active[0].moveSlots.findIndex(s => s.id === ourMoveId);
        if (ourSlot === -1) continue;
        const ourChoice = `move ${ourSlot + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
          if (this.isTimeoutReached()) break;

          const oppMoveId = oppMoves[j];
          const oppSlot = battle[oppPlayer].active[0].moveSlots.findIndex(s => s.id === oppMoveId);
          if (oppSlot === -1) continue;
          const oppChoice = `move ${oppSlot + 1}`;

          const p1Choice = currentPlayer === 'p1' ? ourChoice : oppChoice;
          const p2Choice = currentPlayer === 'p1' ? oppChoice : ourChoice;

          try {
            const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
            this.nodesThisPath++;

            const score = this.minimax(newBattle, oppChoice, depth - 1, alpha, beta, false);
            maxScore = Math.max(maxScore, score);

            if (maxScore > alpha) {
              alpha = maxScore;
              scoreFlag = 'exact';
            }

            if (beta <= alpha) {
              this.searchStats.alphaBetaPrunes++;
              scoreFlag = 'lowerbound';

              if (this.useTranspositionTable) {
                this.simulator.ttStore(battle, depth, this.playerSide, maxScore, scoreFlag);
              }

              return maxScore;
            }
          } catch (error) {
            maxScore = Math.max(maxScore, -1000);
          }
        }
      }

      if (this.useTranspositionTable) {
        this.simulator.ttStore(battle, depth, this.playerSide, maxScore, scoreFlag);
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (let i = 0; i < movesToTry; i++) {
        if (this.isTimeoutReached()) break;

        const ourMoveId = ourMoves[i];
        const ourSlot = battle[currentPlayer].active[0].moveSlots.findIndex(s => s.id === ourMoveId);
        if (ourSlot === -1) continue;
        const ourChoice = `move ${ourSlot + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
          if (this.isTimeoutReached()) break;

          const oppMoveId = oppMoves[j];
          const oppSlot = battle[oppPlayer].active[0].moveSlots.findIndex(s => s.id === oppMoveId);
          if (oppSlot === -1) continue;
          const oppChoice = `move ${oppSlot + 1}`;

          const p1Choice = currentPlayer === 'p1' ? ourChoice : oppChoice;
          const p2Choice = currentPlayer === 'p1' ? oppChoice : ourChoice;

          try {
            const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
            this.nodesThisPath++;

            const score = this.minimax(newBattle, oppChoice, depth - 1, alpha, beta, true);
            minScore = Math.min(minScore, score);

            if (minScore < beta) {
              beta = minScore;
              scoreFlag = 'exact';
            }

            if (beta <= alpha) {
              this.searchStats.alphaBetaPrunes++;
              scoreFlag = 'upperbound';

              if (this.useTranspositionTable) {
                this.simulator.ttStore(battle, depth, this.playerSide, minScore, scoreFlag);
              }

              return minScore;
            }
          } catch (error) {
            minScore = Math.min(minScore, 1000);
          }
        }
      }

      if (this.useTranspositionTable) {
        this.simulator.ttStore(battle, depth, this.playerSide, minScore, scoreFlag);
      }

      return minScore;
    }
  }

  printStats() {
    super.printStats();

    console.log('\nImproved Bot Features:');
    console.log(`  Time limit:             ${this.timeLimit}ms`);
    console.log(`  Timeouts reached:       ${this.improvedStats.timeouts}`);
    console.log(`  Opponent prediction:    ${this.useOpponentPrediction ? 'YES' : 'NO'}`);
    console.log(`  Opponent moves considered: ${this.opponentMovesConsider}`);
    console.log(`  Prediction calls:       ${this.improvedStats.opponentPredictions}`);
  }

  getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      improved: this.improvedStats
    };
  }
}

module.exports = ImprovedDepth6Bot;
