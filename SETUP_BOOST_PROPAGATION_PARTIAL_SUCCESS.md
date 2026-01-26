# Setup Move Boost Propagation - Partial Success

## Executive Summary

**73.3% win rate (22-8 in 30 games)** - **FIRST NON-CATASTROPHIC IMPLEMENTATION**

After four previous catastrophic failures (40%, 10%, 20%, 0%), this implementation finally achieves a respectable win rate by fixing the boost timing bug. However, it still underperforms the 86.7% baseline.

**Result**: ⚠️ **PARTIAL SUCCESS** - Technically correct but underperforms baseline

---

## Performance Results

| Version | Win Rate | Change from Baseline |
|---------|----------|---------------------|
| Boost Fix Baseline | 86.7% (26-4) | - |
| **Setup Boost Propagation** | **73.3% (22-8)** | **-13.4%** |

### By Team

- **Team 1**: 73.3% (11/15) - Down from 87.5% (-14.2%)
- **Team 2**: 73.3% (11/15) - Down from 85.7% (-12.4%)

### Comparison to Previous Failures

| Attempt | Approach | Win Rate | Status |
|---------|----------|----------|--------|
| Baseline | Boost fix only | 86.7% | ✅ Best |
| Failure #1 | Flat +150 bonus | 10.0% | ❌ Catastrophic |
| Failure #2 | Damage-based (no propagation) | 20.0% | ❌ Catastrophic |
| Failure #3 | Wrong boost timing | 0.0% | ❌ Total failure |
| **Current** | **Correct boost timing** | **73.3%** | ⚠️ **Partial success** |

**Key achievement**: First setup move implementation that doesn't catastrophically fail!

---

## What Was Implemented

### Correct Boost Timing

The critical fix was applying boosts at the right time in minimax:

```javascript
// Step 1: Simulate current turn with CURRENT boosts
const [newOurHP, newOppHP] = this.simulateExchange(
  ourPokemon, ourHP, moveData,
  oppPokemon, oppHP, oppMoveData,
  ourBoosts, oppBoosts  // Current turn uses current boosts
);

// Step 2: Apply boost changes for NEXT turn
let newOurBoosts = ourBoosts;
let newOppBoosts = oppBoosts;

const ourMoveNormalized = moveData.name.toLowerCase().replace(/[^a-z]/g, '');
if (this.setupMoves[ourMoveNormalized]) {
  newOurBoosts = this.applyBoostChanges(ourBoosts, this.setupMoves[ourMoveNormalized]);
}

const oppMoveNormalized = oppMoveData.name.toLowerCase().replace(/[^a-z]/g, '');
if (this.setupMoves[oppMoveNormalized]) {
  newOppBoosts = this.applyBoostChanges(oppBoosts, this.setupMoves[oppMoveNormalized]);
}

// Step 3: Recursive call with UPDATED boosts (for next turn)
const score = this.minimaxDepth(
  ourPokemon, newOurHP,
  oppPokemon, newOppHP,
  ourMoves, oppMoves,
  moveData, oppMoveData,
  depth + 1, alpha, beta, false,
  newOurBoosts, newOppBoosts  // Next turn uses updated boosts
);
```

### Boost Application with Capping

Added proper boost capping at ±6:

```javascript
applyBoostChanges(currentBoosts, boostChanges) {
  const newBoosts = { ...currentBoosts };

  if (boostChanges.atk) {
    newBoosts.atk = Math.max(-6, Math.min(6, (newBoosts.atk || 0) + boostChanges.atk));
  }
  // ... same for def, spa, spd, spe

  return newBoosts;
}
```

### Setup Moves Database

Expanded to include stat-lowering moves:

```javascript
this.setupMoves = {
  // Stat-boosting moves
  'dragondance': { atk: 1, spe: 1 },
  'swordsdance': { atk: 2 },
  'nastyplot': { spa: 2 },
  // ... etc

  // Stat-lowering moves
  'dracometeor': { spa: -2 },
  'overheat': { spa: -2 },
  'closecombat': { def: -1, spd: -1 },
  'makeitrain': { spa: -1 },
  // ... etc
};
```

### No Artificial Bonuses

Unlike previous attempts, this implementation uses **pure minimax search** with no artificial strategic bonuses. The search naturally discovers when setup is valuable through simulation.

---

## Why It Works (Compared to Previous Failures)

### Fixed: Boost Timing Bug

**Previous (wrong):**
```javascript
// Applied boosts immediately
if (this.setupMoves[normalized]) {
  newBoosts = applyBoosts(...);
}
const [hp1, hp2] = simulateExchange(...); // Uses old boosts (CORRECT)
const score = minimax(..., newBoosts); // Uses new boosts for SAME turn (WRONG!)
```

**Current (correct):**
```javascript
const [hp1, hp2] = simulateExchange(...); // Current turn with current boosts
if (this.setupMoves[normalized]) {
  newBoosts = applyBoosts(...); // Apply for NEXT turn
}
const score = minimax(..., newBoosts); // Next turn with updated boosts (CORRECT!)
```

### Fixed: Search Stability

- No more node count collapses (was 27-41 nodes, now 5-2890)
- Search completes normally in all games
- No stack overflows or infinite loops

### Fixed: Natural Evaluation

- Minimax discovers setup value through simulation
- No conflicts between root bonuses and search scores
- Consistent evaluation throughout search tree

---

## Why It Still Underperforms Baseline

Despite fixing the technical bugs, performance degraded from 86.7% to 73.3%. Possible reasons:

### 1. Search Depth Limitation

**4-ply search may be insufficient for setup moves:**

Ideal setup sequence:
- Turn 1: Swords Dance (0 damage, +2 Atk)
- Turn 2: Attack with +2 Atk boost
- Turn 3: Attack with +2 Atk boost
- Turn 4: Attack with +2 Atk boost

**Problem**: 4-ply search only sees:
- Ply 1: Our Swords Dance vs opponent's move
- Ply 2: Opponent's move vs our attack
- Ply 3: Our attack vs opponent's move
- Ply 4: Opponent's move vs our attack

The search only sees **2 boosted attacks** in the lookahead. User's math assumed 2.5-3 attacks on average, which requires deeper search or better terminal evaluation.

### 2. Opponent Also Has Setup Moves

When both players can use setup moves, the evaluation becomes exponentially more complex:

- If we Swords Dance and opponent Swords Dances → both get +2 Atk
- If we Swords Dance and opponent attacks → we take damage while setting up
- If we attack and opponent Swords Dances → we get damage but opponent sets up

The minimax must evaluate all these possibilities, and 4 plies might not be deep enough to determine the optimal setup timing.

### 3. No Heuristic Guidance

Pure minimax evaluation means setup moves are only valued by what the search tree discovers. Without any heuristic guidance:

- Setup might look bad in positions where it's actually good (requires deeper search)
- Bot might miss optimal setup opportunities
- Opponent's superior search depth (StatefulTreeSearchBot) might capitalize on our setup turns

### 4. Loss Analysis

**8 losses breakdown:**
- 4 losses hit search timeout (2890 nodes) - genuinely complex positions
- Battle 7: 503 nodes, 31 turns - longer than typical
- Battle 17: 847 nodes, 21 turns - moderate complexity
- Battle 18: 159 nodes, 31 turns - long game, low search
- Battle 23: **29 nodes**, 24 turns - **very low search**, likely early bad decision

The low node count losses suggest the bot made bad decisions early that led to losing positions, possibly due to incorrect setup valuation.

---

## Battle Statistics

### Losses (8 total)

| Battle | Team | Turns | Nodes | Switches | Pattern |
|--------|------|-------|-------|----------|---------|
| 1 | 1 | 17 | 2890 | 1 | Search timeout |
| 6 | 2 | 20 | 2890 | 1 | Search timeout |
| 7 | 1 | 31 | 503 | 1 | Long game |
| 12 | 2 | 22 | 2890 | 0 | Search timeout |
| 17 | 1 | 21 | 847 | 1 | Moderate |
| 18 | 2 | 31 | 159 | 0 | Long game, low search |
| 23 | 1 | 24 | 29 | 1 | **Very low search** |
| 30 | 2 | 17 | 2890 | 0 | Search timeout |

**Key observations:**
- 4/8 losses hit search timeout (complex positions)
- 3/8 losses were long games (24-31 turns)
- 1/8 loss had very low search (29 nodes) - concerning
- Average loss length: 23 turns (vs 14-18 typical wins)

### Node Count Distribution

- Average nodes: 448 (vs baseline ~1000-2000)
- Wins: typically 5-159 nodes
- Losses: 29-2890 nodes (bimodal)

**Lower average node count** suggests:
- Either search is more efficient (finding good moves quickly)
- Or search is terminating early in some positions

---

## Technical Correctness

### ✅ Boost Timing: CORRECT

Boosts now apply at the right time:
1. Current turn simulated with current boosts
2. Setup move boost changes detected
3. Recursive call uses updated boosts for future turns

This matches Pokemon mechanics perfectly.

### ✅ Boost Capping: CORRECT

All boosts capped at ±6 per Pokemon rules:
```javascript
Math.max(-6, Math.min(6, (boost || 0) + change))
```

### ✅ Search Stability: CORRECT

No more catastrophic search collapses:
- All games complete normally
- Node counts reasonable (5-2890)
- No stack overflows

### ✅ Stat-Lowering Moves: INCLUDED

Moves like Draco Meteor (-2 SpA) and Close Combat (-1 Def/SpD) properly tracked.

---

## Comparison to User's Mathematical Framework

### User's Insight

**Swords Dance Example:**
- Attack 3x: 1 + 1 + 1 = 3x damage
- Setup then attack 2x: 0 + 2 + 2 = 4x damage
- Net gain: +1x damage

**Make It Rain Example (stat drops):**
- Attack 3x with drops: 1.0 + 0.67 + 0.5 = 2.17x damage
- Nasty Plot then attack 2x: 0 + 2.0 + 1.5 = 3.5x damage (opponent also attacks with -1 SpA)
- Net gain: +1.33x damage

### Why Implementation Differs

The user's math assumes:
1. **Guaranteed survival** for 3 turns
2. **No opponent disruption** (they don't KO, switch, or setup themselves)
3. **Simple damage accumulation** model

The minimax implementation accounts for:
1. **Opponent can KO us** during setup turn (we take damage with no return)
2. **Opponent can setup too** (mutual setup → unclear advantage)
3. **Switching resets boosts** (boost value depends on staying in)
4. **Complex multi-turn interactions** that are hard to model mathematically

**Conclusion**: User's math is correct for ideal scenarios, but Pokemon battles have many complications that make setup moves harder to evaluate correctly.

---

## Potential Improvements

### Option 1: Add Conservative Heuristic Bonus

Add small bonus (+20-30) for setup moves to guide search:

```javascript
// In evaluateMoveStrategicValue:
if (this.setupMoves[normalized]) {
  const boostValue = calculateOffensiveBoostValue(this.setupMoves[normalized]);
  bonus += Math.min(boostValue * 10, 30); // +1 Atk = +10, +2 Atk = +20, cap at +30
}
```

**Expected**: +3-5% win rate improvement

### Option 2: Increase Search Depth

Increase from 4 to 5 plies:

```javascript
this.searchDepth = 5; // Was 4
```

**Pros**: Better evaluation of setup sequences
**Cons**: May timeout more often
**Expected**: +5-10% win rate, but more timeouts

### Option 3: Quiescence Search for Setup

Extend search when setup moves used:

```javascript
if (depth >= this.searchDepth && noSetupMovesUsed) {
  return this.evaluatePosition(...);
} else if (setupMoveUsed) {
  // Continue search 1-2 more plies to see boosted attacks
  depth += 1;
}
```

**Expected**: +3-7% win rate

### Option 4: Accept 73.3% as Reasonable

Setup moves are inherently complex. 73.3% is:
- Much better than random (50%)
- Much better than catastrophic failures (0-20%)
- Slightly worse than baseline without setup (86.7%)

**Trade-off**: Technically correct implementation vs raw performance

---

## Recommendations

### Option A: Add Small Heuristic (+20 Bonus)

Most promising approach:
1. Keep current boost propagation (technically correct)
2. Add small heuristic bonus (+20 for setup moves)
3. Test with 10 games
4. If improved, validate with 30 games

**Expected result**: 80-85% win rate

### Option B: Increase Search Depth

Try 5 plies instead of 4:
1. Change searchDepth to 5
2. Test with 10 games
3. Monitor timeout rate

**Expected result**: 85-90% win rate, but may timeout

### Option C: Revert to Baseline

If further improvements don't help:
1. Document this as technically correct but impractical
2. Revert to 86.7% baseline
3. Focus on other improvements

**Reasoning**: 86.7% baseline is already excellent

---

## Lessons Learned

### Success: Fixing Boost Timing

The user was correct - the boost timing bug was the critical issue. Applying boosts AFTER current turn simulation but BEFORE recursive call fixed the catastrophic failures.

**Progression:**
- Wrong timing: 0% win rate
- Correct timing: 73.3% win rate

**73.3 percentage point improvement just from correct timing!**

### Challenge: Search Depth Limitations

Even with correct boost timing, 4-ply search may be insufficient for proper setup evaluation. The bot can see setup moves working, but might not see them working *well enough* to overcome the immediate loss of tempo.

### Challenge: Dual Setup Complexity

When both players have setup options, the evaluation space explodes. The bot must consider:
- We setup, they attack
- We setup, they setup
- We attack, they setup
- We attack, they attack

And evaluate all of these 3-4 turns into the future. This is computationally intensive.

### Insight: Pure Search May Be Insufficient

Unlike material (HP) or type matchups, setup moves require deeper search or heuristic guidance to value correctly. Pure minimax discovers their value, but may not discover it *strongly enough* to use them optimally.

---

## Conclusion

This implementation represents a **major breakthrough** - the first setup move feature that doesn't catastrophically fail. The boost timing fix was critical and correct.

However, **performance still underperforms the baseline** (73.3% vs 86.7%). Setup moves are inherently difficult to evaluate with limited search depth.

### Status

✅ **Technically Correct** - Boost timing is perfect
⚠️ **Performance Degraded** - 13.4% below baseline
🎯 **Partial Success** - First non-catastrophic setup implementation

### Next Steps

1. Try adding small heuristic bonus (+20)
2. If that doesn't help, try 5-ply search
3. If still underperforms, revert to 86.7% baseline

### Final Recommendation

**Continue with Option A (small heuristic)** - combine technically correct boost propagation with gentle heuristic guidance. This should get best of both worlds: correct simulation + appropriate valuation.

---

**Date**: 2026-01-26
**Implementation**: Setup Move Boost Propagation (Correct Timing)
**Sample Size**: 30 games
**Result**: 73.3% win rate (22-8)
**Status**: ⚠️ **PARTIAL SUCCESS** - First non-catastrophic implementation
**Change from Baseline**: -13.4 percentage points
**Recommendation**: Try adding small conservative heuristic (+20 bonus)
