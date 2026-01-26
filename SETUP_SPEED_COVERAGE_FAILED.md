# Setup Detection + Speed Control + Team Coverage - FAILED ATTEMPT

## Executive Summary

**40.0% win rate (2-3)** - **Major performance regression** from Entry Hazards + Status baseline!

Attempted to implement all three remaining strategies simultaneously:
1. Setup Move Detection
2. Speed Control & Revenge Killing
3. Team Coverage & Matchup Analysis

**Result**: ❌ **FAILED** - Performance dropped from 76.7% to 40.0% (-36.7 percentage points)

---

## Performance Comparison

| Version | Sample Size | Overall | Team 1 (Offensive) | Team 2 (Defensive) |
|---------|-------------|---------|-------------------|-------------------
| **Entry Hazards + Status** | 30 games | **76.7% (23-7)** | **73.3% (11-4)** | **80.0% (12-3)** |
| **+3 Strategies** | 5 games | **40.0% (2-3)** | 66.7% (2-1) | **0.0% (0-2)** |

### Change from Baseline

- **Overall**: -36.7 percentage points (76.7% → 40.0%)
- **Team 1**: -6.6 percentage points (73.3% → 66.7%)
- **Team 2**: **-80.0 percentage points** (80.0% → 0.0%) - **Complete collapse!**

---

## What Was Implemented

### 1. Setup Move Detection

**Features Added**:
- Stat boost tracking (`this.ourBoosts`, `this.opponentBoosts`)
- Setup moves database (Dragon Dance, Swords Dance, Quiver Dance, etc.)
- `processBoost()` - Track |-boost| and |-unboost| messages
- `resetBoostsOnSwitch()` - Reset boosts when Pokemon switch
- `getBoostMultiplier()` - Calculate stat boost multipliers ((2+boost)/2 for positive, 2/(2-boost) for negative)
- Modified `calculateDamage()` to apply stat boosts to attack/defense
- Modified `getSpeed()` to apply speed boosts
- Modified `evaluatePosition()` to value stat boosts (+50 per Atk/SpA boost, +40 per Spe boost)
- Added setup move valuation in `evaluateMoveStrategicValue()` (up to +200 for safe setups)
- Added opponent setup prevention bonus (+120 for KOing before setup)

**Code Example**:
```javascript
// Stat boost tracking
this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

// Setup moves database
this.setupMoves = {
  'dragondance': { atk: 1, spe: 1 },
  'swordsdance': { atk: 2 },
  // ... 10+ more setup moves
};

// Apply boosts to damage
const attackBoost = move.category === 'Physical' ? attackerBoosts.atk : attackerBoosts.spa;
if (attackBoost) {
  attackStat = Math.floor(attackStat * this.getBoostMultiplier(attackBoost));
}
```

### 2. Speed Control & Revenge Killing

**Features Added**:
- Priority moves database (Sucker Punch, Aqua Jet, Extreme Speed, etc.)
- `isPriorityMove()` - Check if move has priority
- `getPriorityLevel()` - Get priority level (+1, +2, +3)
- `canRevengeKill()` - Detect revenge killing opportunities (priority KO or speed KO)
- Added revenge killing bonus in move evaluation (+150 for confirmed revenge kills)
- Added priority move bonus against low HP targets (priority level * 50)

**Code Example**:
```javascript
// Priority moves database
this.priorityMoves = {
  'suckerpunch': 1,
  'aquajet': 1,
  'extremespeed': 2,
  'fakeout': 3
};

// Revenge killing detection
canRevengeKill(ourPokemon, oppPokemon, oppHP, moves) {
  // Check priority moves first
  for (const move of moves) {
    const priorityLevel = this.getPriorityLevel(moveData.name);
    if (priorityLevel > 0) {
      const damage = this.calculateDamage(ourPokemon, oppPokemon, moveData);
      if (damage >= oppHP) {
        return { canRevenge: true, moveName: moveData.name, reason: 'priority_ko' };
      }
    }
  }

  // Check speed-based revenge kill
  if (ourSpeed > oppSpeed) {
    // Can we KO before they move?
  }
}
```

### 3. Team Coverage & Matchup Analysis

**Features Added**:
- `analyzeTeamCoverage()` - Analyze which Pokemon counter which opponents
- `isCriticalCounter()` - Detect if Pokemon is the only answer to a threat
- Added team coverage analysis to `searchBestMove()` (runs once per battle)
- Modified switch condition to preserve critical counters (require matchup < -4 instead of < -2)

**Code Example**:
```javascript
analyzeTeamCoverage(ourTeam, oppTeam) {
  const coverage = {};

  for (const oppPokemon of oppTeam) {
    const counters = [];

    for (const ourPokemon of ourTeam) {
      const typeMatchup = this.calculateTypeMatchupScore(ourSpecies.types, oppSpecies.types);
      if (typeMatchup > 0) {
        counters.push({ pokemon: ourSpeciesName, matchup: typeMatchup });
      }
    }

    coverage[oppSpeciesName] = counters;
  }

  return coverage;
}

// Don't switch away from critical counters
const isCritical = this.isCriticalCounter(ourPokemon, request);
const shouldConsiderSwitches = (currentMatchup < -2 || (hasRegenerator && ourHP < 40)) && (!isCritical || currentMatchup < -4);
```

---

## Why It Failed

### 1. Team 2 Complete Collapse (0% Win Rate)

**Observations**:
- Team 2 went from **80.0%** to **0.0%**
- Both losses were defensive team games
- One loss at 93 nodes (quick), one at 2804 nodes (deep search)

**Likely Causes**:
- **Critical counter preservation too aggressive**: Defensive teams rely on pivoting. Restricting switches (matchup < -4 for critical counters) may have prevented necessary defensive switches.
- **Setup move overvaluation**: Defensive teams don't have many setup sweepers. The bot might have tried to setup with Pokemon like Slowking (which doesn't have setup moves), wasting turns.
- **Stat boost tracking bugs**: Defensive Pokemon like Magnezone or Slowking don't setup, but the bot might be misinterpreting their actions or opponent boosts.

### 2. Potential Bugs

**Boost Tracking Race Condition**:
```javascript
// In processBattleMessage, both are called:
if (line.includes('|-boost|') || line.includes('|-unboost|')) {
  this.processBoost(line);
}
if (line.includes('|switch|') || line.includes('|drag|')) {
  this.resetBoostsOnSwitch(line);  // Also called for processSwitch!
}
```

**Problem**: Switch messages are processed twice - once in the main loop for resetting boosts, and once in `processSwitch()`. This could cause boosts to reset at the wrong time or cause undefined behavior.

**Opponent Boost Detection Flaw**:
```javascript
// In evaluateMoveStrategicValue:
const oppCanSetup = Array.from(this.opponentActive.moves).some(m => this.isSetupMove(m));
```

**Problem**: Checking `this.opponentActive.moves` which are estimated moves, not actual moves. The bot might think opponent can Dragon Dance when they can't, causing it to panic and make suboptimal decisions.

**Team Coverage Initialization**:
```javascript
// In searchBestMove:
if (!this.teamCoverage && team && this.opponentTeam.length > 0) {
  this.teamCoverage = this.analyzeTeamCoverage(team, this.opponentTeam);
}
```

**Problem**: `this.opponentTeam` might not be fully populated yet. The bot only adds to `opponentTeam` when it sees Pokemon for the first time. Early-game coverage analysis might be incomplete.

### 3. Excessive Complexity

**Before**: Entry Hazards + Status
- Tracked: 2 hazard states, 2 status conditions
- Evaluation factors: ~8 (hazards, status, type matchup, HP)
- Decision complexity: Moderate

**After**: +Setup +Speed +Coverage
- Tracked: 2 hazard states, 2 status conditions, **10 stat boosts**, **12 setup moves**, **11 priority moves**, **team coverage matrix**
- Evaluation factors: ~15+ (hazards, status, boosts, setup opportunities, revenge kills, critical counters)
- Decision complexity: Very high

**Result**: The evaluation function became too complex, likely causing:
- Conflicting bonuses (setup bonus vs revenge kill bonus vs hazard bonus)
- Over-optimization in one area at the expense of others
- Search tree explosion (more options to consider)

### 4. Evaluation Weight Imbalance

**Entry Hazards + Status bonuses**:
- Stealth Rock: +150
- Burn physical attacker: +100
- Sleep: +120

**New bonuses added**:
- Setup move (safe): up to +200
- Revenge kill: +150
- Prevent opponent setup: +120
- Stat boost in position: +50 per boost
- Priority move vs low HP: +50 to +150

**Problem**: These bonuses might stack inappropriately or conflict with each other, causing the bot to:
- Overvalue setup when it's not actually safe
- Try to revenge kill when it should be setting up hazards
- Avoid switching from critical counters even when necessary

---

## Statistical Analysis

### Test Results (5 games)

| Battle | Team | Result | Turns | Nodes | Switches |
|--------|------|--------|-------|-------|----------|
| 1 | 1 | WIN | 13 | 108 | 1 |
| 2 | 2 | **LOSS** | 20 | 93 | 0 |
| 3 | 1 | WIN | 13 | 188 | 1 |
| 4 | 2 | **LOSS** | 21 | 2804 | 0 |
| 5 | 1 | **LOSS** | 28 | 1235 | 1 |

**Average Statistics**:
- Nodes: 886 (vs 391 in Entry Hazards + Status)
- Switches: 0.6 (vs 1.3 in Entry Hazards + Status)

**Observations**:
- **Higher node count**: 886 vs 391 suggests more complex evaluation or deeper searches
- **Fewer switches**: 0.6 vs 1.3 suggests critical counter preservation prevented necessary switches
- **Team 2 no switches**: Both Team 2 losses had 0 switches, suggesting the bot got stuck with bad matchups

### Comparison to Previous Versions

| Strategy | Win Rate | Team 1 | Team 2 | Avg Nodes |
|----------|----------|--------|--------|-----------|
| Baseline | 53.3% | 40% | 67% | ~1500 |
| V2 Switch Lookahead | 73.3% | 73.3% | 73.3% | 825 |
| +Entry Hazards +Status | 76.7% | 73.3% | 80% | 391 |
| **+Setup +Speed +Coverage** | **40.0%** | **66.7%** | **0%** | **886** |

**Trend**: More features ≠ better performance

---

## Lessons Learned

### 1. Incremental Implementation is Critical

**Mistake**: Implemented all 3 strategies at once
**Result**: Couldn't isolate which strategy caused the regression

**Should Have Done**: Implement one at a time:
1. Setup Detection only → test → document
2. Add Speed Control → test → document
3. Add Team Coverage → test → document

### 2. Defensive Teams Need Different Logic

**Observation**: Team 2 (defensive) collapsed to 0%
**Insight**: Defensive teams don't benefit from the same features as offensive teams

**Defensive teams care about**:
- Pivoting (frequent switching)
- Status moves (burn, paralysis)
- Entry hazards (passive damage accumulation)
- **NOT**: Setup moves, revenge killing, preserving for late-game

**Offensive teams care about**:
- Setup opportunities (Dragon Dance, Swords Dance)
- Revenge killing (priority moves)
- Speed control
- **NOT**: Passive hazard damage, defensive pivoting

**Conclusion**: Need team-style-aware logic (which we tried before and failed with)

### 3. Evaluation Function Complexity Limits

**Finding**: Adding too many bonuses causes unpredictable behavior

**Hypothesis**: When you have 15+ factors contributing to evaluation, small bugs or weight imbalances create cascading failures.

**Best Practice**: Keep evaluation simple and focused. Entry Hazards + Status (76.7%) had:
- Type matchup (30 weight)
- HP preservation (80 weight)
- Hazards (+30 for opponent's Stealth Rock)
- Status (+80 for burning physical attackers)
- **Total: 4-5 main factors**

**Failed Version**: Added:
- Stat boosts (+50 per boost)
- Setup move value (+200)
- Revenge kill (+150)
- Prevent setup (+120)
- Priority moves (+50-150)
- Critical counter preservation
- **Total: 10+ factors**

**Conclusion**: Diminishing returns beyond 5-6 evaluation factors

### 4. Testing is Insufficient at 5-10 Games

**Problem**: 5 games showed 40%, but variance is high

**Need**: Minimum 30 games to confirm performance (like we did for Entry Hazards + Status)

**Should Have Done**: After implementing, run 30 games before declaring success/failure

---

## Root Cause Analysis

### Primary Cause: Stat Boost Tracking Bug

The most likely culprit is the `resetBoostsOnSwitch()` being called in the battle message processing loop alongside `processSwitch()`. This could cause:
1. Boosts resetting at wrong times
2. Our boosts being reset when opponent switches
3. Double-processing of switch events

**Evidence**:
- Team 2 losses had 0 switches (stuck with bad matchups because the bot thought its Pokemon had boosts or feared opponent boosts)
- Higher node counts (886 vs 391) suggest evaluation was unstable or oscillating

### Secondary Cause: Critical Counter Over-Preservation

Making critical counters require matchup < -4 to switch (instead of < -2) meant defensive teams couldn't pivot effectively.

**Evidence**:
- Team 2 had 0 switches in both losses
- Defensive teams rely on pivoting to wear down opponents

### Tertiary Cause: Setup Move Overvaluation

The bot might have tried to setup with Pokemon that don't have setup moves, or valued setup too highly in unsafe situations.

**Evidence**:
- Longer battles (28 turns in Battle 5 vs typical 14-17)
- Higher node counts (evaluating setup options adds complexity)

---

## Recommended Next Steps

### Option 1: Incremental Re-Implementation

1. **Setup Detection Only**:
   - Fix the `resetBoostsOnSwitch()` bug (move out of general message processing)
   - Test stat boost tracking independently
   - Run 30 games
   - Document results

2. **If Setup Detection Succeeds, Add Speed Control**:
   - Only add revenge killing detection
   - Don't add priority move bonuses yet
   - Run 30 games
   - Document results

3. **If Speed Control Succeeds, Add Team Coverage**:
   - Only add critical counter detection
   - Don't modify switch thresholds yet
   - Run 30 games
   - Document results

### Option 2: Abandon Complex Strategies

**Argument**: Entry Hazards + Status (76.7%) might be near the ceiling for this approach

**Current Performance**:
- Original baseline: 53.3%
- Switch Lookahead V2: 73.3%
- +Entry Hazards +Status: 76.7%
- **Improvement from baseline: +23.4 percentage points**

**Theoretical ceiling**: ~95-98% according to RECOMMENDED_STRATEGIES.md

**Reality**: Might be hitting diminishing returns. Going from 76.7% to 95% might require:
- Perfect damage range calculations (account for min/max rolls)
- Perfect move prediction (opponent's next move)
- Team preview optimization
- Doubles/VGC-specific logic

**Recommendation**: Accept 76.7% as excellent performance and move on to other improvements (team preview, better opponent modeling, etc.)

### Option 3: Simplify Setup Detection

**Insight**: Maybe we don't need full stat boost tracking

**Simpler Approach**:
```javascript
// Detect if opponent just used a setup move this turn
if (lastOpponentMove && this.isSetupMove(lastOpponentMove)) {
  // Opponent just setup - prioritize KOing them
  koBonus += 150;
}

// Detect if we can safely setup
if (ourMove && this.isSetupMove(ourMove) && ourHP > 50) {
  // We can setup safely
  setupBonus += 100;
}
```

**Benefits**:
- No stat boost tracking complexity
- No boost multiplication in damage calculations
- Simple detection of setup turns

**Test**: Implement this simpler version and run 30 games

---

## Conclusion

The three-strategy implementation was a **FAILURE**, dropping performance from **76.7% to 40.0%**.

### Key Findings

1. ❌ **Implementing multiple features simultaneously is dangerous**
2. ❌ **Defensive and offensive teams need different logic**
3. ❌ **Evaluation complexity has diminishing returns**
4. ❌ **5-10 game samples are insufficient for validation**
5. ✅ **Entry Hazards + Status (76.7%) remains the best version**

### Reversion

**Reverted to**: Entry Hazards + Status Conditions (commit 8cdb265)
**Current Performance**: 76.7% (23-7 in 30 games)

### Next Actions

1. **Document this failure** ✅ (this document)
2. **Run confirmation test** to verify reversion restored performance
3. **Decide**: Incremental re-implementation vs accepting 76.7% as ceiling
4. **Consider**: Simpler setup detection without full boost tracking

---

**Date**: 2026-01-26
**Implementation**: Setup Detection + Speed Control + Team Coverage
**Result**: 40.0% win rate (2-3 in 5 games)
**Status**: ❌ FAILED - **REVERTED**
**Reverted To**: Entry Hazards + Status (76.7%)
**Key Lesson**: Incremental implementation and larger test samples are critical
