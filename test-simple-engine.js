const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

const team1 = Teams.pack(Teams.generate('gen9randombattle'));
const team2 = Teams.pack(Teams.generate('gen9randombattle'));

console.log('Creating battle...');
const battle = new Battle({
  formatid: 'gen9customgame',
  p1: { name: 'P1', team: team1 },
  p2: { name: 'P2', team: team2 }
});

console.log('Team preview...');
battle.makeChoices('default', 'default');

console.log('P1 Active:', battle.p1.active[0].name);
console.log('P2 Active:', battle.p2.active[0].name);

console.log('\nSimulating Turn 1...');
battle.makeChoices('move 1', 'move 1');

console.log('After Turn 1:');
console.log('P1:', battle.p1.active[0].name, battle.p1.active[0].hp + '/' + battle.p1.active[0].maxhp);
console.log('P2:', battle.p2.active[0].name, battle.p2.active[0].hp + '/' + battle.p2.active[0].maxhp);

console.log('\nTesting clone...');
const serialized = battle.toJSON();
console.log('Serialized successfully');

const cloned = Battle.fromJSON(serialized);
console.log('Cloned successfully');
console.log('Cloned turn:', cloned.turn);
console.log('Cloned P1:', cloned.p1.active[0].name);

console.log('\nTrying to simulate on cloned battle...');
try {
  cloned.makeChoices('move 2', 'move 2');
  console.log('Success! Cloned battle turn:', cloned.turn);
} catch (error) {
  console.error('Error:', error.message);
}
