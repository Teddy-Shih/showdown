const { Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const pureOffenseTeams = require('../data/pure-offense-teams');

Teams.setGeneratorFactory(TeamGenerators);

console.log('Testing pure offense team import...\n');

try {
  const team1 = pureOffenseTeams.TEAM_PURE_OFFENSE_1;
  console.log('Team 1 first 150 chars:');
  console.log(team1.substring(0, 150));
  console.log('\n');

  console.log('Attempting to import team 1...');
  const imported1 = Teams.import(team1);
  console.log('✓ Team 1 imported successfully');
  console.log('Pokemon count:', imported1.length);
  console.log('First Pokemon:', imported1[0].species);
  console.log('Moves:', imported1[0].moves);
  console.log('\n');

  console.log('Attempting to pack team 1...');
  const packed1 = Teams.pack(imported1);
  console.log('✓ Team 1 packed successfully');
  console.log('\n');

  const team2 = pureOffenseTeams.TEAM_PURE_OFFENSE_2;
  console.log('Attempting to import team 2...');
  const imported2 = Teams.import(team2);
  console.log('✓ Team 2 imported successfully');
  console.log('Pokemon count:', imported2.length);

  console.log('\n✓ All teams valid!');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
