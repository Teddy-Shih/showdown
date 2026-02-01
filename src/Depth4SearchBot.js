const ProfiledEngineMoveSimulator = require('./ProfiledEngineMoveSimulator');

/**
 * Depth4SearchBot - 4-ply minimax search with engine simulation
 *
 * WARNING: This will be MUCH slower than FastTreeSearchBot (2-ply)
 * Branching: depth 2 = ~9 nodes, depth 4 = ~81 nodes (9x more!)
 */
class Depth4SearchBot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new ProfiledEngineMoveSimulator();
    this.battleInstance = null;
    this.playerSide = null;
    this.verbose = options.verbose || false;
    this.maxMovesToConsider = options.maxMovesToConsider || 3;
    this.maxDepth = options.maxDepth || 4;

    this.searchStats = {
      totalSearchTime: 0,
      searchCalls: 0,
      nodesExplored: 0
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
      console.log(`[${this.name}] Depth ${this.maxDepth}: ${searchTime.toFixed(2)}ms, chose: ${bestMove.choice}, score: ${bestMove.score.toFixed(2)}, nodes: ${bestMove.nodesExplored}`);
    }

    return bestMove.choice;
  }

  searchBestMove() {
    const ourMoves = this.simulator.getAvailableMoves(this.battleInstance, this.playerSide);

    if (ourMoves.length === 0) {
      const switches = this.simulator.getAvailableSwitches(this.battleInstance, this.playerSide);
      return {
        choice: switches.length > 0 ? `switch ${switches[0]}` : 'default',
        score: 0,
        nodesExplored: 0
      };
    }

    let bestChoice = 'move 1';
    let bestScore = -Infinity;
    let totalNodes = 0;

    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);

    for (let i = 0; i < movesToTry; i++) {
      const ourChoice = `move ${i + 1}`;

      try {
        this.nodesThisPath = 0;
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
    // Terminal conditions
    if (depth === 0 || battle.ended) {
      this.nodesThisPath++;
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    const currentPlayer = maximizing ? this.playerSide : (this.playerSide === 'p1' ? 'p2' : 'p1');
    const oppPlayer = maximizing ? (this.playerSide === 'p1' ? 'p2' : 'p1') : this.playerSide;

    const ourMoves = this.simulator.getAvailableMoves(battle, currentPlayer);
    const oppMoves = this.simulator.getAvailableMoves(battle, oppPlayer);

    if (ourMoves.length === 0 || oppMoves.length === 0) {
      this.nodesThisPath++;
      return this.simulator.evaluateState(battle, this.playerSide);
    }

    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);
    const oppMovesToTry = Math.min(oppMoves.length, this.maxMovesToConsider);

    if (maximizing) {
      let maxScore = -Infinity;

      for (let i = 0; i < movesToTry; i++) {
        const ourChoice = `move ${i + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
          const oppChoice = `move ${j + 1}`;

          const p1Choice = currentPlayer === 'p1' ? ourChoice : oppChoice;
          const p2Choice = currentPlayer === 'p1' ? oppChoice : ourChoice;

          try {
            const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
            this.nodesThisPath++;

            const score = this.minimax(newBattle, oppChoice, depth - 1, alpha, beta, false);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);

            if (beta <= alpha) {
              return maxScore; // Beta cutoff
            }
          } catch (error) {
            maxScore = Math.max(maxScore, -1000);
          }
        }
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (let i = 0; i < movesToTry; i++) {
        const ourChoice = `move ${i + 1}`;

        for (let j = 0; j < oppMovesToTry; j++) {
          const oppChoice = `move ${j + 1}`;

          const p1Choice = currentPlayer === 'p1' ? ourChoice : oppChoice;
          const p2Choice = currentPlayer === 'p1' ? oppChoice : ourChoice;

          try {
            const newBattle = this.simulator.simulateTurn(battle, p1Choice, p2Choice);
            this.nodesThisPath++;

            const score = this.minimax(newBattle, oppChoice, depth - 1, alpha, beta, true);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);

            if (beta <= alpha) {
              return minScore; // Alpha cutoff
            }
          } catch (error) {
            minScore = Math.min(minScore, 1000);
          }
        }
      }

      return minScore;
    }
  }

  chooseBestSwitch(request) {
    const alivePokemon = request.side.pokemon
      .map((p, idx) => ({ pokemon: p, slot: idx + 1 }))
      .filter(({ pokemon }) => !pokemon.active && pokemon.condition !== '0 fnt');

    return alivePokemon.length > 0 ? `switch ${alivePokemon[0].slot}` : 'default';
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
    console.log(`PROFILING STATISTICS - ${this.name} (Depth ${this.maxDepth})`);
    console.log('='.repeat(70));

    console.log('\nSearch Statistics:');
    console.log(`  Total searches:         ${stats.search.searchCalls}`);
    console.log(`  Total search time:      ${stats.search.totalSearchTime.toFixed(2)}ms`);
    console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);
    console.log(`  Total nodes explored:   ${stats.search.nodesExplored}`);
    console.log(`  Avg nodes per search:   ${stats.search.avgNodesExplored.toFixed(1)}`);

    this.simulator.printStats();
  }
}

module.exports = Depth4SearchBot;
