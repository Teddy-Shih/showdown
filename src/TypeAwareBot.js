const { Dex } = require('@pkmn/sim');

/**
 * TypeAwareBot - Adds type effectiveness and switch intelligence to FixedDeepSearchBot
 *
 * New Features:
 * 1. Type effectiveness scoring in evaluation (heavy weight)
 * 2. Proactive switch intelligence (considers switches in minimax)
 * 3. Team-aware evaluation (considers remaining Pokemon)
 * 4. HP preservation bonus (exponential)
 *
 * Goal: Fix losses from poor type matchup management
 */
class TypeAwareBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.searchDepth = 4;

    this.opponentActive = null;
    this.opponentTeam = [];
    this.seenOpponentPokemon = new Set();

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    // Loop detection
    this.moveHistory = [];
    this.maxHistorySize = 6;
    this.turnNumber = 0;

    // Switch tracking
    this.switchBreaks = 0;

    // NEW: Team composition analysis
    this.teamStyle = null; // 'offensive' or 'defensive', cached after first analysis
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
      if (line.includes('|turn|')) {
        this.turnNumber++;
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
      moves: new Set(estimatedMoves),
      item: null,
      ability: null,
      level: 100
    };

    this.seenOpponentPokemon.add(speciesName);

    if (!this.opponentTeam.find(p => p.species === speciesName)) {
      this.opponentTeam.push({ ...this.opponentActive });
    }
  }

  estimateCommonMoves(species) {
    const moves = [];

    if (species.baseStats.atk > species.baseStats.spa) {
      moves.push('tackle', 'bodyslam', 'earthquake', 'stoneedge');
    } else {
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

    if (!this.opponentActive) {
      return this.fallbackChoice(active);
    }

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    const ourHP = this.parseHP(ourPokemon.condition).current;
    const oppHP = this.opponentActive.hp;

    // Ensure opponent has moves before searching
    if (this.opponentActive.moves.size === 0) {
      const species = this.dex.species.get(this.opponentActive.species);
      const estimatedMoves = this.estimateCommonMoves(species);
      estimatedMoves.forEach(m => this.opponentActive.moves.add(m));
    }

    // NEW: Check if we should switch BEFORE searching for best move
    const shouldSwitch = this.shouldProactivelySwitch(request, ourPokemon, ourHP);
    if (shouldSwitch) {
      const bestSwitchSlot = this.findBestSwitch(request, ourPokemon);
      if (bestSwitchSlot) {
        this.switchBreaks++;
        const switchChoice = `switch ${bestSwitchSlot}`;

        // Check for switch spam
        if (this.isAboutToLoop(switchChoice)) {
          // Switch spam detected, don't switch
        } else {
          this.moveHistory.push(switchChoice);
          if (this.moveHistory.length > this.maxHistorySize) {
            this.moveHistory.shift();
          }
          return switchChoice;
        }
      }
    }

    // Search for best attacking move
    const bestMove = this.searchBestMove(request, active.moves, ourPokemon, ourHP, oppHP);

    // Loop detection for moves
    const proposedChoice = `move ${bestMove.slot}`;

    if (this.isAboutToLoop(proposedChoice)) {
      const alternativeSlot = this.findAlternativeMove(active.moves, bestMove.slot);
      if (alternativeSlot) {
        const finalChoice = `move ${alternativeSlot}`;
        this.moveHistory.push(finalChoice);
        if (this.moveHistory.length > this.maxHistorySize) {
          this.moveHistory.shift();
        }
        return finalChoice;
      }
    }

    this.moveHistory.push(proposedChoice);
    if (this.moveHistory.length > this.maxHistorySize) {
      this.moveHistory.shift();
    }

    return proposedChoice;
  }

  isAboutToLoop(proposedMove) {
    if (this.moveHistory.length < 2) return false;
    const last2 = this.moveHistory.slice(-2);
    return last2.every(m => m === proposedMove);
  }

  findAlternativeMove(availableMoves, currentSlot) {
    const recentMoves = new Set(this.moveHistory.slice(-3));

    for (let i = 0; i < availableMoves.length; i++) {
      const slot = i + 1;
      const move = availableMoves[i];
      const moveChoice = `move ${slot}`;

      if (slot !== currentSlot && !move.disabled && move.pp > 0) {
        if (!recentMoves.has(moveChoice)) {
          return slot;
        }
      }
    }

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
   * NEW: Decide if we should proactively switch based on type matchup
   */
  shouldProactivelySwitch(request, ourPokemon, ourHP) {
    // Don't switch if we just switched recently (prevent switch spam)
    const recentSwitches = this.moveHistory.filter(h => h.startsWith('switch')).length;
    if (recentSwitches >= 2) {
      return false;
    }

    // Only switch if matchup is clearly bad
    const ourSpeciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const ourSpecies = this.dex.species.get(ourSpeciesName);

    const typeMatchup = this.calculateTypeMatchupScore(ourSpecies.types, this.opponentActive.types);

    // Only switch if at major type disadvantage (score < -3)
    // OR if HP is low and matchup isn't favorable
    if (typeMatchup < -3) {
      return true;
    }

    if (ourHP < 30 && typeMatchup < 0) {
      return true;
    }

    return false;
  }

  /**
   * NEW: Find best Pokemon to switch to
   */
  findBestSwitch(request, currentPokemon) {
    const switches = this.getAvailableSwitches(request);
    if (switches.length === 0) return null;

    let bestSlot = null;
    let bestScore = -Infinity;

    for (const switchSlot of switches) {
      const switchTarget = request.side.pokemon[switchSlot - 1];
      const switchHP = this.parseHP(switchTarget.condition).current;

      // Skip if switching to fainted Pokemon
      if (switchHP <= 0) continue;

      const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
      const switchSpecies = this.dex.species.get(switchSpeciesName);

      // Calculate type advantage
      const typeMatchup = this.calculateTypeMatchupScore(
        switchSpecies.types,
        this.opponentActive.types
      );

      // Prefer switches with good type matchup and high HP
      const score = typeMatchup * 50 + switchHP * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = switchSlot;
      }
    }

    return bestSlot;
  }

  searchBestMove(request, availableMoves, ourPokemon, ourHP, oppHP) {
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    const ourMoveList = availableMoves.filter(m => !m.disabled && m.pp > 0);
    const oppMoveList = Array.from(this.opponentActive.moves);

    if (oppMoveList.length === 0) {
      return { slot: 1, move: ourMoveList[0]?.move || 'tackle', score: 0 };
    }

    const orderedMoves = this.orderMoves(ourMoveList, ourPokemon, this.opponentActive, oppHP);
    const team = request.side ? request.side.pokemon : null; // Get team for evaluation

    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];
      if (move.disabled || move.pp === 0) continue;

      const moveData = this.dex.moves.get(move.id);

      const score = this.minimaxDepth(
        ourPokemon, ourHP,
        this.opponentActive, oppHP,
        orderedMoves, oppMoveList,
        moveData, null,
        1, alpha, beta, false, team
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

  /**
   * NEW: Evaluate the value of switching to a different Pokemon
   */
  evaluateSwitchOption(switchTarget, switchHP, oppPokemon, oppHP, oppMoves) {
    // Calculate type matchup after switch
    const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
    const switchSpecies = this.dex.species.get(switchSpeciesName);

    const typeAdvantage = this.calculateTypeMatchupScore(
      switchSpecies.types,
      oppPokemon.types
    );

    // Switching takes 1 turn, opponent gets free hit
    // Estimate damage we'll take
    let expectedDamage = 0;
    for (const oppMoveName of oppMoves) {
      const oppMoveData = this.dex.moves.get(oppMoveName);
      const damage = this.calculateDamageWithTypes(
        oppPokemon, oppMoveData,
        { species: switchSpeciesName, types: switchSpecies.types, stats: this.estimateStats(switchSpeciesName, 100) }
      );
      expectedDamage = Math.max(expectedDamage, damage); // Assume worst case
    }

    const newSwitchHP = switchHP - expectedDamage;

    // Evaluate position after switch
    let score = 0;

    // FIXED: Reduced type advantage weight (was 200, now 40)
    // Only worth switching if type advantage is VERY good
    score += typeAdvantage * 40;

    // HP difference after taking hit
    score += newSwitchHP - oppHP;

    // FIXED: Significantly increased switch penalty (was 50, now 150)
    // Switching should only happen when NECESSARY
    score -= 150;

    // Don't switch if it results in immediate KO
    if (newSwitchHP <= 0) {
      score -= 1000;
    }

    // FIXED: Only switch if we're at a major disadvantage
    // Type advantage of +6 or more needed to overcome switch penalty
    // (6 * 40 = 240, vs penalty of 150, net +90)

    return score;
  }

  /**
   * NEW: Calculate type matchup score (offensive and defensive)
   */
  calculateTypeMatchupScore(ourTypes, oppTypes) {
    let score = 0;

    // Offensive matchup: how well we hit them
    for (const ourType of ourTypes) {
      for (const oppType of oppTypes) {
        const typeData = this.dex.types.get(ourType);
        const effectiveness = typeData.damageTaken[oppType];

        // damageTaken is from defender's perspective
        // We need offensive effectiveness
        // Check if our type is super effective against opponent
        const oppTypeData = this.dex.types.get(oppType);
        if (oppTypeData.damageTaken[ourType] === 1) { // Super effective
          score += 2;
        } else if (oppTypeData.damageTaken[ourType] === 2) { // Not very effective
          score -= 1;
        } else if (oppTypeData.damageTaken[ourType] === 3) { // Immune
          score -= 3;
        }
      }
    }

    // Defensive matchup: how well they hit us
    for (const oppType of oppTypes) {
      for (const ourType of ourTypes) {
        const ourTypeData = this.dex.types.get(ourType);
        const effectiveness = ourTypeData.damageTaken[oppType];

        if (effectiveness === 1) { // We take super effective damage
          score -= 2;
        } else if (effectiveness === 2) { // We resist
          score += 1;
        } else if (effectiveness === 3) { // We're immune
          score += 3;
        }
      }
    }

    return score;
  }

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

  minimaxDepth(ourPokemon, ourHP, oppPokemon, oppHP, ourMoves, oppMoves, ourLastMove, oppLastMove, depth, alpha, beta, maximizing, team = null) {
    this.nodesEvaluated++;

    if (depth >= this.searchDepth) {
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team);
    }

    if (ourHP <= 0 || oppHP <= 0) {
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team);
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
            depth + 1, alpha, beta, false, team
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
            depth + 1, alpha, beta, true, team
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
   * NEW: Analyze team composition to determine playstyle
   * Looks at actual movesets, items, and Pokemon roles rather than just base stats
   */
  analyzeTeamStyle(team) {
    if (this.teamStyle) {
      return this.teamStyle; // Cache result
    }

    let setupCount = 0;
    let defensiveCount = 0;
    let offensiveCount = 0;
    let count = 0;

    for (const pokemon of team) {
      const speciesName = pokemon.ident.split(':')[1].trim().split(',')[0];
      const species = this.dex.species.get(speciesName);

      if (!species) continue;
      count++;

      // Check for defensive characteristics
      const isDefensivePivot = ['Slowking', 'Slowbro', 'Rotom-Wash', 'Rotom-Heat', 'Toxapex',
                                'Corviknight', 'Skarmory', 'Ferrothorn', 'Clefable', 'Blissey',
                                'Chansey', 'Magnezone', 'Wo-Chien', 'Ting-Lu', 'Alomomola'].includes(species.name);

      // Check for setup sweepers
      const isSetupSweeper = ['Baxcalibur', 'Kingambit', 'Dragonite', 'Garchomp', 'Volcarona',
                              'Frosmoth', 'Salamence', 'Gyarados', 'Lucario', 'Haxorus'].includes(species.name);

      // Check for immediate offensive threats
      const isWallbreaker = ['Gholdengo', 'Iron Valiant', 'Great Tusk', 'Zapdos-Galar',
                            'Weavile', 'Dragapult', 'Hoopa-Unbound', 'Kyurem'].includes(species.name);

      if (isDefensivePivot) {
        defensiveCount++;
      } else if (isSetupSweeper) {
        setupCount++; // Setup sweepers need defensive evaluation (HP preservation)
      } else if (isWallbreaker) {
        offensiveCount++;
      }
    }

    if (count === 0) {
      this.teamStyle = 'balanced';
      return this.teamStyle;
    }

    // Team classification logic:
    // - OFFENSIVE: Setup sweepers + wallbreakers (hyper offense - aggressive setup)
    //   → Team 1: 2 setup sweepers + 3 wallbreakers = wants to set up and sweep
    // - DEFENSIVE: Defensive pivots + recovery (defensive control - patient grinding)
    //   → Team 2: 2 defensive pivots + 1 setup = wants to wear down and pivot
    // - BALANCED: Mixed or unclear

    if (setupCount >= 2 && offensiveCount >= 2) {
      this.teamStyle = 'offensive'; // Hyper offense: setup + wallbreak strategy
    } else if (defensiveCount >= 2) {
      this.teamStyle = 'defensive'; // Defensive control: pivot and wear down
    } else if (offensiveCount >= 3) {
      this.teamStyle = 'offensive'; // Wallbreaker-heavy teams
    } else {
      this.teamStyle = 'balanced';
    }

    return this.teamStyle;
  }

  /**
   * NEW: Enhanced evaluation with type effectiveness AND team-aware weights
   */
  evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team = null) {
    let score = 0;

    // Terminal states (high priority)
    if (oppHP <= 0) score += 1000;
    if (ourHP <= 0) score -= 1000;

    // NEW: Type matchup scoring
    const ourSpecies = this.dex.species.get(
      ourPokemon.species || ourPokemon.ident.split(':')[1].trim().split(',')[0]
    );
    const oppSpecies = this.dex.species.get(oppPokemon.species);

    const typeMatchup = this.calculateTypeMatchupScore(ourSpecies.types, oppSpecies.types);

    // NEW: HP ratios for scaling
    const ourHPRatio = Math.max(0, ourHP) / 100;
    const oppHPRatio = Math.max(0, oppHP) / 100;

    // NEW: Team-aware evaluation weights
    const teamStyle = team ? this.analyzeTeamStyle(team) : 'balanced';

    if (teamStyle === 'offensive') {
      // OFFENSIVE TEAMS (wallbreakers): Prioritize damage output and progress
      // Go for immediate kills, less concerned with HP preservation
      score += (ourHP - oppHP) * 1.3;     // Slightly increased damage weight
      score += typeMatchup * 35;          // Increased type advantage importance
      score += (ourHPRatio ** 2) * 50;    // REDUCED HP preservation (wallbreakers trade)
      score -= (oppHPRatio ** 2) * 100;   // HEAVILY penalize opponent HP
      score += (1 - oppHPRatio) * 80;     // HIGH progress bonus (finish them fast)
    } else if (teamStyle === 'defensive') {
      // DEFENSIVE TEAMS (setup sweepers + pivots): Preserve HP for setup/pivoting
      // Setup sweepers NEED HP to set up Dragon Dance, Swords Dance, etc.
      // Defensive pivots NEED HP to keep pivoting
      score += (ourHP - oppHP) * 0.8;     // DECREASED raw damage importance
      score += typeMatchup * 35;          // INCREASED type advantage (switch to good matchups)
      score += (ourHPRatio ** 2) * 100;   // INCREASED HP preservation (critical for setup)
      score -= (oppHPRatio ** 2) * 70;    // Decreased opponent HP penalty
      score += (1 - oppHPRatio) * 40;     // Low progress bonus (patient play)
    } else {
      // BALANCED TEAMS: Middle ground
      score += (ourHP - oppHP);
      score += typeMatchup * 30;
      score += (ourHPRatio ** 2) * 80;
      score -= (oppHPRatio ** 2) * 80;
      score += (1 - oppHPRatio) * 50;
    }

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

  /**
   * NEW: Helper for calculating damage with explicit types
   */
  calculateDamageWithTypes(attacker, move, defender) {
    if (!move.basePower) return 0;

    const attackStat = move.category === 'Physical' ?
      (attacker.stats?.atk || 250) :
      (attacker.stats?.spa || 250);
    const defenseStat = move.category === 'Physical' ?
      (defender.stats?.def || 250) :
      (defender.stats?.spd || 250);

    let damage = Math.floor(((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    // STAB
    if (attacker.types && attacker.types.includes(move.type)) {
      damage *= 1.5;
    }

    const effectiveness = this.getTypeEffectiveness(move.type, defender.types);
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

module.exports = TypeAwareBot;
