const { Dex } = require('@pkmn/sim');

/**
 * Position Evaluator - Evaluates the quality of a battle position
 * Used by minimax search to score positions
 */
class PositionEvaluator {
  constructor() {
    this.dex = Dex;
  }

  /**
   * Evaluate a battle position from perspective of player
   * Returns a score where positive = good for us, negative = good for opponent
   *
   * @param {Object} request - Battle request object
   * @param {string} perspective - 'us' or 'opponent'
   * @returns {number} - Position score
   */
  evaluate(request, perspective = 'us') {
    if (!request || !request.side) {
      return 0;
    }

    const ourTeam = request.side.pokemon;

    // Calculate our side's score
    let ourScore = 0;

    // 1. HP Advantage (most important)
    ourScore += this.evaluateHP(ourTeam) * 100;

    // 2. Pokemon Count (having more Pokemon alive is crucial)
    ourScore += this.evaluatePokemonCount(ourTeam) * 200;

    // 3. Status Conditions (burn, paralysis hurt)
    ourScore += this.evaluateStatus(ourTeam) * 50;

    // 4. Stat Boosts (setup sweepers)
    ourScore += this.evaluateBoosts(ourTeam) * 30;

    // 5. Active Pokemon matchup quality
    const activePokemon = ourTeam.find(p => p.active);
    if (activePokemon) {
      ourScore += this.evaluateActivePokemon(activePokemon, request) * 20;
    }

    return ourScore;
  }

  /**
   * Evaluate total HP across team
   */
  evaluateHP(team) {
    let totalHP = 0;
    let maxHP = 0;

    for (const pokemon of team) {
      const hpData = this.parseHP(pokemon.condition);
      totalHP += hpData.current;
      maxHP += hpData.max;
    }

    return maxHP > 0 ? (totalHP / maxHP) : 0;
  }

  /**
   * Evaluate number of alive Pokemon
   */
  evaluatePokemonCount(team) {
    let aliveCount = 0;

    for (const pokemon of team) {
      if (pokemon.condition !== '0 fnt') {
        aliveCount++;
      }
    }

    return aliveCount;
  }

  /**
   * Evaluate status conditions (negative for bad statuses)
   */
  evaluateStatus(team) {
    let statusScore = 0;

    for (const pokemon of team) {
      if (pokemon.condition.includes('brn')) statusScore -= 2; // Burn is bad
      if (pokemon.condition.includes('par')) statusScore -= 1.5; // Paralysis hurts speed
      if (pokemon.condition.includes('psn')) statusScore -= 1; // Poison
      if (pokemon.condition.includes('tox')) statusScore -= 2; // Toxic is worse
      if (pokemon.condition.includes('slp')) statusScore -= 2.5; // Sleep is very bad
      if (pokemon.condition.includes('frz')) statusScore -= 3; // Freeze is worst
    }

    return statusScore;
  }

  /**
   * Evaluate stat boosts
   */
  evaluateBoosts(team) {
    let boostScore = 0;

    const activePokemon = team.find(p => p.active);
    if (activePokemon && activePokemon.boosts) {
      // Offensive boosts are valuable
      boostScore += (activePokemon.boosts.atk || 0) * 2;
      boostScore += (activePokemon.boosts.spa || 0) * 2;
      boostScore += (activePokemon.boosts.spe || 0) * 1.5;

      // Defensive boosts are good too
      boostScore += (activePokemon.boosts.def || 0) * 1;
      boostScore += (activePokemon.boosts.spd || 0) * 1;

      // Evasion/accuracy
      boostScore += (activePokemon.boosts.evasion || 0) * 0.5;
      boostScore += (activePokemon.boosts.accuracy || 0) * 0.5;
    }

    return boostScore;
  }

  /**
   * Evaluate active Pokemon quality
   */
  evaluateActivePokemon(pokemon, request) {
    let score = 0;

    // Higher HP on active Pokemon is good
    const hpData = this.parseHP(pokemon.condition);
    score += (hpData.current / hpData.max) * 10;

    // Having moves with PP is good
    if (request.active && request.active[0] && request.active[0].moves) {
      const moves = request.active[0].moves;
      let usableMoves = 0;

      for (const move of moves) {
        if (!move.disabled && move.pp > 0) {
          usableMoves++;
        }
      }

      score += usableMoves * 2;
    }

    return score;
  }

  /**
   * Parse HP from condition string (e.g., "150/200" or "50/100 par")
   */
  parseHP(condition) {
    if (!condition || condition === '0 fnt') {
      return { current: 0, max: 100 };
    }

    const parts = condition.split(' ')[0].split('/');
    return {
      current: parseInt(parts[0]) || 0,
      max: parseInt(parts[1]) || 100
    };
  }

  /**
   * Evaluate type matchup (for future use)
   */
  evaluateTypeMatchup(attackerType, defenderType) {
    // This would use Dex.types.get() to calculate effectiveness
    // For now, simplified
    return 0;
  }
}

module.exports = PositionEvaluator;
