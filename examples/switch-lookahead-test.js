const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

const team1 = TEAM_SPECS_GHOLDENGO;
const team2 = TEAM_ANTIMETA_LANDO;

/**
 * Test TypeAwareBot with Switch Lookahead vs StatefulTreeSearchBot
 *
 * NEW FEATURE: Switch Lookahead in Search (Type Disadvantage Only)
 * - Switches are now considered as valid options in the minimax tree
 * - Search can choose to switch instead of attacking if it's better
 * - ONLY considers switches when at type disadvantage (matchup < -2)
 * - Does NOT switch on low HP (better to sacrifice than transfer damage)
 * - Philosophy: Win by KOing all 6 opponent Pokemon, not preserving our own
 * - Evaluates opponent's response to switch before committing
 *
 * REVERTED: Back to balanced evaluation weights (proven optimal at 53.3%)
 */

class DetailedBattleLogger {
  constructor() {
    this.logs = [];
    this.currentTurn = 0;
    this.activePokemon = { p1: null, p2: null };
  }

  reset() {
    this.logs = [];
    this.currentTurn = 0;
    this.activePokemon = { p1: null, p2: null };
  }

  processMessage(message) {
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.startsWith('|turn|')) {
        this.currentTurn = parseInt(line.split('|')[2]);
      } else if (line.includes('|switch|') || line.includes('|drag|')) {
        this.processSwitch(line);
      } else if (line.includes('|move|')) {
        this.processMove(line);
      }
    }
  }

  processSwitch(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];  // e.g., "p1a: Baxcalibur"
    const pokemonInfo = parts[3]; // e.g., "Baxcalibur, L50, M"

    const player = playerSlot.startsWith('p1') ? 'p1' : 'p2';
    const pokemonName = pokemonInfo.split(',')[0].trim();

    this.activePokemon[player] = pokemonName;

    this.logs.push({
      turn: this.currentTurn,
      player: player,
      action: 'switch',
      pokemon: pokemonName,
      target: null,
      move: null
    });
  }

  processMove(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];  // e.g., "p1a: Baxcalibur"
    const moveName = parts[3];    // e.g., "Icicle Crash"
    const target = parts[4] || null;

    const player = playerSlot.startsWith('p1') ? 'p1' : 'p2';
    const pokemonMatch = playerSlot.match(/:\s*([^,]+)/);
    const pokemonName = pokemonMatch ? pokemonMatch[1].trim() : this.activePokemon[player];

    this.logs.push({
      turn: this.currentTurn,
      player: player,
      action: 'move',
      pokemon: pokemonName,
      target: target,
      move: moveName
    });
  }

  getTurnSummary(turn) {
    const turnLogs = this.logs.filter(log => log.turn === turn);
    if (turnLogs.length === 0) return null;

    return turnLogs.map(log => {
      if (log.action === 'switch') {
        return `${log.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot'} switched to ${log.pokemon}`;
      } else {
        return `${log.player === 'p1' ? 'TypeAwareBot' : 'TreeSearchBot'}'s ${log.pokemon} used ${log.move}`;
      }
    }).join(' | ');
  }

  getFullLog() {
    const turns = [...new Set(this.logs.map(l => l.turn))].sort((a, b) => a - b);
    return turns.map(turn => {
      const summary = this.getTurnSummary(turn);
      return `Turn ${turn}: ${summary}`;
    }).join('\n');
  }

  getSimpleLog() {
    // Format: "TypeAwareBot used Dragon Dance"
    return this.logs.map(log => {
      const botName = log.player === 'p1' ? 'TypeAwareBot' : 'StatefulTreeSearchBot';
      if (log.action === 'switch') {
        return `${botName} switched to ${log.pokemon}`;
      } else {
        return `${botName} used ${log.move}`;
      }
    }).join('\n');
  }
}

async function main() {
  const numBattles = parseInt(process.argv[2]) || 30;

  console.log('='.repeat(80));
  console.log('TYPEAWAREBOT WITH SETUP MOVE STRATEGIC VALUE');
  console.log('='.repeat(80));
  console.log();
  console.log('🆕 NEW FEATURE: Setup Move Strategic Value');
  console.log('   - Detects setup moves (Dragon Dance, Swords Dance, etc.)');
  console.log('   - Values offensive boosts: +50 per Atk/SpA boost');
  console.log('   - Values speed boosts: +35 per Spe boost');
  console.log('   - Values defensive boosts: +25 per Def/SpD boost');
  console.log('   - Capped at +150 per setup move');
  console.log('   - Pressures opponent setup sweepers: +30 when attacking them');
  console.log();
  console.log('CURRENT BASELINE (Boost Fix, 30 games):');
  console.log('  Overall: 86.7% (26-4)');
  console.log('  With Team 1: 87.5% (14-2)');
  console.log('  With Team 2: 85.7% (12-2)');
  console.log();
  console.log('EXPECTED IMPACT: +5-10% win rate');
  console.log();
  console.log('='.repeat(80));
  console.log(`Running ${numBattles} battles...`);
  console.log('='.repeat(80));
  console.log();

  let typeAwareWins = 0;
  let treeSearchWins = 0;
  let draws = 0;
  let totalTypeAwareNodes = 0;
  let totalTypeAwarePrunes = 0;
  let totalTypeAwareSwitches = 0;

  let team1Wins = 0;
  let team1Losses = 0;
  let team2Wins = 0;
  let team2Losses = 0;

  const lossLogs = [];
  const detailedBattleLogs = [];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : typeAwareBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const typeAwareTeam = i % 2 === 0 ? team1 : team2;
    const typeAwareTeamNum = i % 2 === 0 ? 1 : 2;

    // Capture detailed logs for ALL losses
    const logger = new DetailedBattleLogger();
    const shouldCapture = true; // Capture all battles to get loss logs

    const originalLog = console.log;
    if (shouldCapture) {
      console.log = (...args) => {
        const msg = args.join(' ');
        logger.processMessage(msg);
        // Don't output during battle
      };
    }

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: shouldCapture,
      maxTurns: 100
    });

    const result = await sim.runBattle();

    if (shouldCapture) {
      console.log = originalLog;
    }

    const typeAwareWon = result.winner === 'TypeAwareBot';
    const isLoss = !typeAwareWon && result.winner !== 'draw';

    if (typeAwareWon) {
      typeAwareWins++;
      if (typeAwareTeamNum === 1) team1Wins++;
      else team2Wins++;
    } else if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
      if (typeAwareTeamNum === 1) team1Losses++;
      else team2Losses++;
    } else {
      draws++;
    }

    totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
    totalTypeAwarePrunes += typeAwareBot.pruneCount;
    totalTypeAwareSwitches += typeAwareBot.switchBreaks;

    const status = typeAwareWon ? 'WON' : (result.winner === 'draw' ? 'DRAW' : 'LOST');
    const emoji = typeAwareWon ? '✓' : (result.winner === 'draw' ? '⚖️' : '❌');

    console.log(`Battle ${i + 1}: TypeAwareBot (Team ${typeAwareTeamNum}) ${status} in ${result.turns} turns ${emoji} (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);

    if (isLoss) {
      lossLogs.push({
        battle: i + 1,
        team: typeAwareTeamNum,
        turns: result.turns,
        nodes: typeAwareBot.nodesEvaluated,
        prunes: typeAwareBot.pruneCount,
        switches: typeAwareBot.switchBreaks
      });

      if (shouldCapture) {
        detailedBattleLogs.push({
          battle: i + 1,
          team: typeAwareTeamNum,
          logger: logger
        });
      }
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('SWITCH LOOKAHEAD RESULTS');
  console.log('='.repeat(80));
  console.log(`TypeAwareBot:     ${typeAwareWins} wins (${(typeAwareWins/numBattles*100).toFixed(1)}%)`);
  console.log(`TreeSearchBot:    ${treeSearchWins} wins (${(treeSearchWins/numBattles*100).toFixed(1)}%)`);
  console.log(`Draws:            ${draws}`);
  console.log('='.repeat(80));
  console.log(`TypeAwareBot avg nodes: ${Math.round(totalTypeAwareNodes / numBattles)}`);
  console.log(`TypeAwareBot avg prunes: ${Math.round(totalTypeAwarePrunes / numBattles)}`);
  console.log(`TypeAwareBot prune efficiency: ${(totalTypeAwarePrunes / totalTypeAwareNodes * 100).toFixed(1)}%`);
  console.log(`TypeAwareBot avg switches: ${(totalTypeAwareSwitches / numBattles).toFixed(1)}`);
  console.log();

  // Team-specific performance
  console.log('='.repeat(80));
  console.log('PERFORMANCE BY TEAM');
  console.log('='.repeat(80));
  const team1Total = team1Wins + team1Losses;
  const team2Total = team2Wins + team2Losses;
  console.log(`Team 1 (Offensive): ${team1Wins}/${team1Total} wins (${team1Total > 0 ? (team1Wins/team1Total*100).toFixed(1) : '0.0'}%)`);
  console.log(`Team 2 (Defensive): ${team2Wins}/${team2Total} wins (${team2Total > 0 ? (team2Wins/team2Total*100).toFixed(1) : '0.0'}%)`);
  console.log();
  console.log('COMPARISON TO BASELINE:');
  console.log(`  Team 1: Baseline 87.5% → Current ${team1Total > 0 ? (team1Wins/team1Total*100).toFixed(1) : '0.0'}% (${team1Total > 0 ? ((team1Wins/team1Total*100 - 87.5) >= 0 ? '+' : '') + (team1Wins/team1Total*100 - 87.5).toFixed(1) : '0.0'}%)`);
  console.log(`  Team 2: Baseline 85.7% → Current ${team2Total > 0 ? (team2Wins/team2Total*100).toFixed(1) : '0.0'}% (${team2Total > 0 ? ((team2Wins/team2Total*100 - 85.7) >= 0 ? '+' : '') + (team2Wins/team2Total*100 - 85.7).toFixed(1) : '0.0'}%)`);
  console.log();

  // Overall comparison
  const baselineOverall = 86.7;
  const currentOverall = typeAwareWins/numBattles*100;
  const improvement = currentOverall - baselineOverall;

  console.log('='.repeat(80));
  console.log('OVERALL COMPARISON');
  console.log('='.repeat(80));
  console.log(`Boost Fix (30 games):                 86.7% (26-4)`);
  console.log(`+Setup Move Strategic Value (${numBattles}g):  ${currentOverall.toFixed(1)}% (${typeAwareWins}-${treeSearchWins})`);
  console.log(`Change from baseline:                 ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} percentage points`);
  console.log();

  if (improvement >= 10) {
    console.log('✅ SIGNIFICANT IMPROVEMENT! Switch lookahead is working.');
  } else if (improvement >= 5) {
    console.log('✓ Moderate improvement. Switch lookahead shows promise.');
  } else if (improvement >= 0) {
    console.log('≈ Marginal improvement. May need more games or tuning.');
  } else {
    console.log('❌ Performance degraded. Switch lookahead may need adjustment.');
  }
  console.log();

  if (lossLogs.length > 0) {
    console.log(`📝 Loss Summary (${lossLogs.length} losses):`);
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battle} (Team ${loss.team}): ${loss.turns} turns, ${loss.nodes} nodes, ${loss.switches} switches`);
    });
    console.log();
  }

  // Print detailed battle logs for ALL losses
  if (detailedBattleLogs.length > 0) {
    console.log('='.repeat(80));
    console.log(`DETAILED LOSS LOGS (${detailedBattleLogs.length} losses)`);
    console.log('='.repeat(80));
    console.log();

    detailedBattleLogs.forEach((loss, index) => {
      console.log(`Loss ${index + 1}: Battle ${loss.battle} - TypeAwareBot (Team ${loss.team})`);
      console.log('-'.repeat(80));
      console.log(loss.logger.getSimpleLog());
      console.log();
      console.log('='.repeat(80));
      console.log();
    });
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
