const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

// Set up team generator factory
Teams.setGeneratorFactory(TeamGenerators);

/**
 * CompetitiveBattleSimulator - Run battles between two different bot strategies
 */
class CompetitiveBattleSimulator {
  constructor(bot1, bot2, formatId = 'gen9randombattle', options = {}) {
    this.bot1 = bot1;
    this.bot2 = bot2;
    this.formatId = formatId;
    this.verbose = options.verbose || false;
    this.turnCount = 0;
    this.battleEnded = false;
    this.winner = null;
    this.maxTurns = options.maxTurns || 1000;
  }

  /**
   * Start and run the battle to completion
   */
  async runBattle() {
    if (this.verbose) {
      console.log('='.repeat(60));
      console.log(`BATTLE: ${this.bot1.name} vs ${this.bot2.name}`);
      console.log('='.repeat(60));
    }

    // Create battle streams
    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

    // Generate random teams
    const team1 = Teams.pack(Teams.generate(this.formatId));
    const team2 = Teams.pack(Teams.generate(this.formatId));

    const spec = { formatid: this.formatId };
    const p1spec = { name: this.bot1.name, team: team1 };
    const p2spec = { name: this.bot2.name, team: team2 };

    // Start the battle
    void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
    void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
    void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

    // Set up stream readers
    const processP1 = async () => {
      for await (const chunk of streams.p1) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('|request|')) {
            const requestData = line.slice('|request|'.length);
            if (requestData) {
              const p1Request = JSON.parse(requestData);

              if (!p1Request.wait) {
                const choice = this.bot1.chooseMove(p1Request);
                if (this.verbose) {
                  console.log(`${this.bot1.name}: ${choice}`);
                }
                void streams.p1.write(choice);
              }
            }
          } else if (line.startsWith('|win|') || line.startsWith('|tie')) {
            this.battleEnded = true;
            if (line.startsWith('|win|')) {
              this.winner = line.split('|')[2];
            }
          } else if (line.startsWith('|turn|')) {
            const turn = parseInt(line.split('|')[2]);
            if (turn !== this.turnCount) {
              this.turnCount = turn;
              if (this.verbose) {
                console.log(`\n--- Turn ${this.turnCount} ---`);
              }

              // Safety check for infinite battles
              if (this.turnCount >= this.maxTurns) {
                this.battleEnded = true;
                this.winner = null; // Draw
              }
            }
          }
        }
      }
    };

    const processP2 = async () => {
      for await (const chunk of streams.p2) {
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('|request|')) {
            const requestData = line.slice('|request|'.length);
            if (requestData) {
              const p2Request = JSON.parse(requestData);

              if (!p2Request.wait) {
                const choice = this.bot2.chooseMove(p2Request);
                if (this.verbose) {
                  console.log(`${this.bot2.name}: ${choice}`);
                }
                void streams.p2.write(choice);
              }
            }
          }
        }
      }
    };

    // Process both streams in parallel
    await Promise.all([processP1(), processP2()]);

    if (this.verbose) {
      console.log('\n' + '='.repeat(60));
      console.log('BATTLE END');
      console.log('='.repeat(60));
      console.log(`Winner: ${this.winner || 'Draw'}`);
      console.log(`Total turns: ${this.turnCount}`);
    }

    return {
      winner: this.winner,
      turns: this.turnCount,
      ended: this.battleEnded,
      bot1Name: this.bot1.name,
      bot2Name: this.bot2.name
    };
  }
}

module.exports = CompetitiveBattleSimulator;
