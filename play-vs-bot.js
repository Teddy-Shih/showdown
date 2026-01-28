const readline = require('readline');
const { BattleStreams } = require('@pkmn/sim');
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

    this.streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
    this.humanStream = this.streams.p1;
    this.botStream = this.streams.p2;

    this.battleState = {
      turn: 0,
      p1Active: null,
      p2Active: null,
      p1Team: [],
      p2Team: [],
      winner: null
    };

    this.currentRequest = null;

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

    // Set up message handlers
    this.humanStream.on('request', (request) => this.handleHumanRequest(request));
    this.botStream.on('request', (request) => this.handleBotRequest(request));

    // Listen to battle output
    const battleStream = this.streams.omniscient;
    battleStream.on('data', (message) => this.processBattleMessage(message));

    // Start battle
    await this.humanStream.write(`>start {"formatid":"gen9ou"}`);
    await this.humanStream.write(`>player p1 {"name":"You","team":"${this.humanTeam}"}`);
    await this.botStream.write(`>player p2 {"name":"Bot","team":"${this.botTeam}"}`);
  }

  processBattleMessage(message) {
    const lines = message.split('\n');

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
        const details = parts[4];

        if (player === 'p1') {
          this.battleState.p1Active = { name: pokemon, details };
        } else {
          this.battleState.p2Active = { name: pokemon, details };
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

      if (line.startsWith('|win|')) {
        const winner = line.split('|')[2];
        this.battleState.winner = winner;
        console.log('\n' + '='.repeat(80));
        console.log(`${winner.toUpperCase()} WINS!`);
        console.log('='.repeat(80));
        this.rl.close();
      }

      // Pass messages to bot for its internal state tracking
      this.bot.receiveMessage(line);
    }
  }

  async handleHumanRequest(requestStr) {
    if (!requestStr) return;

    const request = JSON.parse(requestStr);
    this.currentRequest = request;

    // Team preview
    if (request.teamPreview) {
      console.log('\n--- TEAM PREVIEW ---');
      console.log('Your team:');
      request.side.pokemon.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.details}`);
      });

      const choice = await this.promptUser(`\nChoose lead Pokemon (1-${request.side.pokemon.length}): `);
      await this.humanStream.write(`>team ${choice}`);
      return;
    }

    // Force switch (Pokemon fainted)
    if (request.forceSwitch) {
      console.log('\n--- FORCE SWITCH ---');
      this.displayTeam(request.side.pokemon);

      const choice = await this.promptUser('Choose Pokemon to switch to (number): ');
      await this.humanStream.write(`>choose switch ${choice}`);
      return;
    }

    // Normal turn
    if (request.active) {
      console.log('\n--- YOUR TURN ---');
      this.displayBattleState(request);

      const choice = await this.promptUserChoice(request);
      await this.humanStream.write(`>choose ${choice}`);
    }
  }

  handleBotRequest(requestStr) {
    if (!requestStr) return;

    const request = JSON.parse(requestStr);

    // Let bot decide
    const choice = this.bot.getChoice(request);

    // Don't log bot's choice (spoilers!)
    this.botStream.write(`>choose ${choice}`);
  }

  displayBattleState(request) {
    console.log('\n Current Battle State:');
    console.log('  Your Pokemon:', this.battleState.p1Active?.name || 'Unknown');
    console.log('  Bot Pokemon:', this.battleState.p2Active?.name || 'Unknown');

    if (request.active && request.active[0]) {
      const active = request.active[0];
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

    console.log('\n Available moves:');
    active.moves.forEach((move, i) => {
      const disabled = move.disabled ? ' [DISABLED]' : '';
      const pp = move.pp !== undefined ? ` (${move.pp}/${move.maxpp} PP)` : '';
      console.log(`  ${i + 1}. ${move.move}${pp}${disabled}`);
    });

    console.log('\n Available switches:');
    const switches = [];
    request.side.pokemon.forEach((p, i) => {
      if (!p.active && p.condition !== '0 fnt') {
        switches.push(i + 1);
        console.log(`  ${i + 1}. ${p.details} - ${p.condition}`);
      }
    });

    const input = await this.promptUser('\nYour choice (move 1-4 or switch 1-6): ');
    return input;
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
