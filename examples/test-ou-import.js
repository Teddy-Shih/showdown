const { Teams } = require('@pkmn/sim');
const { TeamGenerators } = require('@pkmn/randoms');
const ouTeams = require('../data/ou-teams');

// Set up team generator factory
Teams.setGeneratorFactory(TeamGenerators);

console.log('Testing team import...\n');

try {
  const team1 = ouTeams.TEAM_SPECS_GHOLDENGO;
  console.log('Team 1 (first 200 chars):');
  console.log(team1.substring(0, 200));
  console.log('\n');

  console.log('Attempting to import team 1...');
  const imported1 = Teams.import(team1);
  console.log('✓ Team 1 imported successfully');
  console.log('Imported team:', imported1);
  console.log('\n');

  console.log('Attempting to pack team 1...');
  const packed1 = Teams.pack(imported1);
  console.log('✓ Team 1 packed successfully');
  console.log('Packed team (first 100 chars):', packed1.substring(0, 100));
  console.log('\n');

  const team2 = ouTeams.TEAM_ANTIMETA_LANDO;
  console.log('Attempting to import team 2...');
  const imported2 = Teams.import(team2);
  console.log('✓ Team 2 imported successfully');

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
}
