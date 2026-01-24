const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const RandomBot = require('./RandomBot');

// Set up team generator factory
Teams.setGeneratorFactory(TeamGenerators);

/**
 * BattleSimulator - Manages a local Pokemon Showdown battle using BattleStreams
 */
class BattleSimulator {
  constructor(formatId = 'gen9randombattle') {
    this.formatId = formatId;
    this.turnCount = 0;
    this.battleEnded = false;
    this.winner = null;
  }

  /**
   * Start and run the battle to completion
   */
  async runBattle() {
    console.log('='.repeat(60));
    console.log('BATTLE START');
    console.log('='.repeat(60));

    // Create battle streams
    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

    // Generate random teams
    const team1 = Teams.pack(Teams.generate(this.formatId));
    const team2 = Teams.pack(Teams.generate(this.formatId));

    const spec = { formatid: this.formatId };
    const p1spec = { name: 'Player 1', team: team1 };
    const p2spec = { name: 'Player 2', team: team2 };

    // Create our random bots
    const bot1 = new RandomBot('Player 1');
    const bot2 = new RandomBot('Player 2');

    // Track battle state
    let p1Request = null;
    let p2Request = null;

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
              p1Request = JSON.parse(requestData);

              // Make a choice
              if (p1Request.wait) {
                // Waiting for other player
              } else {
                const choice = bot1.chooseMove(p1Request);
                console.log(`Player 1: ${choice}`);
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
              console.log(`\n--- Turn ${this.turnCount} ---`);
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
              p2Request = JSON.parse(requestData);

              // Make a choice
              if (p2Request.wait) {
                // Waiting for other player
              } else {
                const choice = bot2.chooseMove(p2Request);
                console.log(`Player 2: ${choice}`);
                void streams.p2.write(choice);
              }
            }
          }
        }
      }
    };

    // Process both streams in parallel
    await Promise.all([processP1(), processP2()]);

    console.log('\n' + '='.repeat(60));
    console.log('BATTLE END');
    console.log('='.repeat(60));
    console.log(`Winner: ${this.winner || 'Draw'}`);
    console.log(`Total turns: ${this.turnCount}`);

    return {
      winner: this.winner,
      turns: this.turnCount,
      ended: this.battleEnded
    };
  }
}

module.exports = BattleSimulator;
