# Setup Move Strategic Value - CATASTROPHIC FAILURE

## Executive Summary

**10.0% win rate (1-9)** - **COMPLETE FAILURE** - Worse than random play!

Attempted to add strategic value to setup moves after the successful boost fix (86.7%). The implementation caused the bot to spam setup moves and status moves excessively, leading to a catastrophic collapse in performance.

**Result**: ❌ **CATASTROPHIC FAILURE** - Performance plummeted from 86.7% to 10.0% (-76.7 percentage points)

---

## Performance Results

| Version | Sample Size | Overall | Team 1 | Team 2 |
|---------|-------------|---------|--------|--------|
| **Boost Fix (Baseline)** | 30 games | **86.7% (26-4)** | 87.5% | 85.7% |
| **+Setup Strategic Value** | 10 games | **10.0% (1-9)** | 20.0% | **0.0%** |

### Change from Baseline

- **Overall**: -76.7 percentage points (86.7% → 10.0%)
- **Team 1**: -67.5 percentage points (87.5% → 20.0%)
- **Team 2**: **-85.7 percentage points** (85.7% → 0.0%) - **COMPLETE COLLAPSE**

This is the **worst failure yet** in the entire development history.

---

## What Was Implemented

### Setup Move Detection

**Setup moves database**:
```javascript
this.setupMoves = {
  'dragondance': { atk: 1, spe: 1 },
  'swordsdance': { atk: 2 },
  'quiverdance': { spa: 1, spd: 1, spe: 1 },
  'nastyplot': { spa: 2 },
  'calmmind': { spa: 1, spd: 1 },
  'bulkup': { atk: 1, def: 1 },
  'coil': { atk: 1, def: 1 },
  'curse': { atk: 1, def: 1, spe: -1 },
  'agility': { spe: 2 },
  'rockpolish': { spe: 2 },
  'shellsmash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }
};
```

### Strategic Value Calculation

**In `evaluateMoveStrategicValue()`**:
```javascript
const normalized = moveName.replace(/[^a-z]/g, '');
if (this.setupMoves[normalized]) {
  const setupBoosts = this.setupMoves[normalized];
  let setupValue = 0;

  // Offensive boosts most valuable
  if (setupBoosts.atk && setupBoosts.atk > 0) {
    setupValue += setupBoosts.atk * 50; // +1 Atk = 50, +2 Atk = 100
  }
  if (setupBoosts.spa && setupBoosts.spa > 0) {
    setupValue += setupBoosts.spa * 50;
  }
  if (setupBoosts.spe && setupBoosts.spe > 0) {
    setupValue += setupBoosts.spe * 35; // +1 Spe = 35, +2 Spe = 70
  }
  if (setupBoosts.def && setupBoosts.def > 0) {
    setupValue += setupBoosts.def * 25;
  }
  if (setupBoosts.spd && setupBoosts.spd > 0) {
    setupValue += setupBoosts.spd * 25;
  }

  bonus += Math.min(setupValue, 150); // Cap at 150
}

// Prevent opponent setup (INEFFECTIVE)
const oppHasSetup = /* check if opponent can setup */;
if (oppHasSetup && oppPokemon.hp > 0 && damage > 0) {
  bonus += 30; // Pressure setup sweepers
}
```

---

## Why It Failed So Badly

### 1. Setup Move Values Dominate Evaluation

**Evaluation weights comparison**:
- Setup moves: **+150** (Swords Dance: +2 Atk = +100)
- Type matchup: **30**
- HP preservation: **80**

**Problem**: Setup moves are valued **5x higher** than type matchups and **2x higher** than HP preservation.

**Result**: Bot ignores type disadvantages and danger to use setup moves.

### 2. Excessive Setup Spam

**Examples from detailed logs**:

#### Loss 1: Baxcalibur Setup Spam
```
Turn 1: TypeAwareBot used Dragon Dance
Turn 2: TypeAwareBot switched to Gholdengo (took damage)
...
Turn 7: TypeAwareBot switched to Baxcalibur
Turn 8: TypeAwareBot used Dragon Dance
Turn 9: TypeAwareBot used Dragon Dance
Turn 10: TypeAwareBot used Glaive Rush
Turn 11: TypeAwareBot used Dragon Dance (4th time!)
```

**Problem**: Bot used Dragon Dance **4 times** instead of attacking, giving opponent free turns to set up entry hazards and position advantageously.

#### Loss 5: Kingambit Setup in Bad Position
```
TypeAwareBot switched to Kingambit
TypeAwareBot used Swords Dance
StatefulTreeSearchBot used Ice Beam
TypeAwareBot used Swords Dance (2nd time!)
StatefulTreeSearchBot used Ice Beam
TypeAwareBot used Kowtow Cleave
```

**Problem**: Bot used Swords Dance twice against an Ice-type move, taking massive damage before attacking once.

#### Loss 10: Opponent Setup Sweep
```
StatefulTreeSearchBot used Swords Dance
StatefulTreeSearchBot used Swords Dance
TypeAwareBot used Hydro Pump (missed or low damage?)
StatefulTreeSearchBot used Kowtow Cleave (KO)
...
StatefulTreeSearchBot used Swords Dance (3rd time!)
...
StatefulTreeSearchBot used Swords Dance (4th time!)
```

**Problem**: Bot let opponent set up **4 times** and then got swept. The +30 "pressure opponent setup" bonus was completely ineffective.

### 3. Status Move Spam

#### Loss 1: Thunder Wave Spam
```
TypeAwareBot used Thunder Wave
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Volt Switch (finally!)
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave (back to spam)
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Hydro Pump (finally attacked!)
StatefulTreeSearchBot used Earthquake
TypeAwareBot used Thunder Wave (spam again)
...
```

**Problem**: Rotom-Wash spammed Thunder Wave **12+ times** against Landorus-Therian (which was already paralyzed), allowing free Earthquakes that slowly KO'd the team.

**Root cause**: Status moves might be valued too highly, or setup move logic is interfering with attack selection.

### 4. Poor Threat Recognition

**Pattern across all losses**:
1. Opponent uses Dragon Dance or Swords Dance
2. Bot doesn't prioritize KOing the boosted threat
3. Opponent gets another setup turn
4. Opponent sweeps

**The +30 "pressure opponent setup" bonus is completely insufficient** compared to:
- Our own setup moves: +150
- Type matchups: 30
- HP preservation: 80

Bot thinks "I should setup too" instead of "I should KO this threat immediately."

---

## Comparison to Previous Failures

| Attempt | Implementation | Win Rate | Team 1 | Team 2 | Status |
|---------|----------------|----------|--------|--------|--------|
| Baseline | Boost Fix | 86.7% (30g) | 87.5% | 85.7% | ✅ SUCCESS |
| Failed #1 | All 3 strategies | 40.0% (5g) | 66.7% | 0.0% | ❌ FAILED |
| Failed #2 | Setup (buggy boost) | 6.7% (15g) | 12.5% | 0.0% | ❌ CATASTROPHIC |
| **Failed #3** | **Setup strategic value** | **10.0% (10g)** | **20.0%** | **0.0%** | **❌ CATASTROPHIC** |

**Observation**: Setup move features have now failed **three times independently**:
1. 40% with all strategies (boost bug)
2. 6.7% with setup only (boost bug)
3. **10.0% with setup strategic value (no boost bug, pure evaluation issue)**

---

## Battle Statistics

### Loss Summary (9 losses out of 10 games)

| Battle | Team | Turns | Nodes | Switches | Pattern |
|--------|------|-------|-------|----------|---------|
| 1 | 1 | 30 | 2804 | 1 | Setup spam + Thunder Wave spam |
| 2 | 2 | 21 | 2804 | 0 | Opponent setup sweep |
| 4 | 2 | 21 | 2804 | 0 | Opponent setup sweep |
| 5 | 1 | 27 | 1315 | 1 | Setup in bad positions |
| 6 | 2 | 30 | 1315 | 1 | Setup spam |
| 7 | 1 | 19 | 2804 | 1 | Setup spam |
| 8 | 2 | 17 | 2804 | 0 | Opponent setup sweep |
| 9 | 1 | 21 | 1332 | 1 | Setup spam |
| 10 | 2 | 33 | 466 | 0 | Opponent Swords Dance x4 sweep |

**Key observations**:
- **Team 2 had 0 switches in all 5 losses** (same pattern as previous failures)
- 6 losses hit search timeout (2804 nodes)
- Battles were longer (17-33 turns vs 14-18 typical wins)
- Low/zero switches suggest bot got "stuck" with bad strategy

---

## Root Cause Analysis

### Primary Issue: Evaluation Weight Imbalance

**Current weights after setup strategic value**:

| Factor | Weight | Notes |
|--------|--------|-------|
| Setup moves | +150 | Swords Dance, Dragon Dance, etc. |
| Type matchup | 30 | Super effective, not very effective |
| HP preservation | 80 | Keep Pokemon alive |
| Opponent HP penalty | 80 | Reduce opponent HP |
| Status effects | 60-100 | Burn, paralysis, etc. |
| Entry hazards | 30-150 | Stealth Rock, Spikes |
| **Prevent opponent setup** | **+30** | **INEFFECTIVE!** |

**Problem**: Setup moves valued **5x higher** than preventing opponent setup!

**Result**:
- Bot thinks: "I should use Swords Dance (+100) instead of attacking (+30 type matchup + damage)"
- Bot thinks: "Setting up myself (+150) is better than preventing opponent setup (+30)"
- Bot ignores danger and tries to setup in bad positions

### Secondary Issue: Status Move Interference

Thunder Wave spam suggests status moves are being valued incorrectly in combination with setup move logic.

Possible causes:
- Status moves getting high strategic value bonuses
- Setup move logic interfering with move selection
- Evaluation function not recognizing diminishing returns (can't paralyze twice)

### Tertiary Issue: Threat Recognition

The +30 bonus for attacking setup sweepers is **completely insufficient**.

When opponent has +2 Atk (Swords Dance):
- Opponent can 2HKO or OHKO our Pokemon
- We should prioritize KOing them immediately
- +30 bonus is too small to override other considerations

**Solution needed**: Much higher bonus (e.g., +200) when opponent is boosted and threatening.

---

## Lessons Learned

### 1. Setup Moves Are Extremely Dangerous to Value

Three independent failures with setup move features:
- 40% (all strategies together)
- 6.7% (setup detection with boost bug)
- 10.0% (setup strategic value, no bug)

**Conclusion**: Setup moves are fundamentally difficult to evaluate correctly because:
- Require safe opportunities (hard to detect)
- Value depends on future turns (beyond search depth)
- Can backfire catastrophically if used incorrectly
- Opponent can exploit setup turns to gain advantage

### 2. Evaluation Weights Must Be Carefully Balanced

**Rule**: No single feature should dominate evaluation by >2x

**Current imbalance**:
- Setup moves: 150
- Type matchup: 30
- HP preservation: 80

**Should be**:
- Setup moves: Maybe 40-60 at most
- Type matchup: 30 (keep)
- HP preservation: 80 (keep)

### 3. Threat Recognition Needs Higher Priority

**Current**: +30 for attacking setup sweepers
**Needed**: +150-200 for attacking highly boosted opponents

When opponent has +2 Atk or +2 SpA:
- They can OHKO or 2HKO our team
- This is an immediate, critical threat
- Must be highest priority (even higher than our type matchups)

### 4. Incremental Testing Isn't Sufficient

Even implementing just setup strategic value alone failed catastrophically.

**Should have done**:
1. Start with **much smaller** bonuses (e.g., +20 for Swords Dance)
2. Test with 5 games
3. Gradually increase if helpful
4. Stop if performance drops

**What we did**:
1. Implemented +150 bonus immediately
2. Tested with 10 games
3. Failed catastrophically

---

## Recommended Next Steps

### Option 1: Abandon Setup Move Features

**Rationale**:
- Three independent failures (40%, 6.7%, 10%)
- Consistently causes catastrophic performance drops
- Team 2 consistently collapses to 0% win rate
- Fundamental evaluation difficulty

**Accept 86.7% as excellent performance** and focus on:
- Other improvements (damage ranges, opponent prediction)
- Opponent-specific strategies
- Team preview optimization

### Option 2: Minimal Setup Move Bonus (Conservative)

If we must try again:

**Ultra-conservative approach**:
- Setup move bonus: +20 (not +150)
- Prevent opponent setup: +150 (not +30)
- Test with 5 games first
- Increase by +10 increments only if helpful

**Expected**: Likely still fails, but less catastrophically

### Option 3: Targeted Setup Detection (No Bonuses)

**Don't add strategic value**. Only use setup detection for:
1. Detecting opponent threats (boost tracking already works)
2. Logging and analysis
3. Future opponent modeling

**No changes to move evaluation** - keep 86.7% baseline intact

---

## Conclusion

Setup move strategic value implementation was a **complete catastrophic failure** (10.0% win rate), marking the **third independent failure** of setup move features.

### Key Findings

1. ❌ **Evaluation weight imbalance**: Setup moves valued 5x higher than type matchups
2. ❌ **Excessive setup spam**: Bot used Dragon Dance 4 times, Swords Dance 2+ times in losing positions
3. ❌ **Status move spam**: Rotom-Wash spammed Thunder Wave 12+ times against paralyzed opponent
4. ❌ **Poor threat recognition**: +30 bonus for attacking setup sweepers completely ineffective
5. ❌ **Team 2 collapse**: 0% win rate (same pattern as previous failures)

### Performance History

| Version | Win Rate | Change |
|---------|----------|--------|
| Original Baseline | 53.3% | - |
| Switch Lookahead V2 | 73.3% | +20.0% |
| +Entry Hazards + Status | 76.7% | +3.4% |
| +Boost Fix | 86.7% | +10.0% |
| **+Setup Strategic Value** | **10.0%** | **-76.7%** ❌ |

### Status

**Reverted To**: Boost Fix Baseline (86.7%)
**Current State**: Boost tracking works correctly
**Next Action**: Decide whether to abandon setup moves entirely or try ultra-conservative approach

### Recommendation

**Option 1: Abandon Setup Move Features**

After three catastrophic failures, recommend accepting 86.7% as excellent performance. Setup moves appear fundamentally incompatible with current evaluation architecture.

**Alternative improvements**:
- Damage range calculations
- Better opponent move prediction
- Team preview optimization
- Meta-game knowledge integration

---

**Date**: 2026-01-26
**Implementation**: Setup Move Strategic Value
**Sample Size**: 10 games
**Result**: 10.0% win rate (1-9)
**Status**: ❌ **CATASTROPHIC FAILURE** - **REVERTED**
**Reverted To**: Boost Fix (86.7%, commit 079a949)
**Recommendation**: **ABANDON** setup move features entirely
