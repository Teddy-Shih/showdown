/**
 * Pure Offense Teams - Only attacking moves with no status effects
 * Used to test if SmartBot is optimal when strategy is removed
 */

// Team 1: Pure offense with only damaging moves
const TEAM_PURE_OFFENSE_1 = `
Dragonite @ Choice Band
Ability: Multiscale
Tera Type: Normal
EVs: 252 Atk / 4 SpD / 252 Spe
Adamant Nature
- Outrage
- Earthquake
- Fire Punch
- Extreme Speed

Gengar @ Life Orb
Ability: Cursed Body
Tera Type: Ghost
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Shadow Ball
- Sludge Wave
- Focus Blast
- Psychic

Gyarados @ Leftovers
Ability: Intimidate
Tera Type: Water
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Waterfall
- Crunch
- Earthquake
- Ice Fang

Alakazam @ Choice Specs
Ability: Magic Guard
Tera Type: Psychic
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Psychic
- Focus Blast
- Shadow Ball
- Dazzling Gleam

Machamp @ Assault Vest
Ability: No Guard
Tera Type: Fighting
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Close Combat
- Stone Edge
- Earthquake
- Ice Punch

Charizard @ Heavy-Duty Boots
Ability: Blaze
Tera Type: Fire
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Flamethrower
- Air Slash
- Dragon Pulse
- Focus Blast
`.trim();

// Team 2: Pure offense with only damaging moves
const TEAM_PURE_OFFENSE_2 = `
Tyranitar @ Choice Band
Ability: Sand Stream
Tera Type: Rock
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Stone Edge
- Crunch
- Earthquake
- Fire Punch

Starmie @ Life Orb
Ability: Natural Cure
Tera Type: Water
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Hydro Pump
- Ice Beam
- Psychic
- Thunderbolt

Scizor @ Choice Band
Ability: Technician
Tera Type: Bug
EVs: 252 HP / 252 Atk / 4 SpD
Adamant Nature
- Bullet Punch
- Bug Bite
- Superpower
- Dual Wingbeat

Espeon @ Choice Specs
Ability: Magic Bounce
Tera Type: Psychic
EVs: 252 SpA / 4 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Psychic
- Shadow Ball
- Dazzling Gleam
- Grass Knot

Lucario @ Life Orb
Ability: Inner Focus
Tera Type: Fighting
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Close Combat
- Extreme Speed
- Meteor Mash
- Earthquake

Arcanine @ Heavy-Duty Boots
Ability: Intimidate
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Flare Blitz
- Wild Charge
- Extreme Speed
- Close Combat
`.trim();

module.exports = {
  TEAM_PURE_OFFENSE_1,
  TEAM_PURE_OFFENSE_2,

  getAllTeams() {
    return [TEAM_PURE_OFFENSE_1, TEAM_PURE_OFFENSE_2];
  }
};
