const { Battle } = require('@pkmn/sim');

/**
 * CachedEngineMoveSimulator - Adds transposition table caching
 *
 * Optimization: Cache evaluated positions to avoid re-simulating identical states
 */
class CachedEngineMoveSimulator {
  constructor() {
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.maxCacheSize = 1000; // Limit memory usage
  }

  /**
   * Create a hash key for battle state
   * Simplified - just use turn + HP of active Pokemon
   */
  getBattleStateKey(battle, p1Choice, p2Choice) {
    const p1Active = battle.p1.active[0];
    const p2Active = battle.p2.active[0];

    if (!p1Active || !p2Active) {
      return null;
    }

    // Create a simple hash
    return `t${battle.turn}:${p1Active.species.id}${p1Active.hp}:${p2Active.species.id}${p2Active.hp}:${p1Choice}:${p2Choice}`;
  }

  cloneBattle(battle) {
    const serialized = battle.toJSON();
    return Battle.fromJSON(serialized);
  }

  /**
   * Simulate turn with caching
   */
  simulateTurn(battle, p1Choice, p2Choice) {
    // Check cache
    const cacheKey = this.getBattleStateKey(battle, p1Choice, p2Choice);

    if (cacheKey && this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey);
    }

    this.cacheMisses++;

    // Simulate
    const cloned = this.cloneBattle(battle);

    try {
      cloned.makeChoices(p1Choice, p2Choice);
    } catch (error) {
      // Return cloned state even on error
    }

    // Cache result (if cache not full)
    if (cacheKey && this.cache.size < this.maxCacheSize) {
      this.cache.set(cacheKey, cloned);
    }

    return cloned;
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

  evaluateState(battle, player = 'p1') {
    const us = player === 'p1' ? battle.p1 : battle.p2;
    const them = player === 'p1' ? battle.p2 : battle.p1;

    if (battle.ended) {
      const winner = battle.winner;
      if (winner === (player === 'p1' ? 'P1' : 'P2')) {
        return 10000;
      } else if (winner) {
        return -10000;
      }
      return 0;
    }

    let score = 0;

    // HP advantage
    const ourHP = us.pokemon.reduce((sum, p) => sum + p.hp, 0);
    const ourMaxHP = us.pokemon.reduce((sum, p) => sum + p.maxhp, 0);
    const theirHP = them.pokemon.reduce((sum, p) => sum + p.hp, 0);
    const theirMaxHP = them.pokemon.reduce((sum, p) => sum + p.maxhp, 0);

    score += (ourHP / ourMaxHP) * 100;
    score -= (theirHP / theirMaxHP) * 100;

    // Pokemon count
    const ourAlive = us.pokemon.filter(p => p.hp > 0).length;
    const theirAlive = them.pokemon.filter(p => p.hp > 0).length;
    score += (ourAlive - theirAlive) * 200;

    // Status
    const ourStatused = us.pokemon.filter(p => p.status && p.hp > 0).length;
    const theirStatused = them.pokemon.filter(p => p.status && p.hp > 0).length;
    score -= ourStatused * 30;
    score += theirStatused * 30;

    return score;
  }

  getStats() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheSize: this.cache.size,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
    };
  }

  clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

module.exports = CachedEngineMoveSimulator;
