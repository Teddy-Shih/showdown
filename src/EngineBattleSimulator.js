const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

/**
 * EngineBattleSimulator - Run battles using direct Battle class access
 *
 * Unlike OUBattleSimulator (which uses streams), this gives bots direct
 * access to the Battle instance, enabling them to run tree search.
 *
 * This is specifically designed for EngineTreeSearchBot and similar AIs
 * that need to simulate future states.
 */
class EngineBattleSimulator {
  constructor(bot1, bot2, team1, team2, options = {}) {
    this.bot1 = bot1;
    this.bot2 = bot2;
    this.team1 = team1; // Team string in Showdown format
    this.team2 = team2;
    this.formatId = options.formatid || 'gen9customgame';
    this.verbose = options.verbose || false;
    this.maxTurns = options.maxTurns || 100;
    this.battle = null;
  }

  /**
   * Run the battle to completion
   */
  async runBattle() {
    if (this.verbose) {
      console.log('='.repeat(60));
      console.log(`BATTLE: ${this.bot1.name} vs ${this.bot2.name}`);
      console.log(`Format: ${this.formatId}`);
      console.log('='.repeat(60));
    }

    // Pack teams
    const team1Packed = Teams.pack(Teams.import(this.team1));
    const team2Packed = Teams.pack(Teams.import(this.team2));

    // Create battle
    this.battle = new Battle({
      formatid: this.formatId,
      p1: { name: this.bot1.name, team: team1Packed },
      p2: { name: this.bot2.name, team: team2Packed }
    });

    // Give bots access to battle instance
    if (typeof this.bot1.setBattleInstance === 'function') {
      this.bot1.setBattleInstance(this.battle, 'p1');
    }
    if (typeof this.bot2.setBattleInstance === 'function') {
      this.bot2.setBattleInstance(this.battle, 'p2');
    }

    // Make team preview choices
    const p1TeamPreview = this.getTeamPreviewChoice(this.bot1);
    const p2TeamPreview = this.getTeamPreviewChoice(this.bot2);

    this.battle.makeChoices(p1TeamPreview, p2TeamPreview);

    if (this.verbose) {
      console.log('Team preview complete');
      console.log(`${this.bot1.name}: ${this.battle.p1.active[0].name}`);
      console.log(`${this.bot2.name}: ${this.battle.p2.active[0].name}`);
    }

    // Battle loop
    let turnCount = 0;
    while (!this.battle.ended && turnCount < this.maxTurns) {
      turnCount++;

      if (this.verbose) {
        console.log(`\n--- Turn ${turnCount} ---`);
        console.log(`${this.bot1.name}: ${this.battle.p1.active[0]?.name} (${this.battle.p1.active[0]?.hp}/${this.battle.p1.active[0]?.maxhp})`);
        console.log(`${this.bot2.name}: ${this.battle.p2.active[0]?.name} (${this.battle.p2.active[0]?.hp}/${this.battle.p2.active[0]?.maxhp})`);
      }

      // Get choices from bots
      const p1Request = this.createRequest(this.battle.p1, this.battle);
      const p2Request = this.createRequest(this.battle.p2, this.battle);

      const p1Choice = this.bot1.chooseMove(p1Request);
      const p2Choice = this.bot2.chooseMove(p2Request);

      if (this.verbose) {
        console.log(`${this.bot1.name}: ${p1Choice}`);
        console.log(`${this.bot2.name}: ${p2Choice}`);
      }

      // Execute turn
      try {
        this.battle.makeChoices(p1Choice, p2Choice);
      } catch (error) {
        console.error('Error making choices:', error.message);
        console.error('P1:', p1Choice, 'P2:', p2Choice);
        break;
      }

      // Check for forced switches
      if (this.battle.p1.active[0]?.fainted) {
        const p1SwitchChoice = this.handleForcedSwitch(this.bot1, this.battle.p1, this.battle);
        if (p1SwitchChoice && p1SwitchChoice !== 'default') {
          if (this.verbose) console.log(`${this.bot1.name} forced switch: ${p1SwitchChoice}`);
          this.battle.choose('p1', p1SwitchChoice);
        }
      }

      if (this.battle.p2.active[0]?.fainted) {
        const p2SwitchChoice = this.handleForcedSwitch(this.bot2, this.battle.p2, this.battle);
        if (p2SwitchChoice && p2SwitchChoice !== 'default') {
          if (this.verbose) console.log(`${this.bot2.name} forced switch: ${p2SwitchChoice}`);
          this.battle.choose('p2', p2SwitchChoice);
        }
      }
    }

    if (this.verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('BATTLE END');
      console.log('='.repeat(60));
      console.log(`Winner: ${this.battle.winner || 'Draw'}`);
      console.log(`Total turns: ${turnCount}`);
    }

    const winner = this.getWinnerName();

    return {
      winner,
      turns: turnCount,
      ended: this.battle.ended,
      bot1Name: this.bot1.name,
      bot2Name: this.bot2.name
    };
  }

  /**
   * Get team preview choice
   */
  getTeamPreviewChoice(bot) {
    // Most bots don't implement team preview
    // Just return default
    return 'default';
  }

  /**
   * Create request object for bot (mimics Showdown request format)
   */
  createRequest(side, battle) {
    const active = side.active[0];

    if (!active) {
      return { active: [], side: { pokemon: [] } };
    }

    const request = {
      active: [{
        moves: active.moveSlots.map((move, idx) => ({
          move: move.move?.name || move.id,
          id: move.id,
          pp: move.pp,
          maxpp: move.maxpp,
          target: move.target,
          disabled: move.disabled || false
        }))
      }],
      side: {
        pokemon: side.pokemon.map(p => ({
          ident: `${side.id}: ${p.name}`,
          details: `${p.species.name}, L${p.level}`,
          condition: p.fainted ? '0 fnt' : `${p.hp}/${p.maxhp}`,
          active: p.isActive,
          stats: p.baseStoredStats || {},
          moves: p.moveSlots.map(m => m.id),
          baseAbility: p.baseAbility,
          item: p.item,
          pokeball: 'pokeball',
          ability: p.ability,
          level: p.level,
          hp: p.hp,
          maxhp: p.maxhp,
          status: p.status || '',
          boosts: { ...p.boosts }
        }))
      },
      forceSwitch: active.fainted ? [true] : undefined
    };

    return request;
  }

  /**
   * Handle forced switch
   */
  handleForcedSwitch(bot, side, battle) {
    const request = this.createRequest(side, battle);
    request.forceSwitch = [true];

    return bot.chooseMove(request);
  }

  /**
   * Get winner name
   */
  getWinnerName() {
    if (!this.battle.winner) return null;

    if (this.battle.winner === this.battle.p1.name || this.battle.winner === 'P1') {
      return this.bot1.name;
    } else if (this.battle.winner === this.battle.p2.name || this.battle.winner === 'P2') {
      return this.bot2.name;
    }

    return this.battle.winner;
  }
}

module.exports = EngineBattleSimulator;
