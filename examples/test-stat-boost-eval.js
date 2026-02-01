const EngineBattleSimulator = require('../src/EngineBattleSimulator');
const FastTreeSearchBot = require('../src/FastTreeSearchBot');
const RandomBot = require('../src/RandomBot');

/**
 * Test that stat boost evaluation is working
 * Use a team with boosting moves to see if bot values them correctly
 */

const BOOST_TEAM = `
Clefable @ Leftovers
Ability: Magic Guard
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Calm Mind
- Moonblast
- Soft-Boiled
- Stealth Rock

Garchomp @ Rocky Helmet
Ability: Rough Skin
EVs: 252 HP / 4 Atk / 252 Spe
Jolly Nature
- Swords Dance
- Earthquake
- Stone Edge
- Stealth Rock

Gyarados @ Leftovers
Ability: Intimidate
EVs: 252 HP / 252 Atk / 4 Spe
Adamant Nature
- Dragon Dance
- Waterfall
- Earthquake
- Ice Fang

Volcarona @ Heavy-Duty Boots
Ability: Flame Body
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
- Quiver Dance
- Fiery Dance
- Bug Buzz
- Giga Drain

Dragonite @ Weakness Policy
Ability: Multiscale
EVs: 252 Atk / 4 Def / 252 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Outrage

Lucario @ Life Orb
Ability: Inner Focus
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Swords Dance
- Close Combat
- Meteor Mash
- Extreme Speed
`.trim();

const OPPONENT_TEAM = `
Toxapex @ Black Sludge
Ability: Regenerator
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Scald
- Recover
- Haze
- Toxic Spikes

Ferrothorn @ Leftovers
Ability: Iron Barbs
EVs: 252 HP / 88 Def / 168 SpD
Relaxed Nature
- Stealth Rock
- Leech Seed
- Power Whip
- Gyro Ball

Blissey @ Heavy-Duty Boots
Ability: Natural Cure
EVs: 252 HP / 252 Def / 4 SpD
Bold Nature
- Seismic Toss
- Soft-Boiled
- Toxic
- Stealth Rock

Slowbro @ Heavy-Duty Boots
Ability: Regenerator
EVs: 252 HP / 252 Def / 4 SpA
Bold Nature
- Scald
- Slack Off
- Ice Beam
- Thunder Wave

Hippowdon @ Leftovers
Ability: Sand Stream
EVs: 252 HP / 252 Def / 4 SpD
Impish Nature
- Stealth Rock
- Earthquake
- Slack Off
- Whirlwind

Mandibuzz @ Heavy-Duty Boots
Ability: Overcoat
EVs: 252 HP / 4 Def / 252 SpD
Careful Nature
- Foul Play
- Roost
- Defog
- Toxic
`.trim();

async function testStatBoosts() {
  console.log('Testing stat boost evaluation...\n');
  console.log('Team composition:');
  console.log('- Bot team: Setup sweepers (Calm Mind, Swords Dance, Dragon Dance, Quiver Dance)');
  console.log('- Opponent: Defensive walls\n');

  const bot = new FastTreeSearchBot('BoostBot', {
    verbose: true,
    maxMovesToConsider: 3
  });

  const randomBot = new RandomBot('DefensiveBot');

  const simulator = new EngineBattleSimulator(
    bot,
    randomBot,
    BOOST_TEAM,
    OPPONENT_TEAM,
    { verbose: true }
  );

  console.log('Starting battle...\n');
  const result = await simulator.runBattle();

  console.log('\n' + '='.repeat(60));
  console.log('BATTLE RESULT');
  console.log('='.repeat(60));
  console.log(`Winner: ${result.winner || 'Draw'}`);
  console.log(`Turns: ${result.turns}`);
  console.log('');
  console.log('Expected behavior:');
  console.log('- Bot should recognize value of boosting moves');
  console.log('- Should use setup moves when safe to do so');
  console.log('- Should value stat boosts in position evaluation');
  console.log('='.repeat(60));
}

testStatBoosts().catch(console.error);
