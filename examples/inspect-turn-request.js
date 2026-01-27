const { BattleStreams, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const { TEAM_SPECS_GHOLDENGO } = require('../data/ou-teams');

Teams.setGeneratorFactory(TeamGenerators);

class RequestInspectorBot {
  constructor(name) {
    this.name = name;
    this.turnCount = 0;
  }

  processBattleMessage(message) {
    // Not needed for this test
  }

  chooseMove(request) {
    this.turnCount++;

    // Log turn 2 request (after team preview)
    if (this.turnCount === 2) {
      console.log('='.repeat(80));
      console.log(`TURN 2 REQUEST OBJECT FOR ${this.name}`);
      console.log('='.repeat(80));
      console.log(JSON.stringify(request, null, 2));
      console.log('='.repeat(80));
    }

    if (request.forceSwitch) {
      return 'switch 2';
    }

    if (request.teamPreview) {
      return 'default';
    }

    // Use Stealth Rock on turn 2 to set up field condition
    if (this.turnCount === 2) {
      return 'move 4'; // Stealth Rock for Great Tusk
    }

    return 'move 1';
  }
}

async function inspectRequest() {
  const bot1 = new RequestInspectorBot('Bot1');
  const bot2 = new RequestInspectorBot('Bot2');

  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

  const team1Packed = Teams.pack(Teams.import(TEAM_SPECS_GHOLDENGO));
  const team2Packed = Teams.pack(Teams.import(TEAM_SPECS_GHOLDENGO));

  const spec = { formatid: 'gen9ou' };
  const p1spec = { name: bot1.name, team: team1Packed };
  const p2spec = { name: bot2.name, team: team2Packed };

  void streams.omniscient.write(`>start ${JSON.stringify(spec)}`);
  void streams.omniscient.write(`>player p1 ${JSON.stringify(p1spec)}`);
  void streams.omniscient.write(`>player p2 ${JSON.stringify(p2spec)}`);

  const processP1 = async () => {
    for await (const chunk of streams.p1) {
      bot1.processBattleMessage(chunk);

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
        }
      }
    }
  };

  const processP2 = async () => {
    for await (const chunk of streams.p2) {
      bot2.processBattleMessage(chunk);

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
    }
  };

  await Promise.all([processP1(), processP2()]);
}

inspectRequest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
