const { Battle, Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');

Teams.setGeneratorFactory(TeamGenerators);

// Generate simple teams
const team1 = Teams.pack(Teams.generate('gen9randombattle'));
const team2 = Teams.pack(Teams.generate('gen9randombattle'));

console.log('Exploring Battle API...\n');

// Try to create a Battle instance
try {
  const battle = new Battle({
    formatid: 'gen9customgame',
    p1: { name: 'P1', team: team1 },
    p2: { name: 'P2', team: team2 }
  });

  console.log('Battle instance created!');
  console.log('Battle properties:', Object.keys(battle).slice(0, 20));
  console.log('\nBattle methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(battle)).slice(0, 20));

  // Check for important methods
  console.log('\nKey methods available:');
  console.log('- choose:', typeof battle.choose);
  console.log('- makeChoices:', typeof battle.makeChoices);
  console.log('- destroy:', typeof battle.destroy);
  console.log('- restart:', typeof battle.restart);

  // Check state
  console.log('\nBattle state:', {
    turn: battle.turn,
    ended: battle.ended,
    winner: battle.winner
  });

  console.log('\nP1 Pokemon:', battle.p1.pokemon?.map(p => p.name));
  console.log('P2 Pokemon:', battle.p2.pokemon?.map(p => p.name));

  // Test making choices
  console.log('\n--- Testing Move Selection ---');

  // Make initial switch choices (team preview)
  battle.makeChoices('default', 'default');
  console.log('After team preview - Turn:', battle.turn);

  // Check active pokemon
  const p1Active = battle.p1.active[0];
  const p2Active = battle.p2.active[0];

  console.log('\nP1 Active:', p1Active?.name, `HP: ${p1Active?.hp}/${p1Active?.maxhp}`);
  console.log('P1 Moves:', p1Active?.moveSlots?.map(m => m.name));

  console.log('\nP2 Active:', p2Active?.name, `HP: ${p2Active?.hp}/${p2Active?.maxhp}`);
  console.log('P2 Moves:', p2Active?.moveSlots?.map(m => m.name));

  // Make a move
  console.log('\n--- Simulating Turn 1 ---');
  battle.makeChoices('move 1', 'move 1');

  console.log('After Turn 1:');
  console.log('P1 Active:', p1Active?.name, `HP: ${p1Active?.hp}/${p1Active?.maxhp}`);
  console.log('P2 Active:', p2Active?.name, `HP: ${p2Active?.hp}/${p2Active?.maxhp}`);
  console.log('Battle turn:', battle.turn);
  console.log('Battle ended:', battle.ended);

  // Test cloning - Can we serialize and restore?
  console.log('\n--- Testing Serialization ---');
  const serialized = JSON.stringify(battle.toJSON());
  console.log('Serialized length:', serialized.length, 'bytes');

  // Try to restore
  const restored = Battle.fromJSON(JSON.parse(serialized));
  console.log('Restored battle turn:', restored?.turn);

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
