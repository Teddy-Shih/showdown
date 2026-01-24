const { Dex } = require('@pkmn/sim');
const { calculate, Pokemon, Move, Generations } = require('@smogon/calc');

/**
 * MaxDamageBot - A bot that calculates actual damage and selects the highest damage move
 * Uses @smogon/calc for accurate damage calculation including types, stats, abilities, items
 */
class MaxDamageBot {
  constructor(playerName) {
    this.name = playerName;
    this.gen = Generations.get(9); // Gen 9
  }

  /**
   * Choose the move with highest expected damage
   * @param {Object} request - The request object from Pokemon Showdown
   * @returns {string} - The choice string (e.g., "move 1", "switch 2")
   */
  chooseMove(request) {
    // If we need to switch (force switch scenario)
    if (request.forceSwitch) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
    }

    // Get available moves for the active Pokemon
    const active = request.active[0];
    if (!active || !active.moves) {
      return 'move 1';
    }

    // Get our active Pokemon info
    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'move 1';
    }

    // Calculate damage for each move
    const moveScores = [];
    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];

      // Skip disabled moves or moves without PP
      if (moveData.disabled || moveData.pp === 0) {
        continue;
      }

      const damage = this.estimateDamage(moveData, ourPokemon, request);
      moveScores.push({
        slot: i + 1,
        damage: damage,
        move: moveData.move
      });
    }

    // If no moves available, try to switch
    if (moveScores.length === 0) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
      return 'move 1'; // Last resort
    }

    // Sort by damage (highest first)
    moveScores.sort((a, b) => b.damage - a.damage);

    // Choose the highest damage move
    return `move ${moveScores[0].slot}`;
  }

  /**
   * Estimate damage for a move using actual damage calculator
   * @param {Object} moveData - Move data from request
   * @param {Object} ourPokemon - Our active Pokemon
   * @param {Object} request - Full request object for context
   * @returns {number} - Estimated average damage
   */
  estimateDamage(moveData, ourPokemon, request) {
    try {
      // Parse our Pokemon's species name
      const speciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];

      // Create attacker Pokemon object for damage calculator
      const attackerOptions = {
        level: ourPokemon.level || 100,
      };

      // Add stats if available
      if (ourPokemon.stats) {
        attackerOptions.evs = {
          hp: 85, // Default EVs
          atk: 85,
          def: 85,
          spa: 85,
          spd: 85,
          spe: 85
        };
      }

      // Try to infer current boosts
      if (ourPokemon.boosts) {
        attackerOptions.boosts = ourPokemon.boosts;
      }

      const attacker = new Pokemon(this.gen, speciesName, attackerOptions);

      // For the defender, we need to make assumptions since we don't know their exact Pokemon
      // In a real implementation, we'd track opponent Pokemon from battle messages
      // For now, use a generic bulky Pokemon as baseline
      const defender = new Pokemon(this.gen, 'Blissey', {
        level: 100,
        evs: {hp: 252, def: 252, spd: 252}
      });

      // Create move object
      const move = new Move(this.gen, moveData.id);

      // Calculate damage
      const result = calculate(this.gen, attacker, defender, move);

      // Get average damage
      const damageRolls = result.damage;
      let avgDamage = 0;

      if (Array.isArray(damageRolls)) {
        avgDamage = damageRolls.reduce((a, b) => a + b, 0) / damageRolls.length;
      } else {
        avgDamage = damageRolls;
      }

      // For status moves, assign special values
      if (avgDamage === 0) {
        const moveObj = Dex.moves.get(moveData.id);
        if (moveObj.category === 'Status') {
          if (['sleeppowder', 'spore', 'hypnosis'].includes(moveObj.id)) {
            return 300; // Sleep is very valuable
          } else if (['thunderwave', 'willowisp', 'toxic'].includes(moveObj.id)) {
            return 200; // Status conditions
          } else if (['stealthrock', 'spikes'].includes(moveObj.id)) {
            return 250; // Hazards
          } else if (['swordsdance', 'nastyplot', 'dragondance', 'quiverdance', 'calmmind'].includes(moveObj.id)) {
            return 180; // Setup moves
          }
          return 50; // Other status moves
        }
      }

      return avgDamage;

    } catch (error) {
      // If calculation fails, fall back to simple base power
      const move = Dex.moves.get(moveData.id);
      return move.basePower || 0;
    }
  }

  /**
   * Get list of available Pokemon to switch to
   * @param {Object} request - The request object
   * @returns {Array<number>} - Array of valid switch positions (1-indexed)
   */
  getAvailableSwitches(request) {
    const switches = [];
    const team = request.side.pokemon;

    for (let i = 0; i < team.length; i++) {
      const pokemon = team[i];
      // Can switch if not active and not fainted
      if (!pokemon.active && pokemon.condition !== '0 fnt') {
        switches.push(i + 1); // 1-indexed
      }
    }

    return switches;
  }
}

module.exports = MaxDamageBot;
