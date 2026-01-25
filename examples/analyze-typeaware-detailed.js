const TypeAwareBot = require('../src/TypeAwareBot');
const StatefulTreeSearchBot = require('../src/StatefulTreeSearchBot');
const StatefulBattleSimulator = require('../src/StatefulBattleSimulator');
const { team1, team2 } = require('../data/ou-teams');

/**
 * Detailed TypeAwareBot loss analysis
 * Runs individual battles with verbose logging to identify loss patterns
 */

async function runDetailedBattle(battleNum, typeAwareBotTeam, treeSearchBotTeam) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`BATTLE ${battleNum} - DETAILED ANALYSIS`);
  console.log(`TypeAwareBot: ${typeAwareBotTeam === team1 ? 'Team 1' : 'Team 2'}`);
  console.log(`TreeSearchBot: ${treeSearchBotTeam === team1 ? 'Team 1' : 'Team 2'}`);
  console.log(`${'='.repeat(80)}`);

  const typeAwareBot = new TypeAwareBot('TypeAwareBot');
  const treeSearchBot = new StatefulTreeSearchBot('TreeSearchBot');

  const sim = new StatefulBattleSimulator(typeAwareBot, treeSearchBot, typeAwareBotTeam, treeSearchBotTeam, {
    verbose: true, // Enable verbose logging
    maxTurns: 100
  });

  const result = await sim.runBattle();

  console.log(`\n${'-'.repeat(80)}`);
  console.log('BATTLE RESULT:');
  console.log(`  Winner: ${result.winner}`);
  console.log(`  Turns: ${result.turns}`);
  console.log(`  TypeAwareBot nodes: ${typeAwareBot.nodesEvaluated}`);
  console.log(`  TypeAwareBot prunes: ${typeAwareBot.pruneCount}`);
  console.log(`  TypeAwareBot switches: ${typeAwareBot.switchBreaks}`);
  console.log(`${'-'.repeat(80)}`);

  return result;
}

async function analyzeLossPatterns() {
  console.log('TYPEAWAREBOT DETAILED LOSS ANALYSIS');
  console.log('Running battles that match loss patterns from Round 3\n');

  // Pattern identified: TypeAwareBot loses most when it has Team 1 vs Team 2
  console.log('\nPattern: TypeAwareBot (Team 1) vs TreeSearchBot (Team 2)');
  console.log('This pattern accounted for 3/4 losses in Round 3\n');

  const results = [];

  // Run 3 battles with this specific matchup (reduced for speed)
  for (let i = 0; i < 3; i++) {
    const result = await runDetailedBattle(i + 1, team1, team2);
    results.push({
      battle: i + 1,
      winner: result.winner,
      typeAwareBotWon: result.winner === 'TypeAwareBot'
    });
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('AGGREGATE RESULTS: TypeAwareBot (Team 1) vs TreeSearchBot (Team 2)');
  console.log('='.repeat(80));

  const wins = results.filter(r => r.typeAwareBotWon).length;
  const losses = results.length - wins;

  console.log(`TypeAwareBot wins: ${wins}/${results.length} (${(wins/results.length*100).toFixed(1)}%)`);
  console.log(`TreeSearchBot wins: ${losses}/${results.length} (${(losses/results.length*100).toFixed(1)}%)`);

  if (losses >= 2) {
    console.log('\n⚠️  CONFIRMED: Team 1 vs Team 2 matchup is unfavorable for TypeAwareBot');
    console.log('This suggests a team composition weakness, not an algorithm issue.');
  }

  console.log('\n\nRunning reverse matchup for comparison...\n');

  const reverseResults = [];

  // Run 3 battles with reversed teams
  for (let i = 0; i < 3; i++) {
    const result = await runDetailedBattle(i + 4, team2, team1);
    reverseResults.push({
      battle: i + 4,
      winner: result.winner,
      typeAwareBotWon: result.winner === 'TypeAwareBot'
    });
  }

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('AGGREGATE RESULTS: TypeAwareBot (Team 2) vs TreeSearchBot (Team 1)');
  console.log('='.repeat(80));

  const reverseWins = reverseResults.filter(r => r.typeAwareBotWon).length;
  const reverseLosses = reverseResults.length - reverseWins;

  console.log(`TypeAwareBot wins: ${reverseWins}/${reverseResults.length} (${(reverseWins/reverseResults.length*100).toFixed(1)}%)`);
  console.log(`TreeSearchBot wins: ${reverseLosses}/${reverseResults.length} (${(reverseLosses/reverseResults.length*100).toFixed(1)}%)`);

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('COMPARISON SUMMARY');
  console.log('='.repeat(80));
  console.log(`TypeAwareBot (Team 1) vs TreeSearchBot (Team 2): ${(wins/results.length*100).toFixed(1)}% win rate`);
  console.log(`TypeAwareBot (Team 2) vs TreeSearchBot (Team 1): ${(reverseWins/reverseResults.length*100).toFixed(1)}% win rate`);

  const differential = ((reverseWins/reverseResults.length) - (wins/results.length)) * 100;
  console.log(`\nDifferential: ${differential.toFixed(1)}% (${differential > 0 ? 'Team 2 favored' : 'Team 1 favored'})`);

  if (Math.abs(differential) > 33) {
    console.log('\n⚠️  SIGNIFICANT TEAM COMPOSITION IMBALANCE DETECTED');
    console.log('One team has a structural advantage regardless of bot algorithm.');
  } else {
    console.log('\n✓ Teams are relatively balanced');
    console.log('Losses are likely due to algorithm decisions, not team composition.');
  }
}

// Run analysis
analyzeLossPatterns().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
