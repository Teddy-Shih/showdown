const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

const team1 = Teams.pack(Teams.generate('gen9randombattle'));
const team2 = Teams.pack(Teams.generate('gen9randombattle'));

const battle = new Battle({
  formatid: 'gen9customgame',
  p1: { name: 'P1', team: team1 },
  p2: { name: 'P2', team: team2 }
});

battle.makeChoices('default', 'default');

const p1Active = battle.p1.active[0];

console.log('Active Pokemon:', p1Active.name);
console.log('Species:', p1Active.species.name);
console.log('HP:', p1Active.hp, '/', p1Active.maxhp);
console.log('Stats:', p1Active.stats);
console.log('Level:', p1Active.level);
console.log('Status:', p1Active.status);
console.log('Boosts:', p1Active.boosts);
console.log('\nMoveSlots:');
p1Active.moveSlots.forEach((slot, i) => {
  console.log(`  ${i+1}. ${slot.id} (PP: ${slot.pp}/${slot.maxpp})`);
});

console.log('\nAll Pokemon on team:');
battle.p1.pokemon.forEach((p, i) => {
  console.log(`  ${i+1}. ${p.name} - ${p.hp}/${p.maxhp}`);
});
