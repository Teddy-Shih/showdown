const { Battle } = require('@pkmn/sim');

/**
 * Clone a Battle for search without touching the original.
 *
 * Battle#toJSON() puts the live `log` array on the serialized state by
 * reference, and Battle.fromJSON() assigns that same array to the clone. Any
 * turn simulated on the clone then appends to the real battle's log. The sim
 * throws "Infinite loop" once more than 1000 unsent lines accumulate, so search
 * clones were crashing real games (and leaking phantom lines to stream clients).
 * Giving each clone its own empty log fixes both problems.
 */
function cloneBattle(battle) {
  const state = battle.toJSON();
  state.log = [];
  return Battle.fromJSON(state);
}

module.exports = cloneBattle;
