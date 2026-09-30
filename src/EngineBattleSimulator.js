const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

/**
 * EngineBattleSimulator - Run battles using direct Battle class access
 *
 * Unlike OUBattleSimulator (which uses streams), this gives bots direct
 * access to the Battle instance, enabling them to run tree search.
 *
 * The loop is driven by each side's pending request (side.requestState):
 * 'move', 'switch' (fainted or mid-turn switch such as U-turn), 'teampreview',
 * or '' (waiting). Only sides with a pending request are asked for a choice,
 * and Battle#choose commits the turn once every pending side has chosen.
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
    this.seed = options.seed; // [n, n, n, n] for reproducible battles
    this.battle = null;
  }

  /**
   * Run the battle to completion (or until maxTurns)
   */
  async runBattle() {
    const team1Packed = Teams.pack(Teams.import(this.team1));
    const team2Packed = Teams.pack(Teams.import(this.team2));

    const battleOptions = {
      formatid: this.formatId,
      p1: { name: this.bot1.name, team: team1Packed },
      p2: { name: this.bot2.name, team: team2Packed }
    };
    if (this.seed) battleOptions.seed = this.seed;
    this.battle = new Battle(battleOptions);

    if (this.verbose) {
      console.log('='.repeat(60));
      console.log(`BATTLE: ${this.bot1.name} vs ${this.bot2.name}`);
      console.log(`Format: ${this.formatId}`);
      console.log('='.repeat(60));
    }

    // Give bots access to battle instance
    if (typeof this.bot1.setBattleInstance === 'function') {
      this.bot1.setBattleInstance(this.battle, 'p1');
    }
    if (typeof this.bot2.setBattleInstance === 'function') {
      this.bot2.setBattleInstance(this.battle, 'p2');
    }

    const stats = {
      invalidChoices: 0,
      botErrors: 0,
      decisions: { p1: 0, p2: 0 },
      decisionMs: { p1: 0, p2: 0 }
    };
    let error = null;
    let lastLoggedTurn = 0;
    // Each turn needs at most a handful of request rounds (move + switches)
    const maxSteps = this.maxTurns * 20;
    let steps = 0;

    while (!this.battle.ended && this.battle.turn <= this.maxTurns) {
      if (++steps > maxSteps) {
        error = 'step limit exceeded';
        break;
      }

      const pending = this.battle.sides.filter(side => side.requestState);
      if (pending.length === 0) {
        error = 'no pending request';
        break;
      }

      if (this.verbose && this.battle.turn !== lastLoggedTurn) {
        lastLoggedTurn = this.battle.turn;
        console.log(`\n--- Turn ${this.battle.turn} ---`);
        console.log(`${this.bot1.name}: ${this.describeActive(this.battle.p1)}`);
        console.log(`${this.bot2.name}: ${this.describeActive(this.battle.p2)}`);
      }

      // Collect every choice before submitting, so both bots see the same state
      const choices = pending.map(side => [side, this.getChoice(side, stats)]);

      for (const [side, choice] of choices) {
        if (this.verbose) console.log(`${this.botFor(side).name}: ${choice}`);
        if (!this.battle.choose(side.id, choice)) {
          stats.invalidChoices++;
          if (this.verbose) console.log(`  invalid choice "${choice}", using default`);
          this.battle.choose(side.id, 'default');
        }
      }
    }

    const winner = this.getWinnerName();

    if (this.verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('BATTLE END');
      console.log('='.repeat(60));
      console.log(`Winner: ${winner || 'Draw'}`);
      console.log(`Total turns: ${this.battle.turn}`);
      if (error) console.log(`Error: ${error}`);
    }

    return {
      winner,
      turns: this.battle.turn,
      ended: this.battle.ended,
      error,
      bot1Name: this.bot1.name,
      bot2Name: this.bot2.name,
      ...stats
    };
  }

  botFor(side) {
    return side.id === 'p1' ? this.bot1 : this.bot2;
  }

  describeActive(side) {
    const active = side.active[0];
    return active ? `${active.name} (${active.hp}/${active.maxhp})` : 'none';
  }

  /**
   * Ask the bot for this side's choice. Team preview uses the default order.
   */
  getChoice(side, stats) {
    if (side.requestState === 'teampreview') return 'default';

    const bot = this.botFor(side);
    const start = performance.now();
    let choice;
    try {
      choice = bot.chooseMove(this.createRequest(side));
    } catch (err) {
      stats.botErrors++;
      if (this.verbose) console.log(`${bot.name} threw: ${err.message}`);
      choice = 'default';
    }
    stats.decisionMs[side.id] += performance.now() - start;
    stats.decisions[side.id]++;

    return choice || 'default';
  }

  /**
   * Build the request object passed to bots.
   *
   * This is the sim's real request (the same JSON a stream client receives),
   * so it carries forceSwitch, trapped, disabled moves and choice locks. Each
   * side.pokemon entry is also given level/hp/maxhp/status/boosts, which some
   * bots read directly.
   */
  createRequest(side) {
    const request = JSON.parse(JSON.stringify(side.activeRequest));
    if (request.side && request.side.pokemon) {
      request.side.pokemon.forEach((entry, i) => {
        const pokemon = side.pokemon[i];
        if (!pokemon) return;
        entry.level = pokemon.level;
        entry.hp = pokemon.hp;
        entry.maxhp = pokemon.maxhp;
        entry.status = pokemon.status || '';
        entry.boosts = { ...pokemon.boosts };
      });
    }
    return request;
  }

  /**
   * Get winner name
   */
  getWinnerName() {
    if (!this.battle.winner) return null;

    if (this.battle.winner === this.battle.p1.name) {
      return this.bot1.name;
    } else if (this.battle.winner === this.battle.p2.name) {
      return this.bot2.name;
    }

    return this.battle.winner;
  }
}

module.exports = EngineBattleSimulator;
