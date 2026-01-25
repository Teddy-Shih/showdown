/**
 * Run TypeAwareBot vs StatefulTreeSearchBot - Round 2
 * Show team compositions and run 10 games
 */

const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const ouTeams = require('../data/ou-teams');
const fs = require('fs');

async function runTest(numBattles) {
  console.log('='.repeat(80));
  console.log('TYPEAWAREBOT VS STATEFULTREESEARCHBOT - ROUND 2');
  console.log('='.repeat(80));
  console.log();

  const teams = ouTeams.getAllTeams();
  const team1 = teams[0];
  const team2 = teams[1];

  // Display team compositions
  console.log('TEAM 1 - Choice Specs Gholdengo (Offensive Balance)');
  console.log('-'.repeat(80));
  console.log('1. Baxcalibur @ Heavy-Duty Boots (Dragon/Ice - Physical Sweeper)');
  console.log('   - Icicle Crash, Glaive Rush, Earthquake, Dragon Dance');
  console.log('2. Gholdengo @ Choice Specs (Steel/Ghost - Special Attacker)');
  console.log('   - Shadow Ball, Make It Rain, Power Gem, Thunderbolt');
  console.log('3. Great Tusk @ Booster Energy (Ground/Fighting - Physical + Support)');
  console.log('   - Earthquake, Close Combat, Rapid Spin, Stealth Rock');
  console.log('4. Iron Valiant @ Choice Scarf (Fairy/Fighting - Mixed Attacker)');
  console.log('   - Moonblast, Close Combat, Knock Off, Trick');
  console.log('5. Rotom-Wash @ Leftovers (Electric/Water - Defensive Pivot)');
  console.log('   - Thunder Wave, Hydro Pump, Volt Switch, Protect');
  console.log('6. Kingambit @ Leftovers (Dark/Steel - Physical Sweeper)');
  console.log('   - Kowtow Cleave, Tera Blast, Sucker Punch, Swords Dance');
  console.log();

  console.log('TEAM 2 - Anti-Meta Landorus-T (Defensive Control)');
  console.log('-'.repeat(80));
  console.log('1. Hatterene @ Focus Sash (Psychic/Fairy - Special Attacker)');
  console.log('   - Mystical Fire, Psychic, Dazzling Gleam, Thunder Wave');
  console.log('2. Magnezone @ Rocky Helmet (Electric/Steel - Defensive + Trapper)');
  console.log('   - Body Press, Thunderbolt, Iron Defense, Volt Switch');
  console.log('3. Slowking @ Leftovers (Water/Psychic - Defensive Pivot)');
  console.log('   - Slack Off, Hydro Pump, Thunder Wave, Chilly Reception');
  console.log('4. Frosmoth @ Heavy-Duty Boots (Ice/Bug - Setup Sweeper)');
  console.log('   - Quiver Dance, Ice Beam, Bug Buzz, Aurora Veil');
  console.log('5. Landorus-Therian @ Choice Scarf (Ground/Flying - Physical Revenge Killer)');
  console.log('   - Earthquake, Stealth Rock, U-turn, Stone Edge');
  console.log('6. Zapdos-Galar @ Choice Band (Fighting/Flying - Physical Attacker)');
  console.log('   - Close Combat, Brave Bird, Tera Blast, U-turn');
  console.log();

  console.log('='.repeat(80));
  console.log(`Running ${numBattles} battles...`);
  console.log('TypeAwareBot switches between teams each battle');
  console.log('='.repeat(80));
  console.log();

  let typeAwareWins = 0;
  let treeSearchWins = 0;
  let draws = 0;
  let totalTypeAwareNodes = 0;
  let totalTypeAwarePrunes = 0;
  let totalTypeAwareSwitches = 0;
  const lossLogs = [];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : typeAwareBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    // Capture battle log
    const battleLog = [];
    const originalWrite = console.log;

    console.log = (...args) => {
      battleLog.push(args.join(' '));
      originalWrite(...args);
    };

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false, // Reduced verbosity for cleaner output
      maxTurns: 100
    });

    const result = await sim.runBattle();

    console.log = originalWrite;

    const typeAwareBotTeam = i % 2 === 0 ? 'Team 1' : 'Team 2';
    const treeSearchBotTeam = i % 2 === 0 ? 'Team 2' : 'Team 1';

    if (result.winner === 'TypeAwareBot') {
      typeAwareWins++;
      totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
      totalTypeAwarePrunes += typeAwareBot.pruneCount;
      totalTypeAwareSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot (${typeAwareBotTeam}) WON in ${result.turns} turns (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);
    } else if (result.winner === 'TreeSearchBot') {
      treeSearchWins++;
      totalTypeAwareNodes += typeAwareBot.nodesEvaluated;
      totalTypeAwarePrunes += typeAwareBot.pruneCount;
      totalTypeAwareSwitches += typeAwareBot.switchBreaks;
      console.log(`Battle ${i + 1}: TypeAwareBot (${typeAwareBotTeam}) LOST to TreeSearchBot (${treeSearchBotTeam}) in ${result.turns} turns ❌ (nodes: ${typeAwareBot.nodesEvaluated}, switches: ${typeAwareBot.switchBreaks})`);

      lossLogs.push({
        battleNumber: i + 1,
        turns: result.turns,
        typeAwareBotTeam,
        treeSearchBotTeam,
        log: battleLog,
        stats: {
          nodes: typeAwareBot.nodesEvaluated,
          prunes: typeAwareBot.pruneCount,
          switches: typeAwareBot.switchBreaks,
          moveHistory: [...typeAwareBot.moveHistory]
        }
      });
    } else {
      draws++;
      console.log(`Battle ${i + 1}: DRAW in ${result.turns} turns`);
    }
  }

  const avgNodes = totalTypeAwareNodes / numBattles;
  const avgPrunes = totalTypeAwarePrunes / numBattles;
  const avgSwitches = totalTypeAwareSwitches / numBattles;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`TYPEAWAREBOT VS TREESEARCH - ROUND 2 RESULTS (${numBattles} BATTLES)`);
  console.log('='.repeat(80));
  console.log(`TypeAwareBot:     ${typeAwareWins} wins (${(typeAwareWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`TreeSearchBot:    ${treeSearchWins} wins (${(treeSearchWins / numBattles * 100).toFixed(1)}%)`);
  console.log(`Draws:            ${draws}`);
  console.log('='.repeat(80));
  console.log(`TypeAwareBot avg nodes: ${avgNodes.toFixed(0)}`);
  console.log(`TypeAwareBot avg prunes: ${avgPrunes.toFixed(0)}`);
  console.log(`TypeAwareBot prune efficiency: ${(avgPrunes / avgNodes * 100).toFixed(1)}%`);
  console.log(`TypeAwareBot avg switches: ${avgSwitches.toFixed(1)}`);

  console.log('\n📊 Performance Across Multiple Tests:');
  console.log('  vs RandomBot (original test):     100.0% (10-0)');
  console.log('  vs TreeSearchBot (Round 1):       60.0% (6-4)');
  console.log(`  vs TreeSearchBot (Round 2):       ${(typeAwareWins / numBattles * 100).toFixed(1)}% (${typeAwareWins}-${treeSearchWins})`);

  const round1WinRate = 60.0;
  const round2WinRate = (typeAwareWins / numBattles * 100);
  const variance = round2WinRate - round1WinRate;

  if (Math.abs(variance) < 5) {
    console.log(`\n→ Consistent with Round 1 (±${Math.abs(variance).toFixed(1)}% variance)`);
  } else if (variance > 0) {
    console.log(`\n→ Better than Round 1 (+${variance.toFixed(1)}%)`);
  } else {
    console.log(`\n→ Worse than Round 1 (${variance.toFixed(1)}%)`);
  }

  // Save loss logs if any
  if (lossLogs.length > 0) {
    const logLines = [];
    logLines.push('TypeAwareBot vs StatefulTreeSearchBot - Round 2 Loss Analysis');
    logLines.push(`Total Battles: ${numBattles}`);
    logLines.push(`TypeAwareBot Losses: ${lossLogs.length}`);
    logLines.push(`Win Rate: ${(typeAwareWins / numBattles * 100).toFixed(1)}%`);
    logLines.push('');
    logLines.push('Team Compositions:');
    logLines.push('Team 1: Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-Wash, Kingambit');
    logLines.push('Team 2: Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-Galar');
    logLines.push('');
    logLines.push('='.repeat(80));
    logLines.push('');

    lossLogs.forEach(loss => {
      logLines.push(`BATTLE ${loss.battleNumber} - LOSS`);
      logLines.push(`TypeAwareBot Team: ${loss.typeAwareBotTeam}`);
      logLines.push(`TreeSearchBot Team: ${loss.treeSearchBotTeam}`);
      logLines.push(`Turns: ${loss.turns}`);
      logLines.push(`Nodes: ${loss.stats.nodes}`);
      logLines.push(`Prunes: ${loss.stats.prunes}`);
      logLines.push(`Switches: ${loss.stats.switches}`);
      logLines.push(`Move History: ${loss.stats.moveHistory.join(', ')}`);
      logLines.push('');
      logLines.push('Battle Log:');
      logLines.push(loss.log.join('\n'));
      logLines.push('');
      logLines.push('='.repeat(80));
      logLines.push('');
    });

    const filename = `typeaware-vs-treesearch-round2-losses-${Date.now()}.txt`;
    fs.writeFileSync(filename, logLines.join('\n'));
    console.log();
    console.log(`📝 Saved ${lossLogs.length} loss log(s) to: ${filename}`);

    console.log();
    console.log('📋 Loss Summary:');
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battleNumber} (${loss.typeAwareBotTeam} vs ${loss.treeSearchBotTeam}): ${loss.turns} turns, ${loss.stats.nodes} nodes, ${loss.stats.switches} switches`);
    });

    // Analyze node patterns
    const nodeCounts = lossLogs.map(l => l.stats.nodes);
    const avgLossNodes = nodeCounts.reduce((a, b) => a + b, 0) / nodeCounts.length;
    const allSame = nodeCounts.every(n => n === nodeCounts[0]);

    console.log();
    console.log('🔍 Node Count Analysis:');
    console.log(`   Average nodes in losses: ${avgLossNodes.toFixed(0)}`);
    if (allSame) {
      console.log(`   ⚠️ All losses have identical node count (${nodeCounts[0]})`);
    } else {
      console.log(`   ✓ Node counts vary (range: ${Math.min(...nodeCounts)} - ${Math.max(...nodeCounts)})`);
    }

  } else {
    console.log();
    console.log('🎉 Perfect 100% win rate! No losses to analyze.');
  }
}

const numBattles = parseInt(process.argv[2]) || 10;
runTest(numBattles).catch(console.error);
