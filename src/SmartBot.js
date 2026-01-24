const { Dex } = require('@pkmn/sim');

/**
 * SmartBot - Enhanced SmartDamageBot with strategic awareness
 * Combines damage calculation with understanding of setup, hazards, and position
 */
class SmartBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.hazardsSet = false; // Track if we've set hazards
    this.setupCount = 0; // Track setup move usage
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

    // Evaluate position
    const position = this.evaluatePosition(request);

    // Evaluate each move
    const moveScores = [];
    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];

      if (moveData.disabled || moveData.pp === 0) {
        continue;
      }

      const score = this.scoreMove(moveData, ourPokemon, request, position);
      moveScores.push({
        slot: i + 1,
        score: score,
        move: moveData.move
      });
    }

    if (moveScores.length === 0) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
      return 'default';
    }

    // Sort by score (highest first)
    moveScores.sort((a, b) => b.score - a.score);
    return `move ${moveScores[0].slot}`;
  }

  scoreMove(moveData, ourPokemon, request, position) {
    const move = this.dex.moves.get(moveData.id);
    const speciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const species = this.dex.species.get(speciesName);

    let score = 0;

    // Status moves get special handling
    if (move.category === 'Status') {
      return this.scoreStatusMove(move, request, position);
    }

    // Base power
    score = move.basePower || 0;

    // Apply STAB
    if (species.types.includes(move.type)) {
      score *= 1.5;
    }

    // Consider attacking stat
    const attackStat = move.category === 'Physical' ? 'atk' : 'spa';
    if (ourPokemon.stats && ourPokemon.stats[attackStat]) {
      const statModifier = Math.max(0.5, Math.min(2.0, ourPokemon.stats[attackStat] / 250));
      score *= statModifier;
    }

    // Consider stat boosts
    if (ourPokemon.boosts) {
      const boostStat = move.category === 'Physical' ? 'atk' : 'spa';
      if (ourPokemon.boosts[boostStat]) {
        const boostMultiplier = 1 + (ourPokemon.boosts[boostStat] * 0.5);
        score *= Math.max(0.25, Math.min(4.0, boostMultiplier));
      }
    }

    // Accuracy penalty
    if (move.accuracy !== true && move.accuracy < 100) {
      score *= (move.accuracy / 100);
    }

    // Penalize moves with severe drawbacks
    if (['glaiverush', 'superfang', 'finalgambit'].includes(move.id)) {
      score *= 0.5; // These have major downsides
    }

    // Bonus for high HP moves when we're healthy
    const hpPercent = this.getHPPercent(ourPokemon);
    if (hpPercent > 0.8 && move.basePower >= 120) {
      score *= 1.2; // Favor power when healthy
    }

    return score;
  }

  scoreStatusMove(move, request, position) {
    // Hazards (if we haven't set them yet)
    if (move.id === 'stealthrock' && !this.hazardsSet) {
      this.hazardsSet = true;
      return 250;
    }

    // Setup moves (limit to avoid spamming)
    if (move.boosts && this.setupCount < 2) {
      const ourPokemon = request.side.pokemon.find(p => p.active);
      const hpPercent = this.getHPPercent(ourPokemon);

      // Only setup if we have good HP
      if (hpPercent > 0.6) {
        let setupScore = 150;

        // Add bonus based on boost quality
        if (move.boosts.atk) setupScore += move.boosts.atk * 50;
        if (move.boosts.spa) setupScore += move.boosts.spa * 50;
        if (move.boosts.spe) setupScore += move.boosts.spe * 30;

        this.setupCount++;
        return setupScore;
      }
    }

    // Sleep moves
    if (['sleeppowder', 'spore', 'hypnosis'].includes(move.id)) {
      return 180;
    }

    // Other status
    if (['thunderwave', 'willowisp', 'toxic'].includes(move.id)) {
      return 120;
    }

    // Recovery (when low HP)
    if (['recover', 'roost', 'synthesis', 'slackoff'].includes(move.id)) {
      const ourPokemon = request.side.pokemon.find(p => p.active);
      const hpPercent = this.getHPPercent(ourPokemon);

      if (hpPercent < 0.5) {
        return 200 * (1 - hpPercent);
      }
      return 30;
    }

    // Default status move
    return 60;
  }

  evaluatePosition(request) {
    let score = 0;

    const ourTeam = request.side.pokemon;

    // Count alive Pokemon
    let ourAlive = 0;
    let totalHP = 0;
    let maxHP = 0;

    for (const pokemon of ourTeam) {
      if (pokemon.condition !== '0 fnt') {
        ourAlive++;

        const hp = this.parseHP(pokemon.condition);
        totalHP += hp.current;
        maxHP += hp.max;
      }
    }

    score += ourAlive * 100;
    score += (totalHP / maxHP) * 100;

    return score;
  }

  getHPPercent(pokemon) {
    const hp = this.parseHP(pokemon.condition);
    return hp.current / hp.max;
  }

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

module.exports = SmartBot;
