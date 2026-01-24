/**
 * Analyze FixedBot losses to identify failure patterns
 */

const fs = require('fs');

function analyzeLosses() {
  const logContent = fs.readFileSync('fixed-loss-logs-1769286377072.txt', 'utf8');

  console.log('='.repeat(80));
  console.log('LOSS PATTERN ANALYSIS');
  console.log('='.repeat(80));
  console.log();

  // Extract battles
  const battles = logContent.split('================================================================================');

  battles.forEach((battle, idx) => {
    if (!battle.includes('BATTLE') || !battle.includes('LOSS')) return;

    const battleNum = battle.match(/BATTLE (\d+)/)?.[1];
    if (!battleNum) return;

    console.log(`\nBATTLE ${battleNum} ANALYSIS:`);
    console.log('-'.repeat(80));

    // Extract key metrics
    const turns = battle.match(/Turns: (\d+)/)?.[1];
    const nodes = battle.match(/Nodes: (\d+)/)?.[1];
    const moveHistory = battle.match(/Move History: (.+)/)?.[1];

    console.log(`Duration: ${turns} turns`);
    console.log(`Search nodes: ${nodes}`);
    console.log(`Final move history: ${moveHistory}`);
    console.log();

    // Analyze move choices
    const turnLines = battle.split('\n').filter(line => line.includes('FixedBot:'));
    const fixedBotMoves = turnLines.map(line => {
      const match = line.match(/FixedBot: (move \d+|default)/);
      return match ? match[1] : null;
    }).filter(m => m);

    console.log(`Total moves by FixedBot: ${fixedBotMoves.length}`);

    // Count move distribution
    const moveCounts = {};
    fixedBotMoves.forEach(move => {
      moveCounts[move] = (moveCounts[move] || 0) + 1;
    });

    console.log('Move distribution:');
    Object.entries(moveCounts).sort((a, b) => b[1] - a[1]).forEach(([move, count]) => {
      const percentage = ((count / fixedBotMoves.length) * 100).toFixed(1);
      console.log(`  ${move}: ${count} times (${percentage}%)`);
    });

    // Count forced switches
    const forcedSwitches = fixedBotMoves.filter(m => m === 'default').length;
    console.log(`\nForced switches (faints): ${forcedSwitches}`);
    console.log(`Offensive moves: ${fixedBotMoves.length - forcedSwitches}`);

    // Analyze opponent moves
    const oppLines = battle.split('\n').filter(line => line.includes('RandomBot:'));
    const oppMoves = oppLines.map(line => {
      const match = line.match(/RandomBot: (move \d+|default)/);
      return match ? match[1] : null;
    }).filter(m => m);

    const oppForcedSwitches = oppMoves.filter(m => m === 'default').length;
    console.log(`\nOpponent forced switches: ${oppForcedSwitches}`);

    // Who lost more Pokemon?
    console.log(`\nAttrition comparison:`);
    console.log(`  FixedBot faints: ${forcedSwitches}`);
    console.log(`  RandomBot faints: ${oppForcedSwitches}`);

    if (forcedSwitches > oppForcedSwitches) {
      console.log(`  → FixedBot lost more Pokemon (worse attrition)`);
    } else if (forcedSwitches < oppForcedSwitches) {
      console.log(`  → RandomBot lost more Pokemon (but still won!)`);
    } else {
      console.log(`  → Equal attrition (came down to final matchup)`);
    }

    // Check for repetitive patterns
    console.log(`\nRepetition analysis:`);
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    let mostRepeatedMove = fixedBotMoves[0];

    for (let i = 1; i < fixedBotMoves.length; i++) {
      if (fixedBotMoves[i] === fixedBotMoves[i-1]) {
        currentConsecutive++;
        if (currentConsecutive > maxConsecutive) {
          maxConsecutive = currentConsecutive;
          mostRepeatedMove = fixedBotMoves[i];
        }
      } else {
        currentConsecutive = 1;
      }
    }

    console.log(`  Max consecutive same move: ${maxConsecutive}x ${mostRepeatedMove}`);

    if (maxConsecutive >= 5) {
      console.log(`  ⚠️ WARNING: Possible loop/stuck pattern`);
    }

    // Strategic insight
    console.log(`\n💡 Strategic Insights:`);

    if (moveCounts['move 1'] > fixedBotMoves.length * 0.6) {
      console.log(`  - Over-reliance on move 1 (${((moveCounts['move 1'] / fixedBotMoves.length) * 100).toFixed(1)}%)`);
      console.log(`    → May indicate poor move diversity or evaluation bias`);
    }

    if (forcedSwitches >= 3) {
      console.log(`  - High attrition (${forcedSwitches} faints) suggests:`);
      console.log(`    → Poor type matchup management`);
      console.log(`    → No proactive switching when in bad position`);
      console.log(`    → Evaluation function doesn't recognize losing matchups`);
    }

    if (oppForcedSwitches > forcedSwitches && battle.includes('Winner: RandomBot')) {
      console.log(`  - Lost despite better attrition:`);
      console.log(`    → Final Pokemon matchup was unfavorable`);
      console.log(`    → Could indicate HP management issues`);
      console.log(`    → Or final Pokemon had poor moveset for opponent`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log();
  console.log('1. Type Effectiveness Weighting:');
  console.log('   - Heavily bonus super-effective moves in evaluation');
  console.log('   - Penalty for resisted moves');
  console.log('   - Consider STAB (Same Type Attack Bonus)');
  console.log();
  console.log('2. Proactive Switch Intelligence:');
  console.log('   - Detect when current matchup is unfavorable');
  console.log('   - Consider switch options in minimax tree');
  console.log('   - Evaluate "switch value" vs "stay value"');
  console.log();
  console.log('3. Move Diversity:');
  console.log('   - Penalty for over-using one move');
  console.log('   - Consider move coverage (different types)');
  console.log('   - Factor in PP management');
  console.log();
  console.log('4. Enhanced Position Evaluation:');
  console.log('   - Current: HP difference only');
  console.log('   - Add: Type advantage score');
  console.log('   - Add: Speed control bonus');
  console.log('   - Add: Remaining team strength');
  console.log('   - Add: HP distribution (better to have 3 at 50% than 1 at 100% + 2 fainted)');
  console.log();
  console.log('5. Deeper Search in Critical Positions:');
  console.log('   - Extend search depth when HP is low');
  console.log('   - Extend when considering switches');
  console.log('   - Adaptive depth based on position complexity');
  console.log();
}

analyzeLosses();
