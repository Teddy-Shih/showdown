const { calculate, Pokemon, Move, Field, Generations } = require('@smogon/calc');

const gen = Generations.get(9);

try {
  console.log('Creating attacker...');
  const attacker = new Pokemon(gen, 'Charizard', {
    level: 100
  });
  console.log('Attacker created:', attacker.name);

  console.log('Creating defender...');
  const defender = new Pokemon(gen, 'Blastoise', {
    level: 100
  });
  console.log('Defender created:', defender.name);

  console.log('Creating move...');
  const move = new Move(gen, 'Flamethrower');
  console.log('Move created:', move.name);

  console.log('Creating field...');
  const field = new Field({
    weather: undefined,
    terrain: undefined
  });
  console.log('Field created');

  console.log('Calculating damage...');
  const result = calculate(gen, attacker, defender, move, field);
  console.log('Damage:', result.damage);
  console.log('Success!');

} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
