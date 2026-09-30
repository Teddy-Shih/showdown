const test = require('node:test');
const assert = require('node:assert');
const { Battle, Teams } = require('@pkmn/sim');

const OptimizedDepth4Bot = require('../src/OptimizedDepth4Bot');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const ImprovedDepth6Bot = require('../src/ImprovedDepth6Bot');

// Both Pokemon are down to 1 HP and Dragapult is faster. Earthquake is
// Garchomp's highest-damage move, so damage-based move ordering ranks it first,
// but Dragapult moves first and knocks Garchomp out: a loss. Aqua Jet has
// priority and wins. A search that actually simulates its own root move must
// pick Aqua Jet; one that falls back on damage ordering picks Earthquake.
const GARCHOMP = `
Garchomp
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Aqua Jet
`;

const DRAGAPULT = `
Dragapult
Ability: Clear Body
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Shadow Ball
`;

function tacticalBattle(garchompSide) {
  const garchomp = Teams.pack(Teams.import(GARCHOMP));
  const dragapult = Teams.pack(Teams.import(DRAGAPULT));
  const battle = new Battle({
    formatid: 'gen9customgame',
    seed: [1, 2, 3, 4],
    p1: { name: 'Alice', team: garchompSide === 'p1' ? garchomp : dragapult },
    p2: { name: 'Bob', team: garchompSide === 'p1' ? dragapult : garchomp }
  });
  battle.makeChoices('default', 'default'); // team preview
  battle.p1.active[0].hp = 1;
  battle.p2.active[0].hp = 1;
  return battle;
}

for (const side of ['p1', 'p2']) {
  test(`search simulates its root move and finds the winning move (bot as ${side})`, () => {
    const battle = tacticalBattle(side);
    const bot = new OptimizedDepth4Bot(side === 'p1' ? 'Alice' : 'Bob', { maxDepth: 2 });
    bot.setBattleInstance(battle, side);

    // Guard: move ordering alone would pick the wrong move here
    const ordered = bot.simulator.orderMoves(battle, side, ['earthquake', 'aquajet']);
    assert.strictEqual(ordered[0], 'earthquake');

    const result = bot.searchBestMove();
    assert.strictEqual(result.choice, 'move 2', 'should choose Aqua Jet');
    assert.ok(result.score >= 10000, `winning line should score as a win, got ${result.score}`);
  });
}

test('root moves get different scores when their outcomes differ', () => {
  const battle = tacticalBattle('p1');
  const bot = new OptimizedDepth4Bot('Alice', { maxDepth: 2, considerSwitches: false });
  bot.setBattleInstance(battle, 'p1');
  bot.searchStartTime = performance.now();
  bot.nodesThisPath = 0;

  const scores = new Map();
  const choices = bot.getOrderedChoices(battle, 'p1', true);
  bot.maxMin(battle, 1, -Infinity, Infinity, choices, scores, 0, true);

  assert.ok(scores.get('move 2') > scores.get('move 1'),
    `Aqua Jet ${scores.get('move 2')} should beat Earthquake ${scores.get('move 1')}`);
});

test('evaluateState scores a win for the winner and a loss for the loser', () => {
  const battle = tacticalBattle('p1');
  battle.makeChoices('move 2', 'move 1'); // Aqua Jet KOs Dragapult first
  assert.ok(battle.ended);
  assert.strictEqual(battle.winner, 'Alice');

  const bot = new OptimizedDepth4Bot('Alice');
  assert.strictEqual(bot.simulator.evaluateState(battle, 'p1'), 10000);
  assert.strictEqual(bot.simulator.evaluateState(battle, 'p2'), -10000);
});

test('time-limited search returns a legal choice from a completed iteration', () => {
  const battle = tacticalBattle('p1');
  for (const Bot of [Depth6SearchBot, ImprovedDepth6Bot]) {
    const bot = new Bot('Alice', { timeLimit: 200 });
    bot.setBattleInstance(battle, 'p1');
    const choice = bot.chooseMove(battle.p1.activeRequest);
    assert.strictEqual(choice, 'move 2');
  }
});

test('transposition key ignores the turn number', () => {
  const battle = tacticalBattle('p1');
  const bot = new OptimizedDepth4Bot('Alice');
  const key = bot.simulator.getBattleStateHash(battle);
  battle.turn += 5;
  assert.strictEqual(bot.simulator.getBattleStateHash(battle), key);
});
