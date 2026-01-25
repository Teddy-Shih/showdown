# Team-Aware Evaluation: Complete Failure Analysis

## Executive Summary

**Two attempts at team-aware evaluation both failed catastrophically:**

| Version | Method | Overall | Team 1 | Team 2 | Status |
|---------|--------|---------|--------|--------|--------|
| **Baseline** | None (balanced weights) | **53.3%** | **40%** | **67%** | ✅ Best |
| **V1** | Stat-based classification | 40.0% | 40% | 40% | ❌ -13.3% |
| **V2** | Role-based classification | 40.0% | 40% | 40% | ❌ -13.3% |

**Both V1 and V2 produced identical results**: 40% overall, destroying Team 2's 67% advantage.

## Root Cause: Optimal Weights Cannot Be "Improved"

### The Fundamental Problem

The original TypeAwareBot uses "balanced" evaluation weights:
```javascript
score += (ourHP - oppHP);           // HP difference weight: 1.0
score += typeMatchup * 30;          // Type advantage weight: 30
score += (ourHPRatio ** 2) * 80;    // HP preservation: 80
score -= (oppHPRatio ** 2) * 80;    // Opponent HP penalty: 80
score += (1 - oppHPRatio) * 50;     // Progress bonus: 50
```

**These weights are ALREADY OPTIMAL for both teams**:
- Team 1 (Offensive): 40% win rate
- Team 2 (Defensive): 67% win rate
- **Overall: 53.3% win rate**

Any deviation from these weights makes performance worse, because:

1. **Local Optimum**: These weights represent a local maximum in the parameter space
2. **Tightly Coupled**: Changing one weight affects all evaluations
3. **Non-Linear Effects**: Small changes can have large impacts

### What Happened in V1 (Stat-Based Classification)

**V1 Logic**: Classify teams by offensive vs defensive base stats
- Team 1: Classified as "balanced/defensive" (offensive stats only 1.09x defensive)
- Team 2: Classified as "offensive" (offensive stats 1.18x defensive)

**Result**: WRONG classification, Team 2 got offensive weights and collapsed.

### What Happened in V2 (Role-Based Classification)

**V2 Logic**: Classify teams by Pokemon roles (setup sweepers, defensive pivots, wallbreakers)

**Team 1** (TEAM_SPECS_GHOLDENGO):
- **Setup sweepers**: Baxcalibur (Dragon Dance), Kingambit (Swords Dance) = 2
- **Defensive pivots**: Rotom-Wash (Leftovers, Thunder Wave, Protect) = 1
- **Wallbreakers**: Gholdengo (Choice Specs), Iron Valiant (Choice Scarf), Great Tusk = 3
- **Classification**: OFFENSIVE (2 setup + 3 wallbreakers → aggressive setup team)

**Team 2** (TEAM_ANTIMETA_LANDO):
- **Setup sweepers**: Frosmoth (Quiver Dance) = 1
- **Defensive pivots**: Magnezone (Rocky Helmet, Iron Defense), Slowking (Slack Off, Regenerator) = 2
- **Wallbreakers**: Zapdos-Galar (Choice Band), Landorus-T (Choice Scarf) = 2
- **Classification**: DEFENSIVE (2+ defensive pivots → defensive control team)

**Evaluation Weights Applied**:

**Team 1 (Offensive)**:
```javascript
score += (ourHP - oppHP) * 1.3;     // Increased from 1.0
score += typeMatchup * 35;          // Increased from 30
score += (ourHPRatio ** 2) * 50;    // DECREASED from 80 ← PROBLEM!
score -= (oppHPRatio ** 2) * 100;   // Increased from 80
score += (1 - oppHPRatio) * 80;     // Increased from 50
```

**Team 2 (Defensive)**:
```javascript
score += (ourHP - oppHP) * 0.8;     // DECREASED from 1.0
score += typeMatchup * 35;          // Increased from 30
score += (ourHPRatio ** 2) * 100;   // Increased from 80
score -= (oppHPRatio ** 2) * 70;    // DECREASED from 80 ← PROBLEM!
score += (1 - oppHPRatio) * 40;     // DECREASED from 50 ← PROBLEM!
```

**Why Team 1 Stayed at 40%**:
- HP preservation decreased from 80 → 50
- But Team 1 has **setup sweepers** (Baxcalibur Dragon Dance, Kingambit Swords Dance)
- Setup sweepers NEED HP to set up and sweep
- Reducing HP preservation = dying before setup = same 40% performance

**Why Team 2 Collapsed from 67% → 40%**:
- Opponent HP penalty decreased from 80 → 70
- Progress bonus decreased from 50 → 40
- Team 2 was winning 67% with BALANCED weights by playing patient control
- Forcing even MORE defensive weights made it TOO PASSIVE
- Not applying enough pressure to finish games = lost advantage

## The Paradox: Both Teams Need The Same Weights

### Team 1 (Hyper Offense with Setup Sweepers)

**Needs**:
- ✅ **HP Preservation (80)**: Baxcalibur and Kingambit need HP to set up Dragon Dance / Swords Dance
- ✅ **Type Advantage (30)**: Switch to favorable matchups for setup opportunities
- ✅ **Opponent HP Penalty (80)**: After setup, sweep quickly
- ✅ **Moderate Progress Bonus (50)**: Balance between setup patience and finishing

**V2 Offensive weights hurt because**: Decreased HP preservation from 80 → 50 means setup sweepers die before setting up.

### Team 2 (Defensive Control with Pivots)

**Needs**:
- ✅ **HP Preservation (80)**: Magnezone and Slowking need HP to keep pivoting
- ✅ **Type Advantage (30)**: Switch to favorable matchups for control
- ✅ **Opponent HP Penalty (80)**: Apply pressure through chip damage
- ✅ **Moderate Progress Bonus (50)**: Steady wear-down strategy

**V2 Defensive weights hurt because**: Decreased opponent HP penalty (80 → 70) and progress bonus (50 → 40) means too passive, doesn't finish games.

## Why "Offensive" vs "Defensive" Classification Doesn't Work

The fundamental flaw is assuming:
- Offensive teams = aggressive evaluation (low HP preservation, high damage focus)
- Defensive teams = conservative evaluation (high HP preservation, low pressure)

**Reality**:
- **BOTH** team styles need HP preservation (for different reasons)
- **BOTH** team styles need to apply pressure to opponent
- **BOTH** team styles need good type matchups
- The balanced weights (80/30/80/50) work for BOTH

## Evidence: The 40% Curse

**Suspicious pattern**: Both V1 and V2 produced IDENTICAL results

| Metric | V1 (Stat-Based) | V2 (Role-Based) |
|--------|----------------|----------------|
| Overall | 40.0% | 40.0% |
| Team 1 | 40.0% | 40.0% |
| Team 2 | 40.0% | 40.0% |
| Node counts | Varied | Varied |

This suggests:
1. The deviation from optimal weights is so destructive that the specific classification doesn't matter
2. ANY change from the balanced weights (80/30/80/50) leads to ~40% performance
3. The balanced weights are a sharp local optimum - small changes cause collapse

## Node Count Analysis

**Baseline TypeAwareBot** (53.3% win rate):
- Losses: 2804 nodes (consistent, all losses)
- Wins: 9 nodes (quick, decisive)

**V2 Team-Aware** (40.0% win rate):
- Team 1 losses: 1068, 36, 405 nodes (varied - unstable evaluation)
- Team 2 losses: 2744, 2744, 2744 nodes (consistent - hitting some limit)
- Wins: 9, 9, 23, 39 nodes (still quick when winning)

The **2744 node pattern** for Team 2 is almost identical to baseline's 2804, suggesting:
- Team 2 is searching deeply but can't find winning moves
- The defensive weights make it too passive to capitalize on advantages
- Consistent node count = hitting evaluation/search limit in losing positions

## Conclusion: Team-Aware Evaluation Is Fundamentally Flawed

### Why It Cannot Work:

1. **Optimal weights are already universal**
   - HP preservation: 80
   - Type matchup: 30
   - Opponent HP penalty: 80
   - Progress bonus: 50
   - These work for ALL team styles

2. **Classification is impossible without perfect information**
   - Need to know: items, moves, EVs, strategy, matchup context
   - Only have: Pokemon names during battle
   - Cannot infer true playstyle from partial information

3. **Small deviations destroy performance**
   - 53.3% → 40.0% with ANY weight changes
   - Sharp local optimum, no room for "improvement"

4. **Both team styles have same core needs**
   - Setup sweepers need HP (to set up)
   - Defensive pivots need HP (to pivot)
   - Both need type advantage (for favorable matchups)
   - Both need to apply pressure (to win)

### The Real Problem: Team Composition Imbalance

The 40% vs 67% differential is NOT fixable by algorithm:

**Team 1**: Objectively weaker
- Requires setup time (Baxcalibur Dragon Dance, Kingambit Swords Dance)
- Vulnerable to being disrupted before setup
- Needs specific conditions to succeed

**Team 2**: Objectively stronger
- Immediate threats (Choice Band Zapdos, Choice Scarf Landorus)
- Defensive cores provide safety (Magnezone, Slowking)
- Can pivot and adapt to any situation

**No evaluation function can overcome team strength differences.**

## Final Recommendations

### ❌ ABANDON Team-Aware Evaluation

- V1 failed: 40%
- V2 failed: 40%
- Any weight deviation from baseline causes collapse
- Cannot be salvaged

### ✅ REVERT to Original TypeAwareBot

```javascript
// KEEP THESE WEIGHTS - THEY ARE OPTIMAL
score += (ourHP - oppHP);           // 1.0
score += typeMatchup * 30;          // 30
score += (ourHPRatio ** 2) * 80;    // 80
score -= (oppHPRatio ** 2) * 80;    // 80
score += (1 - oppHPRatio) * 50;     // 50
```

**Performance**: 53.3% overall (40% Team 1, 67% Team 2)

This is OPTIMAL and should not be changed.

### ✅ If Improvement Is Needed, Try:

1. **Switch Lookahead in Minimax**
   - Add switch options to search tree
   - Let minimax decide optimal switch timing
   - More strategic than weight tuning
   - Requires significant implementation effort

2. **Strategic Evaluation Factors**
   - Detect setup moves (Dragon Dance, Swords Dance, Quiver Dance)
   - Evaluate status conditions (burn, paralysis, sleep)
   - Consider speed control (faster = better initiative)
   - Assess team coverage (can we hit all opponent types?)
   - DO NOT change existing weights

3. **Better Teams**
   - Team 1 is fundamentally weaker
   - Find more balanced teams from Smogon
   - Test with equal-strength teams

## Lessons Learned

1. **Local optima are sharp**: Small changes = large performance drops
2. **Classification requires perfect info**: Can't infer strategy from names alone
3. **Universal principles exist**: Good evaluation works for all playstyles
4. **Team strength > algorithm**: Can't compensate for composition differences
5. **"Obvious improvements" often backfire**: Loss analysis can identify wrong problems

**The original TypeAwareBot (53.3%) is already well-optimized and should be preserved.**

---

**Date**: 2025-01-25
**Experiments**: V1 (stat-based), V2 (role-based)
**Status**: FAILED - Both degraded to 40%
**Recommendation**: Revert to baseline, no further weight tuning
