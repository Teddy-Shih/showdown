# Priority Move Implementation Plan

## Your Insights Summary

### ✅ Excellent Points You Raised:

1. **Priority vs Coverage Trade-off**: When you naturally outspeed and can KO with multiple moves, coverage for switch-ins should be considered
   - Example: Ogerpon with Grassy Slide (+1 priority) vs Ivy Cudgel (normal priority, better coverage)
   - If naturally faster, both moves go first, so Ivy Cudgel's coverage advantage matters

2. **Speed Should Be Binary**: In Pokemon mechanics, being 1 speed point faster = being 100 points faster
   - However: With hidden information (unknown EVs/IVs), gradient represents confidence

3. **Current Implementation Gaps**:
   - No priority move tracking (Grassy Slide, Aqua Jet, Extreme Speed, etc.)
   - No coverage evaluation when multiple moves can KO
   - No terrain tracking (for Grassy Slide, Electric Terrain, etc.)

### My Pushback:

**Keep Gradient Speed Evaluation** (0.2 per speed point, max +20):
- It's actually representing **confidence** in being faster, not the value of speed itself
- With hidden information, larger speed gaps = higher confidence we're actually faster
- Already working well (83.3% win rate)
- Max of 20 prevents overweighting

**Reframe, Don't Replace**:
```javascript
// Make it clearer this is about confidence, not speed value
const speedConfidence = Math.min(Math.abs(ourSpeed - oppSpeed) / 100, 1.0);
const speedAdvantageBonus = ourSpeed > oppSpeed ? 20 * speedConfidence : -15 * speedConfidence;
score += speedAdvantageBonus;
```

## Implementation Plan

### Phase 1: Priority Move Infrastructure ⚡ (HIGH PRIORITY)

**1.1: Add Priority Tracking**
```javascript
// In TypeAwareBot.js

// Add to constructor:
this.terrain = null; // 'Grassy', 'Electric', 'Psychic', 'Misty'
this.fieldConditions = {
  trickRoom: false,
  gravity: false
};

// Add terrain tracking in processBattleMessage:
processFieldChange(line) {
  // |-fieldstart|move: Grassy Terrain
  if (line.includes('|-fieldstart|')) {
    const parts = line.split('|');
    if (parts[2].includes('Grassy Terrain')) {
      this.terrain = 'Grassy';
    } else if (parts[2].includes('Electric Terrain')) {
      this.terrain = 'Electric';
    }
    // ... other terrains
  }

  // |-fieldend|move: Grassy Terrain
  if (line.includes('|-fieldend|')) {
    this.terrain = null;
  }
}
```

**1.2: Get Effective Priority**
```javascript
getEffectivePriority(move, pokemon) {
  let priority = move.priority || 0;

  // Terrain-based priority boosts
  if (move.name === 'Grassy Slide' && this.terrain === 'Grassy') {
    priority = 1;
  }

  // Ability-based priority (Prankster, etc.)
  // TODO: Track abilities and apply modifiers

  return priority;
}
```

**1.3: Determine Move Order with Priority**
```javascript
determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority) {
  // Trick Room reverses speed order (but NOT priority)
  const trickRoom = this.fieldConditions.trickRoom;

  // Higher priority always goes first
  if (ourPriority > oppPriority) return true;
  if (oppPriority > ourPriority) return false;

  // Same priority: speed determines order (reverse in Trick Room)
  if (trickRoom) {
    return ourSpeed <= oppSpeed; // Slower goes first in Trick Room
  } else {
    return ourSpeed >= oppSpeed; // Faster goes first normally
  }
}
```

### Phase 2: Coverage-Aware Move Selection 🎯 (HIGH PRIORITY)

**2.1: Evaluate Move Coverage Against Team**
```javascript
evaluateMoveCoverageVsTeam(move, oppTeam) {
  if (!oppTeam || oppTeam.length === 0) return 0;

  let coverageScore = 0;

  for (const oppPokemon of oppTeam) {
    if (!oppPokemon || !oppPokemon.species) continue;

    const species = this.dex.species.get(oppPokemon.species);
    if (!species) continue;

    const effectiveness = this.getTypeEffectiveness(move.type, species.types);

    if (effectiveness === 0) {
      // Immune - very bad (e.g., Grass move vs Gholdengo fails)
      coverageScore -= 3;
    } else if (effectiveness < 1) {
      // Resisted - bad
      coverageScore -= 1;
    } else if (effectiveness === 1) {
      // Neutral - okay
      coverageScore += 0;
    } else if (effectiveness >= 2) {
      // Super effective - good
      coverageScore += 2;
    }
  }

  return coverageScore;
}
```

**2.2: Update Move Ordering with Coverage**
```javascript
orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
  const moveScores = [];

  const ourSpeed = this.getSpeed(ourPokemon, this.ourBoosts);
  const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);

  for (const move of moves) {
    const moveData = this.dex.moves.get(move.id);
    const damage = this.calculateDamage(ourPokemon, oppPokemon, moveData, this.ourBoosts, this.opponentBoosts);

    // NEW: Get effective priority
    const ourPriority = this.getEffectivePriority(moveData, ourPokemon);
    const oppPriority = 0; // Assume opponent uses normal priority (worst case)

    // NEW: Determine who goes first (accounts for priority)
    const weGoFirst = this.determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority);

    // NEW: Check if we naturally outspeed (without needing priority)
    const naturallyFaster = ourSpeed >= oppSpeed;
    const needsPriorityToGoFirst = weGoFirst && !naturallyFaster && ourPriority > oppPriority;

    let orderScore = 0;

    if (damage >= oppHP) {
      // KO move
      if (weGoFirst) {
        orderScore = 200000 + damage;

        // NEW: Coverage bonus if we naturally outspeed (priority not needed)
        if (naturallyFaster && !needsPriorityToGoFirst) {
          // We outspeed naturally - opponent likely to switch
          // Evaluate coverage against opponent team
          const coverageBonus = this.evaluateMoveCoverageVsTeam(
            moveData,
            this.opponentTeam
          );

          // Scale coverage bonus (each point of coverage = +100 priority)
          // This can shift preference between moves with same KO power
          orderScore += coverageBonus * 100;
        }
      } else {
        orderScore = 100000 + damage; // Risky KO (we're slower)
      }
    } else if (damage > 0) {
      // Damaging move but not KO
      if (weGoFirst) {
        orderScore = 15000 + damage;
      } else {
        orderScore = 10000 + damage;
      }
    } else {
      // Status/utility move
      orderScore = moveData.basePower || 0;
    }

    moveScores.push({ move, score: orderScore, priority: ourPriority });
  }

  moveScores.sort((a, b) => b.score - a.score);
  return moveScores.map(ms => ms.move);
}
```

### Phase 3: Speed Confidence Reframe 🏃 (LOW PRIORITY)

**Optional: Make it clearer that gradient is about confidence**

```javascript
// In evaluatePosition, replace:
//   const speedDiff = Math.min(ourSpeed - oppSpeed, 100);
//   score += speedDiff * 0.2;
//
// With:

if (ourHP > 0 && oppHP > 0) {
  const ourSpeed = this.getSpeed(ourPokemon, ourBoosts);
  const oppSpeed = this.getSpeed(oppPokemon, oppBoosts);

  // Speed confidence: larger gap = more confident we're actually faster
  // (accounts for unknown EVs/IVs/nature)
  const speedGap = Math.abs(ourSpeed - oppSpeed);
  const speedConfidence = Math.min(speedGap / 100, 1.0); // 0 to 1

  if (ourSpeed > oppSpeed) {
    // We're faster - valuable for moving first
    score += 20 * speedConfidence; // Max +20

    // Extra bonus if faster + type advantage
    if (typeMatchup > 0) {
      score += 15; // Faster + SE = likely KO before opponent moves
    }
  } else if (oppSpeed > ourSpeed) {
    // Opponent is faster - risky at low HP
    score -= 15 * speedConfidence; // Max -15

    // Extra penalty if slower + type disadvantage
    if (typeMatchup < 0) {
      score -= 15; // Slower + weak = likely KO'd before we move
    }
  }
}
```

## Expected Impact

### Win Rate Improvement Estimate:
- **Current**: 83.3% (30 games)
- **After Priority + Coverage**: 85-88% (estimated +2-5%)

### What This Fixes:
1. ✅ Won't waste priority moves when unnecessary
2. ✅ Will choose coverage moves when opponent likely to switch
3. ✅ Will correctly evaluate Trick Room scenarios
4. ✅ More strategic move selection in complex situations

### What Still Needs Work:
- ⚠️ Ability tracking (Prankster, Gale Wings, etc.)
- ⚠️ Weather/terrain comprehensive tracking
- ⚠️ Item tracking (Choice Scarf for speed)

## Testing Plan

### Test 1: Priority Move Scenario
```javascript
// Setup:
// - Ogerpon-Hearthflame (Grassy Terrain active)
// - Opponent: Urshifu-Rapid-Strike at 10 HP
// - Opponent team: Gholdengo in back
// - Moves: Grassy Slide (+1 priority, Grass) vs Ivy Cudgel (normal, Fire)

// Expected: Should prefer Ivy Cudgel (better coverage for Gholdengo switch)
```

### Test 2: Priority Needed Scenario
```javascript
// Setup:
// - Our Pokemon slower than opponent
// - Have Aqua Jet (+1 priority) vs Earthquake (normal)
// - Both can KO

// Expected: Should prefer Aqua Jet (priority needed to go first)
```

### Test 3: 30-Game Benchmark
```javascript
// Compare:
// - Before: Current implementation (83.3%)
// - After: With priority + coverage
// - Goal: 85%+ win rate
```

## Next Steps

1. **Implement Priority Tracking** (Phase 1)
   - Add terrain tracking to processBattleMessage
   - Implement getEffectivePriority()
   - Implement determineMoveOrder()

2. **Implement Coverage Evaluation** (Phase 2)
   - Add evaluateMoveCoverageVsTeam()
   - Update orderMoves() with coverage bonus
   - Test with Ogerpon example

3. **Test and Benchmark**
   - Run 30-game test suite
   - Measure win rate improvement
   - Analyze remaining losses

4. **Optional Refinements** (Phase 3)
   - Reframe speed evaluation as confidence
   - Add ability tracking
   - Add item tracking (Choice Scarf)

Would you like me to implement Phase 1 and Phase 2 now?
