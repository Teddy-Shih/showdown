const ProfiledEngineMoveSimulator = require('./ProfiledEngineMoveSimulator');

/**
 * ProfiledFastTreeSearchBot - FastTreeSearchBot with detailed profiling
 */
class ProfiledFastTreeSearchBot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new ProfiledEngineMoveSimulator();
    this.battleInstance = null;
    this.playerSide = null;
    this.verbose = options.verbose || false;
    this.maxMovesToConsider = options.maxMovesToConsider || 3;

    // Additional profiling
    this.searchStats = {
      totalSearchTime: 0,
      searchCalls: 0,
      movesConsidered: 0,
      pathsExplored: 0
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
      console.log(`[${this.name}] Search: ${searchTime.toFixed(2)}ms, chose: ${bestMove.choice}, score: ${bestMove.score.toFixed(2)}, nodes: ${bestMove.nodesSearched}`);
    }

    return bestMove.choice;
  }

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

    const movesToTry = Math.min(ourMoves.length, this.maxMovesToConsider);
    const oppMovesToTry = Math.min(oppMoves.length, this.maxMovesToConsider);

    this.searchStats.movesConsidered += movesToTry;

    let bestChoice = 'move 1';
    let bestScore = -Infinity;
    let nodesSearched = 0;

    for (let i = 0; i < movesToTry; i++) {
      const ourChoice = `move ${i + 1}`;
      let worstCaseScore = Infinity;

      for (let j = 0; j < oppMovesToTry; j++) {
        const oppChoice = `move ${j + 1}`;

        const p1Choice = this.playerSide === 'p1' ? ourChoice : oppChoice;
        const p2Choice = this.playerSide === 'p1' ? oppChoice : ourChoice;

        try {
          const afterTurn1 = this.simulator.simulateTurn(this.battleInstance, p1Choice, p2Choice);
          nodesSearched++;
          this.searchStats.pathsExplored++;

          if (afterTurn1.ended) {
            const score = this.simulator.evaluateState(afterTurn1, this.playerSide);
            worstCaseScore = Math.min(worstCaseScore, score);
            continue;
          }

          const score = this.simulator.evaluateState(afterTurn1, this.playerSide);
          worstCaseScore = Math.min(worstCaseScore, score);

        } catch (error) {
          worstCaseScore = Math.min(worstCaseScore, -1000);
        }
      }

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

  getStats() {
    return {
      search: {
        ...this.searchStats,
        avgSearchTime: this.searchStats.searchCalls > 0
          ? this.searchStats.totalSearchTime / this.searchStats.searchCalls
          : 0,
        avgMovesConsidered: this.searchStats.searchCalls > 0
          ? this.searchStats.movesConsidered / this.searchStats.searchCalls
          : 0,
        avgPathsExplored: this.searchStats.searchCalls > 0
          ? this.searchStats.pathsExplored / this.searchStats.searchCalls
          : 0
      },
      simulator: this.simulator.getStats()
    };
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log(`PROFILING STATISTICS - ${this.name}`);
    console.log('='.repeat(70));

    console.log('\nSearch Statistics:');
    console.log(`  Total searches:         ${stats.search.searchCalls}`);
    console.log(`  Total search time:      ${stats.search.totalSearchTime.toFixed(2)}ms`);
    console.log(`  Avg search time:        ${stats.search.avgSearchTime.toFixed(2)}ms`);
    console.log(`  Avg moves considered:   ${stats.search.avgMovesConsidered.toFixed(1)}`);
    console.log(`  Avg paths explored:     ${stats.search.avgPathsExplored.toFixed(1)}`);

    this.simulator.printStats();
  }
}

module.exports = ProfiledFastTreeSearchBot;
