const TypeAwareBot = require('../src/TypeAwareBot');
const { Dex } = require('@pkmn/sim');

const bot = new TypeAwareBot('TestBot');

console.log('Testing coverage evaluation with debug output');
console.log('='.repeat(80));

// Grass move vs Gholdengo
const razorLeaf = Dex.moves.get('Razor Leaf');
console.log(`Move: ${razorLeaf.name}, Type: ${razorLeaf.type}`);

const gholdengo = Dex.species.get('Gholdengo');
console.log(`Pokemon: ${gholdengo.name}, Types: ${gholdengo.types.join('/')}`);

// Check type effectiveness
const effectiveness = bot.getTypeEffectiveness(razorLeaf.type, gholdengo.types);
console.log(`Type effectiveness: ${effectiveness}`);

// Expected: Grass vs Steel/Ghost
// Grass -> Steel: 0.5x (not very effective)
// Grass -> Ghost: 1.0x (neutral)
// Combined: 0.5x

console.log();
console.log('Evaluating coverage:');
bot.opponentTeam = [{ species: 'Gholdengo' }];
const coverage = bot.evaluateMoveCoverageVsTeam(razorLeaf, bot.opponentTeam);
console.log(`Coverage score: ${coverage}`);
console.log(`Expected: -1 (resisted)`);
console.log(`Test: ${coverage < 0 ? 'PASS' : 'FAIL'}`);
