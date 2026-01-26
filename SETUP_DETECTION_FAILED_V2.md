# Setup Move Detection - SECOND FAILURE (Incremental Attempt)

## Executive Summary

**6.7% win rate (1-14)** - **CATASTROPHIC failure** - Even worse than first attempt!

After documenting the failure of implementing all 3 strategies together (40% win rate), attempted to implement **Setup Move Detection alone** using an incremental approach.

**Result**: ❌ **COMPLETE FAILURE** - Performance plummeted from 76.7% to 6.7% (-70 percentage points)

---

## Performance Results

| Version | Sample Size | Overall | Team 1 | Team 2 |
|---------|-------------|---------|--------|--------|
| **Entry Hazards + Status** | 30 games | **76.7% (23-7)** | 73.3% | 80.0% |
| **+Setup Detection (Incremental)** | 15 games | **6.7% (1-14)** | 12.5% | **0.0%** |

### Change from Baseline

- **Overall**: -70.0 percentage points (76.7% → 6.7%)
- **Team 1**: -60.8 percentage points (73.3% → 12.5%)
- **Team 2**: **-80.0 percentage points** (80.0% → 0.0%) - **COMPLETE COLLAPSE**

---

## What Was Implemented

### Stat Boost Tracking

**Variables added**:
```javascript
this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
```

**Setup moves database**:
```javascript
this.setupMoves = {
  'dragondance': { atk: 1, spe: 1 },
  'swordsdance': { atk: 2 },
  'quiverdance': { spa: 1, spd: 1, spe: 1 },
  'nastyplot': { spa: 2 },
  // ... 8 more moves
};
```

### Battle Message Processing

**processBoost** function:
```javascript
processBoost(line) {
  // Parse |-boost| and |-unboost| messages
  // Track stat changes for both players
  // Clamp to -6 to +6 range
}
```

**Modified processSwitch**:
```javascript
processSwitch(line) {
  // Reset boosts on switch for both players
  if (this.isOpponent(playerSlot)) {
    this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  } else {
    this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  }
  // ... rest of switch processing
}
```

### Stat Modifications

**getBoostMultiplier**:
```javascript
getBoostMultiplier(boost) {
  if (boost >= 0) {
    return (2 + boost) / 2;  // +1 = 1.5x, +2 = 2x, +6 = 4x
  } else {
    return 2 / (2 - boost);  // -1 = 0.67x, -2 = 0.5x, -6 = 0.25x
  }
}
```

**Modified calculateDamage**:
```javascript
// Apply stat boosts to attack and defense
const attackBoost = move.category === 'Physical' ? attackerBoosts.atk : attackerBoosts.spa;
if (attackBoost) {
  attackStat = Math.floor(attackStat * this.getBoostMultiplier(attackBoost));
}
```

**Modified getSpeed**:
```javascript
// Apply speed boosts
if (boosts && boosts.spe) {
  speed = Math.floor(speed * this.getBoostMultiplier(boosts.spe));
}
```

### Evaluation Changes

**Position evaluation**:
```javascript
// Our stat boosts are valuable
score += this.ourBoosts.atk * 40;
score += this.ourBoosts.spa * 40;
score += this.ourBoosts.spe * 30;
score += this.ourBoosts.def * 25;
score += this.ourBoosts.spd * 25;

// Opponent stat boosts are bad
score -= this.opponentBoosts.atk * 40;
// ... (mirrored)
```

**Move strategic value**:
```javascript
// Setup move detection
if (this.setupMoves[normalized]) {
  let setupValue = 0;
  setupValue += setupBoosts.atk * 60;
  setupValue += setupBoosts.spa * 60;
  setupValue += setupBoosts.spe * 45;
  // ... capped at 180
  bonus += Math.min(setupValue, 180);
}

// Prevent opponent setup
if (oppCanSetup && oppPokemon.hp < 100) {
  bonus += 40;
}
```

---

## Why It Failed So Badly

### Critical Bug: Boost Application Logic

The most likely culprit is in the boost application code:

```javascript
const isAttackerOpponent = attacker === this.opponentActive;
const isDefenderOpponent = defender === this.opponentActive;

const attackerBoosts = isAttackerOpponent ? this.opponentBoosts : this.ourBoosts;
const defenderBoosts = isDefenderOpponent ? this.opponentBoosts : this.ourBoosts;
```

**Problem**: This assumes `attacker === this.opponentActive` can correctly identify whether a Pokemon is ours or opponent's. However, in minimax simulation, we create temporary Pokemon objects that won't match `this.opponentActive` by reference.

**Result**: Boosts might be applied to the wrong Pokemon or not applied at all, causing:
- Massive overestimation/underestimation of damage
- Incorrect move selection
- Search tree instability

### Evidence of Bug

**Node count increased**: Average 1467 nodes (vs 391 in Entry Hazards + Status)
- Suggests evaluation function is unstable
- Bot is exploring more nodes due to incorrect evaluations

**Longer battles**: One battle lasted 93 turns!
- Normal battles are 14-25 turns
- Suggests the bot was making extremely suboptimal moves

**Team 2 complete collapse**: 0% win rate again
- Same pattern as first attempt
- Defensive teams particularly vulnerable to boost bugs

### Secondary Issue: Boost Tracking on Switch

```javascript
processSwitch(line) {
  const playerSlot = parts[2];

  // NEW: Reset boosts on switch for both players
  if (this.isOpponent(playerSlot)) {
    this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  } else {
    this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  }

  if (!this.isOpponent(playerSlot)) return;  // <-- PROBLEM
  // ... rest of switch processing
}
```

**Problem**: The function resets boosts, then returns early if it's our switch. This means our switch doesn't get fully processed!

**Result**: When we switch Pokemon, our boosts reset but the opponent tracking might not update correctly.

### Tertiary Issue: Evaluation Weight Imbalance

**Previous version (76.7%)**:
- Type matchup: 30
- HP preservation: 80
- Hazards: 30
- Status: 60-100

**New version**:
- Stat boosts: 40 per Atk/SpA boost, 30 per Spe boost
- **At +2 Atk**: +80 to evaluation
- **At +1 Atk, +1 Spe**: +70 to evaluation

**Problem**: These boost values compete with type matchup and HP preservation, potentially causing the bot to overvalue boosted Pokemon even when they're in bad matchups.

---

## Battle Statistics Analysis

### Loss Patterns

**All 14 losses**:
- Team 1 losses: 7/8 games (87.5% loss rate)
- Team 2 losses: 7/7 games (100% loss rate)

**Node counts**:
- 5 losses at 2804 nodes (search timeout)
- 1 loss at 3288 nodes (even more nodes!)
- Multiple losses at low node counts (23, 32, 93, 309 nodes)

**Low node count losses** suggest the bot was making obviously bad moves that the opponent punished quickly.

**High node count losses** suggest the bot was searching deeply but with incorrect evaluations.

### Unusual Behaviors

**Battle 14**: 93 turns (!!!)
- Normal games are 14-30 turns
- This is 3-6x longer than normal
- Suggests both bots were making suboptimal moves
- Possibly stuck in an evaluation loop or repeatedly making bad trades

**Battle 13**: 3288 nodes
- Higher than the typical 2804 node maximum
- Suggests search went deeper than normal
- Evaluation function might have been oscillating

**Team 2 zero switches**: All 7 Team 2 losses had 0 switches
- Same pattern as first failed attempt
- Defensive teams need to switch frequently
- Something is preventing switches or making them look bad

---

## Comparison to First Attempt

| Attempt | Strategies | Win Rate | Team 1 | Team 2 |
|---------|-----------|----------|--------|--------|
| First (All 3) | Setup + Speed + Coverage | 40.0% (5g) | 66.7% | 0.0% |
| **Second (Setup Only)** | **Setup Detection** | **6.7% (15g)** | **12.5%** | **0.0%** |

**Observation**: Implementing Setup Detection alone performed **WORSE** than implementing all 3 together!

**Hypothesis**: The bug is in Setup Detection itself, not in the combination of strategies.

---

## Root Cause: Incorrect Boost Application

The core issue is likely this section in `calculateDamage`:

```javascript
const isAttackerOpponent = attacker === this.opponentActive;
const isDefenderOpponent = defender === this.opponentActive;
```

**Why this fails**:
1. In minimax search, we create simulated Pokemon objects
2. These objects won't match `this.opponentActive` by reference
3. Therefore, `isAttackerOpponent` will always be `false` for simulated objects
4. This means **boosts are never applied in minimax search**!
5. But boosts **are** applied in `evaluatePosition`, creating inconsistency

**Result**:
- Position evaluation says "+2 Atk Dragon Dance Baxcalibur is very strong" (+80)
- Damage calculation doesn't apply the +2 Atk boost
- Bot thinks it's strong but deals normal damage
- Opponent exploits this and wins

---

## Lessons Learned (Updated)

### 1. Reference Equality is Dangerous

**Never use `===` to identify Pokemon in battle simulations**

**Instead**: Use identifiers (ident string, species name, or explicit flags)

```javascript
// BAD
const isOpponent = pokemon === this.opponentActive;

// GOOD
const isOpponent = pokemon.playerSide === 'p2' || this.isOpponent(pokemon.ident);
```

### 2. Boost Tracking Requires Context

**Boosts are tied to specific Pokemon**, not just "our Pokemon" vs "opponent Pokemon".

In minimax search, we need to know:
- Which Pokemon is currently active
- What are its current boosts
- How do boosts change during the search

**Current implementation doesn't track per-Pokemon boosts in search**, only at the top level.

### 3. Incremental Testing Isn't Enough

Even implementing one feature at a time failed because:
- The feature itself had critical bugs
- 15 games revealed the bug (1-14 record)
- But we didn't have unit tests to catch the boost application bug earlier

**Should have done**:
1. Unit test boost multiplier calculation
2. Unit test boost application in damage calculation
3. Unit test boost tracking through switches
4. **Then** run integration tests (15 games)

### 4. Simulation vs Reality Mismatch

The bot has two modes:
1. **Reality**: Tracking actual battle state (this.ourBoosts, this.opponentBoosts)
2. **Simulation**: Minimax search with hypothetical futures

**The bug**: Boost tracking works in Reality but not in Simulation.

**Solution needed**: Either:
- Pass boost state through minimax search, OR
- Don't modify damage calculations, only use boosts in evaluation

---

## Recommended Next Steps

### Option 1: Fix the Boost Application Bug

**Changes needed**:
1. Add explicit `playerSide` or `isOpponent` flag to Pokemon objects
2. Pass boost state through minimax search
3. Modify calculateDamage to use explicit flags instead of reference equality

**Estimated effort**: Medium-High
**Risk**: High (complex change to core search logic)

### Option 2: Simpler Boost Tracking (Detection Only)

**Don't modify damage calculations at all**. Only use boosts for:
1. Detecting when opponent has setup
2. Valuing our own setup moves
3. Position evaluation (our boosts good, opponent boosts bad)

**Changes needed**:
1. Remove boost application from calculateDamage
2. Remove boost application from getSpeed
3. Keep only position evaluation changes

**Estimated effort**: Low
**Risk**: Low (doesn't touch damage calc)

### Option 3: Abandon Setup Detection

**Accept 76.7% as ceiling** and focus on other improvements:
- Team preview optimization
- Better opponent move prediction
- Damage range calculations (min/max rolls)
- Probabilistic search (handle accuracy, crits)

**Rationale**:
- 76.7% is +23.4% from baseline (53.3%)
- Two independent attempts at setup detection both failed catastrophically
- The feature might be fundamentally incompatible with current architecture

---

## Conclusion

Setup Move Detection, even implemented incrementally and carefully, resulted in **catastrophic failure** (6.7% win rate).

### Key Findings

1. ❌ **Reference equality bug**: Can't use `===` to identify Pokemon in minimax
2. ❌ **Boost application fails in simulation**: Works for real moves, not simulated
3. ❌ **Team 2 consistently collapses**: Defensive teams particularly vulnerable
4. ❌ **Performance worse than all-3 attempt**: 6.7% vs 40% before
5. ✅ **Entry Hazards + Status remains best**: 76.7% (reverted to this)

### Status

**Reverted to**: Entry Hazards + Status Conditions (commit 8cdb265)
**Current Performance**: 76.7% (23-7 in 30 games)

### Recommendation

**Option 3: Abandon Setup Detection**

After two independent failures with the same feature:
- All-3-strategies: 40% win rate
- Setup-alone: 6.7% win rate

**Conclusion**: Setup Detection is fundamentally incompatible with the current architecture or requires major refactoring to work correctly.

**Recommendation**: Accept 76.7% as excellent performance. This represents:
- +23.4 percentage points from baseline (53.3%)
- 3.4x improvement in win/loss ratio (from 16-14 to 23-7)
- Balanced performance across both team types

Further improvements should focus on simpler enhancements:
- Team preview selection
- Better damage range estimation
- Improved opponent move prediction
- Meta-game knowledge (common sets, items)

---

**Date**: 2026-01-26
**Implementation**: Setup Move Detection (Incremental)
**Sample Size**: 15 games
**Result**: 6.7% win rate (1-14)
**Status**: ❌ **CATASTROPHIC FAILURE** - **REVERTED**
**Reverted To**: Entry Hazards + Status (76.7%)
**Final Decision**: Abandon Setup Detection feature
