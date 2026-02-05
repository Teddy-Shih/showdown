const TranspositionMoveSimulator = require('./TranspositionMoveSimulator');

/**
 * OptimizedDepth4Bot - Depth 4 search with transposition tables and move ordering
 *
 * Optimizations:
 * 1. Transposition tables to avoid re-evaluating identical positions
 * 2. Move ordering to improve alpha-beta pruning efficiency
 * 3. Better state hashing that includes boosts, status, hazards
 *
 * Expected improvements over Depth4SearchBot:
 * - 30-50% reduction in nodes explored (via move ordering)
 * - 20-40% faster execution (via transposition tables)
 */
class OptimizedDepth4Bot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new TranspositionMoveSimulator({
      maxTableSize: options.maxTableSize || 10000
    });
    this.battleInstance = null;
    this.playerSide = null;
    this.verbose = options.verbose || false;
    this.maxMovesToConsider = options.maxMovesToConsider || 3;
    this.maxDepth = options.maxDepth || 4;
    this.useTranspositionTable = options.useTranspositionTable !== false;
    this.useMoveOrdering = options.useMoveOrdering !== false;

    this.searchStats = {
      totalSearchTime: 0,
      searchCalls: 0,
      nodesExplored: 0,
      ttCutoffs: 0,
      alphaBetaPrunes: 0
    };
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

    const startTime = performance.now();
    const bestMove = this.searchBestMove();
    const searchTime = performance.now() - startTime;

    this.searchStats.totalSearchTime += searchTime;
    this.searchStats.searchCalls++;

    if (this.verbose) {
      const stats = this.simulator.getStats();
      console.log(`[${this.name}] Depth ${this.maxDepth}: ${searchTime.toFixed(2)}ms, chose: ${bestMove.choice}, score: ${bestMove.score.toFixed(2)}`);
      console.log(`  Nodes: ${bestMove.nodesExplored}, TT hits: ${stats.ttHits}, TT cutoffs: ${this.searchStats.ttCutoffs}, Prunes: ${this.searchStats.alphaBetaPrunes}`);
    }

    return bestMove.choice;
  }

  searchBestMove() {
    let ourMoves = this.simulator.getAvailableMoves(this.battleInstance, this.playerSide);

    if (ourMoves.length === 0) {
      const switches = this.simulator.getAvailableSwitches(this.battleInstance, this.playerSide);
      return {
        choice: switches.length > 0 ? `switch ${switches[0]}` : 'default',
        score: 0,
        nodesExplored: 0
      };
    }

    // Apply move ordering at root
    if (this.useMoveOrdering) {
      ourMoves = this.simulator.orderMoves(this.battleInstance, this.playerSide, ourMoves);
    }

    let bestChoice = 'move 1';
    let bestScore = -Infinity;
    let totalNodes = 0;
    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);

    // Try each move
    for (let i = 0; i < movesToTry; i++) {
      const moveId = ourMoves[i];

      // Find the actual slot number for this move
      const side = this.battleInstance[this.playerSide];
      const active = side.active[0];
      const slotIndex = active.moveSlots.findIndex(slot => slot.id === moveId);

      if (slotIndex === -1) continue;

      const ourChoice = `move ${slotIndex + 1}`;

      try {
        this.nodesThisPath = 0;
        this.searchStats.ttCutoffs = 0;
        this.searchStats.alphaBetaPrunes = 0;

        const score = this.minimax(
          this.battleInstance,
          ourChoice,
          this.maxDepth - 1,
          -Infinity,
          Infinity,
          false
        );

        totalNodes += this.nodesThisPath;

        if (score > bestScore) {
          bestScore = score;
          bestChoice = ourChoice;
        }
      } catch (error) {
        if (this.verbose) {
          console.log(`[${this.name}] Error evaluating ${ourChoice}: ${error.message}`);
        }
      }
    }

    this.searchStats.nodesExplored += totalNodes;

    return {
      choice: bestChoice,
      score: bestScore,
      nodesExplored: totalNodes
    };
  }

  minimax(battle, lastChoice, depth, alpha, beta, maximizing) {
    // Check transposition table first
    if (this.useTranspositionTable && depth > 0) {
      const ttEntry = this.simulator.ttLookup(battle, depth, this.playerSide);
      if (ttEntry) {
        // TT hit - can we use this score?
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

      // Store in transposition table
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
      const score = this.simulator.evaluateState(battle, this.playerSide);
      return score;
    }

    // Apply move ordering
    if (this.useMoveOrdering) {
      ourMoves = this.simulator.orderMoves(battle, currentPlayer, ourMoves);
      oppMoves = this.simulator.orderMoves(battle, oppPlayer, oppMoves);
    }

    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);
    const oppMovesToTry = Math.min(oppMoves.length, this.maxMovesToConsider);

    let scoreFlag = 'upperbound'; // Assume all moves will fail high

    if (maximizing) {
      let maxScore = -Infinity;

      for (let i = 0; i < movesToTry; i++) {
        const ourMoveId = ourMoves[i];
        const ourSlot = battle[currentPlayer].active[0].moveSlots.findIndex(s => s.id === ourMoveId);
        if (ourSlot === -1) continue;
        const ourChoice = `move ${ourSlot + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
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

              // Store in TT before cutoff
              if (this.useTranspositionTable) {
                this.simulator.ttStore(battle, depth, this.playerSide, maxScore, scoreFlag);
              }

              return maxScore; // Beta cutoff
            }
          } catch (error) {
            maxScore = Math.max(maxScore, -1000);
          }
        }
      }

      // Store in transposition table
      if (this.useTranspositionTable) {
        this.simulator.ttStore(battle, depth, this.playerSide, maxScore, scoreFlag);
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (let i = 0; i < movesToTry; i++) {
        const ourMoveId = ourMoves[i];
        const ourSlot = battle[currentPlayer].active[0].moveSlots.findIndex(s => s.id === ourMoveId);
        if (ourSlot === -1) continue;
        const ourChoice = `move ${ourSlot + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
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

              // Store in TT before cutoff
              if (this.useTranspositionTable) {
                this.simulator.ttStore(battle, depth, this.playerSide, minScore, scoreFlag);
              }

              return minScore; // Alpha cutoff
            }
          } catch (error) {
            minScore = Math.min(minScore, 1000);
          }
        }
      }

      // Store in transposition table
      if (this.useTranspositionTable) {
        this.simulator.ttStore(battle, depth, this.playerSide, minScore, scoreFlag);
      }

      return minScore;
    }
  }

  chooseBestSwitch(request) {
    if (!this.battleInstance) {
      // Fallback to simple logic if no battle instance
      const alivePokemon = request.side.pokemon
        .map((p, idx) => ({ pokemon: p, slot: idx + 1 }))
        .filter(({ pokemon }) => !pokemon.active && pokemon.condition !== '0 fnt');

      return alivePokemon.length > 0 ? `switch ${alivePokemon[0].slot}` : 'default';
    }

    // Use minimax search to find best switch
    const switches = this.simulator.getAvailableSwitches(this.battleInstance, this.playerSide);

    if (switches.length === 0) {
      return 'default';
    }

    if (switches.length === 1) {
      return `switch ${switches[0]}`;
    }

    // Evaluate each switch option using limited-depth minimax
    let bestSwitch = switches[0];
    let bestScore = -Infinity;
    const switchSearchDepth = Math.min(2, this.maxDepth - 1); // Shallower search for switches

    if (this.verbose) {
      console.log(`[${this.name}] Evaluating ${switches.length} switch options...`);
    }

    for (const switchSlot of switches) {
      const switchChoice = `switch ${switchSlot}`;

      try {
        this.nodesThisPath = 0;

        // Simulate the switch and evaluate resulting position
        // We need to estimate opponent's move - try most damaging move
        const oppMoves = this.simulator.getAvailableMoves(this.battleInstance,
          this.playerSide === 'p1' ? 'p2' : 'p1');

        if (oppMoves.length === 0) {
          // If opponent has no moves, just evaluate the switch directly
          const p1Choice = this.playerSide === 'p1' ? switchChoice : 'move 1';
          const p2Choice = this.playerSide === 'p1' ? 'move 1' : switchChoice;

          const newBattle = this.simulator.simulateTurn(this.battleInstance, p1Choice, p2Choice);
          const score = this.simulator.evaluateState(newBattle, this.playerSide);

          if (score > bestScore) {
            bestScore = score;
            bestSwitch = switchSlot;
          }
          continue;
        }

        // Order opponent moves to try most threatening first
        let orderedOppMoves = oppMoves;
        if (this.useMoveOrdering) {
          orderedOppMoves = this.simulator.orderMoves(
            this.battleInstance,
            this.playerSide === 'p1' ? 'p2' : 'p1',
            oppMoves
          );
        }

        // Evaluate against top 3 opponent moves (pessimistic assumption)
        const movesToConsider = Math.min(3, orderedOppMoves.length);
        let minScoreAgainstOpp = Infinity;

        for (let i = 0; i < movesToConsider; i++) {
          const oppMoveId = orderedOppMoves[i];
          const oppSide = this.battleInstance[this.playerSide === 'p1' ? 'p2' : 'p1'];
          const oppActive = oppSide.active[0];
          const oppSlot = oppActive.moveSlots.findIndex(s => s.id === oppMoveId);

          if (oppSlot === -1) continue;

          const oppChoice = `move ${oppSlot + 1}`;
          const p1Choice = this.playerSide === 'p1' ? switchChoice : oppChoice;
          const p2Choice = this.playerSide === 'p1' ? oppChoice : switchChoice;

          try {
            const newBattle = this.simulator.simulateTurn(this.battleInstance, p1Choice, p2Choice);

            // Run shallow minimax from the switched position
            const score = this.minimax(newBattle, oppChoice, switchSearchDepth, -Infinity, Infinity, true);
            minScoreAgainstOpp = Math.min(minScoreAgainstOpp, score);
          } catch (error) {
            // If simulation fails, assign penalty
            minScoreAgainstOpp = Math.min(minScoreAgainstOpp, -500);
          }
        }

        if (this.verbose) {
          console.log(`  switch ${switchSlot}: score ${minScoreAgainstOpp.toFixed(1)}`);
        }

        // Use the worst-case score (pessimistic)
        if (minScoreAgainstOpp > bestScore) {
          bestScore = minScoreAgainstOpp;
          bestSwitch = switchSlot;
        }

      } catch (error) {
        if (this.verbose) {
          console.log(`[${this.name}] Error evaluating switch ${switchSlot}: ${error.message}`);
        }
      }
    }

    if (this.verbose) {
      console.log(`[${this.name}] Best switch: ${bestSwitch} (score: ${bestScore.toFixed(1)})`);
    }

    return `switch ${bestSwitch}`;
  }

  fallbackChoice(request) {
    const active = request.active[0];
    if (!active || !active.moves) return 'move 1';

    for (let i = 0; i < active.moves.length; i++) {
      if (!active.moves[i].disabled && active.moves[i].pp > 0) {
        return `move ${i + 1}`;
      }
    }
    return 'move 1';
  }

  getStats() {
    return {
      search: {
        ...this.searchStats,
        avgSearchTime: this.searchStats.searchCalls > 0
          ? this.searchStats.totalSearchTime / this.searchStats.searchCalls
          : 0,
        avgNodesExplored: this.searchStats.searchCalls > 0
          ? this.searchStats.nodesExplored / this.searchStats.searchCalls
          : 0
      },
      simulator: this.simulator.getStats()
    };
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log(`OPTIMIZED DEPTH ${this.maxDepth} BOT STATISTICS - ${this.name}`);
    console.log('='.repeat(70));

    console.log('\nOptimizations Enabled:');
    console.log(`  Transposition tables: ${this.useTranspositionTable ? 'YES' : 'NO'}`);
    console.log(`  Move ordering:        ${this.useMoveOrdering ? 'YES' : 'NO'}`);

    console.log('\nSearch Statistics:');
    console.log(`  Total searches:         ${stats.search.searchCalls}`);
    console.log(`  Total search time:      ${stats.search.totalSearchTime.toFixed(2)}ms`);
    console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);
    console.log(`  Total nodes explored:   ${stats.search.nodesExplored}`);
    console.log(`  Avg nodes per search:   ${stats.search.avgNodesExplored.toFixed(1)}`);
    console.log(`  TT cutoffs:             ${stats.search.ttCutoffs}`);
    console.log(`  Alpha-beta prunes:      ${stats.search.alphaBetaPrunes}`);

    this.simulator.printStats();
  }
}

module.exports = OptimizedDepth4Bot;
