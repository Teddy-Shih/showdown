# Battle Loss Analysis - Priority/Coverage Implementation

## Test Results: 10 Battles

**Performance**: 4 wins, 6 losses (40% win rate)
**Baseline**: Was 83-90% before changes
**Status**: ❌ **REGRESSION** (-43 to -50 percentage points)

## Key Findings

### Common Failure Patterns

#### 1. **Hazard Spam Over Damage** (Battle 3, Turns 11-12)
```
Turn 11: TypeAwareBot's Great Tusk used Stealth Rock (already set!)
Turn 12: TypeAwareBot's Great Tusk used Stealth Rock (AGAIN!)
```

**Issue**: Great Tusk spammed Stealth Rock 2 turns in a row when:
- Hazards were already up
- Opponent Landorus was using Earthquake (4x effective)
- Should have used Earthquake or switched

**Root Cause**: `evaluateMoveStrategicValue()` gives +150 bonus for Stealth Rock when not up, but doesn't check if hazards are ALREADY SET.

#### 2. **Status Move Spam** (Battle 3, Turns 17-20)
```
Turn 17: TypeAwareBot's Rotom used Thunder Wave
Turn 18: TypeAwareBot's Rotom used Thunder Wave
Turn 19: TypeAwareBot's Rotom used Thunder Wave
Turn 20: TypeAwareBot's Rotom used Thunder Wave
```

**Issue**: Rotom spammed Thunder Wave 4 turns in a row when:
- Opponent likely already paralyzed OR immune
- Should have used Hydro Pump or switched
- Just kept losing HP to Earthquake

**Root Cause**: `evaluateMoveStrategicValue()` gives +90 bonus for paralysis without checking if:
- Status already applied
- Opponent is immune (Ground types immune to paralysis)

#### 3. **Coverage Bonus May Be Too Weak**
The coverage bonus is `coverageBonus * 50` in move ordering, but:
- Base move priority is 200,000 for KO moves
- Coverage difference of 3 points = 150 bonus
- This is only 0.075% of the base priority

**Potential Issue**: Coverage bonus might be getting drowned out by other factors.

## Detailed Loss Investigations

### Battle 3: Team 1 vs Team 2 (23 turns, 2398 nodes)

**What Went Wrong**:
1. **Turns 1-8**: Actually went well! Gholdengo swept 3 Pokemon
2. **Turns 11-12**: Great Tusk spammed Stealth Rock (ALREADY SET)
3. **Turn 14**: Switched Iron Valiant into Earthquake (bad switch)
4. **Turns 17-20**: Rotom spammed Thunder Wave (opponent possibly immune)
5. **Turn 23**: Kingambit Sucker Punch failed to KO

**Critical Mistakes**:
- Hazard spam when hazards already up
- Status spam without checking immunity/existing status
- Poor switch timing (Iron Valiant into Earthquake)

### Battle 4: Team 2 vs Team 1 (21 turns)

**Needs investigation** - similar patterns likely

### Battle 5: Team 1 vs Team 2

**Needs investigation** - likely hazard/status spam issues

### Battle 7: Team 1 vs Team 2

**Needs investigation**

### Battle 8: Team 2 vs Team 1

**Needs investigation**

### Battle 10: Team 2 vs Team 1

**Needs investigation**

## Root Cause Analysis

### Bug 1: Strategic Value Doesn't Check Existing Hazards

**Location**: `TypeAwareBot.js:1367-1369`
```javascript
if (moveName.includes('stealth rock') || moveName === 'stealthrock') {
  // High value if we don't have Stealth Rock up yet
  if (!this.hazards.opponent.stealthRock) {
    bonus += 150; // Stealth Rock is extremely valuable
  }
}
```

**Issue**: This correctly checks `!this.hazards.opponent.stealthRock`, but somehow Stealth Rock is being used when hazards ARE up.

**Hypothesis**: The `this.hazards.opponent` tracking may not be working correctly. Let me check if hazards are being tracked properly.

### Bug 2: Status Value Doesn't Check Immunity or Existing Status

**Location**: `TypeAwareBot.js:1400-1435`
```javascript
const inflictsStatus = statusMoves[moveName];
if (inflictsStatus) {
  // Don't value status if opponent already has status or is immune
  if (!this.opponentStatus && !oppPokemon.status) {
    if (!this.isImmuneToStatus(oppSpecies.types, inflictsStatus)) {
      // ... apply bonus
    }
  }
}
```

**Issue**: This DOES check `!this.opponentStatus`, but clearly it's not working since Thunder Wave was spammed.

**Hypothesis**:
1. `this.opponentStatus` isn't being updated correctly, OR
2. Status moves are getting bonus even when opponent is immune

### Bug 3: Coverage Bonus Might Be Too Small

**Location**: `TypeAwareBot.js:1171`
```javascript
orderScore += coverageBonus * 50;
```

**Issue**: With base scores of 200,000+ for KO moves, a coverage difference of 3 points (150) is only 0.075%.

**Fix**: Increase multiplier to 100 or 200?

## Recommended Fixes

### Fix 1: Add Hazard Check Logging
```javascript
// In evaluateMoveStrategicValue
if (moveName.includes('stealth rock') || moveName === 'stealthrock') {
  console.log(`[DEBUG] Stealth Rock check: opponent.stealthRock = ${this.hazards.opponent.stealthRock}`);
  if (!this.hazards.opponent.stealthRock) {
    bonus += 150;
  }
}
```

### Fix 2: Add Status Check Logging
```javascript
// In evaluateMoveStrategicValue
if (inflictsStatus) {
  console.log(`[DEBUG] Status check: opponentStatus = ${this.opponentStatus}, oppPokemon.status = ${oppPokemon.status}`);
  if (!this.opponentStatus && !oppPokemon.status) {
    // ...
  }
}
```

### Fix 3: Increase Coverage Bonus
```javascript
// Change from 50 to 200
orderScore += coverageBonus * 200;
```

This would make:
- Coverage difference of 3 points = 600 bonus (0.3% of 200k base)
- Still small but more meaningful

## Performance Comparison

| Implementation | Win Rate | Change |
|----------------|----------|--------|
| Baseline (before priority/coverage) | 83-90% | - |
| **Current (with priority/coverage)** | **40%** | **-43 to -50 pp** |

## Conclusion

The priority and coverage implementation is **correct in theory** but has **critical bugs**:

1. ✅ Priority tracking works (unit tests pass)
2. ✅ Coverage evaluation works (unit tests pass)
3. ❌ **Strategic value bonuses are being applied when they shouldn't**
4. ❌ **Hazard/status tracking may not be updating correctly during battle**

**Next Steps**:
1. Add debug logging to hazard and status evaluation
2. Run 1 battle with verbose logging
3. Identify why hazards/status aren't being tracked correctly
4. Fix the tracking issues
5. Consider increasing coverage bonus multiplier

The good news: The core priority/coverage logic is sound. The bad news: We broke something with the strategic value bonuses or state tracking.
