const { Dex } = require('@pkmn/sim');
const MoveSimulator = require('./MoveSimulator');

/**
 * StatefulTreeSearchBot - Tree search with opponent state tracking
 * Tracks opponent Pokemon from battle messages
 */
class StatefulTreeSearchBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.simulator = new MoveSimulator();
    this.searchDepth = 2;

    // Track opponent state
    this.opponentActive = null;
    this.opponentTeam = [];
    this.seenOpponentPokemon = new Set();
  }

  /**
   * Process battle message to track opponent state
   */
  processBattleMessage(message) {
    const lines = message.split('\n');
    for (const line of lines) {
      // Track opponent switch-ins
      if (line.includes('|switch|') || line.includes('|drag|')) {
        this.processSwitch(line);
      }
      // Track damage to infer HP
      if (line.includes('|-damage|')) {
        this.processDamage(line);
      }
      // Track revealed moves
      if (line.includes('|move|')) {
        this.processMove(line);
      }
    }
  }

  /**
   * Process switch message
   */
  processSwitch(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    // Check if this is opponent (p2 if we're p1, vice versa)
    if (!this.isOpponent(playerSlot)) return;

    const pokemonInfo = parts[3];
    const speciesName = pokemonInfo.split(',')[0].trim();
    const hpInfo = parts[4];

    // Extract HP
    const hp = this.parseHP(hpInfo);

    // Create or update opponent Pokemon
    this.opponentActive = {
      species: speciesName,
      types: this.dex.species.get(speciesName).types,
      hp: hp.current,
      maxHP: hp.max,
      hpPercent: hp.percent,
      status: hp.status,
      stats: this.estimateStats(speciesName, 100),
      boosts: {},
      moves: new Set(),
      item: null,
      ability: null,
      level: 100
    };

    this.seenOpponentPokemon.add(speciesName);

    // Add to team if not already there
    if (!this.opponentTeam.find(p => p.species === speciesName)) {
      this.opponentTeam.push({ ...this.opponentActive });
    }
  }

  /**
   * Process move message
   */
  processMove(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    const moveName = parts[3];

    if (this.isOpponent(playerSlot) && this.opponentActive) {
      this.opponentActive.moves.add(moveName.toLowerCase());
    }
  }

  /**
   * Process damage message
   */
  processDamage(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const target = parts[2];
    const newHP = parts[3];

    if (this.isOpponent(target) && this.opponentActive) {
      const hp = this.parseHP(newHP);
      this.opponentActive.hp = hp.current;
      this.opponentActive.maxHP = hp.max;
      this.opponentActive.hpPercent = hp.percent;
    }
  }

  /**
   * Check if a player slot is the opponent
   */
  isOpponent(playerSlot) {
    // If we haven't determined our side yet, guess
    if (!this.playerSide) {
      // This will be set when we first see ourselves
      return !playerSlot.includes(this.name);
    }
    return !playerSlot.includes(this.playerSide);
  }

  /**
   * Parse HP from string
   */
  parseHP(hpString) {
    if (!hpString) return { current: 100, max: 100, percent: 1, status: null };

    const parts = hpString.trim().split(' ');
    const hpPart = parts[0];
    const status = parts[1] || null;

    if (hpPart.includes('/')) {
      const [current, max] = hpPart.split('/').map(n => parseInt(n));
      return { current, max, percent: current / max, status };
    } else {
      // Percentage format
      const percent = parseInt(hpPart) / 100;
      return { current: percent * 100, max: 100, percent, status };
    }
  }

  /**
   * Estimate stats for a Pokemon
   */
  estimateStats(speciesName, level) {
    const species = this.dex.species.get(speciesName);
    const stats = {};

    for (const stat in species.baseStats) {
      const base = species.baseStats[stat];
      if (stat === 'hp') {
        stats[stat] = Math.floor((2 * base + 31 + 63) * level / 100) + level + 10;
      } else {
        stats[stat] = Math.floor((2 * base + 31 + 63) * level / 100) + 5;
      }
    }

    return stats;
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

    // If we don't have opponent info yet, use simple strategy
    if (!this.opponentActive || this.opponentActive.moves.size === 0) {
      return this.fallbackChoice(active);
    }

    // Run minimax search
    const bestMove = this.searchBestMove(request, active.moves);

    return `move ${bestMove.slot}`;
  }

  /**
   * Search for best move using minimax
   */
  searchBestMove(request, availableMoves) {
    let bestMove = null;
    let bestScore = -Infinity;

    const ourPokemon = request.side.pokemon.find(p => p.active);
    const oppMoves = Array.from(this.opponentActive.moves);

    // Try each of our moves
    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];

      if (move.disabled || move.pp === 0) {
        continue;
      }

      // Evaluate against each opponent move
      let minScore = Infinity;

      for (const oppMoveName of oppMoves) {
        const score = this.evaluateMoveExchange(
          ourPokemon,
          this.opponentActive,
          move,
          oppMoveName
        );

        minScore = Math.min(minScore, score);
      }

      // If opponent has no known moves, evaluate without opponent response
      if (oppMoves.length === 0) {
        minScore = this.evaluateMoveAlone(ourPokemon, this.opponentActive, move);
      }

      if (minScore > bestScore) {
        bestScore = minScore;
        bestMove = { slot: i + 1, move: move.move, score: minScore };
      }
    }

    // Fallback
    if (!bestMove) {
      return { slot: 1, move: availableMoves[0].move, score: 0 };
    }

    return bestMove;
  }

  /**
   * Evaluate a move exchange (our move vs opponent's move)
   */
  evaluateMoveExchange(ourPokemon, oppPokemon, ourMove, oppMoveName) {
    // Calculate damage we deal
    const ourMoveData = this.dex.moves.get(ourMove.id);
    const ourDamage = this.estimateDamage(ourPokemon, oppPokemon, ourMoveData);

    // Calculate damage we take
    const oppMoveData = this.dex.moves.get(oppMoveName);
    const oppDamage = this.estimateDamage(oppPokemon, ourPokemon, oppMoveData);

    // Simple evaluation: damage dealt - damage taken
    // Bonus if we KO
    let score = ourDamage - oppDamage;

    if (ourDamage >= oppPokemon.hp) {
      score += 200; // KO bonus
    }

    if (oppDamage >= this.parseHP(ourPokemon.condition).current) {
      score -= 200; // Getting KO'd is bad
    }

    return score;
  }

  /**
   * Evaluate move without opponent response
   */
  evaluateMoveAlone(ourPokemon, oppPokemon, ourMove) {
    const moveData = this.dex.moves.get(ourMove.id);
    const damage = this.estimateDamage(ourPokemon, oppPokemon, moveData);

    let score = damage;

    if (damage >= oppPokemon.hp) {
      score += 200;
    }

    return score;
  }

  /**
   * Estimate damage
   */
  estimateDamage(attacker, defender, move) {
    if (!move.basePower) return 0;

    // Get species data
    const attackerSpecies = this.dex.species.get(attacker.species || attacker.ident.split(':')[1].trim().split(',')[0]);
    const defenderSpecies = this.dex.species.get(defender.species);

    const attackStat = move.category === 'Physical' ?
      (attacker.stats.atk || 250) :
      (attacker.stats.spa || 250);
    const defenseStat = move.category === 'Physical' ?
      (defender.stats.def || 250) :
      (defender.stats.spd || 250);

    let damage = Math.floor(((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    // STAB
    if (attackerSpecies.types.includes(move.type)) {
      damage *= 1.5;
    }

    // Type effectiveness
    const effectiveness = this.getTypeEffectiveness(move.type, defenderSpecies.types);
    damage *= effectiveness;

    return Math.floor(damage);
  }

  /**
   * Get type effectiveness
   */
  getTypeEffectiveness(moveType, defenderTypes) {
    let multiplier = 1;
    for (const defenderType of defenderTypes) {
      const typeData = this.dex.types.get(moveType);
      if (typeData.damageTaken[defenderType] === 1) multiplier *= 2;
      if (typeData.damageTaken[defenderType] === 2) multiplier *= 0.5;
      if (typeData.damageTaken[defenderType] === 3) multiplier *= 0;
    }
    return multiplier;
  }

  /**
   * Fallback move choice
   */
  fallbackChoice(active) {
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

module.exports = StatefulTreeSearchBot;
