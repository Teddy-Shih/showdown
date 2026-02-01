const { Battle, Teams } = require('@pkmn/sim');

/**
 * ProfiledEngineMoveSimulator - Same as EngineMoveSimulator but with detailed timing
 */
class ProfiledEngineMoveSimulator {
  constructor() {
    // Performance counters
    this.stats = {
      cloneTime: 0,
      cloneCalls: 0,
      simulateTime: 0,
      simulateCalls: 0,
      evaluateTime: 0,
      evaluateCalls: 0,
      jsonSerializeTime: 0,
      jsonDeserializeTime: 0,
      makeChoicesTime: 0,
      makeChoicesCalls: 0
    };
  }

  createBattleFromTeams(team1, team2, formatid = 'gen9customgame') {
    const battle = new Battle({
      formatid,
      p1: { name: 'P1', team: team1 },
      p2: { name: 'P2', team: team2 }
    });

    battle.makeChoices('default', 'default');
    return battle;
  }

  cloneBattle(battle) {
    const start = performance.now();

    const serializeStart = performance.now();
    const serialized = battle.toJSON();
    this.stats.jsonSerializeTime += performance.now() - serializeStart;

    const deserializeStart = performance.now();
    const cloned = Battle.fromJSON(serialized);
    this.stats.jsonDeserializeTime += performance.now() - deserializeStart;

    this.stats.cloneTime += performance.now() - start;
    this.stats.cloneCalls++;

    return cloned;
  }

  simulateTurn(battle, p1Choice, p2Choice) {
    const start = performance.now();

    const cloned = this.cloneBattle(battle);

    try {
      const makeChoicesStart = performance.now();
      cloned.makeChoices(p1Choice, p2Choice);
      this.stats.makeChoicesTime += performance.now() - makeChoicesStart;
      this.stats.makeChoicesCalls++;

      this.stats.simulateTime += performance.now() - start;
      this.stats.simulateCalls++;

      return cloned;
    } catch (error) {
      this.stats.simulateTime += performance.now() - start;
      this.stats.simulateCalls++;
      return cloned;
    }
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

  extractState(battle, perspective = 'p1') {
    const us = perspective === 'p1' ? battle.p1 : battle.p2;
    const them = perspective === 'p1' ? battle.p2 : battle.p1;

    return {
      turn: battle.turn,
      ended: battle.ended,
      winner: battle.winner,
      ourActive: this.extractPokemonState(us.active[0]),
      ourTeam: us.pokemon.map(p => this.extractPokemonState(p)),
      oppActive: this.extractPokemonState(them.active[0]),
      oppTeam: them.pokemon.map(p => this.extractPokemonState(p)),
      weather: battle.field.weather,
      terrain: battle.field.terrain,
      ourSideConditions: this.extractSideConditions(us),
      oppSideConditions: this.extractSideConditions(them)
    };
  }

  extractPokemonState(pokemon) {
    if (!pokemon) return null;

    return {
      name: pokemon.name,
      species: pokemon.species.name,
      hp: pokemon.hp,
      maxhp: pokemon.maxhp,
      fainted: pokemon.fainted,
      active: pokemon.isActive,
      status: pokemon.status,
      statusState: pokemon.statusState,
      level: pokemon.level,
      types: pokemon.types,
      ability: pokemon.ability,
      item: pokemon.item,
      boosts: { ...pokemon.boosts },
      moves: pokemon.moveSlots?.map(m => ({
        id: m.id,
        pp: m.pp,
        maxpp: m.maxpp,
        disabled: m.disabled
      })) || []
    };
  }

  extractSideConditions(side) {
    const conditions = {};

    if (side.sideConditions) {
      for (const [condition, data] of Object.entries(side.sideConditions)) {
        if (condition === 'spikes' || condition === 'toxicspikes') {
          conditions[condition] = data.layers || 0;
        } else {
          conditions[condition] = true;
        }
      }
    }

    return conditions;
  }

  evaluateState(battle, player = 'p1') {
    const start = performance.now();

    const state = this.extractState(battle, player);

    if (state.ended) {
      this.stats.evaluateTime += performance.now() - start;
      this.stats.evaluateCalls++;

      if (state.winner === (player === 'p1' ? 'P1' : 'P2')) {
        return 10000;
      } else if (state.winner) {
        return -10000;
      }
      return 0;
    }

    let score = 0;

    const ourTotalHP = state.ourTeam.reduce((sum, p) => sum + p.hp, 0);
    const ourTotalMaxHP = state.ourTeam.reduce((sum, p) => sum + p.maxhp, 0);
    const oppTotalHP = state.oppTeam.reduce((sum, p) => sum + p.hp, 0);
    const oppTotalMaxHP = state.oppTeam.reduce((sum, p) => sum + p.maxhp, 0);

    score += (ourTotalHP / ourTotalMaxHP) * 100;
    score -= (oppTotalHP / oppTotalMaxHP) * 100;

    const ourAlive = state.ourTeam.filter(p => p.hp > 0).length;
    const oppAlive = state.oppTeam.filter(p => p.hp > 0).length;
    score += (ourAlive - oppAlive) * 200;

    const ourStatused = state.ourTeam.filter(p => p.status && p.hp > 0).length;
    const oppStatused = state.oppTeam.filter(p => p.status && p.hp > 0).length;
    score -= ourStatused * 30;
    score += oppStatused * 30;

    // Stat boosts (on active Pokemon)
    if (state.ourActive && state.ourActive.boosts) {
      const ourBoosts = state.ourActive.boosts;
      score += (ourBoosts.atk || 0) * 15;
      score += (ourBoosts.spa || 0) * 15;
      score += (ourBoosts.def || 0) * 12;
      score += (ourBoosts.spd || 0) * 12;
      score += (ourBoosts.spe || 0) * 20;
      score += (ourBoosts.accuracy || 0) * 8;
      score += (ourBoosts.evasion || 0) * 10;
    }

    if (state.oppActive && state.oppActive.boosts) {
      const oppBoosts = state.oppActive.boosts;
      score -= (oppBoosts.atk || 0) * 15;
      score -= (oppBoosts.spa || 0) * 15;
      score -= (oppBoosts.def || 0) * 12;
      score -= (oppBoosts.spd || 0) * 12;
      score -= (oppBoosts.spe || 0) * 20;
      score -= (oppBoosts.accuracy || 0) * 8;
      score -= (oppBoosts.evasion || 0) * 10;
    }

    if (state.oppSideConditions.stealthrock) score += 50;
    if (state.ourSideConditions.stealthrock) score -= 50;
    score += (state.oppSideConditions.spikes || 0) * 20;
    score -= (state.ourSideConditions.spikes || 0) * 20;

    this.stats.evaluateTime += performance.now() - start;
    this.stats.evaluateCalls++;

    return score;
  }

  getStats() {
    return {
      ...this.stats,
      avgCloneTime: this.stats.cloneCalls > 0 ? this.stats.cloneTime / this.stats.cloneCalls : 0,
      avgSimulateTime: this.stats.simulateCalls > 0 ? this.stats.simulateTime / this.stats.simulateCalls : 0,
      avgEvaluateTime: this.stats.evaluateCalls > 0 ? this.stats.evaluateTime / this.stats.evaluateCalls : 0,
      avgMakeChoicesTime: this.stats.makeChoicesCalls > 0 ? this.stats.makeChoicesTime / this.stats.makeChoicesCalls : 0
    };
  }

  resetStats() {
    this.stats = {
      cloneTime: 0,
      cloneCalls: 0,
      simulateTime: 0,
      simulateCalls: 0,
      evaluateTime: 0,
      evaluateCalls: 0,
      jsonSerializeTime: 0,
      jsonDeserializeTime: 0,
      makeChoicesTime: 0,
      makeChoicesCalls: 0
    };
  }

  printStats() {
    const stats = this.getStats();

    console.log('\n' + '='.repeat(70));
    console.log('PROFILING STATISTICS');
    console.log('='.repeat(70));

    console.log('\nFunction Call Counts:');
    console.log(`  Clone calls:        ${stats.cloneCalls}`);
    console.log(`  Simulate calls:     ${stats.simulateCalls}`);
    console.log(`  MakeChoices calls:  ${stats.makeChoicesCalls}`);
    console.log(`  Evaluate calls:     ${stats.evaluateCalls}`);

    console.log('\nTotal Time Spent:');
    console.log(`  Cloning:            ${stats.cloneTime.toFixed(2)}ms`);
    console.log(`    - Serialize:      ${stats.jsonSerializeTime.toFixed(2)}ms`);
    console.log(`    - Deserialize:    ${stats.jsonDeserializeTime.toFixed(2)}ms`);
    console.log(`  Simulation:         ${stats.simulateTime.toFixed(2)}ms`);
    console.log(`  MakeChoices:        ${stats.makeChoicesTime.toFixed(2)}ms`);
    console.log(`  Evaluation:         ${stats.evaluateTime.toFixed(2)}ms`);

    console.log('\nAverage Time Per Call:');
    console.log(`  Clone:              ${stats.avgCloneTime.toFixed(3)}ms`);
    console.log(`  Simulate:           ${stats.avgSimulateTime.toFixed(3)}ms`);
    console.log(`  MakeChoices:        ${stats.avgMakeChoicesTime.toFixed(3)}ms`);
    console.log(`  Evaluate:           ${stats.avgEvaluateTime.toFixed(3)}ms`);

    console.log('\nBreakdown by Percentage:');
    const total = stats.cloneTime + stats.makeChoicesTime + stats.evaluateTime;
    if (total > 0) {
      console.log(`  Cloning:            ${(stats.cloneTime / total * 100).toFixed(1)}%`);
      console.log(`  MakeChoices:        ${(stats.makeChoicesTime / total * 100).toFixed(1)}%`);
      console.log(`  Evaluation:         ${(stats.evaluateTime / total * 100).toFixed(1)}%`);
    }

    console.log('='.repeat(70));
  }
}

module.exports = ProfiledEngineMoveSimulator;
