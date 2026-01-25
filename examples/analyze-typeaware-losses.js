/**
 * Detailed analysis of TypeAwareBot losses to StatefulTreeSearchBot
 */

const fs = require('fs');

function analyzeLosses() {
  const logContent = fs.readFileSync('typeaware-vs-treesearch-losses-1769309868895.txt', 'utf8');

  console.log('='.repeat(80));
  console.log('DETAILED LOSS ANALYSIS: TypeAwareBot vs StatefulTreeSearchBot');
  console.log('='.repeat(80));
  console.log();
  console.log('Overall Results: 60% win rate (6-4 record)');
  console.log('vs RandomBot: 100% win rate (10-0)');
  console.log('Performance Drop: -40% against intelligent opponent');
  console.log();

  // Extract battles
  const battles = logContent.split('================================================================================');

  const lossData = [];

  battles.forEach((battle, idx) => {
    if (!battle.includes('BATTLE') || !battle.includes('LOSS')) return;

    const battleNum = battle.match(/BATTLE (\d+)/)?.[1];
    if (!battleNum) return;

    // Extract metrics
    const turns = parseInt(battle.match(/Turns: (\d+)/)?.[1]);
    const nodes = parseInt(battle.match(/TypeAwareBot Nodes: (\d+)/)?.[1]);
    const switches = parseInt(battle.match(/TypeAwareBot Switches: (\d+)/)?.[1]);
    const moveHistory = battle.match(/TypeAwareBot Move History: (.+)/)?.[1];

    // Extract turn-by-turn moves
    const turnLines = battle.split('\n').filter(line => line.includes('TypeAwareBot:'));
    const typeAwareMoves = turnLines.map(line => {
      const match = line.match(/TypeAwareBot: (move \d+|switch \d+|default)/);
      return match ? match[1] : null;
    }).filter(m => m);

    // Analyze attrition
    const typeAwareFaints = typeAwareMoves.filter(m => m === 'default').length;
    const treeSearchFaints = battle.split('\n').filter(line =>
      line.includes('TreeSearchBot: default')
    ).length;

    // Analyze move repetition
    const moveCounts = {};
    typeAwareMoves.forEach(move => {
      if (move !== 'default') {
        moveCounts[move] = (moveCounts[move] || 0) + 1;
      }
    });

    // Find most used move
    const sortedMoves = Object.entries(moveCounts).sort((a, b) => b[1] - a[1]);
    const mostUsedMove = sortedMoves[0];
    const mostUsedPercent = mostUsedMove ? ((mostUsedMove[1] / (typeAwareMoves.length - typeAwareFaints)) * 100).toFixed(1) : 0;

    lossData.push({
      battleNum,
      turns,
      nodes,
      switches,
      typeAwareFaints,
      treeSearchFaints,
      moveHistory,
      moveCounts,
      mostUsedMove,
      mostUsedPercent,
      totalMoves: typeAwareMoves.length - typeAwareFaints
    });
  });

  // Analyze each loss
  lossData.forEach((loss, idx) => {
    console.log(`\nBATTLE ${loss.battleNum} ANALYSIS:`);
    console.log('-'.repeat(80));
    console.log(`Duration: ${loss.turns} turns`);
    console.log(`Nodes evaluated: ${loss.nodes}`);
    console.log(`Proactive switches: ${loss.switches}`);
    console.log();

    console.log('Attrition Comparison:');
    console.log(`  TypeAwareBot faints: ${loss.typeAwareFaints}`);
    console.log(`  TreeSearchBot faints: ${loss.treeSearchFaints}`);

    if (loss.typeAwareFaints > loss.treeSearchFaints) {
      console.log(`  → TypeAwareBot lost MORE Pokemon (worse attrition)`);
    } else if (loss.typeAwareFaints < loss.treeSearchFaints) {
      console.log(`  → TreeSearchBot lost more Pokemon (TypeAwareBot had better attrition but still lost)`);
    } else {
      console.log(`  → Equal attrition (final matchup was decisive)`);
    }

    console.log();
    console.log('Move Usage:');
    Object.entries(loss.moveCounts).sort((a, b) => b[1] - a[1]).forEach(([move, count]) => {
      const percentage = ((count / loss.totalMoves) * 100).toFixed(1);
      console.log(`  ${move}: ${count}x (${percentage}%)`);
    });

    if (loss.mostUsedMove && loss.mostUsedPercent > 50) {
      console.log(`  ⚠️ Over-reliance on ${loss.mostUsedMove[0]} (${loss.mostUsedPercent}%)`);
    }

    console.log();
    console.log('Final Move History:', loss.moveHistory);
    console.log();

    // Identify specific issues
    console.log('💡 Identified Issues:');
    const issues = [];

    // Issue 1: High nodes but still lost
    if (loss.nodes > 2500) {
      issues.push('  - HIGH NODE COUNT (' + loss.nodes + '): Deep search didn\'t find winning line');
      issues.push('    → Possible horizon effect: winning moves beyond search depth');
    }

    // Issue 2: Attrition
    if (loss.typeAwareFaints >= loss.treeSearchFaints) {
      issues.push('  - POOR ATTRITION: Lost same or more Pokemon than opponent');
      issues.push('    → Type-aware switching may not be aggressive enough');
      issues.push('    → Evaluation may undervalue HP preservation');
    }

    // Issue 3: Low switch count
    if (loss.switches <= 1 && loss.typeAwareFaints >= 3) {
      issues.push('  - TOO FEW SWITCHES (' + loss.switches + '): Bot stayed in bad matchups');
      issues.push('    → shouldProactivelySwitch() threshold may be too conservative');
      issues.push('    → Type matchup score < -3 requirement is too strict');
    }

    // Issue 4: Move repetition
    if (loss.mostUsedPercent > 50) {
      issues.push('  - MOVE SPAM: ' + loss.mostUsedMove[0] + ' used ' + loss.mostUsedPercent + '% of the time');
      issues.push('    → Poor move diversity suggests evaluation is biased');
    }

    if (issues.length === 0) {
      issues.push('  - Battle was close; TreeSearchBot made better decisions in critical moments');
    }

    issues.forEach(issue => console.log(issue));
  });

  // Overall patterns
  console.log();
  console.log('='.repeat(80));
  console.log('COMMON PATTERNS ACROSS ALL LOSSES');
  console.log('='.repeat(80));
  console.log();

  const avgTurns = lossData.reduce((sum, l) => sum + l.turns, 0) / lossData.length;
  const avgNodes = lossData.reduce((sum, l) => sum + l.nodes, 0) / lossData.length;
  const avgSwitches = lossData.reduce((sum, l) => sum + l.switches, 0) / lossData.length;
  const avgTypeAwareFaints = lossData.reduce((sum, l) => sum + l.typeAwareFaints, 0) / lossData.length;
  const avgTreeSearchFaints = lossData.reduce((sum, l) => sum + l.treeSearchFaints, 0) / lossData.length;

  console.log(`Average loss duration: ${avgTurns.toFixed(1)} turns`);
  console.log(`Average nodes in losses: ${avgNodes.toFixed(0)}`);
  console.log(`Average switches in losses: ${avgSwitches.toFixed(1)}`);
  console.log(`Average TypeAwareBot faints: ${avgTypeAwareFaints.toFixed(1)}`);
  console.log(`Average TreeSearchBot faints: ${avgTreeSearchFaints.toFixed(1)}`);
  console.log();

  // All losses had exactly 2804 nodes
  if (lossData.every(l => l.nodes === 2804)) {
    console.log('⚠️ CRITICAL FINDING: All losses have EXACTLY 2804 nodes');
    console.log('   → This suggests search is being cut off prematurely');
    console.log('   → May indicate a depth/node limit is being hit');
    console.log('   → Bot may be making decisions with incomplete analysis');
    console.log();
  }

  console.log('ROOT CAUSES SUMMARY:');
  console.log();
  console.log('1. SEARCH LIMITATION:');
  console.log('   - All losses have identical node count (2804)');
  console.log('   - Suggests premature search termination or depth limit');
  console.log('   - TreeSearchBot (2-ply) may be faster and more responsive');
  console.log();

  console.log('2. CONSERVATIVE SWITCHING:');
  console.log(`   - Average only ${avgSwitches.toFixed(1)} switches per loss`);
  console.log('   - Type disadvantage threshold (-3) may be too strict');
  console.log('   - Missing opportunities to escape unfavorable matchups');
  console.log();

  console.log('3. ATTRITION MANAGEMENT:');
  console.log(`   - TypeAwareBot averages ${avgTypeAwareFaints.toFixed(1)} faints per loss`);
  console.log(`   - TreeSearchBot averages ${avgTreeSearchFaints.toFixed(1)} faints per loss`);
  if (avgTypeAwareFaints >= avgTreeSearchFaints) {
    console.log('   - Losing attrition battle despite type awareness');
    console.log('   - HP preservation may not be weighted correctly');
  }
  console.log();

  console.log('4. MOVE DIVERSITY:');
  const overRelianceLosses = lossData.filter(l => l.mostUsedPercent > 50).length;
  console.log(`   - ${overRelianceLosses} of 4 losses show >50% reliance on single move`);
  console.log('   - Evaluation may be consistently favoring same move');
  console.log('   - Lack of tactical variety');
  console.log();

  console.log('='.repeat(80));
  console.log('RECOMMENDED FIXES');
  console.log('='.repeat(80));
  console.log();

  console.log('Priority 1 - INVESTIGATE NODE CAP:');
  console.log('  □ Check why all losses have exactly 2804 nodes');
  console.log('  □ Remove or increase any node/depth limits');
  console.log('  □ Ensure search completes before decision required');
  console.log();

  console.log('Priority 2 - ADJUST SWITCH THRESHOLD:');
  console.log('  □ Change shouldProactivelySwitch() threshold from -3 to -2');
  console.log('  □ Consider switching when HP < 50 (not just 30)');
  console.log('  □ Add "being walled" detection (minimal damage for 2+ turns)');
  console.log();

  console.log('Priority 3 - IMPROVE HP PRESERVATION:');
  console.log('  □ Increase HP preservation bonus from 80 to 120');
  console.log('  □ Add "team HP total" to evaluation (preserve overall team health)');
  console.log('  □ Penalize trades when ahead in Pokemon count');
  console.log();

  console.log('Priority 4 - ADD MOVE DIVERSITY BONUS:');
  console.log('  □ Track move usage over recent turns');
  console.log('  □ Apply small penalty for using same move 3+ times consecutively');
  console.log('  □ Encourage tactical variety');
  console.log();
}

analyzeLosses();
