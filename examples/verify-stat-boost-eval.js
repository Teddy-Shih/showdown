const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const EngineMoveSimulator = require('../src/EngineMoveSimulator');

Teams.setGeneratorFactory(TeamGenerators);

/**
 * Verify that stat boost evaluation is working correctly
 */

async function verifyStatBoosts() {
  console.log('='.repeat(70));
  console.log('STAT BOOST EVALUATION VERIFICATION');
  console.log('='.repeat(70));

  const simulator = new EngineMoveSimulator();

  // Create a simple battle
  const team1 = Teams.pack(Teams.generate('gen9randombattle'));
  const team2 = Teams.pack(Teams.generate('gen9randombattle'));

  const battle = new Battle({
    formatid: 'gen9customgame',
    p1: { name: 'P1', team: team1 },
    p2: { name: 'P2', team: team2 }
  });

  battle.makeChoices('default', 'default');

  console.log('\nInitial state:');
  console.log(`P1: ${battle.p1.active[0].name} (${battle.p1.active[0].hp}/${battle.p1.active[0].maxhp})`);
  console.log(`P2: ${battle.p2.active[0].name} (${battle.p2.active[0].hp}/${battle.p2.active[0].maxhp})`);

  const baselineScore = simulator.evaluateState(battle, 'p1');
  console.log(`\nBaseline evaluation (no boosts): ${baselineScore.toFixed(2)}`);

  // Manually add stat boosts to P1
  console.log('\n--- Testing Stat Boost Valuation ---');

  // Test +1 Attack
  battle.p1.active[0].boosts.atk = 1;
  const atk1Score = simulator.evaluateState(battle, 'p1');
  console.log(`\n+1 Attack boost:`);
  console.log(`  Score: ${atk1Score.toFixed(2)}`);
  console.log(`  Difference: ${(atk1Score - baselineScore).toFixed(2)} (expected: 15)`);

  // Test +2 Attack
  battle.p1.active[0].boosts.atk = 2;
  const atk2Score = simulator.evaluateState(battle, 'p1');
  console.log(`\n+2 Attack boost:`);
  console.log(`  Score: ${atk2Score.toFixed(2)}`);
  console.log(`  Difference: ${(atk2Score - baselineScore).toFixed(2)} (expected: 30)`);

  // Reset
  battle.p1.active[0].boosts.atk = 0;

  // Test +1 Speed
  battle.p1.active[0].boosts.spe = 1;
  const spe1Score = simulator.evaluateState(battle, 'p1');
  console.log(`\n+1 Speed boost:`);
  console.log(`  Score: ${spe1Score.toFixed(2)}`);
  console.log(`  Difference: ${(spe1Score - baselineScore).toFixed(2)} (expected: 20)`);

  // Reset
  battle.p1.active[0].boosts.spe = 0;

  // Test multiple boosts (Dragon Dance: +1 Atk, +1 Spe)
  battle.p1.active[0].boosts.atk = 1;
  battle.p1.active[0].boosts.spe = 1;
  const ddScore = simulator.evaluateState(battle, 'p1');
  console.log(`\n+1 Attack, +1 Speed (Dragon Dance):`);
  console.log(`  Score: ${ddScore.toFixed(2)}`);
  console.log(`  Difference: ${(ddScore - baselineScore).toFixed(2)} (expected: 35)`);

  // Reset
  battle.p1.active[0].boosts.atk = 0;
  battle.p1.active[0].boosts.spe = 0;

  // Test opponent boosts (should be negative for us)
  battle.p2.active[0].boosts.atk = 1;
  const oppBoostScore = simulator.evaluateState(battle, 'p1');
  console.log(`\nOpponent +1 Attack boost:`);
  console.log(`  Score: ${oppBoostScore.toFixed(2)}`);
  console.log(`  Difference: ${(oppBoostScore - baselineScore).toFixed(2)} (expected: -15)`);

  // Reset
  battle.p2.active[0].boosts.atk = 0;

  // Test negative boosts
  battle.p1.active[0].boosts.atk = -1;
  const negBoostScore = simulator.evaluateState(battle, 'p1');
  console.log(`\nOur -1 Attack (debuff):`);
  console.log(`  Score: ${negBoostScore.toFixed(2)}`);
  console.log(`  Difference: ${(negBoostScore - baselineScore).toFixed(2)} (expected: -15)`);

  console.log('\n' + '='.repeat(70));
  console.log('STAT BOOST WEIGHTS');
  console.log('='.repeat(70));
  console.log('Attack:   15 points per stage');
  console.log('Sp. Atk:  15 points per stage');
  console.log('Defense:  12 points per stage');
  console.log('Sp. Def:  12 points per stage');
  console.log('Speed:    20 points per stage (most valuable!)');
  console.log('Accuracy:  8 points per stage');
  console.log('Evasion:  10 points per stage');
  console.log('');
  console.log('Examples:');
  console.log('  Dragon Dance (+1 Atk, +1 Spe): +35 points');
  console.log('  Swords Dance (+2 Atk):         +30 points');
  console.log('  Quiver Dance (+1 SpA, +1 SpD, +1 Spe): +47 points');
  console.log('  Calm Mind (+1 SpA, +1 SpD):    +27 points');
  console.log('='.repeat(70));
}

verifyStatBoosts().catch(console.error);
