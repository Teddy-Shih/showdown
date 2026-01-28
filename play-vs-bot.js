const readline = require('readline');
const { BattleStreams, Teams } = require('@pkmn/sim');
const TypeAwareBot = require('./src/TypeAwareBot');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('./data/ou-teams');

/**
 * Interactive human vs bot battle
 */
class HumanVsBotBattle {
  constructor(humanTeam, botTeam) {
    this.humanTeam = humanTeam;
    this.botTeam = botTeam;
    this.bot = new TypeAwareBot('Bot');

    this.battleState = {
      turn: 0,
      p1Active: null,
      p2Active: null,
      winner: null,
      waitingForInput: false
    };

    this.pendingRequest = null;
    this.pendingResolve = null;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('\n' + '='.repeat(80));
    console.log('POKEMON SHOWDOWN - HUMAN VS BOT');
    console.log('='.repeat(80));
    console.log('\nYou are Player 1 (p1)');
    console.log('Bot is Player 2 (p2)');
    console.log('\nStarting battle...\n');

    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

    const team1Packed = Teams.pack(Teams.import(this.humanTeam));
    const team2Packed = Teams.pack(Teams.import(this.botTeam));

    const spec = { formatid: 'gen9ou' };
    const p1spec = { name: 'You', team: team1Packed };
    const p2spec = { name: 'Bot', team: team2Packed };

    void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
    void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
    void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

    // Process both players and omniscient stream concurrently
    await Promise.all([
      this.processHumanStream(streams.p1),
      this.processBotStream(streams.p2),
      this.processOmniscientStream(streams.omniscient)
    ]);

    this.rl.close();
  }

  async processHumanStream(stream) {
    for await (const chunk of stream) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const request = JSON.parse(requestData);

            if (!request.wait) {
              const choice = await this.handleHumanRequest(request);
              void stream.write(choice);
            }
          }
        }
      }
    }
  }

  async processBotStream(stream) {
    for await (const chunk of stream) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const request = JSON.parse(requestData);

            if (!request.wait) {
              const choice = this.bot.chooseMove(request);
              void stream.write(choice);
            }
          }
        }
      }
    }
  }

  async processOmniscientStream(stream) {
    for await (const chunk of stream) {
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line) continue;

        // Track battle state for display
        if (line.startsWith('|turn|')) {
          const turn = parseInt(line.split('|')[2]);
          this.battleState.turn = turn;
          console.log('\n' + '='.repeat(80));
          console.log(`TURN ${turn}`);
          console.log('='.repeat(80));
        }

        if (line.startsWith('|switch|')) {
          const parts = line.split('|');
          const player = parts[2].startsWith('p1') ? 'p1' : 'p2';
          const pokemon = parts[3];

          if (player === 'p1') {
            this.battleState.p1Active = pokemon;
          } else {
            this.battleState.p2Active = pokemon;
          }

          console.log(`\n${player === 'p1' ? 'You' : 'Bot'} sent out ${pokemon}!`);
        }

        if (line.startsWith('|move|')) {
          const parts = line.split('|');
          const user = parts[2].includes('p1') ? 'You' : 'Bot';
          const moveName = parts[3];
          console.log(`\n${user} used ${moveName}!`);
        }

        if (line.startsWith('|-damage|')) {
          const parts = line.split('|');
          const target = parts[2].includes('p1') ? 'Your' : "Bot's";
          const pokemon = parts[2].split(':')[1].trim().split(',')[0];
          const newHP = parts[3];
          console.log(`${target} ${pokemon}: ${newHP}`);
        }

        if (line.startsWith('|faint|')) {
          const parts = line.split('|');
          const fainted = parts[2].includes('p1') ? 'Your' : "Bot's";
          const pokemon = parts[2].split(':')[1].trim().split(',')[0];
          console.log(`\n${fainted} ${pokemon} fainted!`);
        }

        if (line.startsWith('|-boost|')) {
          const parts = line.split('|');
          const pokemon = parts[2].includes('p1') ? 'Your' : "Bot's";
          const stat = parts[3];
          const amount = parts[4];
          console.log(`${pokemon} ${parts[2].split(':')[1].trim().split(',')[0]}'s ${stat} ${amount > 0 ? 'rose' : 'fell'}!`);
        }

        if (line.startsWith('|win|')) {
          const winner = line.split('|')[2];
          this.battleState.winner = winner;
          console.log('\n' + '='.repeat(80));
          console.log(`${winner.toUpperCase()} WINS!`);
          console.log('='.repeat(80));
        }
      }
    }
  }

  async handleHumanRequest(request) {
    // Team preview
    if (request.teamPreview) {
      console.log('\n--- TEAM PREVIEW ---');
      console.log('Your team:');
      request.side.pokemon.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.details}`);
      });

      const choice = await this.promptUser(`\nChoose lead Pokemon (1-${request.side.pokemon.length}): `);
      return `team ${choice}`;
    }

    // Force switch (Pokemon fainted)
    if (request.forceSwitch) {
      console.log('\n--- FORCE SWITCH ---');
      this.displayTeam(request.side.pokemon);

      const choice = await this.promptUser('Choose Pokemon to switch to (number): ');
      return `switch ${choice}`;
    }

    // Normal turn
    if (request.active) {
      console.log('\n--- YOUR TURN ---');
      this.displayBattleState(request);

      const choice = await this.promptUserChoice(request);
      return choice;
    }

    return 'default';
  }

  displayBattleState(request) {
    console.log('\nCurrent Battle State:');
    console.log('  Your Pokemon:', this.battleState.p1Active || 'Unknown');
    console.log('  Bot Pokemon:', this.battleState.p2Active || 'Unknown');

    if (request.side.pokemon[0]) {
      console.log(`\n  Your HP: ${request.side.pokemon[0].condition}`);
    }
  }

  displayTeam(pokemon) {
    console.log('\nYour team:');
    pokemon.forEach((p, i) => {
      if (p.active) {
        console.log(`  ${i + 1}. ${p.details} - ACTIVE`);
      } else if (p.condition === '0 fnt') {
        console.log(`  ${i + 1}. ${p.details} - FAINTED`);
      } else {
        console.log(`  ${i + 1}. ${p.details} - ${p.condition}`);
      }
    });
  }

  async promptUserChoice(request) {
    const active = request.active[0];

    console.log('\nAvailable moves:');
    active.moves.forEach((move, i) => {
      const disabled = move.disabled ? ' [DISABLED]' : '';
      const pp = move.pp !== undefined ? ` (${move.pp}/${move.maxpp} PP)` : '';
      console.log(`  ${i + 1}. ${move.move}${pp}${disabled}`);
    });

    console.log('\nAvailable switches:');
    request.side.pokemon.forEach((p, i) => {
      if (!p.active && p.condition !== '0 fnt') {
        console.log(`  ${i + 1}. ${p.details} - ${p.condition}`);
      }
    });

    const input = await this.promptUser('\nYour choice (e.g., "move 1" or "switch 3"): ');

    // Parse input - support both "move 1" and just "1"
    if (input.includes('move') || input.includes('switch')) {
      return input;
    } else {
      // If just a number, assume it's a move
      return `move ${input}`;
    }
  }

  promptUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Main
async function main() {
  console.log('\nChoose your team:');
  console.log('1. Offensive (Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-W, Kingambit)');
  console.log('2. Defensive (Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-G)');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const teamChoice = await new Promise((resolve) => {
    rl.question('\nSelect team (1 or 2): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  let humanTeam, botTeam;

  if (teamChoice === '1') {
    humanTeam = TEAM_SPECS_GHOLDENGO;
    botTeam = TEAM_ANTIMETA_LANDO;
    console.log('\nYou chose: Offensive team');
    console.log('Bot will use: Defensive team');
  } else {
    humanTeam = TEAM_ANTIMETA_LANDO;
    botTeam = TEAM_SPECS_GHOLDENGO;
    console.log('\nYou chose: Defensive team');
    console.log('Bot will use: Offensive team');
  }

  const battle = new HumanVsBotBattle(humanTeam, botTeam);
  await battle.start();
}

main().catch(console.error);
