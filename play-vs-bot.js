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
const Depth6SearchBot = require('./src/Depth6SearchBot');

const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('./data/ou-teams');

// Smogon Sample Teams from https://www.smogon.com/forums/threads/sv-ou-sample-teams-new-samples-added-post-scl-and-olt.3712513/
const SAMPLE_TEAMS = {
  'offensive': {
    name: 'Offensive (Original)',
    description: 'Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-W, Kingambit',
    team: TEAM_SPECS_GHOLDENGO
  },
  'defensive': {
    name: 'Defensive (Original)',
    description: 'Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-G',
    team: TEAM_ANTIMETA_LANDO
  },
  'dragonite-screens': {
    name: 'Dragonite + Kingambit Screens',
    description: 'Hyper Offense with dual screens and setup sweepers',
    team: `Iron Valiant @ Booster Energy
Ability: Quark Drive
Tera Type: Steel
EVs: 84 Atk / 172 SpA / 252 Spe
Naive Nature
- Moonblast
- Close Combat
- Taunt
- Knock Off

Great Tusk @ Booster Energy
Ability: Protosynthesis
Tera Type: Poison
EVs: 248 HP / 4 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Head Smash
- Taunt
- Bulk Up

Dragonite @ Leftovers
Ability: Multiscale
Tera Type: Flying
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Tera Blast
- Earthquake
- Substitute
- Dragon Dance

Deoxys-Speed @ Light Clay
Ability: Pressure
Tera Type: Ghost
EVs: 248 HP / 108 SpA / 152 Spe
Timid Nature
IVs: 0 Atk
- Reflect
- Light Screen
- Taunt
- Psycho Boost

Glimmora @ Power Herb
Ability: Toxic Debris
Tera Type: Ghost
EVs: 4 Def / 252 SpA / 252 Spe
Modest Nature
- Meteor Beam
- Earth Power
- Stealth Rock
- Mortal Spin

Kingambit @ Lum Berry
Ability: Supreme Overlord
Tera Type: Fighting
EVs: 252 Atk / 4 Def / 252 Spe
Adamant Nature
- Iron Head
- Low Kick
- Sucker Punch
- Swords Dance`
  },
  'venusaur-sun': {
    name: 'Venusaur Sun',
    description: 'Sun team with Chlorophyll Venusaur and Protosynthesis abusers',
    team: `Great Tusk @ Assault Vest
Ability: Protosynthesis
Tera Type: Water
EVs: 160 HP / 132 Atk / 12 SpD / 204 Spe
Adamant Nature
- Headlong Rush
- Rapid Spin
- Ice Spinner
- Close Combat

Walking Wake @ Wise Glasses
Ability: Protosynthesis
Tera Type: Ghost
EVs: 12 HP / 244 SpA / 252 Spe
Timid Nature
- Hydro Steam
- Draco Meteor
- Flamethrower
- Flip Turn

Kingambit @ Air Balloon
Ability: Supreme Overlord
Tera Type: Ghost
EVs: 140 HP / 252 Atk / 112 Spe
Adamant Nature
- Swords Dance
- Kowtow Cleave
- Iron Head
- Sucker Punch

Venusaur @ Life Orb
Ability: Chlorophyll
Tera Type: Fire
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Growth
- Giga Drain
- Weather Ball
- Sludge Bomb

Ninetales @ Heat Rock
Ability: Drought
Tera Type: Ghost
EVs: 248 HP / 44 Def / 216 Spe
Timid Nature
IVs: 0 Atk
- Will-O-Wisp
- Weather Ball
- Healing Wish
- Encore

Raging Bolt @ Air Balloon
Ability: Protosynthesis
Tera Type: Fairy
EVs: 4 HP / 252 SpA / 252 Spe
Modest Nature
IVs: 20 Atk
- Thunderbolt
- Thunderclap
- Dragon Pulse
- Calm Mind`
  },
  'neo-grassy': {
    name: 'Neo Grassy',
    description: 'Grassy Terrain team with Rillaboom and powerful attackers',
    team: `Rillaboom @ Life Orb
Ability: Grassy Surge
Tera Type: Fairy
EVs: 72 HP / 252 Atk / 184 Spe
Adamant Nature
- Grassy Glide
- Tera Blast
- Knock Off
- Swords Dance

Serperior @ Choice Scarf
Ability: Contrary
Tera Type: Grass
EVs: 32 HP / 252 SpA / 224 Spe
Modest Nature
- Leaf Storm
- Knock Off
- Giga Drain
- Glare

Heatran @ Air Balloon
Ability: Flash Fire
Tera Type: Ghost
EVs: 248 HP / 16 Atk / 208 SpD / 36 Spe
Sassy Nature
- Magma Storm
- Heavy Slam
- Taunt
- Stealth Rock

Gholdengo @ Grassy Seed
Ability: Good as Gold
Tera Type: Water
EVs: 248 HP / 32 SpA / 156 SpD / 72 Spe
Modest Nature
IVs: 0 Atk
- Shadow Ball
- Focus Blast
- Recover
- Nasty Plot

Zamazenta @ Life Orb
Ability: Dauntless Shield
Tera Type: Fighting
EVs: 252 Atk / 4 Def / 252 Spe
Adamant Nature
- Close Combat
- Crunch
- Psychic Fangs
- Ice Fang

Great Tusk @ Booster Energy
Ability: Protosynthesis
Tera Type: Poison
EVs: 248 HP / 4 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Head Smash
- Bulk Up
- Rapid Spin`
  },
  'torn-hatte-cind': {
    name: 'Torn Hatte Cind',
    description: 'Balanced team with Kyurem, Cinderace, and Tornadus-T',
    team: `Kyurem @ Choice Specs
Ability: Pressure
Tera Type: Fairy
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Ice Beam
- Draco Meteor
- Freeze-Dry
- Earth Power

Cinderace @ Heavy-Duty Boots
Ability: Libero
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Pyro Ball
- Gunk Shot
- U-turn
- Will-O-Wisp

Tornadus-Therian @ Assault Vest
Ability: Regenerator
Tera Type: Poison
EVs: 176 HP / 92 SpD / 240 Spe
Timid Nature
- Bleakwind Storm
- Heat Wave
- Knock Off
- U-turn

Hatterene (F) @ Leftovers
Ability: Magic Bounce
Tera Type: Flying
EVs: 248 HP / 204 Def / 56 Spe
Bold Nature
- Psychic Noise
- Draining Kiss
- Pain Split
- Nuzzle

Great Tusk @ Rocky Helmet
Ability: Protosynthesis
Tera Type: Dragon
EVs: 252 HP / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Rapid Spin
- Ice Spinner
- Stealth Rock

Kingambit (F) @ Leftovers
Ability: Supreme Overlord
Tera Type: Fairy
EVs: 236 HP / 252 Atk / 20 Spe
Adamant Nature
- Kowtow Cleave
- Tera Blast
- Sucker Punch
- Swords Dance`
  },
  'zamazenta-stall': {
    name: 'Zamazenta Stall',
    description: 'Defensive team with Iron Defense Zamazenta and hazard control',
    team: `Zamazenta @ Leftovers
Ability: Dauntless Shield
Tera Type: Fire
EVs: 136 HP / 120 Def / 252 Spe
Jolly Nature
- Iron Defense
- Roar
- Crunch
- Body Press

Kyurem @ Assault Vest
Ability: Pressure
Tera Type: Fairy
EVs: 252 Def / 152 SpA / 104 Spe
Modest Nature
IVs: 0 Atk
- Freeze-Dry
- Ice Beam
- Earth Power
- Body Press

Iron Treads @ Leftovers
Ability: Quark Drive
Tera Type: Ghost
EVs: 252 HP / 52 Atk / 188 SpD / 16 Spe
Adamant Nature
- Stealth Rock
- Rapid Spin
- Ice Spinner
- Earthquake

Tornadus-Therian @ Heavy-Duty Boots
Ability: Regenerator
Tera Type: Steel
EVs: 252 HP / 16 Def / 240 Spe
Timid Nature
- Knock Off
- Taunt
- Bleakwind Storm
- Nasty Plot

Pecharunt @ Covert Cloak
Ability: Poison Puppeteer
Tera Type: Water
EVs: 252 HP / 96 Def / 160 Spe
Bold Nature
IVs: 0 Atk
- Nasty Plot
- Shadow Ball
- Malignant Chain
- Recover

Ting-Lu @ Leftovers
Ability: Vessel of Ruin
Tera Type: Ghost
EVs: 244 HP / 56 Def / 200 SpD / 8 Spe
Impish Nature
- Ruination
- Spikes
- Whirlwind
- Earthquake`
  },
  'grasspon': {
    name: 'Grasspon',
    description: 'Offensive team featuring Ogerpon and strong sweepers',
    team: `Primarina (M) @ Leftovers
Ability: Liquid Voice
Tera Type: Ghost
EVs: 252 SpA / 4 SpD / 252 Spe
Modest Nature
IVs: 0 Atk
- Psychic Noise
- Moonblast
- Whirlpool
- Substitute

Great Tusk @ Rocky Helmet
Ability: Protosynthesis
Tera Type: Fire
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Headlong Rush
- Ice Spinner
- Rapid Spin
- Stealth Rock

Enamorus (F) @ Choice Scarf
Ability: Contrary
Tera Type: Ground
EVs: 252 SpA / 4 SpD / 252 Spe
Modest Nature
- Moonblast
- Earth Power
- Mystical Fire
- Healing Wish

Slowking-Galar (M) @ Assault Vest
Ability: Regenerator
Tera Type: Ice
EVs: 248 HP / 252 Def / 8 SpD
Bold Nature
IVs: 0 Atk
- Psychic Noise
- Sludge Bomb
- Flamethrower
- Ice Beam

Ogerpon (F) @ Choice Band
Ability: Defiant
Tera Type: Grass
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Ivy Cudgel
- U-turn
- Knock Off
- Rock Tomb

Kingambit (M) @ Leftovers
Ability: Supreme Overlord
Tera Type: Ghost
EVs: 248 HP / 252 Atk / 8 Def
Adamant Nature
- Swords Dance
- Kowtow Cleave
- Iron Head
- Sucker Punch`
  },
  'hydrapple-sand': {
    name: 'Hydrapple Sand',
    description: 'Sand team with Tyranitar, Excadrill, and Hydrapple',
    team: `Hydrapple (M) @ Heavy-Duty Boots
Ability: Regenerator
Tera Type: Poison
EVs: 208 HP / 172 Def / 88 SpA / 40 Spe
Bold Nature
IVs: 0 Atk
- Nasty Plot
- Giga Drain
- Fickle Beam
- Earth Power

Tyranitar (F) @ Smooth Rock
Ability: Sand Stream
Tera Type: Flying
EVs: 248 HP / 16 Def / 24 SpA / 216 SpD / 4 Spe
Sassy Nature
- Knock Off
- Ice Beam
- Thunder Wave
- Stealth Rock

Moltres @ Heavy-Duty Boots
Ability: Flame Body
Tera Type: Fairy
EVs: 248 HP / 248 Def / 12 Spe
Bold Nature
- Flamethrower
- U-turn
- Roost
- Roar

Zamazenta @ Leftovers
Ability: Dauntless Shield
Tera Type: Fire
EVs: 4 Atk / 252 Def / 252 Spe
Jolly Nature
- Body Press
- Crunch
- Iron Defense
- Roar

Slowking-Galar @ Assault Vest
Ability: Regenerator
Tera Type: Grass
EVs: 248 HP / 184 Def / 28 SpA / 48 Spe
Bold Nature
IVs: 0 Atk
- Psyshock
- Sludge Bomb
- Flamethrower
- Ice Beam

Excadrill (F) @ Air Balloon
Ability: Sand Rush
Tera Type: Fire
EVs: 252 Atk / 4 Def / 252 Spe
Jolly Nature
- Earthquake
- Iron Head
- Rapid Spin
- Swords Dance`
  },
  'card-ting-fairy-nite': {
    name: 'Card Ting, Fairy Nite',
    description: 'Defensive core with Ting-Lu, Zamazenta, and Dragonite',
    team: `Ting-Lu @ Red Card
Ability: Vessel of Ruin
Tera Type: Ghost
EVs: 40 HP / 216 Def / 252 SpD
Relaxed Nature
IVs: 0 Atk / 9 Spe
- Stealth Rock
- Whirlwind
- Ruination
- Spikes

Zamazenta @ Leftovers
Ability: Dauntless Shield
Tera Type: Fire
EVs: 16 HP / 240 Def / 252 Spe
Jolly Nature
- Iron Defense
- Body Press
- Crunch
- Roar

Ogerpon-Wellspring (F) @ Wellspring Mask
Ability: Water Absorb
Tera Type: Water
EVs: 244 Atk / 12 Def / 252 Spe
Jolly Nature
- Ivy Cudgel
- Play Rough
- Synthesis
- Taunt

Dragonite (F) @ Heavy-Duty Boots
Ability: Multiscale
Tera Type: Fairy
EVs: 248 HP / 108 Def / 152 Spe
Impish Nature
- Dragon Dance
- Tera Blast
- Earthquake
- Roost

Gholdengo @ Choice Scarf
Ability: Good as Gold
Tera Type: Steel
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Make It Rain
- Shadow Ball
- Recover
- Trick

Iron Treads @ Air Balloon
Ability: Quark Drive
Tera Type: Ghost
EVs: 100 Atk / 216 SpD / 192 Spe
Jolly Nature
- Earthquake
- Ice Spinner
- Knock Off
- Rapid Spin`
  }
};

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
    description: 'TypeAwareBot with optimized switching and wall detection.',
    difficulty: 'Expert',
    strength: '★★★★★★',
    features: ['Optimized switching', 'Wall detection', 'Aggressive play', 'Team preservation']
  },
  '7': {
    name: 'Depth6SearchBot',
    class: Depth6SearchBot,
    description: 'Deepest search bot! 6-ply minimax with transposition tables and move ordering.',
    difficulty: 'Master',
    strength: '★★★★★★★',
    features: ['6-ply minimax (3 full turns)', 'Transposition tables', 'Move ordering', 'Alpha-beta pruning', '~2-5s per turn']
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
    this.battleStream = null;
    this.botInitialized = false;

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

    // Keep reference to the BattleStream to access battle instance
    const battleStream = new BattleStreams.BattleStream();
    const streams = BattleStreams.getPlayerStreams(battleStream);

    const team1Packed = Teams.pack(Teams.import(this.humanTeam));
    const team2Packed = Teams.pack(Teams.import(this.botTeam));

    const spec = { formatid: 'gen9ou' };
    const p1spec = { name: 'You', team: team1Packed };
    const p2spec = { name: 'Bot', team: team2Packed };

    void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
    void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
    void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

    // Store battleStream reference for later access
    this.battleStream = battleStream;
    this.botInitialized = false;

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

            // Initialize bot with battle instance on first request
            if (!this.botInitialized && this.battleStream.battle && typeof this.bot.setBattleInstance === 'function') {
              this.bot.setBattleInstance(this.battleStream.battle, 'p2');
              this.botInitialized = true;
              console.log('[System] Bot initialized with battle instance - minimax search enabled\n');
            }

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
    rl.question('Select bot opponent (1-7): ', (answer) => {
      resolve(answer.trim());
    });
  });

  const selectedBot = BOTS[botChoice] || BOTS['5']; // Default to TypeAwareBot if invalid

  console.log(`\n✓ Selected: ${selectedBot.name} (${selectedBot.difficulty})\n`);

  // Display all available teams
  console.log('\n' + '='.repeat(80));
  console.log('CHOOSE YOUR TEAM');
  console.log('='.repeat(80));
  console.log('\nAvailable Teams (from Smogon Sample Teams):\n');

  const teamKeys = Object.keys(SAMPLE_TEAMS);
  teamKeys.forEach((key, index) => {
    const team = SAMPLE_TEAMS[key];
    console.log(`${index + 1}. ${team.name}`);
    console.log(`   ${team.description}`);
    console.log('');
  });

  // Select human team
  const humanTeamChoice = await new Promise((resolve) => {
    rl.question(`Select your team (1-${teamKeys.length}): `, (answer) => {
      resolve(answer.trim());
    });
  });

  const humanTeamIndex = parseInt(humanTeamChoice) - 1;
  const humanTeamKey = teamKeys[humanTeamIndex] || teamKeys[0];
  const humanTeamData = SAMPLE_TEAMS[humanTeamKey];

  console.log(`\n✓ You selected: ${humanTeamData.name}`);

  // Select bot team
  console.log('\nChoose bot team:\n');
  teamKeys.forEach((key, index) => {
    const team = SAMPLE_TEAMS[key];
    console.log(`${index + 1}. ${team.name}`);
  });

  const botTeamChoice = await new Promise((resolve) => {
    rl.question(`\nSelect bot team (1-${teamKeys.length}): `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  const botTeamIndex = parseInt(botTeamChoice) - 1;
  const botTeamKey = teamKeys[botTeamIndex] || teamKeys[1];
  const botTeamData = SAMPLE_TEAMS[botTeamKey];

  console.log(`\n✓ Bot will use: ${botTeamData.name}\n`);

  const humanTeam = humanTeamData.team;
  const botTeam = botTeamData.team;

  const battle = new HumanVsBotBattle(humanTeam, botTeam, selectedBot.class, selectedBot.name);
  await battle.start();
}

main().catch(console.error);
