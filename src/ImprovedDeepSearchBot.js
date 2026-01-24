const { Dex } = require('@pkmn/sim');

/**
 * ImprovedDeepSearchBot - DeepSearchBot with critical fixes
 * Fixes:
 * 1. Better opponent tracking from turn 1 (infer from switch-in)
 * 2. Loop detection to avoid move spamming
 * 3. Guaranteed search execution
 * 4. Progress-aware evaluation
 */
class ImprovedDeepSearchBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.searchDepth = 4;

    // Track opponent state
    this.opponentActive = null;
    this.opponentTeam = [];
    this.seenOpponentPokemon = new Set();

    // Performance tracking
    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    // Loop detection
    this.moveHistory = [];
    this.maxHistorySize = 5;
  }

  processBattleMessage(message) {
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.includes('|switch|') || line.includes('|drag|')) {
        this.processSwitch(line);
      }
      if (line.includes('|-damage|')) {
        this.processDamage(line);
      }
      if (line.includes('|move|')) {
        this.processMove(line);
      }
    }
  }

  processSwitch(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    if (!this.isOpponent(playerSlot)) return;

    const pokemonInfo = parts[3];
    const speciesName = pokemonInfo.split(',')[0].trim();
    const hpInfo = parts[4];
    const hp = this.parseHP(hpInfo);

    // FIX 1: Create opponent with estimated moveset immediately
    const species = this.dex.species.get(speciesName);
    const estimatedMoves = this.estimateCommonMoves(species);

    this.opponentActive = {
      species: speciesName,
      types: species.types,
      hp: hp.current,
      maxHP: hp.max,
      hpPercent: hp.percent,
      status: hp.status,
      stats: this.estimateStats(speciesName, 100),
      boosts: {},
      moves: new Set(estimatedMoves), // Start with estimated moves
      item: null,
      ability: null,
      level: 100
    };

    this.seenOpponentPokemon.add(speciesName);

    if (!this.opponentTeam.find(p => p.species === speciesName)) {
      this.opponentTeam.push({ ...this.opponentActive });
    }
  }

  /**
   * FIX 1: Estimate common moves for a species
   */
  estimateCommonMoves(species) {
    // For now, assume 4 attacking moves based on stats
    const moves = [];

    // Physical attacker
    if (species.baseStats.atk > species.baseStats.spa) {
      moves.push('tackle', 'bodyslam', 'earthquake', 'stoneedge');
    }
    // Special attacker
    else {
      moves.push('thunderbolt', 'icebeam', 'fireblast', 'hydropump');
    }

    return moves.slice(0, 4);
  }

  processMove(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    const moveName = parts[3];

    if (this.isOpponent(playerSlot) && this.opponentActive) {
      // Replace estimated moves with actual revealed moves
      this.opponentActive.moves.add(moveName.toLowerCase());
    }
  }

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
      if (hp.status) this.opponentActive.status = hp.status;
    }
  }

  isOpponent(playerSlot) {
    if (!this.playerSide) {
      return !playerSlot.includes(this.name);
    }
    return !playerSlot.includes(this.playerSide);
  }

  parseHP(hpString) {
    if (!hpString) return { current: 100, max: 100, percent: 1, status: null };

    const parts = hpString.trim().split(' ');
    const hpPart = parts[0];
    const status = parts[1] || null;

    if (hpPart.includes('/')) {
      const [current, max] = hpPart.split('/').map(n => parseInt(n));
      return { current, max, percent: current / max, status };
    } else {
      const percent = parseInt(hpPart) / 100;
      return { current: percent * 100, max: 100, percent, status };
    }
  }

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
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    if (request.forceSwitch) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
      return 'default';
    }

    const active = request.active[0];
    if (!active || !active.moves) {
      return 'default';
    }

    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'default';
    }

    // FIX 3: Always have opponent info (estimated or actual)
    if (!this.opponentActive) {
      return this.fallbackChoice(active);
    }

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    const ourHP = this.parseHP(ourPokemon.condition).current;
    const oppHP = this.opponentActive.hp;

    const bestMove = this.searchBestMove(request, active.moves, ourPokemon, ourHP, oppHP);

    // FIX 2: Check for loops and penalize repeated moves
    const moveChoice = `move ${bestMove.slot}`;
    this.moveHistory.push(moveChoice);
    if (this.moveHistory.length > this.maxHistorySize) {
      this.moveHistory.shift();
    }

    // If we've used same move 3+ times in a row, try something different
    if (this.isInLoop(moveChoice)) {
      const alternativeMove = this.findAlternativeMove(active.moves, bestMove.slot);
      if (alternativeMove) {
        return `move ${alternativeMove}`;
      }
    }

    return moveChoice;
  }

  /**
   * FIX 2: Detect if we're in a loop
   */
  isInLoop(currentMove) {
    if (this.moveHistory.length < 3) return false;

    const last3 = this.moveHistory.slice(-3);
    return last3.every(m => m === currentMove);
  }

  /**
   * FIX 2: Find an alternative move when stuck in loop
   */
  findAlternativeMove(availableMoves, currentSlot) {
    for (let i = 0; i < availableMoves.length; i++) {
      const slot = i + 1;
      const move = availableMoves[i];

      if (slot !== currentSlot && !move.disabled && move.pp > 0) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Order moves for better pruning
   */
  orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
    const moveScores = [];

    for (const move of moves) {
      const moveData = this.dex.moves.get(move.id);
      const damage = this.calculateDamage(ourPokemon, oppPokemon, moveData);

      let orderScore = 0;

      if (damage >= oppHP) {
        orderScore = 100000 + damage;
      } else if (damage > 0) {
        orderScore = 10000 + damage;
      } else {
        orderScore = moveData.basePower || 0;
      }

      moveScores.push({ move, score: orderScore });
    }

    moveScores.sort((a, b) => b.score - a.score);
    return moveScores.map(ms => ms.move);
  }

  searchBestMove(request, availableMoves, ourPokemon, ourHP, oppHP) {
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    const ourMoveList = availableMoves.filter(m => !m.disabled && m.pp > 0);

    // FIX 3: Ensure we have moves to search
    if (ourMoveList.length === 0) {
      return { slot: 1, move: 'struggle', score: 0 };
    }

    const oppMoveList = Array.from(this.opponentActive.moves);

    const orderedMoves = this.orderMoves(ourMoveList, ourPokemon, this.opponentActive, oppHP);

    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];
      if (move.disabled || move.pp === 0) continue;

      const moveData = this.dex.moves.get(move.id);

      const score = this.minimaxDepth(
        ourPokemon, ourHP,
        this.opponentActive, oppHP,
        orderedMoves, oppMoveList,
        moveData, null,
        1, alpha, beta, false
      );

      if (score > bestScore) {
        bestScore = score;
        bestMove = { slot: i + 1, move: move.move, score };
      }

      alpha = Math.max(alpha, score);

      if (beta <= alpha) {
        this.pruneCount++;
        break;
      }
    }

    if (!bestMove) {
      return { slot: 1, move: availableMoves[0].move, score: 0 };
    }

    return bestMove;
  }

  minimaxDepth(ourPokemon, ourHP, oppPokemon, oppHP, ourMoves, oppMoves, ourLastMove, oppLastMove, depth, alpha, beta, maximizing) {
    this.nodesEvaluated++;

    if (depth >= this.searchDepth) {
      return this.evaluatePosition(ourHP, oppHP);
    }

    if (ourHP <= 0 || oppHP <= 0) {
      return this.evaluatePosition(ourHP, oppHP);
    }

    if (maximizing) {
      let maxScore = -Infinity;

      const orderedOurMoves = this.orderMoves(ourMoves, ourPokemon, oppPokemon, oppHP);

      for (const move of orderedOurMoves) {
        const moveData = this.dex.moves.get(move.id);

        for (const oppMoveName of oppMoves) {
          const oppMoveData = this.dex.moves.get(oppMoveName);

          const [newOurHP, newOppHP] = this.simulateExchange(
            ourPokemon, ourHP, moveData,
            oppPokemon, oppHP, oppMoveData
          );

          const score = this.minimaxDepth(
            ourPokemon, newOurHP,
            oppPokemon, newOppHP,
            ourMoves, oppMoves,
            moveData, oppMoveData,
            depth + 1, alpha, beta, false
          );

          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);

          if (beta <= alpha) {
            this.pruneCount++;
            return maxScore;
          }
        }
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (const oppMoveName of oppMoves) {
        const oppMoveData = this.dex.moves.get(oppMoveName);

        const orderedOurMoves = this.orderMoves(ourMoves, ourPokemon, oppPokemon, oppHP);

        for (const move of orderedOurMoves) {
          const moveData = this.dex.moves.get(move.id);

          const [newOurHP, newOppHP] = this.simulateExchange(
            ourPokemon, ourHP, moveData,
            oppPokemon, oppHP, oppMoveData
          );

          const score = this.minimaxDepth(
            ourPokemon, newOurHP,
            oppPokemon, newOppHP,
            ourMoves, oppMoves,
            moveData, oppMoveData,
            depth + 1, alpha, beta, true
          );

          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);

          if (beta <= alpha) {
            this.pruneCount++;
            return minScore;
          }
        }
      }

      return minScore;
    }
  }

  simulateExchange(ourPokemon, ourHP, ourMove, oppPokemon, oppHP, oppMove) {
    let newOurHP = ourHP;
    let newOppHP = oppHP;

    const ourSpeed = this.getSpeed(ourPokemon);
    const oppSpeed = oppPokemon.stats.spe;

    let firstIsOurs = ourSpeed >= oppSpeed;

    if (firstIsOurs) {
      const damage = this.calculateDamage(ourPokemon, oppPokemon, ourMove);
      newOppHP -= damage;
      if (newOppHP <= 0) return [newOurHP, Math.max(0, newOppHP)];

      const oppDamage = this.calculateDamage(oppPokemon, ourPokemon, oppMove);
      newOurHP -= oppDamage;
    } else {
      const oppDamage = this.calculateDamage(oppPokemon, ourPokemon, oppMove);
      newOurHP -= oppDamage;
      if (newOurHP <= 0) return [Math.max(0, newOurHP), newOppHP];

      const damage = this.calculateDamage(ourPokemon, oppPokemon, ourMove);
      newOppHP -= damage;
    }

    return [Math.max(0, newOurHP), Math.max(0, newOppHP)];
  }

  /**
   * FIX 4: Progress-aware evaluation
   */
  evaluatePosition(ourHP, oppHP) {
    let score = 0;

    // HP advantage
    score += ourHP;
    score -= oppHP;

    // KO bonuses (very high value)
    if (oppHP <= 0) score += 500;
    if (ourHP <= 0) score -= 500;

    // Progress bonus: reward reducing opponent HP
    // The lower opponent HP is, the more valuable our position
    const oppHPRatio = oppHP / 100; // Normalize to 0-1
    score += (1 - oppHPRatio) * 100; // Bonus for damaging opponent

    // Survival bonus: reward keeping our HP high
    const ourHPRatio = ourHP / 100;
    score += ourHPRatio * 50;

    return score;
  }

  getSpeed(pokemon) {
    if (pokemon.stats && pokemon.stats.spe) {
      return pokemon.stats.spe;
    }
    const speciesName = pokemon.ident.split(':')[1].trim().split(',')[0];
    const species = this.dex.species.get(speciesName);
    return Math.floor((2 * species.baseStats.spe + 31 + 63) * 100 / 100) + 5;
  }

  calculateDamage(attacker, defender, move) {
    if (!move.basePower) return 0;

    const attackerSpecies = this.dex.species.get(
      attacker.species || attacker.ident.split(':')[1].trim().split(',')[0]
    );
    const defenderSpecies = this.dex.species.get(defender.species);

    const attackStat = move.category === 'Physical' ?
      (attacker.stats?.atk || 250) :
      (attacker.stats?.spa || 250);
    const defenseStat = move.category === 'Physical' ?
      (defender.stats?.def || 250) :
      (defender.stats?.spd || 250);

    let damage = Math.floor(((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    if (attackerSpecies.types.includes(move.type)) {
      damage *= 1.5;
    }

    const effectiveness = this.getTypeEffectiveness(move.type, defenderSpecies.types);
    damage *= effectiveness;

    return Math.floor(damage);
  }

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

module.exports = ImprovedDeepSearchBot;
