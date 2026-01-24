/**
 * RandomBot - A simple bot that selects random valid moves
 */
class RandomBot {
  constructor(playerName) {
    this.name = playerName;
  }

  /**
   * Choose a random move from available options
   * @param {Object} request - The request object from Pokemon Showdown
   * @returns {string} - The choice string (e.g., "move 1", "switch 2")
   */
  chooseMove(request) {
    // If we need to switch (force switch scenario)
    if (request.forceSwitch) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        const randomSwitch = switches[Math.floor(Math.random() * switches.length)];
        return `switch ${randomSwitch}`;
      }
    }

    // Get available moves for the active Pokemon
    const active = request.active[0];
    const availableMoves = [];

    // Add all non-disabled moves
    if (active && active.moves) {
      for (let i = 0; i < active.moves.length; i++) {
        const move = active.moves[i];
        if (!move.disabled && move.pp > 0) {
          availableMoves.push(i + 1); // Moves are 1-indexed
        }
      }
    }

    // If no moves available, try to switch
    if (availableMoves.length === 0) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        const randomSwitch = switches[Math.floor(Math.random() * switches.length)];
        return `switch ${randomSwitch}`;
      }
      // If no switches available, struggle or pass
      return 'move 1';
    }

    // Choose a random move
    const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
    return `move ${randomMove}`;
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

module.exports = RandomBot;
