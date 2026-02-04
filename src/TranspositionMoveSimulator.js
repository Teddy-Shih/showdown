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

    // HP advantage
    const ourTotalHP = state.ourTeam.reduce((sum, p) => sum + p.hp, 0);
    const ourTotalMaxHP = state.ourTeam.reduce((sum, p) => sum + p.maxhp, 0);
    const oppTotalHP = state.oppTeam.reduce((sum, p) => sum + p.hp, 0);
    const oppTotalMaxHP = state.oppTeam.reduce((sum, p) => sum + p.maxhp, 0);

    score += (ourTotalHP / ourTotalMaxHP) * 100;
    score -= (oppTotalHP / oppTotalMaxHP) * 100;

    // Pokemon count (most important)
    const ourAlive = state.ourTeam.filter(p => p.hp > 0).length;
    const oppAlive = state.oppTeam.filter(p => p.hp > 0).length;
    score += (ourAlive - oppAlive) * 200;

    // Status conditions
    const ourStatused = state.ourTeam.filter(p => p.status && p.hp > 0).length;
    const oppStatused = state.oppTeam.filter(p => p.status && p.hp > 0).length;
    score -= ourStatused * 30;
    score += oppStatused * 30;

    // Stat boosts (on active Pokemon only)
    if (state.ourActive && state.ourActive.boosts) {
      const ourBoosts = state.ourActive.boosts;
      score += (ourBoosts.atk || 0) * 15;
      score += (ourBoosts.spa || 0) * 15;
      score += (ourBoosts.def || 0) * 12;
      score += (ourBoosts.spd || 0) * 12;
      score += (ourBoosts.spe || 0) * 20;
      score += (ourBoosts.accuracy || 0) * 8;
      score += (ourBoosts.evasion || 0) * 10;
    }

    if (state.oppActive && state.oppActive.boosts) {
      const oppBoosts = state.oppActive.boosts;
      score -= (oppBoosts.atk || 0) * 15;
      score -= (oppBoosts.spa || 0) * 15;
      score -= (oppBoosts.def || 0) * 12;
      score -= (oppBoosts.spd || 0) * 12;
      score -= (oppBoosts.spe || 0) * 20;
      score -= (oppBoosts.accuracy || 0) * 8;
      score -= (oppBoosts.evasion || 0) * 10;
    }

    // Hazards
    if (state.oppSideConditions.stealthrock) score += 50;
    if (state.ourSideConditions.stealthrock) score -= 50;
    score += (state.oppSideConditions.spikes || 0) * 20;
    score -= (state.ourSideConditions.spikes || 0) * 20;

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
