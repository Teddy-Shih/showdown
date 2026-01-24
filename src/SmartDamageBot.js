const { Dex } = require('@pkmn/sim');

/**
 * SmartDamageBot - Uses base power, STAB, and actual stats for damage estimation
 * More accurate than random but simpler than full damage calculation
 */
class SmartDamageBot {
  constructor(playerName) {
    this.name = playerName;
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
    }

    // Get available moves
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'move 1';
    }

    // Get our Pokemon
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'move 1';
    }

    // Calculate scores for each move
    const moveScores = [];
    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];

      if (moveData.disabled || moveData.pp === 0) {
        continue;
      }

      const score = this.scoreMove(moveData, ourPokemon);
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
      return 'move 1';
    }

    // Sort by score (highest first)
    moveScores.sort((a, b) => b.score - a.score);
    return `move ${moveScores[0].slot}`;
  }

  scoreMove(moveData, ourPokemon) {
    const move = Dex.moves.get(moveData.id);
    const speciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const species = Dex.species.get(speciesName);

    // Base power
    let score = move.basePower || 0;

    // Status moves get special scores
    if (move.category === 'Status') {
      if (['sleeppowder', 'spore', 'hypnosis'].includes(move.id)) {
        return 120;
      } else if (['thunderwave', 'willowisp', 'toxic'].includes(move.id)) {
        return 90;
      } else if (['stealthrock', 'spikes'].includes(move.id)) {
        return 100;
      } else if (['swordsdance', 'nastyplot', 'dragondance', 'quiverdance', 'calmmind'].includes(move.id)) {
        return 85;
      }
      return 20;
    }

    // Apply STAB (Same Type Attack Bonus)
    if (species.types.includes(move.type)) {
      score *= 1.5;
    }

    // Consider our attacking stat
    const attackStat = move.category === 'Physical' ? 'atk' : 'spa';
    if (ourPokemon.stats && ourPokemon.stats[attackStat]) {
      // Scale based on our stat (200-400 range typical)
      const statModifier = Math.max(0.5, Math.min(2.0, ourPokemon.stats[attackStat] / 250));
      score *= statModifier;
    }

    // Boost if we have stat boosts
    if (ourPokemon.boosts) {
      const boostStat = move.category === 'Physical' ? 'atk' : 'spa';
      if (ourPokemon.boosts[boostStat]) {
        const boostMultiplier = 1 + (ourPokemon.boosts[boostStat] * 0.5);
        score *= Math.max(0.25, Math.min(4.0, boostMultiplier));
      }
    }

    // Consider accuracy (reduce score for inaccurate moves)
    if (move.accuracy !== true && move.accuracy < 100) {
      score *= (move.accuracy / 100);
    }

    return score;
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

module.exports = SmartDamageBot;
