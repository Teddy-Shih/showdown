const { Dex } = require('@pkmn/sim');

/**
 * GameState - Lightweight battle state representation for tree search
 * Represents the key battle information needed for move simulation
 */
class GameState {
  constructor(request) {
    this.dex = Dex;

    // Extract our team state
    this.ourTeam = this.extractTeamState(request.side.pokemon, true);
    this.ourActive = this.ourTeam.find(p => p.active) || this.ourTeam[0];

    // Extract opponent team state (from our perspective)
    // Note: opponent info is limited in request object
    this.oppTeam = [];
    this.oppActive = null;

    // Available moves for active Pokemon
    this.ourMoves = request.active && request.active[0] ?
      request.active[0].moves.filter(m => !m.disabled && m.pp > 0) : [];
    this.oppMoves = []; // Unknown, will estimate

    // Field conditions
    this.ourSideConditions = this.extractSideConditions(request.side);
    this.oppSideConditions = { stealthRock: false, spikes: 0, toxicSpikes: 0 };

    // Weather, terrain, etc.
    this.weather = null;
    this.terrain = null;
  }

  /**
   * Extract team state from Pokemon array
   */
  extractTeamState(pokemonArray, isOurs) {
    return pokemonArray.map((p, idx) => {
      const condition = this.parseCondition(p.condition);
      const speciesName = p.ident.split(':')[1].trim().split(',')[0];
      const species = this.dex.species.get(speciesName);

      return {
        species: speciesName,
        types: species.types,
        active: p.active || false,
        hp: condition.hp,
        maxHP: condition.maxHP,
        status: condition.status,
        stats: p.stats || this.estimateStats(species, p.level || 100),
        boosts: p.boosts || {},
        item: p.item || null,
        ability: p.ability || species.abilities[0],
        level: p.level || 100,
        moves: p.moves || [],
        position: idx
      };
    });
  }

  /**
   * Parse HP condition string
   */
  parseCondition(condition) {
    if (!condition || condition === '0 fnt') {
      return { hp: 0, maxHP: 100, status: 'fnt' };
    }

    const parts = condition.split(' ');
    const hpParts = parts[0].split('/');
    const hp = parseInt(hpParts[0]) || 0;
    const maxHP = parseInt(hpParts[1]) || 100;
    const status = parts[1] || null;

    return { hp, maxHP, status };
  }

  /**
   * Estimate stats for a Pokemon (used when actual stats unavailable)
   */
  estimateStats(species, level) {
    // Assume neutral nature, max EVs in main stats
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

  /**
   * Extract side conditions (hazards, screens, etc.)
   */
  extractSideConditions(side) {
    const conditions = {
      stealthRock: false,
      spikes: 0,
      toxicSpikes: 0,
      reflect: false,
      lightScreen: false
    };

    if (side.sideConditions) {
      for (const condition in side.sideConditions) {
        if (condition === 'stealthrock') conditions.stealthRock = true;
        if (condition === 'spikes') conditions.spikes = side.sideConditions[condition].layers || 1;
        if (condition === 'toxicspikes') conditions.toxicSpikes = side.sideConditions[condition].layers || 1;
        if (condition === 'reflect') conditions.reflect = true;
        if (condition === 'lightscreen') conditions.lightScreen = true;
      }
    }

    return conditions;
  }

  /**
   * Clone this state for simulation
   */
  clone() {
    const cloned = Object.create(GameState.prototype);
    cloned.dex = this.dex;
    cloned.ourTeam = JSON.parse(JSON.stringify(this.ourTeam));
    cloned.oppTeam = JSON.parse(JSON.stringify(this.oppTeam));
    cloned.ourActive = cloned.ourTeam.find(p => p.active);
    cloned.oppActive = cloned.oppTeam.length > 0 ? cloned.oppTeam.find(p => p.active) : null;
    cloned.ourMoves = [...this.ourMoves];
    cloned.oppMoves = [...this.oppMoves];
    cloned.ourSideConditions = { ...this.ourSideConditions };
    cloned.oppSideConditions = { ...this.oppSideConditions };
    cloned.weather = this.weather;
    cloned.terrain = this.terrain;
    return cloned;
  }

  /**
   * Check if battle is over
   */
  isTerminal() {
    const ourAlive = this.ourTeam.filter(p => p.hp > 0).length;
    const oppAlive = this.oppTeam.filter(p => p.hp > 0).length;
    return ourAlive === 0 || oppAlive === 0;
  }

  /**
   * Get simple evaluation score (positive = good for us)
   */
  getScore() {
    let score = 0;

    // HP advantage
    const ourTotalHP = this.ourTeam.reduce((sum, p) => sum + p.hp, 0);
    const ourTotalMaxHP = this.ourTeam.reduce((sum, p) => sum + p.maxHP, 0);
    const oppTotalHP = this.oppTeam.reduce((sum, p) => sum + p.hp, 0);
    const oppTotalMaxHP = this.oppTeam.reduce((sum, p) => sum + p.maxHP, 0);

    score += (ourTotalHP / ourTotalMaxHP) * 100;
    score -= (oppTotalHP / oppTotalMaxHP) * 100;

    // Pokemon count advantage
    const ourAlive = this.ourTeam.filter(p => p.hp > 0).length;
    const oppAlive = this.oppTeam.filter(p => p.hp > 0).length;
    score += (ourAlive - oppAlive) * 200;

    // Status conditions
    const ourStatused = this.ourTeam.filter(p => p.status && p.hp > 0).length;
    const oppStatused = this.oppTeam.filter(p => p.status && p.hp > 0).length;
    score -= ourStatused * 30;
    score += oppStatused * 30;

    // Hazards
    if (this.oppSideConditions.stealthRock) score += 50;
    if (this.ourSideConditions.stealthRock) score -= 50;
    score += this.oppSideConditions.spikes * 20;
    score -= this.ourSideConditions.spikes * 20;

    return score;
  }
}

module.exports = GameState;
