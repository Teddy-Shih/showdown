const TypeAwareBot = require('../src/TypeAwareBot');
const { Dex } = require('@pkmn/sim');

/**
 * Test priority move tracking and coverage-aware selection
 */

console.log('='.repeat(80));
console.log('TESTING PRIORITY MOVE TRACKING AND COVERAGE EVALUATION');
console.log('='.repeat(80));
console.log();

// Create bot instance
const bot = new TypeAwareBot('TestBot');

// Test 1: Terrain tracking
console.log('TEST 1: Terrain Tracking');
console.log('-'.repeat(80));

bot.processBattleMessage('|-fieldstart|move: Grassy Terrain');
console.log(`✓ Set Grassy Terrain: ${bot.terrain === 'Grassy' ? 'PASS' : 'FAIL'}`);
console.log(`  Terrain: ${bot.terrain}, Turns left: ${bot.terrainTurnsLeft}`);

bot.processBattleMessage('|-fieldstart|move: Trick Room');
console.log(`✓ Set Trick Room: ${bot.fieldConditions.trickRoom ? 'PASS' : 'FAIL'}`);
console.log(`  Trick Room active: ${bot.fieldConditions.trickRoom}, Turns left: ${bot.fieldConditions.trickRoomTurnsLeft}`);

bot.processBattleMessage('|-fieldend|move: Grassy Terrain');
console.log(`✓ End Grassy Terrain: ${bot.terrain === null ? 'PASS' : 'FAIL'}`);
console.log(`  Terrain: ${bot.terrain}`);

console.log();

// Test 2: Weather tracking
console.log('TEST 2: Weather Tracking');
console.log('-'.repeat(80));

bot.processBattleMessage('|-weather|SunnyDay');
console.log(`✓ Set Sunny Day: ${bot.weather === 'sun' ? 'PASS' : 'FAIL'}`);
console.log(`  Weather: ${bot.weather}, Turns left: ${bot.weatherTurnsLeft}`);

bot.processBattleMessage('|-weather|none');
console.log(`✓ Clear weather: ${bot.weather === null ? 'PASS' : 'FAIL'}`);
console.log(`  Weather: ${bot.weather}`);

console.log();

// Test 3: Priority calculation
console.log('TEST 3: Priority Calculation');
console.log('-'.repeat(80));

// Reset terrain for testing
bot.terrain = 'Grassy';

const grassyGlide = Dex.moves.get('Grassy Glide');
const aquaJet = Dex.moves.get('Aqua Jet');
const earthquake = Dex.moves.get('Earthquake');

const grassyGlidePriority = bot.getEffectivePriority(grassyGlide, null);
const aquaJetPriority = bot.getEffectivePriority(aquaJet, null);
const earthquakePriority = bot.getEffectivePriority(earthquake, null);

console.log(`Grassy Glide (with Grassy Terrain): Priority ${grassyGlidePriority} ${grassyGlidePriority === 1 ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Aqua Jet: Priority ${aquaJetPriority} ${aquaJetPriority === 1 ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Earthquake: Priority ${earthquakePriority} ${earthquakePriority === 0 ? '✓ PASS' : '✗ FAIL'}`);

console.log();

// Test 4: Move order determination
console.log('TEST 4: Move Order Determination');
console.log('-'.repeat(80));

// Reset Trick Room from Test 1
bot.fieldConditions.trickRoom = false;

// Normal: Faster goes first
const test4a = bot.determineMoveOrder(300, 0, 200, 0); // We're faster
const test4b = bot.determineMoveOrder(200, 0, 300, 0); // We're slower

console.log(`Speed 300 vs 200 (normal): We go first = ${test4a} ${test4a ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Speed 200 vs 300 (normal): We go first = ${test4b} ${!test4b ? '✓ PASS' : '✗ FAIL'}`);

// Priority: Higher priority goes first regardless of speed
const test4c = bot.determineMoveOrder(200, 1, 300, 0); // We're slower but +1 priority
console.log(`Speed 200 priority+1 vs 300 priority 0: We go first = ${test4c} ${test4c ? '✓ PASS' : '✗ FAIL'}`);

// Trick Room: Slower goes first
bot.fieldConditions.trickRoom = true;
const test4d = bot.determineMoveOrder(200, 0, 300, 0); // We're slower (should go first in TR)
const test4e = bot.determineMoveOrder(300, 0, 200, 0); // We're faster (should go second in TR)

console.log(`Trick Room - Speed 200 vs 300: We go first = ${test4d} ${test4d ? '✓ PASS' : '✗ FAIL'}`);
console.log(`Trick Room - Speed 300 vs 200: We go first = ${test4e} ${!test4e ? '✓ PASS' : '✗ FAIL'}`);

// Priority still matters in Trick Room
const test4f = bot.determineMoveOrder(200, 1, 300, 0); // Priority still beats TR
console.log(`Trick Room - Priority+1 still goes first: ${test4f} ${test4f ? '✓ PASS' : '✗ FAIL'}`);

bot.fieldConditions.trickRoom = false; // Reset

console.log();

// Test 5: Coverage evaluation
console.log('TEST 5: Coverage Evaluation Against Team');
console.log('-'.repeat(80));

// Mock opponent team: Gholdengo (Steel/Ghost), Blastoise (Water), Charizard (Fire/Flying)
bot.opponentTeam = [
  { species: 'Gholdengo' },
  { species: 'Blastoise' },
  { species: 'Charizard' }
];

const flamethrower = Dex.moves.get('Flamethrower'); // Fire
const grassKnot = Dex.moves.get('Grass Knot'); // Grass
const thunderbolt = Dex.moves.get('Thunderbolt'); // Electric

const flameCoverage = bot.evaluateMoveCoverageVsTeam(flamethrower, bot.opponentTeam);
const grassCoverage = bot.evaluateMoveCoverageVsTeam(grassKnot, bot.opponentTeam);
const thunderCoverage = bot.evaluateMoveCoverageVsTeam(thunderbolt, bot.opponentTeam);

console.log(`Flamethrower coverage: ${flameCoverage} (SE vs Steel, weak vs Water/Fire)`);
console.log(`Grass Knot coverage: ${grassCoverage} (immune vs Gholdengo, SE vs Water, weak vs Fire)`);
console.log(`Thunderbolt coverage: ${thunderCoverage} (immune vs Gholdengo, SE vs Water/Flying, neutral vs Fire)`);

console.log();

// Specific scenario: Grass move vs Gholdengo (should get penalty)
const razorLeaf = Dex.moves.get('Razor Leaf'); // Grass
bot.opponentTeam = [{ species: 'Gholdengo' }];
const grassVsGholdengo = bot.evaluateMoveCoverageVsTeam(razorLeaf, bot.opponentTeam);

console.log(`Grass move (Razor Leaf) vs Gholdengo team: ${grassVsGholdengo} ${grassVsGholdengo < 0 ? '✓ PASS (negative penalty)' : '✗ FAIL'}`);

console.log();

// Test 6: Speed confidence
console.log('TEST 6: Speed Confidence Calculation');
console.log('-'.repeat(80));

console.log('Speed confidence formula: speedGap / 100, capped at 1.0');
console.log('  speedGap = 100 → confidence = 1.0 (max confidence)');
console.log('  speedGap = 50  → confidence = 0.5 (medium confidence)');
console.log('  speedGap = 10  → confidence = 0.1 (low confidence)');
console.log('  speedGap = 0   → confidence = 0.0 (no confidence, 50/50 tie)');

console.log();

console.log('='.repeat(80));
console.log('ALL TESTS COMPLETE');
console.log('='.repeat(80));
