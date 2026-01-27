const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

Teams.setGeneratorFactory(TeamGenerators);

// Wrap evaluateMoveStrategicValue to add logging
const originalEvaluate = TypeAwareBot.prototype.evaluateMoveStrategicValue;
TypeAwareBot.prototype.evaluateMoveStrategicValue = function(move, oppPokemon) {
  const moveData = this.dex.moves.get(move.id || move);
  if (!moveData) return 0;

  const moveName = moveData.name.toLowerCase();

  // Log hazard moves
  if (moveName.includes('stealth rock')) {
    console.log(`\n[HAZARD CHECK] Move: ${moveData.name}`);
    console.log(`  opponent.stealthRock: ${this.hazards.opponent.stealthRock}`);
    console.log(`  Will apply bonus: ${!this.hazards.opponent.stealthRock}`);
  }

  // Log status moves
  if (moveName.includes('thunder wave')) {
    console.log(`\n[STATUS CHECK] Move: ${moveData.name}`);
    console.log(`  opponentStatus: ${this.opponentStatus}`);
    console.log(`  oppPokemon.status: ${oppPokemon ? oppPokemon.status : 'N/A'}`);
    const oppSpecies = this.dex.species.get(oppPokemon.species);
    console.log(`  opponent types: ${oppSpecies.types.join('/')}`);
    console.log(`  immune: ${this.isImmuneToStatus(oppSpecies.types, 'par')}`);
  }

  return originalEvaluate.call(this, move, oppPokemon);
};

async function runDebugBattle() {
  const typeAwareBot = new TypeAwareBot('TypeAwareBot');
  const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

  const team1Packed = Teams.pack(Teams.import(TEAM_SPECS_GHOLDENGO));
  const team2Packed = Teams.pack(Teams.import(TEAM_ANTIMETA_LANDO));

  const spec = { formatid: 'gen9ou' };
  const p1spec = { name: typeAwareBot.name, team: team1Packed };
  const p2spec = { name: treeSearchBot.name, team: team2Packed };

  void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
  void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
  void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

  let turnCount = 0;

  const processP1 = async () => {
    for await (const chunk of streams.p1) {
      typeAwareBot.processBattleMessage(chunk);

      const lines = chunk.split('\n');
      for (const line of lines) {
        // Log hazard setting
        if (line.includes('|-sidestart|') && line.includes('Stealth Rock')) {
          console.log(`\n[BATTLE EVENT] ${line}`);
          console.log(`  After processing: opponent.stealthRock = ${typeAwareBot.hazards.opponent.stealthRock}`);
        }

        // Log status setting
        if (line.includes('|-status|') && line.includes('par')) {
          console.log(`\n[BATTLE EVENT] ${line}`);
          console.log(`  After processing: opponentStatus = ${typeAwareBot.opponentStatus}`);
        }

        if (line.startsWith('|turn|')) {
          turnCount = parseInt(line.split('|')[2]);
          console.log(`\n${'='.repeat(60)}`);
          console.log(`TURN ${turnCount}`);
          console.log('='.repeat(60));
        }

        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const p1Request = JSON.parse(requestData);
            if (!p1Request.wait) {
              const choice = typeAwareBot.chooseMove(p1Request);
              console.log(`\n[CHOICE] TypeAwareBot: ${choice}`);
              void streams.p1.write(choice);

              // Stop after 15 turns to avoid too much output
              if (turnCount >= 15) {
                console.log('\n[DEBUG] Stopping after turn 15');
                process.exit(0);
              }
            }
          }
        }
      }
    }
  };

  const processP2 = async () => {
    for await (const chunk of streams.p2) {
      treeSearchBot.processBattleMessage(chunk);

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('|request|')) {
          const requestData = line.slice('|request|'.length);
          if (requestData) {
            const p2Request = JSON.parse(requestData);
            if (!p2Request.wait) {
              const choice = treeSearchBot.chooseMove(p2Request);
              void streams.p2.write(choice);
            }
          }
        }
      }
    }
  };

  await Promise.all([processP1(), processP2()]);
}

runDebugBattle().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
