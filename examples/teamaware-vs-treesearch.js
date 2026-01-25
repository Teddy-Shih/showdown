const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO } = require('../data/ou-teams');

const team1 = TEAM_SPECS_GHOLDENGO;
const team2 = TEAM_ANTIMETA_LANDO;

/**
 * Test Team-Aware TypeAwareBot vs StatefulTreeSearchBot
 *
 * Hypothesis: Team-aware evaluation will improve TypeAwareBot's performance with Team 1 (Offensive)
 * Baseline:
 *   - Round 1: 60% (2W with Team 1, 4W with Team 2)
 *   - Round 2: 40% (2W with Team 1, 2W with Team 2)
 *   - Round 3: 60% (2W with Team 1, 4W with Team 2)
 *   - Team 1 win rate: 40% (6/15)
 *   - Team 2 win rate: 67% (10/15)
 *
 * Expected: Team-aware evaluation should boost Team 1 performance to ~60-70%
 */

async function main() {
  const numBattles = parseInt(process.argv[2]) || 10;

  console.log('='.repeat(80));
  console.log('TEAM-AWARE TYPEAWAREBOT VS STATEFULTREESEARCHBOT');
  console.log('='.repeat(80));
  console.log();
  console.log('🎯 Testing Hypothesis: Team-aware evaluation improves offensive team performance');
  console.log();
  console.log('BASELINE PERFORMANCE (30 games):');
  console.log('  Overall: 53.3% (16-14)');
  console.log('  With Team 1 (Offensive): 40% (6-9)');
  console.log('  With Team 2 (Defensive): 67% (10-5)');
  console.log('  Differential: 27 percentage points');
  console.log();
  console.log('EXPECTED IMPROVEMENT:');
  console.log('  Team 1: +20-30% → 60-70% win rate');
  console.log('  Team 2: ±0% → 67% win rate (already optimal)');
  console.log('  Overall: +10-15% → 65-70% win rate');
  console.log();

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

  // Track performance by team
  let team1Wins = 0;
  let team1Losses = 0;
  let team2Wins = 0;
  let team2Losses = 0;

  const lossLogs = [];

  for (let i = 0; i < numBattles; i++) {
    const typeAwareBot = new TypeAwareBot('TypeAwareBot');
    const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

    const bot1 = i % 2 === 0 ? typeAwareBot : treeSearchBot;
    const bot2 = i % 2 === 0 ? treeSearchBot : typeAwareBot;
    const t1 = i % 2 === 0 ? team1 : team2;
    const t2 = i % 2 === 0 ? team2 : team1;

    const typeAwareTeam = i % 2 === 0 ? team1 : team2;
    const typeAwareTeamNum = i % 2 === 0 ? 1 : 2;

    const sim = new StatefulBattleSimulator(bot1, bot2, t1, t2, {
      verbose: false,
      maxTurns: 100
    });

    const result = await sim.runBattle();

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

    const status = typeAwareWon ? 'WON' : (result.winner === 'draw' ? 'DRAW' : 'LOST to TreeSearchBot');
    const emoji = typeAwareWon ? '' : (result.winner === 'draw' ? '⚖️' : '❌');

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
    }
  }

  console.log();
  console.log('='.repeat(80));
  console.log('TEAM-AWARE TYPEAWAREBOT RESULTS');
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
  console.log('BASELINE COMPARISON:');
  console.log(`  Team 1: Baseline 40% → Current ${team1Total > 0 ? (team1Wins/team1Total*100).toFixed(1) : '0.0'}% (${team1Total > 0 ? (team1Wins/team1Total*100 - 40).toFixed(1) : '0.0'}% change)`);
  console.log(`  Team 2: Baseline 67% → Current ${team2Total > 0 ? (team2Wins/team2Total*100).toFixed(1) : '0.0'}% (${team2Total > 0 ? (team2Wins/team2Total*100 - 67).toFixed(1) : '0.0'}% change)`);
  console.log();

  // Overall comparison
  const baselineOverall = 53.3;
  const currentOverall = typeAwareWins/numBattles*100;
  const improvement = currentOverall - baselineOverall;

  console.log('='.repeat(80));
  console.log('OVERALL COMPARISON');
  console.log('='.repeat(80));
  console.log(`Baseline (30 games): 53.3% (16-14)`);
  console.log(`Current (${numBattles} games):   ${currentOverall.toFixed(1)}% (${typeAwareWins}-${treeSearchWins})`);
  console.log(`Change: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)} percentage points`);
  console.log();

  if (improvement >= 10) {
    console.log('✅ SIGNIFICANT IMPROVEMENT! Team-aware evaluation is working.');
  } else if (improvement >= 5) {
    console.log('✓ Moderate improvement. Team-aware evaluation shows promise.');
  } else if (improvement >= 0) {
    console.log('≈ Marginal improvement. Results inconclusive, may need more games.');
  } else {
    console.log('❌ Performance DEGRADED. Team-aware evaluation may need adjustment.');
  }
  console.log();

  if (lossLogs.length > 0) {
    console.log(`📝 Loss Summary (${lossLogs.length} losses):`);
    lossLogs.forEach(loss => {
      console.log(`   Battle ${loss.battle} (Team ${loss.team}): ${loss.turns} turns, ${loss.nodes} nodes, ${loss.switches} switches`);
    });
    console.log();
  }

  // Note: Team style detection happens during battle via analyzeTeamStyle()
  // which analyzes request.side.pokemon automatically
  console.log('='.repeat(80));
  console.log('NOTE: Team Style Detection');
  console.log('='.repeat(80));
  console.log('Team styles are detected automatically during battles:');
  console.log('  - analyzeTeamStyle() analyzes offensive vs defensive stats');
  console.log('  - Offensive teams: atk+spa > def+spd * 1.1');
  console.log('  - Defensive teams: def+spd > atk+spa * 1.1');
  console.log('  - Different evaluation weights applied per team style');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
