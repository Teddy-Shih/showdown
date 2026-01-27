const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

Teams.setGeneratorFactory(TeamGenerators);

class DetailedBattleLogger {
  constructor() {
    this.turns = [];
    this.currentTurn = { number: 0, events: [] };
    this.hp = { p1: {}, p2: {} };
    this.active = { p1: null, p2: null };
  }

  processTurn(lineNum) {
    if (this.currentTurn.number > 0) {
      this.turns.push({ ...this.currentTurn });
    }
    this.currentTurn = { number: lineNum, events: [] };
  }

  processSwitch(line) {
    const parts = line.split('|');
    const player = parts[2].startsWith('p1') ? 'p1' : 'p2';
    const pokemon = parts[3].split(',')[0].trim();
    const hp = parts[4];

    this.active[player] = pokemon;
    this.hp[player][pokemon] = hp;

    this.currentTurn.events.push({
      type: 'switch',
      player: player,
      pokemon: pokemon,
      hp: hp
    });
  }

  processMove(line) {
    const parts = line.split('|');
    const player = parts[2].startsWith('p1') ? 'p1' : 'p2';
    const pokemon = parts[2].split(':')[1]?.trim() || '';
    const move = parts[3];

    this.currentTurn.events.push({
      type: 'move',
      player: player,
      pokemon: pokemon,
      move: move
    });
  }

  processDamage(line) {
    const parts = line.split('|');
    const target = parts[2];
    const player = target.startsWith('p1') ? 'p1' : 'p2';
    const pokemon = target.split(':')[1]?.trim() || '';
    const newHP = parts[3];

    this.hp[player][pokemon] = newHP;

    this.currentTurn.events.push({
      type: 'damage',
      player: player,
      pokemon: pokemon,
      hp: newHP
    });
  }

  processFaint(line) {
    const parts = line.split('|');
    const target = parts[2];
    const player = target.startsWith('p1') ? 'p1' : 'p2';
    const pokemon = target.split(':')[1]?.trim() || '';

    this.currentTurn.events.push({
      type: 'faint',
      player: player,
      pokemon: pokemon
    });
  }

  processMessage(message) {
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.includes('|turn|')) {
        const turnNum = parseInt(line.split('|')[2]);
        this.processTurn(turnNum);
      } else if (line.includes('|switch|') || line.includes('|drag|')) {
        this.processSwitch(line);
      } else if (line.includes('|move|')) {
        this.processMove(line);
      } else if (line.includes('|-damage|')) {
        this.processDamage(line);
      } else if (line.includes('|faint|')) {
        this.processFaint(line);
      }
    }
  }

  finalize() {
    if (this.currentTurn.number > 0) {
      this.turns.push({ ...this.currentTurn });
    }
  }

  formatLog() {
    const lines = [];
    for (const turn of this.turns) {
      lines.push(`\n--- Turn ${turn.number} ---`);

      const switches = turn.events.filter(e => e.type === 'switch');
      const moves = turn.events.filter(e => e.type === 'move');
      const damages = turn.events.filter(e => e.type === 'damage');
      const faints = turn.events.filter(e => e.type === 'faint');

      // Switches first
      for (const sw of switches) {
        const botName = sw.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot';
        lines.push(`  ${botName} switched to ${sw.pokemon} (${sw.hp})`);
      }

      // Moves
      for (const move of moves) {
        const botName = move.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot';
        lines.push(`  ${botName}'s ${move.pokemon} used ${move.move}`);
      }

      // Damage and faints
      for (const dmg of damages) {
        const botName = dmg.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot';
        lines.push(`    → ${botName}'s ${dmg.pokemon}: ${dmg.hp}`);
      }

      for (const faint of faints) {
        const botName = faint.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot';
        lines.push(`    ☠ ${botName}'s ${faint.pokemon} fainted!`);
      }
    }

    return lines.join('\n');
  }
}

async function runDetailedBattle(team1, team2, battleNum, typeAwareSide) {
  const typeAwareBot = new TypeAwareBot('TypeAwareBot');
  const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

  const bot1 = typeAwareSide === 'p1' ? typeAwareBot : treeSearchBot;
  const bot2 = typeAwareSide === 'p1' ? treeSearchBot : typeAwareBot;

  const logger = new DetailedBattleLogger();

  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

  const team1Packed = Teams.pack(Teams.import(team1));
  const team2Packed = Teams.pack(Teams.import(team2));

  const spec = { formatid: 'gen9ou' };
  const p1spec = { name: bot1.name, team: team1Packed };
  const p2spec = { name: bot2.name, team: team2Packed };

  void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
  void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
  void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

  let winner = null;
  let turnCount = 0;

  const processP1 = async () => {
    for await (const chunk of streams.p1) {
      if (bot1.processBattleMessage) {
        bot1.processBattleMessage(chunk);
      }

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const p1Request = JSON.parse(requestData);
            if (!p1Request.wait) {
              const choice = bot1.chooseMove(p1Request);
              void streams.p1.write(choice);
            }
          }
        } else if (line.startsWith('|win|')) {
          winner = line.split('|')[2];
        } else if (line.startsWith('|turn|')) {
          turnCount = parseInt(line.split('|')[2]);
        }
      }

      logger.processMessage(chunk);
    }
  };

  const processP2 = async () => {
    for await (const chunk of streams.p2) {
      if (bot2.processBattleMessage) {
        bot2.processBattleMessage(chunk);
      }

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const p2Request = JSON.parse(requestData);
            if (!p2Request.wait) {
              const choice = bot2.chooseMove(p2Request);
              void streams.p2.write(choice);
            }
          }
        }
      }

      logger.processMessage(chunk);
    }
  };

  await Promise.all([processP1(), processP2()]);

  logger.finalize();

  return {
    winner,
    turnCount,
    logger,
    typeAwareBot,
    treeSearchBot
  };
}

async function main() {
  const numBattles = parseInt(process.argv[2]) || 10;

  console.log('='.repeat(80));
  console.log('RUNNING BATTLES TO CAPTURE LOSS LOGS');
  console.log('='.repeat(80));
  console.log();

  let typeAwareWins = 0;
  let treeSearchWins = 0;
  const losses = [];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareSide = i % 2 === 0 ? 'p1' : 'p2';
    const team1 = i % 2 === 0 ? TEAM_SPECS_GHOLDENGO : TEAM_ANTIMETA_LANDO;
    const team2 = i % 2 === 0 ? TEAM_ANTIMETA_LANDO : TEAM_SPECS_GHOLDENGO;
    const typeAwareTeam = i % 2 === 0 ? 'Team 1' : 'Team 2';

    const result = await runDetailedBattle(team1, team2, i + 1, typeAwareSide);

    const typeAwareWon = result.winner === 'TypeAwareBot';

    if (typeAwareWon) {
      typeAwareWins++;
      console.log(`Battle ${i + 1}: TypeAwareBot (${typeAwareTeam}) WON ✓`);
    } else {
      treeSearchWins++;
      console.log(`Battle ${i + 1}: TypeAwareBot (${typeAwareTeam}) LOST ❌`);

      losses.push({
        battleNum: i + 1,
        team: typeAwareTeam,
        turns: result.turnCount,
        logger: result.logger,
        nodes: result.typeAwareBot.nodesEvaluated
      });
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log(`TypeAwareBot: ${typeAwareWins} wins (${(typeAwareWins/numBattles*100).toFixed(1)}%)`);
  console.log(`TreeSearchBot: ${treeSearchWins} wins (${(treeSearchWins/numBattles*100).toFixed(1)}%)`);
  console.log();

  if (losses.length > 0) {
    console.log('='.repeat(80));
    console.log(`DETAILED LOSS LOGS (${losses.length} losses)`);
    console.log('='.repeat(80));

    for (const loss of losses) {
      console.log();
      console.log(`Battle ${loss.battleNum} - TypeAwareBot (${loss.team}) - ${loss.turns} turns - ${loss.nodes} nodes`);
      console.log('-'.repeat(80));
      console.log(loss.logger.formatLog());
      console.log();
      console.log('='.repeat(80));
    }
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
