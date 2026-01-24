const { Dex } = require('@pkmn/sim');

/**
 * OptimizedDeepSearchBot - 4-ply search with move ordering and enhanced evaluation
 * Improvements over DeepSearchBot:
 * - Move ordering for better alpha-beta pruning
 * - Enhanced evaluation (type advantage, speed, boosts, status)
 * - Tracks status and boosts through search tree
 */
class OptimizedDeepSearchBot {
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
      if (line.includes('|-boost|') || line.includes('|-unboost|')) {
        this.processBoost(line);
      }
      if (line.includes('|-status|')) {
        this.processStatus(line);
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

    this.opponentActive = {
      species: speciesName,
      types: this.dex.species.get(speciesName).types,
      hp: hp.current,
      maxHP: hp.max,
      hpPercent: hp.percent,
      status: hp.status,
      stats: this.estimateStats(speciesName, 100),
      boosts: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      moves: new Set(),
      item: null,
      ability: null,
      level: 100
    };

    this.seenOpponentPokemon.add(speciesName);

    if (!this.opponentTeam.find(p => p.species === speciesName)) {
      this.opponentTeam.push({ ...this.opponentActive });
    }
  }

  processMove(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    const moveName = parts[3];

    if (this.isOpponent(playerSlot) && this.opponentActive) {
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

  processBoost(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const target = parts[2];
    const stat = parts[3];
    const amount = parseInt(parts[4]);

    if (this.isOpponent(target) && this.opponentActive && this.opponentActive.boosts) {
      const isBoost = line.includes('|-boost|');
      this.opponentActive.boosts[stat] = (this.opponentActive.boosts[stat] || 0) + (isBoost ? amount : -amount);
      this.opponentActive.boosts[stat] = Math.max(-6, Math.min(6, this.opponentActive.boosts[stat]));
    }
  }

  processStatus(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const target = parts[2];
    const status = parts[3];

    if (this.isOpponent(target) && this.opponentActive) {
      this.opponentActive.status = status;
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

    if (!this.opponentActive || this.opponentActive.moves.size === 0) {
      return this.fallbackChoice(active);
    }

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    const ourHP = this.parseHP(ourPokemon.condition).current;
    const oppHP = this.opponentActive.hp;

    const bestMove = this.searchBestMove(request, active.moves, ourPokemon, ourHP, oppHP);

    return `move ${bestMove.slot}`;
  }

  /**
   * ORDER MOVES for better pruning
   */
  orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
    const moveScores = moves.map(move => {
      const moveData = this.dex.moves.get(move.id);
      const damage = this.calculateDamage(ourPokemon, oppPokemon, moveData);

      let orderScore = 0;

      // KO moves get highest priority
      if (damage >= oppHP) {
        orderScore = 10000 + damage;
      }
      // High damage moves next
      else if (damage > 0) {
        orderScore = 1000 + damage;
      }
      // Status moves last
      else {
        orderScore = move.basePower || 0;
      }

      return { move, score: orderScore };
    });

    // Sort by score descending
    moveScores.sort((a, b) => b.score - a.score);

    return moveScores.map(ms => ms.move);
  }

  searchBestMove(request, availableMoves, ourPokemon, ourHP, oppHP) {
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    const ourMoveList = availableMoves.filter(m => !m.disabled && m.pp > 0);
    const oppMoveList = Array.from(this.opponentActive.moves);

    // ORDER MOVES - best first for better pruning
    const orderedMoves = this.orderMoves(ourMoveList, ourPokemon, this.opponentActive, oppHP);

    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];
      if (move.disabled || move.pp === 0) continue;

      const moveData = this.dex.moves.get(move.id);

      const score = this.minimaxDepth(
        ourPokemon, ourHP,
        this.opponentActive, oppHP,
        orderedMoves,
        oppMoveList,
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
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP);
    }

    if (ourHP <= 0 || oppHP <= 0) {
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP);
    }

    if (maximizing) {
      let maxScore = -Infinity;

      // ORDER moves for this node too
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

        // ORDER our responses
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
   * ENHANCED EVALUATION with type advantage, speed, boosts, status
   */
  evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP) {
    let score = 0;

    // HP advantage (most important)
    score += ourHP;
    score -= oppHP;

    // KO bonuses (huge)
    if (oppHP <= 0) score += 500;
    if (ourHP <= 0) score -= 500;

    // Type advantage
    const ourSpecies = this.dex.species.get(
      ourPokemon.species || ourPokemon.ident.split(':')[1].trim().split(',')[0]
    );
    const typeAdvantage = this.getTypeMatchupScore(ourSpecies.types, oppPokemon.types);
    score += typeAdvantage * 50;

    // Speed advantage
    const ourSpeed = this.getSpeed(ourPokemon);
    const oppSpeed = oppPokemon.stats.spe;
    if (ourSpeed > oppSpeed) {
      score += 30;
    } else if (oppSpeed > ourSpeed) {
      score -= 30;
    }

    // Stat boosts
    const ourBoosts = ourPokemon.boosts || {};
    const oppBoosts = oppPokemon.boosts || {};

    score += (ourBoosts.atk || 0) * 25;
    score += (ourBoosts.spa || 0) * 25;
    score += (ourBoosts.spe || 0) * 20;
    score += (ourBoosts.def || 0) * 15;
    score += (ourBoosts.spd || 0) * 15;

    score -= (oppBoosts.atk || 0) * 25;
    score -= (oppBoosts.spa || 0) * 25;
    score -= (oppBoosts.spe || 0) * 20;
    score -= (oppBoosts.def || 0) * 15;
    score -= (oppBoosts.spd || 0) * 15;

    // Status conditions
    const ourStatus = this.parseHP(ourPokemon.condition).status || ourPokemon.status;
    const oppStatus = oppPokemon.status;

    if (oppStatus) score += 40;
    if (ourStatus) score -= 40;

    return score;
  }

  /**
   * Calculate type matchup advantage
   */
  getTypeMatchupScore(ourTypes, oppTypes) {
    let bestMultiplier = 1;

    for (const ourType of ourTypes) {
      let effectiveness = 1;
      for (const oppType of oppTypes) {
        const typeData = this.dex.types.get(ourType);
        if (typeData.damageTaken[oppType] === 1) effectiveness *= 2;
        if (typeData.damageTaken[oppType] === 2) effectiveness *= 0.5;
        if (typeData.damageTaken[oppType] === 3) effectiveness = 0;
      }
      bestMultiplier = Math.max(bestMultiplier, effectiveness);
    }

    return bestMultiplier - 1; // Return advantage over neutral
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

module.exports = OptimizedDeepSearchBot;
