/**
 * Benchmark: ImprovedDepth6Bot vs Depth6SearchBot (baseline)
 * Both tested against RandomBot over 10 games each.
 *
 * Tests two key improvements:
 * 1. Refined damage/setup scoring weights in TranspositionMoveSimulator
 * 2. Opponent modeling via move history tracking
 */

const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const ImprovedDepth6Bot = require('../src/ImprovedDepth6Bot');
const Depth6SearchBot = require('../src/Depth6SearchBot');
const RandomBot = require('../src/RandomBot');
const ouTeams = require('../data/ou-teams');

const NUM_GAMES = parseInt(process.argv[2]) || 10;

async function runGames(BotClass, botOptions, botLabel, numGames) {
  const allTeams = ouTeams.getAllTeams();
  const team1 = allTeams[0];
  const team2 = allTeams[1];

  let wins = 0, losses = 0, draws = 0;
  let totalTurns = 0;
  let totalTimeMs = 0;
  let totalHistHits = 0;

  for (let i = 0; i < numGames; i++) {
    const testBot = new BotClass(botLabel, botOptions);
    const randomBot = new RandomBot('RandomBot');

    // Alternate sides each game
    const testIsP1 = i % 2 === 0;
    const t1 = testIsP1 ? team1 : team2;
    const t2 = testIsP1 ? team2 : team1;
    const bot1 = testIsP1 ? testBot : randomBot;
    const bot2 = testIsP1 ? randomBot : testBot;

    const simulator = new EngineBattleSimulator(
      bot1, bot2, t1, t2,
      { verbose: false, maxTurns: 100 }
    );

    const gameStart = performance.now();
    let result;
    try {
      result = await simulator.runBattle();
    } catch (err) {
      console.error(`  [${botLabel}] Game ${i + 1} error: ${err.message}`);
      continue;
    }
    const gameTime = performance.now() - gameStart;
    totalTimeMs += gameTime;
    totalTurns += result.turns || 0;

    const testWon = result.winner === botLabel;
    const randomWon = result.winner === 'RandomBot';

    if (testWon) wins++;
    else if (randomWon) losses++;
    else draws++;

    // Collect history stats for ImprovedDepth6Bot
    const histHits = testBot.improvedStats?.historyHits || 0;
    totalHistHits += histHits;

    const side = testIsP1 ? 'P1' : 'P2';
    const outcomeStr = testWon ? 'WIN  ✓' : randomWon ? 'LOSS ✗' : 'DRAW =';
    const histStr = testBot.improvedStats ? ` hist=${histHits}` : '';
    console.log(
      `  Game ${String(i + 1).padStart(2)}: ${outcomeStr} [${side}] ` +
      `turns=${String(result.turns || '?').padStart(3)} ` +
      `time=${(gameTime / 1000).toFixed(1)}s` +
      histStr
    );
  }

  const total = wins + losses + draws;
  return {
    wins, losses, draws, total,
    winRate: total > 0 ? (wins / total * 100).toFixed(1) : '0.0',
    avgTurns: total > 0 ? (totalTurns / total).toFixed(1) : '0',
    avgTimeMs: total > 0 ? (totalTimeMs / total).toFixed(0) : '0',
    avgHistHits: total > 0 ? (totalHistHits / total).toFixed(1) : 'N/A'
  };
}

async function runBenchmark() {
  console.log('='.repeat(70));
  console.log('BENCHMARK: ImprovedDepth6Bot vs Depth6SearchBot (baseline)');
  console.log('Both tested against RandomBot over', NUM_GAMES, 'games each');
  console.log('='.repeat(70));
  console.log('Improvements in ImprovedDepth6Bot:');
  console.log('  [Eval] Differentiated status weights (slp=70, frz=80, brn=50, tox=55, par=45)');
  console.log('  [Eval] Active pokemon HP weighting (+60 vs flat 0)');
  console.log('  [Eval] Active pokemon KO-range bonus (opp <25% HP)');
  console.log('  [Eval] Type matchup bonus for active pokemon pair');
  console.log('  [Eval] ToxicSpikes hazard scoring (+20/layer)');
  console.log('  [Eval] Reflect/Light Screen scoring (+30 each)');
  console.log('  [Eval] Weather/terrain type-aware scoring');
  console.log('  [Model] Opponent move history from PP depletion tracking');
  console.log('  [Model] History-weighted move prediction (+200 * frequency)');
  console.log('  [Model] Protocol-based move reveal tracking (StatefulBattleSimulator)');
  console.log('');

  console.log(`--- Depth6SearchBot (baseline) vs RandomBot (${NUM_GAMES} games) ---`);
  const baselineStats = await runGames(
    Depth6SearchBot,
    { maxMovesToConsider: 3, useTranspositionTable: true, useMoveOrdering: true },
    'Depth6SearchBot',
    NUM_GAMES
  );

  console.log('');
  console.log(`--- ImprovedDepth6Bot (refined) vs RandomBot (${NUM_GAMES} games) ---`);
  const improvedStats = await runGames(
    ImprovedDepth6Bot,
    {
      maxMovesToConsider: 3,
      useTranspositionTable: true,
      useMoveOrdering: true,
      useOpponentPrediction: true,
      opponentMovesConsider: 3,
      timeLimit: 4000
    },
    'ImprovedDepth6Bot',
    NUM_GAMES
  );

  console.log('');
  console.log('='.repeat(70));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log('vs RandomBot:');
  console.log(`  Depth6SearchBot (baseline): ${baselineStats.wins}W/${baselineStats.losses}L/${baselineStats.draws}D  WR=${baselineStats.winRate}%  avg_turns=${baselineStats.avgTurns}  avg_time=${baselineStats.avgTimeMs}ms`);
  console.log(`  ImprovedDepth6Bot (new):    ${improvedStats.wins}W/${improvedStats.losses}L/${improvedStats.draws}D  WR=${improvedStats.winRate}%  avg_turns=${improvedStats.avgTurns}  avg_time=${improvedStats.avgTimeMs}ms`);

  const winRateDelta = (parseFloat(improvedStats.winRate) - parseFloat(baselineStats.winRate)).toFixed(1);
  console.log('');
  console.log(`Win rate change: ${winRateDelta >= 0 ? '+' : ''}${winRateDelta}%`);

  console.log('');
  console.log('Opponent Modeling (ImprovedDepth6Bot):');
  console.log(`  Avg history-guided predictions/game: ${improvedStats.avgHistHits}`);
  console.log('  (More hist_hits = opponent model active in more decisions)');
  console.log('');

  if (parseFloat(winRateDelta) > 0) {
    console.log(`VERDICT: ImprovedDepth6Bot improved win rate by +${winRateDelta}% vs baseline`);
  } else if (parseFloat(winRateDelta) < 0) {
    console.log(`VERDICT: ImprovedDepth6Bot shows -${Math.abs(winRateDelta)}% vs baseline (needs tuning)`);
  } else {
    console.log('VERDICT: No change in win rate vs RandomBot (both near 100% expected)');
    console.log('  Note: RandomBot is a weak baseline - consider testing vs TypeAwareBot');
    console.log('  or use turn count / decision time as the differentiator.');
  }
  console.log('='.repeat(70));
}

runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
