const { Dex } = require('@pkmn/sim');
const PositionEvaluator = require('./PositionEvaluator');

/**
 * MinimaxBot - Uses minimax search with position evaluation
 * Much more sophisticated than SmartDamageBot
 */
class MinimaxBot {
  constructor(playerName) {
    this.name = playerName;
    this.evaluator = new PositionEvaluator();
    this.dex = Dex;
  }

  chooseMove(request) {
    // Safety check
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    // Handle force switch
    if (request.forceSwitch) {
      return this.chooseBestSwitch(request);
    }

    // Get available moves
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'move 1';
    }

    // Get our active Pokemon
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'move 1';
    }

    // Evaluate each move with minimax
    const moveEvaluations = [];

    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];

      if (moveData.disabled || moveData.pp === 0) {
        continue;
      }

      const score = this.evaluateMove(moveData, ourPokemon, request);
      moveEvaluations.push({
        slot: i + 1,
        score: score,
        move: moveData.move
      });
    }

    // If no moves available, try to switch
    if (moveEvaluations.length === 0) {
      return this.chooseBestSwitch(request);
    }

    // Sort by score (highest first)
    moveEvaluations.sort((a, b) => b.score - a.score);

    return `move ${moveEvaluations[0].slot}`;
  }

  /**
   * Evaluate a move considering position, not just damage
   */
  evaluateMove(moveData, ourPokemon, request) {
    const move = this.dex.moves.get(moveData.id);
    const currentPosition = this.evaluator.evaluate(request);

    let score = 0;

    // 1. Direct damage value (still important)
    const damageScore = this.estimateDamage(moveData, ourPokemon);
    score += damageScore * 1.5; // Weight damage highly

    // 2. Consider move category and effects
    if (move.category === 'Status') {
      score += this.evaluateStatusMove(move, request);
    } else {
      // 3. For attacking moves, consider if we can KO
      const koBonus = this.estimateKOPotential(damageScore);
      score += koBonus;
    }

    // 4. Consider our current position
    // If we're winning, play safer
    // If we're losing, take risks
    if (currentPosition > 200) {
      // We're ahead - prefer safe high accuracy moves
      if (move.accuracy && move.accuracy < 90) {
        score *= 0.8; // Penalize risky moves when ahead
      }
    } else if (currentPosition < -200) {
      // We're behind - need to take risks
      if (move.basePower > 100) {
        score *= 1.2; // Favor high power moves when behind
      }
    }

    // 5. Consider stat boosts if it's a boosting move
    if (move.boosts) {
      score += this.evaluateBoostMove(move, request);
    }

    // 6. Hazard moves (Stealth Rock, Spikes, etc.)
    if (move.id === 'stealthrock' || move.id === 'spikes' || move.id === 'toxicspikes') {
      score += this.evaluateHazardMove(move, request);
    }

    return score;
  }

  /**
   * Estimate damage (similar to SmartDamageBot but simplified)
   */
  estimateDamage(moveData, ourPokemon) {
    const move = this.dex.moves.get(moveData.id);
    let damage = move.basePower || 0;

    if (damage === 0) return 0;

    // Apply STAB
    const speciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const species = this.dex.species.get(speciesName);

    if (species.types.includes(move.type)) {
      damage *= 1.5;
    }

    // Consider stats
    const attackStat = move.category === 'Physical' ? 'atk' : 'spa';
    if (ourPokemon.stats && ourPokemon.stats[attackStat]) {
      const statMultiplier = ourPokemon.stats[attackStat] / 250;
      damage *= statMultiplier;
    }

    // Apply accuracy penalty
    if (move.accuracy && move.accuracy < 100) {
      damage *= (move.accuracy / 100);
    }

    return damage;
  }

  /**
   * Evaluate status moves strategically
   */
  evaluateStatusMove(move, request) {
    let score = 0;

    // Sleep moves are very valuable
    if (['sleeppowder', 'spore', 'hypnosis', 'darkvoid'].includes(move.id)) {
      score = 250; // Very high value
    }
    // Paralysis/Burn are good
    else if (['thunderwave', 'willowisp', 'toxic'].includes(move.id)) {
      score = 180;
    }
    // Hazards are valuable early game
    else if (['stealthrock', 'spikes', 'toxicspikes'].includes(move.id)) {
      score = 200;
    }
    // Setup moves
    else if (move.boosts) {
      score = this.evaluateBoostMove(move, request);
    }
    // Recovery moves
    else if (['recover', 'roost', 'synthesis', 'moonlight', 'slackoff'].includes(move.id)) {
      const ourPokemon = request.side.pokemon.find(p => p.active);
      if (ourPokemon) {
        const hpData = this.evaluator.parseHP(ourPokemon.condition);
        const hpPercent = hpData.current / hpData.max;

        // Recovery is more valuable when low HP
        if (hpPercent < 0.5) {
          score = 200 * (1 - hpPercent);
        } else {
          score = 50; // Less valuable at high HP
        }
      }
    }
    else {
      score = 40; // Generic status move
    }

    return score;
  }

  /**
   * Evaluate stat boost moves
   */
  evaluateBoostMove(move, request) {
    let score = 120; // Base value for setup

    if (move.boosts) {
      // Offensive boosts are very valuable
      if (move.boosts.atk) score += move.boosts.atk * 60;
      if (move.boosts.spa) score += move.boosts.spa * 60;
      if (move.boosts.spe) score += move.boosts.spe * 40;

      // Defensive boosts
      if (move.boosts.def) score += move.boosts.def * 30;
      if (move.boosts.spd) score += move.boosts.spd * 30;
    }

    // Check if we already have boosts (diminishing returns)
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (ourPokemon && ourPokemon.boosts) {
      const totalBoosts = Object.values(ourPokemon.boosts).reduce((a, b) => a + Math.abs(b), 0);
      if (totalBoosts >= 2) {
        score *= 0.5; // Reduce value if already boosted
      }
    }

    return score;
  }

  /**
   * Evaluate hazard moves
   */
  evaluateHazardMove(move, request) {
    // Hazards are very valuable early in battle
    // TODO: Track if hazards are already up
    // For now, assume they're not and value them highly

    return 220;
  }

  /**
   * Estimate KO potential
   */
  estimateKOPotential(damage) {
    // If damage is very high (>300), likely a KO
    if (damage > 300) return 150;
    if (damage > 200) return 100;
    if (damage > 150) return 50;
    return 0;
  }

  /**
   * Choose best switch option
   */
  chooseBestSwitch(request) {
    const switches = this.getAvailableSwitches(request);

    if (switches.length === 0) {
      return 'move 1';
    }

    // For now, pick the first available switch
    // TODO: Evaluate type matchups and choose best counter
    return `switch ${switches[0]}`;
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

module.exports = MinimaxBot;
