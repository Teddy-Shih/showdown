const test = require('node:test');
const assert = require('node:assert');
const { Battle, Teams } = require('@pkmn/sim');

const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const TranspositionMoveSimulator = require('../src/TranspositionMoveSimulator');
const cloneBattle = require('../src/cloneBattle');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

const [TEAM_A, TEAM_B] = ouTeams.getAllTeams();

function startBattle() {
  const battle = new Battle({
    formatid: 'gen9customgame',
    p1: { name: 'A', team: Teams.pack(Teams.import(TEAM_A)) },
    p2: { name: 'B', team: Teams.pack(Teams.import(TEAM_B)) }
  });
  battle.makeChoices('default', 'default'); // team preview
  return battle;
}

test('RandomBot vs RandomBot: 100 seeded games all finish without harness errors', async () => {
  let unfinished = 0;
  let errors = 0;
  let invalid = 0;
  for (let i = 0; i < 100; i++) {
    const sim = new EngineBattleSimulator(
      new RandomBot('A'), new RandomBot('B'),
      i % 2 ? TEAM_B : TEAM_A, i % 2 ? TEAM_A : TEAM_B,
      { seed: [i, 7, 13, 21], maxTurns: 200 }
    );
    const result = await sim.runBattle();
    if (!result.ended) unfinished++;
    if (result.error) errors++;
    invalid += result.invalidChoices;
  }
  assert.strictEqual(unfinished, 0, `${unfinished} games did not finish`);
  assert.strictEqual(errors, 0, `${errors} games hit a harness error`);
  assert.strictEqual(invalid, 0, `${invalid} invalid choices submitted`);
});

test('the same seed reproduces the same game', async () => {
  const run = async () => {
    // RandomBot uses Math.random, so pin both sides to the first legal move
    const first = { chooseMove: r => (r.forceSwitch ? 'default' : 'move 1') };
    const a = { ...first, name: 'A' };
    const b = { ...first, name: 'B' };
    const sim = new EngineBattleSimulator(a, b, TEAM_A, TEAM_B, { seed: [1, 2, 3, 4] });
    const result = await sim.runBattle();
    return `${result.winner}:${result.turns}:${sim.battle.log.length}`;
  };
  assert.strictEqual(await run(), await run());
});

test('cloning a battle does not write to the original log', () => {
  const battle = startBattle();
  const before = battle.log.length;

  for (let i = 0; i < 20; i++) {
    cloneBattle(battle).makeChoices('move 1', 'move 1');
  }
  const simulator = new TranspositionMoveSimulator();
  for (let i = 0; i < 20; i++) {
    simulator.applyChoices(battle, 'move 2', 'move 2');
  }

  assert.strictEqual(battle.log.length, before);
});

test('applyChoices only answers requests that were pending', () => {
  const simulator = new TranspositionMoveSimulator();
  const battle = startBattle();
  const next = simulator.applyChoices(battle, 'move 1', 'move 1');
  assert.ok(next, 'turn should simulate');
  assert.strictEqual(battle.turn, 1, 'original battle must not advance');
  assert.ok(next.turn > 1 || next.ended || next.sides.some(s => s.requestState === 'switch'));
});

test('getChoices reads the real request: moves, capped switches, forced switches', () => {
  const simulator = new TranspositionMoveSimulator();
  const battle = startBattle();

  const movesOnly = simulator.getChoices(battle, 'p1');
  assert.ok(movesOnly.every(c => c.kind === 'move'));
  assert.ok(movesOnly.length >= 1 && movesOnly.length <= 4);

  const withSwitches = simulator.getChoices(battle, 'p1', { includeSwitches: true, maxSwitches: 2 });
  assert.strictEqual(withSwitches.filter(c => c.kind === 'switch').length, 2);

  // No pending request for a side means no choices
  battle.p1.activeRequest = null;
  assert.deepStrictEqual(simulator.getChoices(battle, 'p1'), []);
});
