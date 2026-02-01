const EngineMoveSimulator = require('./EngineMoveSimulator');

/**
 * SimpleEngineBot - One-ply lookahead using @pkmn/sim
 *
 * Simplified version that does NOT do deep tree search, just evaluates
 * each move one turn ahead. This avoids triggering infinite loop detection.
 */
class SimpleEngineBot {
  constructor(playerName, options = {}) {
    this.name = playerName;
    this.simulator = new EngineMoveSimulator();
    this.battleInstance = null;
    this.playerSide = null;
    this.verbose = options.verbose || false;
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

    // Evaluate each move with ONE simulation (no deep search)
    const ourMoves = this.simulator.getAvailableMoves(this.battleInstance, this.playerSide);
    const oppSide = this.playerSide === 'p1' ? 'p2' : 'p1';
    const oppMoves = this.simulator.getAvailableMoves(this.battleInstance, oppSide);

    if (ourMoves.length === 0) {
      const switches = this.simulator.getAvailableSwitches(this.battleInstance, this.playerSide);
      return switches.length > 0 ? `switch ${switches[0]}` : 'default';
    }

    let bestChoice = 'move 1';
    let bestScore = -Infinity;

    // Try each of our moves against opponent's first move (simplification)
    for (let i = 0; i < ourMoves.length; i++) {
      const ourChoice = `move ${i + 1}`;
      const oppChoice = oppMoves.length > 0 ? 'move 1' : 'default';

      const p1Choice = this.playerSide === 'p1' ? ourChoice : oppChoice;
      const p2Choice = this.playerSide === 'p1' ? oppChoice : ourChoice;

      try {
        const newBattle = this.simulator.simulateTurn(this.battleInstance, p1Choice, p2Choice);
        const score = this.simulator.evaluateState(newBattle, this.playerSide);

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

    if (this.verbose) {
      console.log(`[${this.name}] Chose ${bestChoice} (score: ${bestScore.toFixed(2)})`);
    }

    return bestChoice;
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

module.exports = SimpleEngineBot;
