# Pokemon Showdown Simulator Feature Audit

## Executive Summary

**Battle Simulator**: ✅ **FULLY FUNCTIONAL** - Uses official @pkmn/sim
**Bot Damage Calculation**: ❌ **MISSING MANY FEATURES** - Basic approximation only

The good news: All actual battles use the official Pokemon Showdown simulator, so game mechanics work perfectly.
The bad news: Our bot's damage estimation is very basic and missing many features.

---

## Part 1: Battle Simulator (@pkmn/sim) - ✅ ALL FEATURES WORK

### Implementation
```javascript
const { BattleStreams, Teams } = require('@pkmn/sim');
```

We use the **official Pokemon Showdown simulator** directly. This means:

### ✅ Terrains (All Functional)
- **Grassy Terrain**:
  - Grassy Glide gets +1 priority ✓
  - Grassy moves 1.3x power ✓
  - Grounded Pokemon heal 1/16 HP ✓
  - Earthquake/Bulldoze/Magnitude 0.5x power ✓
- **Electric Terrain**:
  - Electric moves 1.3x power ✓
  - Sleep immunity for grounded Pokemon ✓
- **Psychic Terrain**:
  - Psychic moves 1.3x power ✓
  - **Expanding Force hits both targets + 1.5x power** ✓
  - Priority move immunity ✓
- **Misty Terrain**:
  - **Status immunity for grounded Pokemon** ✓
  - Dragon moves 0.5x power ✓

### ✅ Weather (All Functional)
- **Sun**: Fire 1.5x, Water 0.5x ✓
- **Rain**: Water 1.5x, Fire 0.5x ✓
- **Sand**: Rock SpD 1.5x ✓
- **Snow**: Ice Def 1.5x ✓
- **Weather Ball**: 2x power in any weather ✓
- **Hydro Pump damage diminished in sun** ✓

### ✅ Screens (All Functional)
- **Reflect**: Physical moves halved ✓
- **Light Screen**: Special moves halved ✓
- **Aurora Veil**: Both halved (requires snow) ✓

### ✅ Field Conditions (All Functional)
- **Trick Room**: Speed order reversed ✓
- **Magic Room**: Items disabled ✓
- **Wonder Room**: Def/SpD swapped ✓
- **Gravity**: Accuracy boosted, grounded ✓

### ✅ Speed Modifiers (All Functional)
- **Tailwind**: Speed doubled ✓
- **Paralysis**: Speed halved ✓
- **Choice Scarf**: Speed 1.5x ✓
- **Sticky Web**: Speed lowered on switch ✓

### ✅ Abilities (All Functional)
- **Neutralizing Gas**: Disables all other abilities ✓
- **Mind's Eye**: Hits Ghost types with Normal/Fighting ✓
- **Mold Breaker**: Bypasses abilities like Queenly Majesty ✓
  - Can use priority moves through Queenly Majesty ✓
- **Armor Tail**: Blocks priority moves ✓
- **Protosynthesis/Quark Drive**: Stat boosts in weather/terrain ✓
- **Adaptability**: STAB 2x instead of 1.5x ✓
- **Levitate**: Ground immunity ✓
- **Magic Bounce**: Reflects status moves ✓
- **Good as Gold**: Status move immunity ✓
- **Supreme Overlord**: Damage boost per fainted ally ✓
- **Regenerator**: Heals 33% on switch-out ✓

### ✅ Critical Hits (All Functional)
- **Base crit rate**: 1/24 ✓
- **High crit moves** (Ivy Cudgel, Stone Edge): 1/8 ✓
- **Focus Energy**: +2 crit stages ✓
- **Crits ignore negative stat changes** (attacker) ✓
- **Crits ignore positive stat changes** (defender) ✓
- **Crits are 1.5x damage** ✓

### ✅ All Other Features
- **Stat boosts**: -6 to +6 stages ✓
- **STAB**: 1.5x damage ✓
- **Type effectiveness**: 0x, 0.25x, 0.5x, 1x, 2x, 4x ✓
- **Multi-hit moves**: 2-5 hits ✓
- **Recoil**: Life Orb, High Jump Kick, etc. ✓
- **Priority**: -7 to +5 ✓
- **Status conditions**: Burn, Paralysis, Sleep, Poison, Freeze ✓

**Conclusion**: The simulator is perfect. All features work because we use official @pkmn/sim.

---

## Part 2: Bot Damage Calculation - ❌ MISSING MANY FEATURES

### Current Implementation

```javascript
calculateDamage(attacker, defender, move, attackerBoosts, defenderBoosts) {
  if (!move.basePower) return 0;

  // Basic stat calculation
  let attackStat = move.category === 'Physical' ? attacker.stats.atk : attacker.stats.spa;
  let defenseStat = move.category === 'Physical' ? defender.stats.def : defender.stats.spd;

  // Apply stat boosts ✓
  if (attackerBoosts) {
    attackStat *= getBoostMultiplier(attackerBoosts);
  }
  if (defenderBoosts) {
    defenseStat *= getBoostMultiplier(defenderBoosts);
  }

  // Base damage formula
  let damage = ((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50 + 2;

  // Burn halves physical damage ✓
  if (attacker has burn && move.category === 'Physical') {
    damage *= 0.5;
  }

  // STAB ✓
  if (attacker.types.includes(move.type)) {
    damage *= 1.5;
  }

  // Type effectiveness ✓
  damage *= getTypeEffectiveness(move.type, defender.types);

  return damage;
}
```

### ✅ What Works
1. **Base damage formula** - Correct
2. **Stat boosts** - Correctly applied (-6 to +6)
3. **STAB** - 1.5x multiplier
4. **Type effectiveness** - Using Dex correctly
5. **Burn** - Halves physical damage
6. **Paralysis** - Halves speed (in getSpeed function)

### ❌ What's Missing

#### 1. Weather Effects
```javascript
// MISSING: Weather damage modifiers
if (this.weather === 'sun' && move.type === 'Fire') damage *= 1.5;
if (this.weather === 'sun' && move.type === 'Water') damage *= 0.5;
if (this.weather === 'rain' && move.type === 'Water') damage *= 1.5;
if (this.weather === 'rain' && move.type === 'Fire') damage *= 0.5;
```

#### 2. Terrain Effects
```javascript
// MISSING: Terrain damage modifiers
if (this.terrain === 'Grassy' && move.type === 'Grass') damage *= 1.3;
if (this.terrain === 'Electric' && move.type === 'Electric') damage *= 1.3;
if (this.terrain === 'Psychic' && move.type === 'Psychic') damage *= 1.3;
if (this.terrain === 'Misty' && move.type === 'Dragon') damage *= 0.5;

// MISSING: Special terrain effects
if (move.name === 'Expanding Force' && this.terrain === 'Psychic') {
  damage *= 1.5; // Expanding Force is 1.5x power in Psychic Terrain
}
```

#### 3. Screens
```javascript
// MISSING: Reflect/Light Screen
if (defenderHasReflect && move.category === 'Physical') damage *= 0.5;
if (defenderHasLightScreen && move.category === 'Special') damage *= 0.5;
if (defenderHasAuroraVeil) damage *= 0.5;
```

#### 4. Critical Hits
```javascript
// MISSING: Critical hit logic
// - High crit ratio moves (Ivy Cudgel, Stone Edge, etc.)
// - Focus Energy (+2 crit stages)
// - Crits ignore negative stat changes
// - Crits are 1.5x damage
```

#### 5. Abilities
```javascript
// MISSING: Ability modifiers
// - Adaptability: STAB 2x instead of 1.5x
// - Technician: Moves ≤60 power get 1.5x
// - Tough Claws: Contact moves 1.3x
// - Sheer Force: Removes secondary effects, 1.3x power
// - Huge Power/Pure Power: Attack 2x
// - Thick Fat: Fire/Ice damage halved
// - Filter/Solid Rock: Super effective damage 0.75x
// ... and 100+ more abilities
```

#### 6. Items
```javascript
// MISSING: Item modifiers
// - Choice Specs/Band: 1.5x damage
// - Life Orb: 1.3x damage
// - Expert Belt: Super effective moves 1.2x
// - Type-specific items (Charcoal, Mystic Water, etc.): 1.2x
// - Weakness Policy: +2 Atk/SpA when hit super effectively
```

#### 7. Field Effects
```javascript
// MISSING: Other field effects
// - Wonder Room: Def/SpD swapped
// - Gravity: Some moves get 1.2x power
// - Stealth Rock: Damages on switch (we track but don't use in damage calc)
```

### Why This Is Okay (For Now)

Our damage calculation is used for **move ordering in minimax search**, not actual battle damage.

**What Matters**:
- Relative ordering of moves (which does more damage?)
- Approximate damage values for KO detection

**What Doesn't Matter**:
- Exact damage numbers
- Edge cases (crits, weather, etc.)

The minimax search will still find good moves because:
1. The ACTUAL battle uses @pkmn/sim (perfect)
2. Our estimates are consistent (same formula for all moves)
3. We get STAB, type effectiveness, and boosts right (the big factors)

### Why This Could Hurt Performance

**Missing weather/terrain/screens could cause**:
1. **Overestimating damage** when opponent has screens
2. **Underestimating damage** in favorable weather
3. **Wrong move ordering** when weather/terrain matters

**Example**:
- Fire move in sun does 1.5x damage (we calculate 1x)
- Bot might think Water move is better
- Search explores wrong move first
- Alpha-beta prunes the correct move

This could explain the **Team 1 regression** if Team 1 relies more on weather/terrain/setup.

---

## Recommendations

### Option 1: Use @smogon/calc (RECOMMENDED)
Replace our damage calculation with the official calculator:

```javascript
const { calculate, Pokemon, Move, Generations } = require('@smogon/calc');

calculateDamage(attacker, defender, move, attackerBoosts, defenderBoosts) {
  const gen = Generations.get(9);

  const attackerPokemon = new Pokemon(gen, attacker.species, {
    nature: 'Adamant', // We'd need to track this
    evs: { atk: 252 }, // Assume max
    boosts: attackerBoosts
  });

  const defenderPokemon = new Pokemon(gen, defender.species, {
    evs: { hp: 252, def: 252 },
    boosts: defenderBoosts
  });

  const moveObj = new Move(gen, move.name);

  const result = calculate(gen, attackerPokemon, defenderPokemon, moveObj, {
    weather: this.weather,
    terrain: this.terrain,
    // ... field conditions
  });

  return result.damage[0]; // Min damage
}
```

**Pros**:
- ✅ All features automatically (weather, terrain, abilities, items, crits)
- ✅ Same calculator used by competitive players
- ✅ Regularly updated

**Cons**:
- ❌ Requires tracking natures, EVs, items
- ❌ Slightly slower (but negligible)
- ❌ Another dependency

### Option 2: Add Missing Features Manually
Add weather/terrain/screens to our current calculation:

```javascript
calculateDamage(attacker, defender, move, attackerBoosts, defenderBoosts) {
  // ... existing code ...

  // Add weather
  if (this.weather === 'sun' && move.type === 'Fire') damage *= 1.5;
  if (this.weather === 'sun' && move.type === 'Water') damage *= 0.5;
  // ... more weather

  // Add terrain
  if (this.terrain === 'Grassy' && move.type === 'Grass' && isGrounded(defender)) {
    damage *= 1.3;
  }
  // ... more terrain

  // Add screens (need to track these)
  if (this.opponentScreens.reflect && move.category === 'Physical') {
    damage *= 0.5;
  }

  return damage;
}
```

**Pros**:
- ✅ No new dependencies
- ✅ Fast
- ✅ We control the logic

**Cons**:
- ❌ Tedious to implement
- ❌ Easy to miss edge cases
- ❌ Need to maintain as Pokemon adds new mechanics

### Option 3: Do Nothing (Current)
Keep using basic damage calculation.

**Pros**:
- ✅ Simple
- ✅ Fast
- ✅ Works okay for move ordering

**Cons**:
- ❌ Missing 30-50% damage modifiers in some cases
- ❌ Could explain performance regression
- ❌ Wrong move ordering when weather/terrain matters

---

## My Recommendation

**Use @smogon/calc** (Option 1)

**Why**:
1. We're already tracking weather/terrain for priority moves
2. @smogon/calc handles ALL edge cases automatically
3. It's the gold standard for damage calculation
4. Small performance cost is worth accuracy

**Implementation**:
1. `npm install @smogon/calc`
2. Replace `calculateDamage()` with @smogon/calc wrapper
3. Track natures/EVs/items (assume standard sets)
4. Test if performance improves

**Expected Impact**:
- Better move ordering in weather/terrain
- More accurate KO detection
- Could improve Team 1 performance (if weather/terrain matters)
- Baseline: 67-85% → Target: 75-90%

This could be the missing piece explaining the regression!
