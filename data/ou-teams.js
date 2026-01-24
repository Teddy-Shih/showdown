/**
 * Sample Gen 9 OU Teams from Smogon
 * Source: https://www.smogon.com/forums/threads/sv-ou-sample-teams.3712513/
 */

// Team 1: Choice Specs Gholdengo (Smogon Team of the Week)
// Source: https://www.smogon.com/social/totw/svou-choicespecsgholdengo
const TEAM_SPECS_GHOLDENGO = `
Baxcalibur @ Heavy-Duty Boots
Ability: Thermal Exchange
Tera Type: Dragon
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Icicle Crash
- Glaive Rush
- Earthquake
- Dragon Dance

Gholdengo @ Choice Specs
Ability: Good as Gold
Tera Type: Flying
EVs: 108 HP / 252 SpA / 148 Spe
Modest Nature
IVs: 0 Atk
- Shadow Ball
- Make It Rain
- Power Gem
- Thunderbolt

Great Tusk @ Booster Energy
Ability: Protosynthesis
Tera Type: Ghost
EVs: 240 HP / 16 Def / 252 Spe
Jolly Nature
- Earthquake
- Close Combat
- Rapid Spin
- Stealth Rock

Iron Valiant @ Choice Scarf
Ability: Quark Drive
Tera Type: Fairy
EVs: 4 Atk / 252 SpA / 252 Spe
Naive Nature
- Moonblast
- Close Combat
- Knock Off
- Trick

Rotom-Wash @ Leftovers
Ability: Levitate
Tera Type: Steel
EVs: 248 HP / 52 Def / 196 SpD / 12 Spe
Calm Nature
IVs: 0 Atk
- Thunder Wave
- Hydro Pump
- Volt Switch
- Protect

Kingambit @ Leftovers
Ability: Supreme Overlord
Tera Type: Fairy
EVs: 252 Atk / 4 Def / 252 Spe
Adamant Nature
- Kowtow Cleave
- Tera Blast
- Sucker Punch
- Swords Dance
`.trim();

// Team 2: Anti-Meta Landorus-T Team
// Source: https://www.smogon.com/forums/threads/gen-9-ou-anti-meta-team.3726093/
const TEAM_ANTIMETA_LANDO = `
Hatterene @ Focus Sash
Ability: Magic Bounce
Tera Type: Fairy
EVs: 84 HP / 32 Def / 252 SpA / 140 SpD
Bold Nature
IVs: 0 Atk
- Mystical Fire
- Psychic
- Dazzling Gleam
- Thunder Wave

Magnezone @ Rocky Helmet
Ability: Magnet Pull
Tera Type: Fairy
EVs: 232 HP / 144 Def / 76 SpA / 28 SpD / 28 Spe
Bold Nature
IVs: 0 Atk
- Body Press
- Thunderbolt
- Iron Defense
- Volt Switch

Slowking @ Leftovers
Ability: Regenerator
Tera Type: Water
EVs: 216 HP / 52 Def / 240 SpD
Calm Nature
IVs: 0 Atk
- Slack Off
- Hydro Pump
- Thunder Wave
- Chilly Reception

Frosmoth @ Heavy-Duty Boots
Ability: Shield Dust
Tera Type: Water
EVs: 76 HP / 36 Def / 96 SpA / 48 SpD / 252 Spe
Timid Nature
IVs: 0 Atk
- Quiver Dance
- Ice Beam
- Bug Buzz
- Aurora Veil

Landorus-Therian @ Choice Scarf
Ability: Intimidate
Tera Type: Ground
EVs: 48 HP / 188 Atk / 8 Def / 12 SpD / 252 Spe
Adamant Nature
- Earthquake
- Stealth Rock
- U-turn
- Stone Edge

Zapdos-Galar @ Choice Band
Ability: Defiant
Tera Type: Ground
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Close Combat
- Brave Bird
- Tera Blast
- U-turn
`.trim();

module.exports = {
  TEAM_SPECS_GHOLDENGO,
  TEAM_ANTIMETA_LANDO,

  // Get a random team from the pool
  getRandomTeam() {
    const teams = [TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO];
    return teams[Math.floor(Math.random() * teams.length)];
  },

  // Get both teams for comparison
  getAllTeams() {
    return [TEAM_SPECS_GHOLDENGO, TEAM_ANTIMETA_LANDO];
  }
};
