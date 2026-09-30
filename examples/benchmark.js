/**
 * Head-to-head benchmark between two bots on the direct-Battle harness.
 *
 * Usage:
 *   node examples/benchmark.js <botA> <botB> [--games N] [--time MS] [--seed S] [--quiet] [--json FILE]
 *
 * Bots: random, maxdamage, ordering, depth4, depth6, improved6
 *   ordering  = top of the search bot's move ordering with no search, which
 *               is what the old depth-6 bot effectively played
 *   --time    = per-decision time limit for the search bots (default 1000ms)
 *
 * Games are played in mirrored pairs: both games of a pair use the same battle
 * seed, team assignment and seats, with the bots swapped. That cancels out
 * team, seat and seed luck, so the only difference within a pair is the bots.
 */

const fs = require('fs');
const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const RandomBot = require('../src/RandomBot');
const MaxDamageBot = require('../src/MaxDamageBot');
const OptimizedDepth4Bot = require('../src/OptimizedDepth4Bot');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const ImprovedDepth6Bot = require('../src/ImprovedDepth6Bot');
const ouTeams = require('../data/ou-teams');

class OrderingOnlyBot extends OptimizedDepth4Bot {
  constructor(name) {
    super(name, { considerSwitches: false });
  }

  searchBestMove() {
    const order = this.getOrderedChoices(this.battleInstance, this.playerSide, true);
    return order.length ? { choice: order[0].choice, score: 0, depth: 0, nodesExplored: 0 } : null;
  }
}

const BOTS = {
  random: name => new RandomBot(name),
  maxdamage: name => new MaxDamageBot(name),
  ordering: name => new OrderingOnlyBot(name),
  depth4: (name, time) => new OptimizedDepth4Bot(name, { timeLimit: time }),
  depth6: (name, time) => new Depth6SearchBot(name, { timeLimit: time }),
  improved6: (name, time) => new ImprovedDepth6Bot(name, { timeLimit: time })
};

function parseArgs(argv) {
  const args = { games: 100, time: 1000, seed: 1, quiet: false, json: null, bots: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--games') args.games = parseInt(argv[++i], 10);
    else if (arg === '--time') args.time = parseInt(argv[++i], 10);
    else if (arg === '--seed') args.seed = parseInt(argv[++i], 10);
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--quiet') args.quiet = true;
    else args.bots.push(arg);
  }
  if (args.bots.length !== 2 || !args.bots.every(b => BOTS[b])) {
    console.error(`Usage: node examples/benchmark.js <botA> <botB> [--games N] [--time MS] [--seed S] [--quiet] [--json FILE]`);
    console.error(`Bots: ${Object.keys(BOTS).join(', ')}`);
    process.exit(1);
  }
  if (args.games % 2) args.games++; // mirrored pairs
  return args;
}

/**
 * Wilson score interval for a proportion (95% by default).
 */
function wilson(successes, n, z = 1.96) {
  if (n === 0) return [0, 0];
  const p = successes / n;
  const denom = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denom;
  const margin = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / denom;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

const pct = x => `${(x * 100).toFixed(1)}%`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [keyA, keyB] = args.bots;
  // Distinct names even for a self-play benchmark
  const nameA = `A-${keyA}`;
  const nameB = `B-${keyB}`;
  const teams = ouTeams.getAllTeams();

  console.log('='.repeat(70));
  console.log(`BENCHMARK: ${keyA} vs ${keyB}`);
  console.log(`${args.games} games (${args.games / 2} mirrored pairs), time limit ${args.time}ms, seed base ${args.seed}`);
  console.log('='.repeat(70));

  const totals = {
    wins: 0, losses: 0, draws: 0, turns: 0,
    errors: 0, invalid: 0, botErrors: 0,
    decisionMs: { A: 0, B: 0 }, decisions: { A: 0, B: 0 },
    depth: { A: [0, 0], B: [0, 0] }
  };
  const games = [];
  const start = Date.now();

  for (let i = 0; i < args.games; i++) {
    const pair = Math.floor(i / 2);
    const swapped = i % 2 === 1;
    // Alternate team assignment between pairs so each bot sees both teams
    const [teamX, teamY] = pair % 2 === 0 ? [teams[0], teams[1]] : [teams[1], teams[0]];
    const seed = [args.seed, pair, 17, 31];

    const botA = BOTS[keyA](nameA, args.time);
    const botB = BOTS[keyB](nameB, args.time);
    const [p1, p2] = swapped ? [botB, botA] : [botA, botB];
    const aSeat = swapped ? 'p2' : 'p1';

    const sim = new EngineBattleSimulator(p1, p2, teamX, teamY, { seed, maxTurns: 150 });
    const result = await sim.runBattle();

    const outcome = result.winner === nameA ? 'W' : result.winner === nameB ? 'L' : 'D';
    if (outcome === 'W') totals.wins++;
    else if (outcome === 'L') totals.losses++;
    else totals.draws++;
    totals.turns += result.turns;
    totals.errors += result.error ? 1 : 0;
    totals.invalid += result.invalidChoices;
    totals.botErrors += result.botErrors;

    const bSeat = aSeat === 'p1' ? 'p2' : 'p1';
    totals.decisionMs.A += result.decisionMs[aSeat];
    totals.decisionMs.B += result.decisionMs[bSeat];
    totals.decisions.A += result.decisions[aSeat];
    totals.decisions.B += result.decisions[bSeat];
    for (const [label, bot] of [['A', botA], ['B', botB]]) {
      if (bot.searchStats) {
        totals.depth[label][0] += bot.searchStats.totalDepthReached;
        totals.depth[label][1] += bot.searchStats.searchCalls;
      }
    }

    games.push({ game: i + 1, pair, aSeat, outcome, turns: result.turns, error: result.error });

    if (!args.quiet) {
      const played = i + 1;
      console.log(
        `Game ${String(played).padStart(3)}: ${outcome} (${keyA} as ${aSeat}) turns=${String(result.turns).padStart(3)}` +
        `${result.error ? ` ERROR: ${result.error}` : ''}` +
        `  | running ${totals.wins}-${totals.losses}-${totals.draws}`
      );
    }
  }

  const n = totals.wins + totals.losses + totals.draws;
  const decisive = totals.wins + totals.losses;
  const [lo, hi] = wilson(totals.wins, decisive);
  const avgDepth = label => {
    const [sum, calls] = totals.depth[label];
    return calls ? (sum / calls).toFixed(2) : 'n/a';
  };

  const summary = {
    botA: keyA,
    botB: keyB,
    games: n,
    timeLimitMs: args.time,
    seedBase: args.seed,
    wins: totals.wins,
    losses: totals.losses,
    draws: totals.draws,
    winRateDecisive: decisive ? totals.wins / decisive : 0,
    ci95: [lo, hi],
    score: n ? (totals.wins + totals.draws / 2) / n : 0,
    avgTurns: n ? totals.turns / n : 0,
    avgDecisionMs: {
      A: totals.decisions.A ? totals.decisionMs.A / totals.decisions.A : 0,
      B: totals.decisions.B ? totals.decisionMs.B / totals.decisions.B : 0
    },
    avgTurnsSearched: { A: avgDepth('A'), B: avgDepth('B') },
    harnessErrors: totals.errors,
    invalidChoices: totals.invalid,
    botErrors: totals.botErrors,
    wallSeconds: (Date.now() - start) / 1000
  };

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`${keyA} vs ${keyB}: ${totals.wins}-${totals.losses}-${totals.draws} (W-L-D) over ${n} games`);
  console.log(`Win rate (decisive games): ${pct(summary.winRateDecisive)}  95% CI [${pct(lo)}, ${pct(hi)}]`);
  console.log(`Score (draw = half):       ${pct(summary.score)}`);
  console.log(`Avg turns:                 ${summary.avgTurns.toFixed(1)}`);
  console.log(`Avg decision time:         ${keyA} ${summary.avgDecisionMs.A.toFixed(0)}ms, ${keyB} ${summary.avgDecisionMs.B.toFixed(0)}ms`);
  console.log(`Avg turns searched:        ${keyA} ${summary.avgTurnsSearched.A}, ${keyB} ${summary.avgTurnsSearched.B}`);
  console.log(`Harness errors: ${totals.errors}, invalid choices: ${totals.invalid}, bot errors: ${totals.botErrors}`);
  console.log(`Wall time: ${summary.wallSeconds.toFixed(0)}s`);

  if (args.json) {
    fs.writeFileSync(args.json, JSON.stringify({ summary, games }, null, 2));
    console.log(`Saved ${args.json}`);
  }
}

main().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
