const { Dex } = require('@pkmn/sim');
const GameState = require('./GameState');
const MoveSimulator = require('./MoveSimulator');

/**
 * TreeSearchBot - Uses minimax tree search with opponent simulation
 */
class TreeSearchBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.simulator = new MoveSimulator();
    this.opponentPokemon = {}; // Track revealed opponent Pokemon
    this.searchDepth = 2; // 2-ply search (our move + opponent response)
  }

  chooseMove(request) {
    // Safety check
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    // Handle force switch
    if (request.forceSwitch) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
      return 'default';
    }

    // Get available moves
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'default';
    }

    // Get our active Pokemon
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'default';
    }

    // Build game state
    const state = this.buildGameState(request);

    // If we don't have opponent info yet, fall back to simple strategy
    if (!state.oppActive) {
      return this.fallbackChoice(active, ourPokemon);
    }

    // Run minimax search
    const bestMove = this.searchBestMove(state, active.moves);

    return `move ${bestMove.slot}`;
  }

  /**
   * Build GameState from request, incorporating tracked opponent info
   */
  buildGameState(request) {
    const state = new GameState(request);

    // Try to extract opponent info from request
    // The request doesn't directly give us opponent team, so we estimate
    if (request.side && request.side.pokemon) {
      // Get our active Pokemon details
      const ourActive = request.side.pokemon.find(p => p.active);
      if (ourActive) {
        // Estimate opponent from battle context
        // In a real battle, we'd track this from battle logs
        // For now, create a placeholder opponent
        state.oppActive = this.createPlaceholderOpponent();
        state.oppTeam = [state.oppActive];
        state.oppMoves = this.estimateOpponentMoves(state.oppActive);
      }
    }

    return state;
  }

  /**
   * Create placeholder opponent (will be improved with battle log tracking)
   */
  createPlaceholderOpponent() {
    // This is a limitation - we need opponent info
    // In practice, we'd track this from battle messages
    // For now, create a generic bulky opponent
    return {
      species: 'Blissey',
      types: ['Normal'],
      active: true,
      hp: 700,
      maxHP: 700,
      status: null,
      stats: { hp: 700, atk: 50, def: 50, spa: 135, spd: 135, spe: 75 },
      boosts: {},
      item: null,
      ability: 'Natural Cure',
      level: 100,
      moves: ['seismictoss', 'softboiled', 'toxic', 'stealthrock'],
      position: 0
    };
  }

  /**
   * Estimate opponent's likely moves based on species
   */
  estimateOpponentMoves(pokemon) {
    // In a real implementation, we'd use common sets from Smogon
    // For now, assume they have their species' strong moves
    // For simplicity, assume 4 common competitive moves
    return pokemon.moves.map(m => ({ id: m, move: m, pp: 16, maxpp: 16, disabled: false }));
  }

  /**
   * Search for best move using minimax
   */
  searchBestMove(state, availableMoves) {
    let bestMove = null;
    let bestScore = -Infinity;

    // Try each of our moves
    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];

      if (move.disabled || move.pp === 0) {
        continue;
      }

      // Evaluate this move with minimax
      const score = this.minimax(state, move, 1, -Infinity, Infinity, false);

      if (score > bestScore) {
        bestScore = score;
        bestMove = { slot: i + 1, move: move.move, score };
      }
    }

    // Fallback if no move found
    if (!bestMove) {
      return { slot: 1, move: availableMoves[0].move, score: 0 };
    }

    return bestMove;
  }

  /**
   * Minimax algorithm with alpha-beta pruning
   * @param {GameState} state - Current game state
   * @param {object} ourMove - Our move choice
   * @param {number} depth - Current search depth
   * @param {number} alpha - Alpha value for pruning
   * @param {number} beta - Beta value for pruning
   * @param {boolean} maximizing - Whether this is a maximizing node
   */
  minimax(state, ourMove, depth, alpha, beta, maximizing) {
    // If we've reached max depth or terminal state, evaluate
    if (depth >= this.searchDepth || state.isTerminal()) {
      return state.getScore();
    }

    if (maximizing) {
      // Our turn - maximize score
      let maxScore = -Infinity;

      // Try each of our moves
      for (const move of state.ourMoves) {
        if (move.disabled) continue;

        // For each opponent response, simulate
        for (const oppMove of state.oppMoves) {
          const newState = this.simulator.simulateTurn(state, move, oppMove);
          const score = this.minimax(newState, oppMove, depth + 1, alpha, beta, false);

          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);

          if (beta <= alpha) {
            break; // Beta cutoff
          }
        }
      }

      return maxScore;
    } else {
      // Opponent's turn - minimize our score (maximize opponent's score)
      let minScore = Infinity;

      // Opponent will try each of their moves
      for (const oppMove of state.oppMoves) {
        // Simulate this opponent move against our previous move
        const newState = this.simulator.simulateTurn(state, ourMove, oppMove);
        const score = newState.getScore();

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);

        if (beta <= alpha) {
          break; // Alpha cutoff
        }
      }

      return minScore;
    }
  }

  /**
   * Fallback move choice when we don't have enough info
   */
  fallbackChoice(active, ourPokemon) {
    let bestSlot = 1;
    let bestPower = 0;

    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];
      if (moveData.disabled || moveData.pp === 0) continue;

      const move = this.dex.moves.get(moveData.id);
      const power = move.basePower || 0;

      if (power > bestPower) {
        bestPower = power;
        bestSlot = i + 1;
      }
    }

    return `move ${bestSlot}`;
  }

  /**
   * Get available switches
   */
  getAvailableSwitches(request) {
    const switches = [];
    const team = request.side.pokemon;

    for (let i = 0; i < team.length; i++) {
      const pokemon = team[i];
      if (!pokemon.active && pokemon.condition !== '0 fnt') {
        switches.push(i + 1);
      }
    }

    return switches;
  }
}

module.exports = TreeSearchBot;
