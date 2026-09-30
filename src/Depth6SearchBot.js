const OptimizedDepth4Bot = require('./OptimizedDepth4Bot');

/**
 * Depth6SearchBot - OptimizedDepth4Bot searching up to 6 plies (3 turns).
 *
 * Each simulated turn costs a few milliseconds (Battle clone + resolution), so
 * a full 3-turn search does not always fit. The search deepens one turn at a
 * time and stops at the time limit (default 4s), keeping the deepest
 * completed result.
 */
class Depth6SearchBot extends OptimizedDepth4Bot {
  constructor(playerName, options = {}) {
    super(playerName, {
      ...options,
      maxDepth: 6,
      maxTableSize: options.maxTableSize || 50000, // Larger TT for depth 6
      maxMovesToConsider: options.maxMovesToConsider || 4,
      timeLimit: options.timeLimit || 4000
    });
  }
}

module.exports = Depth6SearchBot;
