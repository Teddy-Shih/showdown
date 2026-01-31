const readline = require('readline');
const { BattleStreams, Teams, Dex } = require('@pkmn/sim');
const { calculate, Pokemon, Move, Field, Generations } = require('@smogon/calc');

// Import all available bots
const RandomBot = require('./src/RandomBot');
const MaxDamageBot = require('./src/MaxDamageBot');
const SmartBot = require('./src/SmartBot');
const MinimaxBot = require('./src/MinimaxBot');
const TypeAwareBot = require('./src/TypeAwareBot');
const ImprovedTypeAwareBot = require('./src/ImprovedTypeAwareBot');

const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('./data/ou-teams');

// Bot configurations with descriptions and difficulty ratings
const BOTS = {
  '1': {
    name: 'RandomBot',
    class: RandomBot,
    description: 'Chooses random moves. Perfect for beginners!',
    difficulty: 'Very Easy',
    strength: '★☆☆☆☆',
    features: ['Random move selection', 'No strategy']
  },
  '2': {
    name: 'MaxDamageBot',
    class: MaxDamageBot,
    description: 'Always picks the highest damage move using accurate calculations.',
    difficulty: 'Easy',
    strength: '★★☆☆☆',
    features: ['Damage calculation', 'STAB awareness', 'Basic strategy']
  },
  '3': {
    name: 'SmartBot',
    class: SmartBot,
    description: 'Enhanced damage bot with hazard and setup awareness.',
    difficulty: 'Medium',
    strength: '★★★☆☆',
    features: ['Strategic status moves', 'Hazard setting', 'Position evaluation']
  },
  '4': {
    name: 'MinimaxBot',
    class: MinimaxBot,
    description: 'Uses minimax search to plan ahead and evaluate positions.',
    difficulty: 'Hard',
    strength: '★★★★☆',
    features: ['2-turn lookahead', 'Position evaluation', 'KO prediction']
  },
  '5': {
    name: 'TypeAwareBot',
    class: TypeAwareBot,
    description: 'Advanced bot with type matchups, switching logic, and deep search.',
    difficulty: 'Very Hard',
    strength: '★★★★★',
    features: ['4-turn minimax search', 'Intelligent switching', 'Type advantage', 'Team analysis']
  },
  '6': {
    name: 'ImprovedTypeAwareBot',
    class: ImprovedTypeAwareBot,
    description: 'The strongest bot! TypeAwareBot with optimized switching and wall detection.',
    difficulty: 'Expert',
    strength: '★★★★★★',
    features: ['Optimized switching', 'Wall detection', 'Aggressive play', 'Team preservation']
  }
};

/**
 * Interactive human vs bot battle
 */
class HumanVsBotBattle {
  constructor(humanTeam, botTeam, BotClass, botName) {
    this.humanTeam = humanTeam;
    this.botTeam = botTeam;
    this.bot = new BotClass('Bot');
    this.botName = botName;

    this.battleState = {
      turn: 0,
      p1Active: null,
      p1ActiveSpecies: null,
      p2Active: null,
      p2ActiveSpecies: null,
      p1HP: null,
      p2HP: null,
      winner: null,
      waitingForInput: false
    };

    this.pendingRequest = null;
    this.pendingResolve = null;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.dex = Dex;
    this.gen = Generations.get(9);
  }

  async start() {
    console.log('\n' + '='.repeat(80));
    console.log('POKEMON SHOWDOWN - HUMAN VS BOT');
    console.log('='.repeat(80));
    console.log('\nYou are Player 1 (p1)');
    console.log(`Bot is Player 2 (p2) - ${this.botName}`);
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
          this.displayBattleStatus();
        }

        if (line.startsWith('|switch|') || line.startsWith('|drag|')) {
          const parts = line.split('|');
          const player = parts[2].startsWith('p1') ? 'p1' : 'p2';
          const pokemonInfo = parts[3];
          const speciesName = pokemonInfo.split(',')[0].trim();
          const hpInfo = parts[4];

          // Parse species and get type info
          const species = this.dex.species.get(speciesName);
          const types = species ? species.types.join('/') : 'Unknown';

          if (player === 'p1') {
            this.battleState.p1Active = pokemonInfo;
            this.battleState.p1ActiveSpecies = species;
            this.battleState.p1HP = hpInfo;
          } else {
            this.battleState.p2Active = pokemonInfo;
            this.battleState.p2ActiveSpecies = species;
            this.battleState.p2HP = hpInfo;
          }

          console.log(`\n${player === 'p1' ? '> You' : '> Bot'} sent out ${speciesName}!`);
          console.log(`  Type: ${types} | HP: ${hpInfo}`);
        }

        if (line.startsWith('|move|')) {
          const parts = line.split('|');
          const userSlot = parts[2];
          const user = userSlot.includes('p1') ? 'You' : 'Bot';
          const moveName = parts[3];
          const target = parts[4];

          // Get move info
          const move = this.dex.moves.get(moveName);
          let moveInfo = '';
          if (move) {
            const category = move.category;
            const type = move.type;
            const bp = move.basePower || 0;

            if (bp > 0) {
              moveInfo = ` [${type} ${category}, BP: ${bp}]`;
            } else {
              moveInfo = ` [${type} ${category}]`;
            }
          }

          console.log(`\n${user} used ${moveName}${moveInfo}`);

          // Calculate and display type effectiveness if it's a damaging move
          if (move && move.basePower && target) {
            const targetPlayer = target.includes('p1') ? 'p1' : 'p2';
            const targetSpecies = targetPlayer === 'p1' ? this.battleState.p1ActiveSpecies : this.battleState.p2ActiveSpecies;

            if (targetSpecies) {
              const effectiveness = this.getTypeEffectiveness(move.type, targetSpecies.types);
              let effectivenessText = '';

              if (effectiveness === 0) {
                effectivenessText = "  It doesn't affect the target...";
              } else if (effectiveness >= 4) {
                effectivenessText = '  It\'s ULTRA EFFECTIVE! (4x)';
              } else if (effectiveness === 2) {
                effectivenessText = '  It\'s super effective! (2x)';
              } else if (effectiveness === 0.5) {
                effectivenessText = '  It\'s not very effective... (0.5x)';
              } else if (effectiveness <= 0.25) {
                effectivenessText = '  It\'s barely effective... (0.25x)';
              }

              if (effectivenessText) {
                console.log(effectivenessText);
              }
            }
          }
        }

        if (line.startsWith('|-damage|')) {
          const parts = line.split('|');
          const targetSlot = parts[2];
          const target = targetSlot.includes('p1') ? 'Your' : "Bot's";
          const pokemon = targetSlot.split(':')[1].trim().split(',')[0];
          const newHP = parts[3];

          // Update HP tracking
          if (targetSlot.includes('p1')) {
            this.battleState.p1HP = newHP;
          } else {
            this.battleState.p2HP = newHP;
          }

          // Parse HP to show percentage
          const hpParts = newHP.split(' ');
          const hpFraction = hpParts[0];
          let hpBar = '';

          if (hpFraction.includes('/')) {
            const [current, max] = hpFraction.split('/').map(n => parseInt(n));
            const percent = Math.floor((current / max) * 100);
            const barLength = 20;
            const filled = Math.floor((percent / 100) * barLength);
            hpBar = `[${'█'.repeat(filled)}${'░'.repeat(barLength - filled)}] ${percent}%`;
          } else {
            const percent = parseInt(hpFraction);
            const barLength = 20;
            const filled = Math.floor((percent / 100) * barLength);
            hpBar = `[${'█'.repeat(filled)}${'░'.repeat(barLength - filled)}] ${percent}%`;
          }

          console.log(`  ${target} ${pokemon}: ${hpBar}`);
        }

        if (line.startsWith('|faint|')) {
          const parts = line.split('|');
          const fainted = parts[2].includes('p1') ? 'Your' : "Bot's";
          const pokemon = parts[2].split(':')[1].trim().split(',')[0];
          console.log(`\n💀 ${fainted} ${pokemon} fainted!`);
        }

        if (line.startsWith('|-boost|') || line.startsWith('|-unboost|')) {
          const parts = line.split('|');
          const isBoost = parts[1] === '-boost';
          const pokemon = parts[2].includes('p1') ? 'Your' : "Bot's";
          const pokemonName = parts[2].split(':')[1].trim().split(',')[0];
          const stat = parts[3].toUpperCase();
          const amount = parts[4];

          const statNames = {
            'ATK': 'Attack',
            'DEF': 'Defense',
            'SPA': 'Sp. Atk',
            'SPD': 'Sp. Def',
            'SPE': 'Speed'
          };

          const statName = statNames[stat] || stat;
          const change = isBoost ? 'rose' : 'fell';
          const stages = Math.abs(amount);

          console.log(`  ${pokemon} ${pokemonName}'s ${statName} ${change}${stages > 1 ? ' sharply' : ''}!`);
        }

        if (line.startsWith('|-weather|')) {
          const parts = line.split('|');
          const weather = parts[2];
          if (weather && weather !== 'none') {
            console.log(`  ☀️ Weather: ${weather}`);
          }
        }

        if (line.startsWith('|-fieldstart|')) {
          const parts = line.split('|');
          const field = parts[2];
          console.log(`  🌍 Field: ${field}`);
        }

        if (line.startsWith('|-sidestart|')) {
          const parts = line.split('|');
          const side = parts[2].includes('p1') ? 'Your side' : "Bot's side";
          const hazard = parts[3];
          console.log(`  ⚠️ ${side}: ${hazard}`);
        }

        if (line.startsWith('|-status|')) {
          const parts = line.split('|');
          const target = parts[2].includes('p1') ? 'Your' : "Bot's";
          const pokemon = parts[2].split(':')[1].trim().split(',')[0];
          const status = parts[3];
          const statusNames = {
            'brn': 'burned',
            'par': 'paralyzed',
            'psn': 'poisoned',
            'tox': 'badly poisoned',
            'slp': 'asleep',
            'frz': 'frozen'
          };
          console.log(`  ${target} ${pokemon} was ${statusNames[status] || status}!`);
        }

        if (line.startsWith('|win|')) {
          const winner = line.split('|')[2];
          this.battleState.winner = winner;
          console.log('\n' + '='.repeat(80));
          console.log(`🏆 ${winner.toUpperCase()} WINS! 🏆`);
          console.log('='.repeat(80));
        }
      }
    }
  }

  displayBattleStatus() {
    if (this.battleState.p1ActiveSpecies && this.battleState.p2ActiveSpecies) {
      const p1Name = this.battleState.p1Active.split(',')[0];
      const p2Name = this.battleState.p2Active.split(',')[0];

      const p1Types = this.battleState.p1ActiveSpecies.types.join('/');
      const p2Types = this.battleState.p2ActiveSpecies.types.join('/');

      console.log(`\n┌─ Your ${p1Name} (${p1Types}) VS Bot's ${p2Name} (${p2Types}) ─┐`);

      // Show type matchup
      const matchup = this.analyzeMatchup(this.battleState.p1ActiveSpecies, this.battleState.p2ActiveSpecies);
      if (matchup) {
        console.log(`└─ Type Matchup: ${matchup} ─┘`);
      }
    }
  }

  analyzeMatchup(ourSpecies, oppSpecies) {
    let ourOffense = 1;
    let ourDefense = 1;

    // Check how well we hit them
    for (const ourType of ourSpecies.types) {
      let typeEff = 1;
      for (const oppType of oppSpecies.types) {
        const oppTypeData = this.dex.types.get(oppType);
        if (oppTypeData.damageTaken[ourType] === 1) typeEff *= 2;
        if (oppTypeData.damageTaken[ourType] === 2) typeEff *= 0.5;
        if (oppTypeData.damageTaken[ourType] === 3) typeEff = 0;
      }
      ourOffense = Math.max(ourOffense, typeEff);
    }

    // Check how well they hit us
    for (const oppType of oppSpecies.types) {
      let typeEff = 1;
      for (const ourType of ourSpecies.types) {
        const ourTypeData = this.dex.types.get(ourType);
        if (ourTypeData.damageTaken[oppType] === 1) typeEff *= 2;
        if (ourTypeData.damageTaken[oppType] === 2) typeEff *= 0.5;
        if (ourTypeData.damageTaken[oppType] === 3) typeEff = 0;
      }
      ourDefense = Math.min(ourDefense, typeEff);
    }

    if (ourOffense >= 2 && ourDefense <= 0.5) {
      return '✅ EXCELLENT - You resist and hit super effectively!';
    } else if (ourOffense >= 2) {
      return '✅ GOOD - You hit super effectively!';
    } else if (ourDefense <= 0.5) {
      return '✅ GOOD - You resist their attacks!';
    } else if (ourOffense === 0 || ourDefense >= 2) {
      return '❌ BAD - Consider switching!';
    } else if (ourDefense >= 2) {
      return '❌ BAD - You\'re weak to their attacks!';
    }

    return '➖ NEUTRAL';
  }

  getTypeEffectiveness(moveType, defenderTypes) {
    let multiplier = 1;
    for (const defenderType of defenderTypes) {
      const defenderTypeData = this.dex.types.get(defenderType);
      if (defenderTypeData.damageTaken[moveType] === 1) multiplier *= 2;
      if (defenderTypeData.damageTaken[moveType] === 2) multiplier *= 0.5;
      if (defenderTypeData.damageTaken[moveType] === 3) multiplier *= 0;
    }
    return multiplier;
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
  console.log('\n' + '='.repeat(80));
  console.log('POKEMON SHOWDOWN - BOT SELECTION');
  console.log('='.repeat(80));
  console.log('\nAvailable Bots:\n');

  // Display bot options
  for (const [key, bot] of Object.entries(BOTS)) {
    console.log(`${key}. ${bot.name} - ${bot.strength}`);
    console.log(`   Difficulty: ${bot.difficulty}`);
    console.log(`   ${bot.description}`);
    console.log(`   Features: ${bot.features.join(', ')}`);
    console.log('');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Select bot
  const botChoice = await new Promise((resolve) => {
    rl.question('Select bot opponent (1-6): ', (answer) => {
      resolve(answer.trim());
    });
  });

  const selectedBot = BOTS[botChoice] || BOTS['5']; // Default to TypeAwareBot if invalid

  console.log(`\n✓ Selected: ${selectedBot.name} (${selectedBot.difficulty})\n`);

  // Select team
  console.log('\nChoose your team:');
  console.log('1. Offensive (Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-W, Kingambit)');
  console.log('2. Defensive (Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-G)');

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

  const battle = new HumanVsBotBattle(humanTeam, botTeam, selectedBot.class, selectedBot.name);
  await battle.start();
}

main().catch(console.error);
