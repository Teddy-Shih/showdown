const { Battle, Dex } = require('@pkmn/sim');
const { calculate, Pokemon, Move } = require('@smogon/calc');
const { Generations } = require('@smogon/calc');

/**
 * TranspositionMoveSimulator - Enhanced simulator with:
 * 1. Transposition tables (better state hashing than CachedEngineMoveSimulator)
 * 2. Move ordering for improved alpha-beta pruning
 * 3. Performance profiling
 */
class TranspositionMoveSimulator {
  constructor(options = {}) {
    // Transposition table
    this.transpositionTable = new Map();
    this.maxTableSize = options.maxTableSize || 10000;
    this.ttHits = 0;
    this.ttMisses = 0;
    this.ttCollisions = 0;

    // Performance counters
    this.stats = {
      cloneTime: 0,
      cloneCalls: 0,
      simulateTime: 0,
      simulateCalls: 0,
      evaluateTime: 0,
      evaluateCalls: 0,
      jsonSerializeTime: 0,
      jsonDeserializeTime: 0,
      makeChoicesTime: 0,
      makeChoicesCalls: 0,
      moveOrderingTime: 0,
      moveOrderingCalls: 0,
      hashTime: 0,
      hashCalls: 0
    };

    this.gen = Generations.get(9);
    this.dex = Dex;
  }

  /**
   * Create better hash key for battle state
   * Includes: turn, active Pokemon (species, HP, boosts, status), side conditions
   */
  getBattleStateHash(battle, depth) {
    const start = performance.now();

    const p1Active = battle.p1.active[0];
    const p2Active = battle.p2.active[0];

    if (!p1Active || !p2Active) {
      this.stats.hashTime += performance.now() - start;
      this.stats.hashCalls++;
      return null;
    }

    // Create comprehensive hash
    const hashParts = [
      `t${battle.turn}`,
      `d${depth}`,
      // P1 active
      `p1:${p1Active.species.id}`,
      `hp${Math.floor(p1Active.hp / p1Active.maxhp * 20)}`, // HP in 5% buckets
      `s${p1Active.status || 'none'}`,
      `b${this.boostsToString(p1Active.boosts)}`,
      // P2 active
      `p2:${p2Active.species.id}`,
      `hp${Math.floor(p2Active.hp / p2Active.maxhp * 20)}`,
      `s${p2Active.status || 'none'}`,
      `b${this.boostsToString(p2Active.boosts)}`,
      // Side conditions
      `sc1:${this.sideConditionsToString(battle.p1)}`,
      `sc2:${this.sideConditionsToString(battle.p2)}`,
      // Team health (alive count)
      `a${battle.p1.pokemon.filter(p => p.hp > 0).length}`,
      `a${battle.p2.pokemon.filter(p => p.hp > 0).length}`
    ];

    const hash = hashParts.join('|');

    this.stats.hashTime += performance.now() - start;
    this.stats.hashCalls++;

    return hash;
  }

  boostsToString(boosts) {
    if (!boosts) return '0';
    const keys = ['atk', 'def', 'spa', 'spd', 'spe'];
    return keys.map(k => boosts[k] || 0).join(',');
  }

  sideConditionsToString(side) {
    const conditions = [];
    if (side.sideConditions?.stealthrock) conditions.push('sr');
    if (side.sideConditions?.spikes) conditions.push(`sp${side.sideConditions.spikes.layers}`);
    if (side.sideConditions?.toxicspikes) conditions.push(`ts${side.sideConditions.toxicspikes.layers}`);
    if (side.sideConditions?.reflect) conditions.push('ref');
    if (side.sideConditions?.lightscreen) conditions.push('ls');
    return conditions.join(',') || 'none';
  }

  /**
   * Order moves for better alpha-beta pruning
   * Priority: KO moves > High damage > Stat boosts > Status > Low damage
   */
  orderMoves(battle, player, availableMoves) {
    const start = performance.now();

    if (availableMoves.length <= 1) {
      this.stats.moveOrderingTime += performance.now() - start;
      this.stats.moveOrderingCalls++;
      return availableMoves;
    }

    const side = player === 'p1' ? battle.p1 : battle.p2;
    const oppSide = player === 'p1' ? battle.p2 : battle.p1;
    const active = side.active[0];
    const oppActive = oppSide.active[0];

    if (!active || !oppActive) {
      this.stats.moveOrderingTime += performance.now() - start;
      this.stats.moveOrderingCalls++;
      return availableMoves;
    }

    const moveScores = availableMoves.map((moveId, index) => {
      const moveData = Dex.moves.get(moveId);
      let score = 0;

      // Use @smogon/calc for accurate damage calculation
      try {
        const attacker = new Pokemon(this.gen, active.species.name, {
          level: active.level,
          nature: 'Hardy',
          evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
          boosts: active.boosts
        });

        const defender = new Pokemon(this.gen, oppActive.species.name, {
          level: oppActive.level,
          nature: 'Hardy',
          evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 }
        });

        const move = new Move(this.gen, moveData.name);
        const result = calculate(this.gen, attacker, defender, move);

        // Get average damage
        let avgDamage = 0;
        if (Array.isArray(result.damage)) {
          avgDamage = result.damage.reduce((a, b) => a + b, 0) / result.damage.length;
        } else {
          avgDamage = result.damage;
        }

        // Prioritize by expected outcome
        if (avgDamage >= oppActive.hp) {
          // KO move - highest priority
          score = 1000000 + avgDamage;
        } else if (avgDamage > 0) {
          // Damaging move - high priority based on damage
          score = 100000 + avgDamage;
        } else if (moveData.boosts) {
          // Stat-boosting move - medium priority
          score = 10000;
        } else if (moveData.status || moveData.volatileStatus) {
          // Status move - lower priority
          score = 1000;
        } else {
          // Other moves - lowest priority
          score = moveData.basePower || 0;
        }
      } catch (error) {
        // Fallback to simple scoring
        if (moveData.basePower) {
          score = moveData.basePower * 100;
        } else if (moveData.boosts) {
          score = 10000;
        } else {
          score = 1000;
        }
      }

      return { moveId, index, score };
    });

    // Sort descending by score
    moveScores.sort((a, b) => b.score - a.score);

    this.stats.moveOrderingTime += performance.now() - start;
    this.stats.moveOrderingCalls++;

    return moveScores.map(ms => ms.moveId);
  }

  /**
   * Lookup position in transposition table
   */
  ttLookup(battle, depth, player) {
    const hash = this.getBattleStateHash(battle, depth);
    if (!hash) return null;

    const entry = this.transpositionTable.get(hash);
    if (entry) {
      this.ttHits++;
      return entry;
    }

    this.ttMisses++;
    return null;
  }

  /**
   * Store position in transposition table
   */
  ttStore(battle, depth, player, score, flag = 'exact') {
    const hash = this.getBattleStateHash(battle, depth);
    if (!hash) return;

    // LRU eviction if table is full
    if (this.transpositionTable.size >= this.maxTableSize) {
      // Remove oldest entry (first in map)
      const firstKey = this.transpositionTable.keys().next().value;
      this.transpositionTable.delete(firstKey);
    }

    // Check if we're replacing an entry (collision)
    if (this.transpositionTable.has(hash)) {
      this.ttCollisions++;
    }

    this.transpositionTable.set(hash, {
      score,
      flag,
      depth,
      timestamp: Date.now()
    });
  }

  /**
   * Clear transposition table (call between games)
   */
  clearTT() {
    this.transpositionTable.clear();
    this.ttHits = 0;
    this.ttMisses = 0;
    this.ttCollisions = 0;
  }

  createBattleFromTeams(team1, team2, formatid = 'gen9customgame') {
    const battle = new Battle({
      formatid,
      p1: { name: 'P1', team: team1 },
      p2: { name: 'P2', team: team2 }
    });

    battle.makeChoices('default', 'default');
    return battle;
  }

  cloneBattle(battle) {
    const start = performance.now();

    const serializeStart = performance.now();
    const serialized = battle.toJSON();
    this.stats.jsonSerializeTime += performance.now() - serializeStart;

    const deserializeStart = performance.now();
    const cloned = Battle.fromJSON(serialized);
    this.stats.jsonDeserializeTime += performance.now() - deserializeStart;

    this.stats.cloneTime += performance.now() - start;
    this.stats.cloneCalls++;

    return cloned;
  }

  simulateTurn(battle, p1Choice, p2Choice) {
    const start = performance.now();

    const cloned = this.cloneBattle(battle);

    try {
      const makeChoicesStart = performance.now();
      cloned.makeChoices(p1Choice, p2Choice);
      this.stats.makeChoicesTime += performance.now() - makeChoicesStart;
      this.stats.makeChoicesCalls++;

      this.stats.simulateTime += performance.now() - start;
      this.stats.simulateCalls++;

      return cloned;
    } catch (error) {
      this.stats.simulateTime += performance.now() - start;
      this.stats.simulateCalls++;
      return cloned;
    }
  }

  getAvailableMoves(battle, player) {
    const side = player === 'p1' ? battle.p1 : battle.p2;
    const active = side.active[0];

    if (!active || active.fainted) {
      return [];
    }

    return active.moveSlots
      .filter(slot => !slot.disabled && slot.pp > 0)
      .map(slot => slot.id);
  }

  getAvailableSwitches(battle, player) {
    const side = player === 'p1' ? battle.p1 : battle.p2;

    return side.pokemon
      .map((p, idx) => ({ pokemon: p, slot: idx + 1 }))
      .filter(({ pokemon }) => !pokemon.active && pokemon.hp > 0)
      .map(({ slot }) => slot);
  }

  extractState(battle, perspective = 'p1') {
    const us = perspective === 'p1' ? battle.p1 : battle.p2;
    const them = perspective === 'p1' ? battle.p2 : battle.p1;

    return {
      turn: battle.turn,
      ended: battle.ended,
      winner: battle.winner,
      ourActive: this.extractPokemonState(us.active[0]),
      ourTeam: us.pokemon.map(p => this.extractPokemonState(p)),
      oppActive: this.extractPokemonState(them.active[0]),
      oppTeam: them.pokemon.map(p => this.extractPokemonState(p)),
      weather: battle.field.weather,
      terrain: battle.field.terrain,
      ourSideConditions: this.extractSideConditions(us),
      oppSideConditions: this.extractSideConditions(them)
    };
  }

  extractPokemonState(pokemon) {
    if (!pokemon) return null;

    return {
      name: pokemon.name,
      species: pokemon.species.name,
      hp: pokemon.hp,
      maxhp: pokemon.maxhp,
      fainted: pokemon.fainted,
      active: pokemon.isActive,
      status: pokemon.status,
      statusState: pokemon.statusState,
      level: pokemon.level,
      types: pokemon.types,
      ability: pokemon.ability,
      item: pokemon.item,
      boosts: { ...pokemon.boosts },
      moves: pokemon.moveSlots?.map(m => ({
        id: m.id,
        pp: m.pp,
        maxpp: m.maxpp,
        disabled: m.disabled
      })) || []
    };
  }

  extractSideConditions(side) {
    const conditions = {};

    if (side.sideConditions) {
      for (const [condition, data] of Object.entries(side.sideConditions)) {
        if (condition === 'spikes' || condition === 'toxicspikes') {
          conditions[condition] = data.layers || 0;
        } else {
          conditions[condition] = true;
        }
      }
    }

    return conditions;
  }

  /**
   * Evaluate stat boosts with non-linear scaling
   *
   * Key insights:
   * 1. Each boost stage has increasing marginal value (exponential growth)
   * 2. Combined offensive + speed boosts create sweep potential
   * 3. +3 or higher boosts are extremely dangerous
   *
   * Formula: base_value * (1.5 ^ abs(boost_stage))
   * This captures the exponential damage increase from stat boosts
   *
   * Additional bonus for "sweep setup":
   * - High offensive stat + high speed = unstoppable sweeper
   * - We add extra points for this combination
   */
  evaluateBoosts(boosts) {
    if (!boosts) return 0;

    let score = 0;

    // Non-linear evaluation: each stage worth more than the last
    // Base values represent importance of each stat
    const baseValues = {
      atk: 18,  // Offensive stats are critical
      spa: 18,
      spe: 25,  // Speed is most important (determines who moves first)
      def: 14,  // Defensive stats less impactful
      spd: 14,
      accuracy: 10,
      evasion: 12
    };

    // Exponential scaling: 1.5^n growth per stage
    for (const [stat, baseValue] of Object.entries(baseValues)) {
      const boost = boosts[stat] || 0;
      if (boost !== 0) {
        // Use exponential scaling: value * (1.5^boost)
        const sign = boost > 0 ? 1 : -1;
        const magnitude = Math.abs(boost);
        const exponentialValue = baseValue * Math.pow(1.5, magnitude);
        score += sign * exponentialValue;
      }
    }

    // SWEEP POTENTIAL BONUS
    // If Pokemon has both offensive AND speed boosts, it's a setup sweeper
    // This is extremely dangerous (e.g., +3 Quiver Dance Volcarona)
    const offensiveBoost = Math.max(boosts.atk || 0, boosts.spa || 0);
    const speedBoost = boosts.spe || 0;

    if (offensiveBoost >= 2 && speedBoost >= 2) {
      // High setup: likely can sweep remaining team
      // Add exponential bonus based on total setup
      const totalSetup = offensiveBoost + speedBoost;
      const sweepBonus = 50 * Math.pow(1.8, totalSetup - 4);
      score += sweepBonus;
    } else if (offensiveBoost >= 1 && speedBoost >= 1) {
      // Moderate setup: dangerous but not guaranteed sweep
      const totalSetup = offensiveBoost + speedBoost;
      const sweepBonus = 20 * Math.pow(1.5, totalSetup - 2);
      score += sweepBonus;
    }

    // DEFENSIVE WALL BONUS
    // Multiple defensive boosts make Pokemon very hard to KO
    const defensiveBoost = (boosts.def || 0) + (boosts.spd || 0);
    if (defensiveBoost >= 3) {
      const wallBonus = 30 * Math.pow(1.4, defensiveBoost - 3);
      score += wallBonus;
    }

    return score;
  }

  /**
   * Evaluate status conditions with differentiated weights.
   * Different statuses have very different competitive impacts:
   * - Sleep: most debilitating (no actions for 1-3 turns)
   * - Freeze: permanent until thawed (rare but devastating)
   * - Burn: halves physical attack + chip damage
   * - Toxic: exponentially increasing damage
   * - Paralysis: 25% immobilization + speed cut
   * - Poison: minor chip damage
   */
  evaluateStatusScore(team) {
    let score = 0;
    for (const p of team) {
      if (!p.status || p.hp === 0) continue;
      switch (p.status) {
        case 'slp': score -= 70; break;  // Sleep is devastating
        case 'frz': score -= 80; break;  // Freeze even worse (rare but permanent)
        case 'brn': score -= 50; break;  // Burn halves physical attack + residual
        case 'tox': score -= 55; break;  // Toxic accumulates fast
        case 'par': score -= 45; break;  // Paralysis cuts speed + 25% chance of no move
        case 'psn': score -= 30; break;  // Regular poison is milder
        default:    score -= 20; break;
      }
    }
    return score;
  }

  /**
   * Evaluate type matchup of the active Pokemon pair.
   * A favorable matchup (we resist their moves, they don't resist ours)
   * provides a significant strategic advantage.
   */
  evaluateTypeMatchup(ourActive, oppActive) {
    if (!ourActive || !oppActive) return 0;
    let score = 0;

    try {
      const ourTypes = ourActive.types || [];
      const oppTypes = oppActive.types || [];

      // Check how well our type resists opponent's types
      // (i.e., how much damage we take from STAB moves)
      let ourResistScore = 0;
      for (const oppType of oppTypes) {
        let minEff = Infinity;
        for (const ourType of ourTypes) {
          const eff = this.dex.types.get(oppType)?.effectiveness?.[ourType];
          if (eff !== undefined) {
            minEff = Math.min(minEff, eff);
          }
        }
        // Reward immunity/resistance, penalize weakness
        if (minEff === 0) ourResistScore += 40;        // Immune
        else if (minEff < 1) ourResistScore += 20;     // Resist
        else if (minEff > 1) ourResistScore -= 25;     // Weak
      }

      // Check how well our types hit opponent
      let ourOffenseScore = 0;
      for (const ourType of ourTypes) {
        let maxEff = 0;
        for (const oppType of oppTypes) {
          const eff = this.dex.types.get(ourType)?.effectiveness?.[oppType];
          if (eff !== undefined) {
            maxEff = Math.max(maxEff, eff);
          }
        }
        if (maxEff === 0) ourOffenseScore -= 10;       // Immune (we can't hit)
        else if (maxEff >= 2) ourOffenseScore += 20;   // Super effective STAB coverage
      }

      score = ourResistScore + ourOffenseScore;
    } catch (e) {
      // Ignore errors in type lookup
    }

    return score;
  }

  evaluateState(battle, player = 'p1') {
    const start = performance.now();

    const state = this.extractState(battle, player);

    if (state.ended) {
      this.stats.evaluateTime += performance.now() - start;
      this.stats.evaluateCalls++;

      if (state.winner === (player === 'p1' ? 'P1' : 'P2')) {
        return 10000;
      } else if (state.winner) {
        return -10000;
      }
      return 0;
    }

    let score = 0;

    // --- HP ADVANTAGE (weight: 100) ---
    // Total team HP percentage differential
    const ourTotalHP = state.ourTeam.reduce((sum, p) => sum + p.hp, 0);
    const ourTotalMaxHP = state.ourTeam.reduce((sum, p) => sum + p.maxhp, 0);
    const oppTotalHP = state.oppTeam.reduce((sum, p) => sum + p.hp, 0);
    const oppTotalMaxHP = state.oppTeam.reduce((sum, p) => sum + p.maxhp, 0);

    score += (ourTotalHP / ourTotalMaxHP) * 100;
    score -= (oppTotalHP / oppTotalMaxHP) * 100;

    // --- ACTIVE POKEMON HP (weight: 60) ---
    // Active Pokemon HP matters more - if it faints we lose momentum
    if (state.ourActive && state.ourActive.maxhp > 0) {
      const ourActiveHP = state.ourActive.hp / state.ourActive.maxhp;
      score += ourActiveHP * 60;
      // Bonus for being in the "safe" zone (>50% HP)
      if (ourActiveHP > 0.5) score += 15;
    }
    if (state.oppActive && state.oppActive.maxhp > 0) {
      const oppActiveHP = state.oppActive.hp / state.oppActive.maxhp;
      score -= oppActiveHP * 60;
      // Bonus for getting opponent into KO range (<25%)
      if (oppActiveHP < 0.25) score += 20;
    }

    // --- POKEMON COUNT (most important, weight: 200) ---
    const ourAlive = state.ourTeam.filter(p => p.hp > 0).length;
    const oppAlive = state.oppTeam.filter(p => p.hp > 0).length;
    score += (ourAlive - oppAlive) * 200;

    // --- STATUS CONDITIONS (differentiated weights) ---
    score += this.evaluateStatusScore(state.ourTeam);       // negative for our statuses
    score -= this.evaluateStatusScore(state.oppTeam);       // positive (bad for them)

    // --- STAT BOOSTS (non-linear scaling) ---
    if (state.ourActive && state.ourActive.boosts) {
      score += this.evaluateBoosts(state.ourActive.boosts);
    }
    if (state.oppActive && state.oppActive.boosts) {
      score -= this.evaluateBoosts(state.oppActive.boosts);
    }

    // --- TYPE MATCHUP BONUS ---
    score += this.evaluateTypeMatchup(state.ourActive, state.oppActive) * 0.5;

    // --- HAZARDS (asymmetric: SR hurts entry, spikes add up) ---
    // Stealth Rock: 12.5-50% damage on switch-in depending on typing
    if (state.oppSideConditions.stealthrock) score += 55;
    if (state.ourSideConditions.stealthrock) score -= 55;
    score += (state.oppSideConditions.spikes || 0) * 25;
    score -= (state.ourSideConditions.spikes || 0) * 25;
    score += (state.oppSideConditions.toxicspikes || 0) * 20;
    score -= (state.ourSideConditions.toxicspikes || 0) * 20;

    // Screens reduce damage for 5 turns - significant defensive value
    if (state.ourSideConditions.reflect) score += 30;
    if (state.ourSideConditions.lightscreen) score += 30;
    if (state.oppSideConditions.reflect) score -= 30;
    if (state.oppSideConditions.lightscreen) score -= 30;

    // --- WEATHER/TERRAIN BONUS ---
    // Weather advantages based on team typing (simplified)
    const weather = state.weather;
    if (weather === 'sunnyday') {
      // Sun: fire types benefit, water/ice hurt
      const ourFireTypes = state.ourTeam.filter(p => p.types && p.types.includes('Fire') && p.hp > 0).length;
      const oppFireTypes = state.oppTeam.filter(p => p.types && p.types.includes('Fire') && p.hp > 0).length;
      score += (ourFireTypes - oppFireTypes) * 15;
    } else if (weather === 'raindance') {
      // Rain: water types benefit
      const ourWaterTypes = state.ourTeam.filter(p => p.types && p.types.includes('Water') && p.hp > 0).length;
      const oppWaterTypes = state.oppTeam.filter(p => p.types && p.types.includes('Water') && p.hp > 0).length;
      score += (ourWaterTypes - oppWaterTypes) * 15;
    } else if (weather === 'sandstorm') {
      // Sand: damages non-immune types, buffs Rock SpDef
      const ourSandImmune = state.ourTeam.filter(p => p.types && (p.types.includes('Rock') || p.types.includes('Ground') || p.types.includes('Steel')) && p.hp > 0).length;
      const oppSandImmune = state.oppTeam.filter(p => p.types && (p.types.includes('Rock') || p.types.includes('Ground') || p.types.includes('Steel')) && p.hp > 0).length;
      score += (ourSandImmune - oppSandImmune) * 10;
    }

    this.stats.evaluateTime += performance.now() - start;
    this.stats.evaluateCalls++;

    return score;
  }

  getStats() {
    const ttTotal = this.ttHits + this.ttMisses;
    return {
      ...this.stats,
      avgCloneTime: this.stats.cloneCalls > 0 ? this.stats.cloneTime / this.stats.cloneCalls : 0,
      avgSimulateTime: this.stats.simulateCalls > 0 ? this.stats.simulateTime / this.stats.simulateCalls : 0,
      avgEvaluateTime: this.stats.evaluateCalls > 0 ? this.stats.evaluateTime / this.stats.evaluateCalls : 0,
      avgMakeChoicesTime: this.stats.makeChoicesCalls > 0 ? this.stats.makeChoicesTime / this.stats.makeChoicesCalls : 0,
      avgMoveOrderingTime: this.stats.moveOrderingCalls > 0 ? this.stats.moveOrderingTime / this.stats.moveOrderingCalls : 0,
      avgHashTime: this.stats.hashCalls > 0 ? this.stats.hashTime / this.stats.hashCalls : 0,
      // Transposition table stats
      ttHits: this.ttHits,
      ttMisses: this.ttMisses,
      ttCollisions: this.ttCollisions,
      ttSize: this.transpositionTable.size,
      ttHitRate: ttTotal > 0 ? (this.ttHits / ttTotal * 100).toFixed(1) + '%' : '0%'
    };
  }

  resetStats() {
    this.stats = {
      cloneTime: 0,
      cloneCalls: 0,
      simulateTime: 0,
      simulateCalls: 0,
      evaluateTime: 0,
      evaluateCalls: 0,
      jsonSerializeTime: 0,
      jsonDeserializeTime: 0,
      makeChoicesTime: 0,
      makeChoicesCalls: 0,
      moveOrderingTime: 0,
      moveOrderingCalls: 0,
      hashTime: 0,
      hashCalls: 0
    };
    this.ttHits = 0;
    this.ttMisses = 0;
    this.ttCollisions = 0;
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log('TRANSPOSITION + MOVE ORDERING STATISTICS');
    console.log('='.repeat(70));

    console.log('\nFunction Call Counts:');
    console.log(`  Clone calls:        ${stats.cloneCalls}`);
    console.log(`  Simulate calls:     ${stats.simulateCalls}`);
    console.log(`  MakeChoices calls:  ${stats.makeChoicesCalls}`);
    console.log(`  Evaluate calls:     ${stats.evaluateCalls}`);
    console.log(`  Move ordering:      ${stats.moveOrderingCalls}`);
    console.log(`  Hash calculations:  ${stats.hashCalls}`);

    console.log('\nTransposition Table:');
    console.log(`  Table size:         ${stats.ttSize} / ${this.maxTableSize}`);
    console.log(`  TT hits:            ${stats.ttHits}`);
    console.log(`  TT misses:          ${stats.ttMisses}`);
    console.log(`  Hit rate:           ${stats.ttHitRate}`);
    console.log(`  Collisions:         ${stats.ttCollisions}`);

    console.log('\nTotal Time Spent:');
    console.log(`  Cloning:            ${stats.cloneTime.toFixed(2)}ms`);
    console.log(`    - Serialize:      ${stats.jsonSerializeTime.toFixed(2)}ms`);
    console.log(`    - Deserialize:    ${stats.jsonDeserializeTime.toFixed(2)}ms`);
    console.log(`  Simulation:         ${stats.simulateTime.toFixed(2)}ms`);
    console.log(`  MakeChoices:        ${stats.makeChoicesTime.toFixed(2)}ms`);
    console.log(`  Evaluation:         ${stats.evaluateTime.toFixed(2)}ms`);
    console.log(`  Move ordering:      ${stats.moveOrderingTime.toFixed(2)}ms`);
    console.log(`  Hashing:            ${stats.hashTime.toFixed(2)}ms`);

    console.log('\nAverage Time Per Call:');
    console.log(`  Clone:              ${stats.avgCloneTime.toFixed(3)}ms`);
    console.log(`  Simulate:           ${stats.avgSimulateTime.toFixed(3)}ms`);
    console.log(`  MakeChoices:        ${stats.avgMakeChoicesTime.toFixed(3)}ms`);
    console.log(`  Evaluate:           ${stats.avgEvaluateTime.toFixed(3)}ms`);
    console.log(`  Move ordering:      ${stats.avgMoveOrderingTime.toFixed(3)}ms`);
    console.log(`  Hashing:            ${stats.avgHashTime.toFixed(3)}ms`);

    console.log('\nBreakdown by Percentage:');
    const total = stats.cloneTime + stats.makeChoicesTime + stats.evaluateTime + stats.moveOrderingTime + stats.hashTime;
    if (total > 0) {
      console.log(`  Cloning:            ${(stats.cloneTime / total * 100).toFixed(1)}%`);
      console.log(`  MakeChoices:        ${(stats.makeChoicesTime / total * 100).toFixed(1)}%`);
      console.log(`  Evaluation:         ${(stats.evaluateTime / total * 100).toFixed(1)}%`);
      console.log(`  Move ordering:      ${(stats.moveOrderingTime / total * 100).toFixed(1)}%`);
      console.log(`  Hashing:            ${(stats.hashTime / total * 100).toFixed(1)}%`);
    }

    console.log('='.repeat(70));
  }
}

module.exports = TranspositionMoveSimulator;
