# Speed Control & Revenge Killing Analysis

## Implementation Summary

Added three new features to improve bot gameplay:

### 1. Speed Control Evaluation (in `evaluatePosition()`)

**Rationale**: Speed advantage determines who moves first, which is critical for:
- KOing before taking damage
- Controlling battle pace
- Enabling revenge kill strategies

**Implementation**:
```javascript
// Speed advantage bonus
if (ourSpeed > oppSpeed) {
  const speedDiff = Math.min(ourSpeed - oppSpeed, 100); // Cap at 100
  score += speedDiff * 0.2; // 0.2 per point (max +20)

  // Extra bonus if faster + super effective
  if (typeMatchup > 0) {
    score += 15; // Likely KO before opponent moves
  }
}

// Speed disadvantage penalty
else if (oppSpeed > ourSpeed) {
  const speedDiff = Math.min(oppSpeed - ourSpeed, 100);
  score -= speedDiff * 0.15; // 0.15 per point (max -15)

  // Extra penalty if slower + weak
  if (typeMatchup < 0) {
    score -= 15; // Likely KO'd before we move
  }
}
```

**Value range**: -35 to +35 points

### 2. Revenge Killing Detection (in `evaluateSwitchInSearch()`)

**Rationale**: Revenge killing is a key Pokemon strategy where you bring in a faster Pokemon that can KO the opponent, often after your current Pokemon faints.

**Implementation**:
```javascript
// Check if switch-in can outspeed and KO
const switchSpeed = this.getSpeed(switchTarget, resetBoosts);
const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);

if (switchSpeed > oppSpeed && newSwitchHP > 0 && oppHP > 0) {
  // Find max damage we can deal
  let maxOurDamage = 0;
  for (const moveName of switchMoves) {
    const moveData = this.dex.moves.get(moveName);
    if (moveData.basePower) {
      const damage = this.calculateDamageWithTypes(switchTarget, moveData, oppPokemon);
      maxOurDamage = Math.max(maxOurDamage, damage);
    }
  }

  // Bonus based on damage percentage
  if (maxOurDamage >= oppHP) {
    score += 150; // Guaranteed revenge kill
  } else if (maxOurDamage >= oppHP * 0.8) {
    score += 80; // Likely revenge kill (with damage rolls)
  } else if (maxOurDamage >= oppHP * 0.5) {
    score += 40; // Faster with strong hit
  }
}

// Reduced switch penalty if current Pokemon low HP
if (currentHP < 30) {
  switchPenalty = Math.floor(switchPenalty * 0.5);
}
```

**Value range**: +0 to +150 points for revenge kill opportunity

### 3. Speed-Aware Move Ordering (in `orderMoves()`)

**Rationale**: Alpha-beta pruning is more efficient when good moves are evaluated first. Moves that KO while faster should be highest priority.

**Implementation**:
```javascript
const ourSpeed = this.getSpeed(ourPokemon, this.ourBoosts);
const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);
const weFaster = ourSpeed > oppSpeed;

if (damage >= oppHP) {
  // KO move
  if (weFaster) {
    orderScore = 200000 + damage; // Guaranteed KO before opponent moves
  } else {
    orderScore = 100000 + damage; // Can KO but might get hit first
  }
} else if (damage > 0) {
  if (weFaster) {
    orderScore = 15000 + damage; // Chip damage before opponent acts
  } else {
    orderScore = 10000 + damage; // Less valuable if slower
  }
}
```

**Ordering priorities**:
1. Faster + KO: 200k
2. Slower + KO: 100k
3. Faster + damage: 15k
4. Slower + damage: 10k
5. Status moves: base power

---

## Test Results (10 Games)

### Overall Performance
- **Win rate**: 80% (8-2)
- **Change from baseline** (86.7%): -6.7 percentage points
- **Change from previous** (73.3%): +6.7 percentage points

### Performance by Team
| Team | Wins | Win Rate | Baseline | Change |
|------|------|----------|----------|--------|
| Team 1 (Offensive) | 5/5 | 100.0% | 87.5% | +12.5% |
| Team 2 (Defensive) | 3/5 | 60.0% | 85.7% | -25.7% |

### Key Observations

**Team 1 (Offensive) - Perfect Performance**:
- Won all 5 games (100%)
- +12.5% improvement over baseline
- Speed control helps offensive teams:
  - Fast attackers (Baxcalibur, Iron Valiant) get rewarded
  - Can KO before taking damage
  - Better move ordering finds KO moves faster

**Team 2 (Defensive) - Underperformed**:
- Won only 3/5 games (60%)
- -25.7% below baseline
- Lost 2 games (both timeouts or strategic errors)
- Speed control may hurt defensive teams:
  - Defensive Pokemon tend to be slower
  - Takes penalties for being outsped
  - Revenge killing bonus favors offensive switches

---

## Loss Analysis

### Loss 1: Battle 2 (Team 2)

**Stats**:
- Turns: 30 (long game)
- Nodes evaluated: 39 (very low - early strategic error)
- Switches: 0 (no switches made)

**Pattern**: Very low node count suggests an early bad decision that led to a losing position. The bot may have made a strategic error in the opening turns and couldn't recover.

**Possible causes**:
1. **Speed penalty bias**: Slower defensive Pokemon got penalized, making them look worse than they are
2. **No switches**: Failed to switch when needed (possibly due to speed penalties)
3. **Early error cascade**: One bad move early led to unrecoverable position

### Loss 2: Battle 6 (Team 2)

**Stats**:
- Turns: 20 (moderate)
- Nodes evaluated: 2890 (search timeout)
- Switches: 1

**Pattern**: Hit the search node limit, indicating a complex position with many branching factors.

**Possible causes**:
1. **Complex defensive position**: Defensive teams create more decision branches
2. **Speed calculations**: Added speed evaluation may slow down search
3. **Revenge kill checks**: Extra calculations in switch evaluation

---

## Root Cause Analysis

### Why Team 1 Excels (+12.5%)

1. **Fast offensive Pokemon** (Baxcalibur, Iron Valiant, Kingambit):
   - Naturally faster → get speed bonuses
   - Speed boosts (Dragon Dance, Agility) → compound bonuses
   - Speed control evaluation aligns with offensive play

2. **Move ordering improvement**:
   - "Faster + KO" ordering finds winning moves first
   - Better alpha-beta pruning efficiency
   - Faster search = less timeouts

3. **Revenge killing opportunities**:
   - Offensive Pokemon can revenge kill more easily
   - Fast Choice Scarf users benefit
   - Switch penalties reduced when making offensive switches

### Why Team 2 Struggles (-25.7%)

1. **Slower defensive Pokemon** (Hatterene, Magnezone, Slowking):
   - Naturally slower → take speed penalties
   - Speed penalties accumulate at terminal evaluation
   - Makes defensive Pokemon look worse than they are

2. **Defensive strategy undervalued**:
   - Tanking hits and healing not rewarded for speed
   - Regenerator switching penalized for being slow
   - Iron Defense boosts don't help speed

3. **Search complexity**:
   - More switch options → more revenge kill checks
   - Defensive positions create more branches
   - Speed calculations add overhead → more timeouts

### Specific Problem: Speed Penalty Bias

**The issue**:
```javascript
// In evaluatePosition()
if (oppSpeed > ourSpeed) {
  score -= speedDiff * 0.15; // Penalty for being slower

  if (typeMatchup < 0) {
    score -= 15; // Extra penalty if weak
  }
}
```

**Why this hurts defensive teams**:
- Defensive Pokemon (Slowking, Magnezone) are naturally slow by design
- They're meant to tank hits and heal, not outspeed
- Speed penalty makes them look bad even when they're playing correctly
- Accumulates across multiple turns in minimax

**Example**:
- Slowking (base 30 Speed) vs opponent Dragapult (base 142 Speed)
- Speed difference: ~112
- Penalty: 112 * 0.15 = **-16.8 points**
- Even if Slowking has type advantage and full HP, it gets penalized for being slow

---

## Recommendations

### Option A: Remove or Reduce Speed Penalties

**Change**:
```javascript
// Reduce speed penalty for defensive teams
if (oppSpeed > ourSpeed) {
  const speedDiff = Math.min(oppSpeed - ourSpeed, 100);
  score -= speedDiff * 0.05; // Reduced from 0.15 to 0.05

  // Only apply extra penalty if BOTH slow AND weak
  if (typeMatchup < -1) { // Changed from < 0 to < -1
    score -= 10; // Reduced from 15 to 10
  }
}
```

**Expected**: +10-15% for Team 2

**Risk**: May undervalue speed control

### Option B: Context-Aware Speed Evaluation

**Change**: Only apply speed bonuses/penalties when it matters (low HP situations).

```javascript
// Only evaluate speed when HP is low (KO range)
if (ourHP < 50 || oppHP < 50) {
  // Speed matters more when KO is possible
  if (ourSpeed > oppSpeed) {
    score += speedDiff * 0.3; // Increased weight when it matters
  } else {
    score -= speedDiff * 0.2;
  }
}
```

**Expected**: +5-10% for Team 2, maintains Team 1 performance

**Risk**: May miss speed advantages in early game

### Option C: Asymmetric Speed Weighting

**Change**: Reward speed advantage more than penalize speed disadvantage.

```javascript
if (ourSpeed > oppSpeed) {
  score += speedDiff * 0.25; // Keep bonus
} else {
  score -= speedDiff * 0.05; // Reduce penalty (from 0.15)
}
```

**Expected**: +15% for Team 2, maintains Team 1 at 100%

**Risk**: May slightly overvalue speed

### Option D: Remove Speed Evaluation, Keep Move Ordering

**Change**: Remove speed from `evaluatePosition()`, keep only move ordering improvements.

**Rationale**:
- Move ordering helps both teams (better pruning)
- Revenge killing helps both teams (offensive and defensive switches)
- Speed evaluation may be causing the bias

**Expected**: Team 1: 90%, Team 2: 80% (both improve slightly)

**Risk**: Loses some speed control awareness

---

## Next Steps

1. **Implement Option D** (safest): Remove speed evaluation from terminal, keep move ordering
2. **Test 10 more games** and compare results
3. **If Team 2 still underperforms**: Try Option C (asymmetric weighting)
4. **If both teams improve**: Keep and move to team coverage analysis

---

## Code Changes Summary

**Files modified**:
- `src/TypeAwareBot.js`:
  - Added speed control evaluation in `evaluatePosition()` (lines ~1243-1280)
  - Added revenge killing detection in `evaluateSwitchInSearch()` (lines ~680-720)
  - Enhanced move ordering in `orderMoves()` (lines ~832-872)
- `examples/switch-lookahead-test.js`:
  - Updated test description to reflect speed control features

**Performance Impact**:
- Overall: 80% (vs 73.3% previous, 86.7% baseline)
- Team 1: 100% (+12.5% vs baseline)
- Team 2: 60% (-25.7% vs baseline)
- **Conclusion**: Speed control helps offensive teams significantly but hurts defensive teams

---

**Date**: 2026-01-27
**Test**: 10 games (5 per team)
**Status**: ⚠️ Team 2 underperforms, needs adjustment
**Recommendation**: Try Option D (remove terminal speed eval, keep move ordering)
