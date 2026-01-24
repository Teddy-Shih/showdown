const { calculate, Pokemon, Move, Field, Side } = require('@smogon/calc');
const { Generations } = require('@smogon/calc');
const { Dex } = require('@pkmn/sim');

/**
 * MoveSimulator - Simulates move effects on GameState
 * Uses @smogon/calc for accurate damage calculation
 */
class MoveSimulator {
  constructor() {
    this.gen = Generations.get(9);
    this.dex = Dex;
  }

  /**
   * Simulate both players' moves and return the resulting state
   * Handles speed calculation to determine move order
   */
  simulateTurn(state, ourMoveChoice, oppMoveChoice) {
    const newState = state.clone();

    if (!newState.ourActive || !newState.oppActive) {
      return newState;
    }

    // Determine move order based on priority and speed
    const ourMove = this.dex.moves.get(ourMoveChoice.id || ourMoveChoice);
    const oppMove = this.dex.moves.get(oppMoveChoice.id || oppMoveChoice);

    const ourPriority = ourMove.priority || 0;
    const oppPriority = oppMove.priority || 0;

    let firstAttacker, firstMove, secondAttacker, secondMove;

    if (ourPriority > oppPriority) {
      firstAttacker = 'us';
      firstMove = ourMove;
      secondAttacker = 'opp';
      secondMove = oppMove;
    } else if (oppPriority > ourPriority) {
      firstAttacker = 'opp';
      firstMove = oppMove;
      secondAttacker = 'us';
      secondMove = ourMove;
    } else {
      // Same priority, check speed
      const ourSpeed = this.getEffectiveSpeed(newState.ourActive);
      const oppSpeed = this.getEffectiveSpeed(newState.oppActive);

      if (ourSpeed >= oppSpeed) {
        firstAttacker = 'us';
        firstMove = ourMove;
        secondAttacker = 'opp';
        secondMove = oppMove;
      } else {
        firstAttacker = 'opp';
        firstMove = oppMove;
        secondAttacker = 'us';
        secondMove = ourMove;
      }
    }

    // Execute first move
    this.executeMove(newState, firstAttacker, firstMove);

    // Check if target fainted
    if (firstAttacker === 'us' && newState.oppActive.hp <= 0) {
      return newState; // Opponent fainted, second move doesn't execute
    }
    if (firstAttacker === 'opp' && newState.ourActive.hp <= 0) {
      return newState; // We fainted, second move doesn't execute
    }

    // Execute second move
    this.executeMove(newState, secondAttacker, secondMove);

    return newState;
  }

  /**
   * Execute a single move
   */
  executeMove(state, attacker, move) {
    const isUs = attacker === 'us';
    const attackingPokemon = isUs ? state.ourActive : state.oppActive;
    const defendingPokemon = isUs ? state.oppActive : state.ourActive;

    if (!attackingPokemon || !defendingPokemon) return;

    // Handle different move categories
    if (move.category === 'Status') {
      this.applyStatusMove(state, attacker, move);
    } else {
      // Damaging move
      const damage = this.calculateDamage(attackingPokemon, defendingPokemon, move, state);
      defendingPokemon.hp = Math.max(0, defendingPokemon.hp - damage);

      // Apply secondary effects
      if (move.secondary && Math.random() < (move.secondary.chance || 100) / 100) {
        this.applySecondaryEffect(defendingPokemon, move.secondary);
      }
    }
  }

  /**
   * Calculate damage using @smogon/calc
   */
  calculateDamage(attacker, defender, move, state) {
    try {
      // Create Pokemon objects for calc
      const attackerPokemon = new Pokemon(this.gen, attacker.species, {
        level: attacker.level,
        ability: attacker.ability,
        item: attacker.item,
        nature: 'Adamant', // Assume neutral/beneficial
        evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
        boosts: attacker.boosts || {}
      });

      const defenderPokemon = new Pokemon(this.gen, defender.species, {
        level: defender.level,
        ability: defender.ability,
        item: defender.item,
        nature: 'Adamant',
        evs: { hp: 252, atk: 252, def: 252, spa: 252, spd: 252, spe: 252 },
        boosts: defender.boosts || {},
        curHP: defender.hp,
        status: defender.status
      });

      const moveObj = new Move(this.gen, move.name);
      const field = new Field();

      const result = calculate(this.gen, attackerPokemon, defenderPokemon, moveObj, field);

      // Use average damage for deterministic search
      const damageArray = result.damage;
      if (Array.isArray(damageArray)) {
        const avgDamage = damageArray.reduce((a, b) => a + b, 0) / damageArray.length;
        return Math.floor(avgDamage);
      }

      return damageArray || 0;
    } catch (error) {
      // Fallback to simple calculation if @smogon/calc fails
      return this.simpleDamageCalc(attacker, defender, move);
    }
  }

  /**
   * Simple fallback damage calculation
   */
  simpleDamageCalc(attacker, defender, move) {
    if (!move.basePower) return 0;

    const attackStat = move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
    const defenseStat = move.category === 'Physical' ? defender.stats.def : defender.stats.spd;

    let damage = Math.floor(((2 * attacker.level / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    // STAB
    if (attacker.types.includes(move.type)) {
      damage *= 1.5;
    }

    // Type effectiveness (simplified)
    const effectiveness = this.getTypeEffectiveness(move.type, defender.types);
    damage *= effectiveness;

    return Math.floor(damage);
  }

  /**
   * Get type effectiveness
   */
  getTypeEffectiveness(moveType, defenderTypes) {
    let multiplier = 1;
    for (const defenderType of defenderTypes) {
      const typeData = this.dex.types.get(moveType);
      if (typeData.damageTaken[defenderType] === 1) multiplier *= 2; // Super effective
      if (typeData.damageTaken[defenderType] === 2) multiplier *= 0.5; // Not very effective
      if (typeData.damageTaken[defenderType] === 3) multiplier *= 0; // Immune
    }
    return multiplier;
  }

  /**
   * Apply status move effects
   */
  applyStatusMove(state, attacker, move) {
    const isUs = attacker === 'us';

    // Hazards
    if (move.id === 'stealthrock') {
      if (isUs) state.oppSideConditions.stealthRock = true;
      else state.ourSideConditions.stealthRock = true;
      return;
    }

    if (move.id === 'spikes') {
      if (isUs) state.oppSideConditions.spikes = Math.min(3, state.oppSideConditions.spikes + 1);
      else state.ourSideConditions.spikes = Math.min(3, state.ourSideConditions.spikes + 1);
      return;
    }

    // Stat boosts (on self)
    if (move.boosts) {
      const pokemon = isUs ? state.ourActive : state.oppActive;
      for (const stat in move.boosts) {
        pokemon.boosts[stat] = (pokemon.boosts[stat] || 0) + move.boosts[stat];
        pokemon.boosts[stat] = Math.max(-6, Math.min(6, pokemon.boosts[stat]));
      }
      return;
    }

    // Status conditions on opponent
    if (move.status) {
      const target = isUs ? state.oppActive : state.ourActive;
      if (!target.status) {
        target.status = move.status;
      }
      return;
    }

    // Recovery
    if (['recover', 'roost', 'synthesis', 'slackoff'].includes(move.id)) {
      const pokemon = isUs ? state.ourActive : state.oppActive;
      pokemon.hp = Math.min(pokemon.maxHP, pokemon.hp + Math.floor(pokemon.maxHP / 2));
      return;
    }
  }

  /**
   * Apply secondary effect of a move
   */
  applySecondaryEffect(target, secondary) {
    if (secondary.status && !target.status) {
      target.status = secondary.status;
    }
    if (secondary.boosts) {
      for (const stat in secondary.boosts) {
        target.boosts[stat] = (target.boosts[stat] || 0) + secondary.boosts[stat];
        target.boosts[stat] = Math.max(-6, Math.min(6, target.boosts[stat]));
      }
    }
  }

  /**
   * Get effective speed with boosts
   */
  getEffectiveSpeed(pokemon) {
    let speed = pokemon.stats.spe;
    const boosts = pokemon.boosts.spe || 0;

    if (boosts > 0) {
      speed *= (2 + boosts) / 2;
    } else if (boosts < 0) {
      speed *= 2 / (2 - boosts);
    }

    // Paralysis
    if (pokemon.status === 'par') {
      speed *= 0.5;
    }

    return speed;
  }
}

module.exports = MoveSimulator;
