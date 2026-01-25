# Team-Aware Evaluation - FAILED EXPERIMENT

## Summary

Team-aware evaluation was implemented to address the 40% differential between Team 1 (40% win rate) and Team 2 (67% win rate). The hypothesis was that TypeAwareBot's conservative evaluation favored defensive teams, and adapting weights based on team composition would improve offensive team performance.

**Result**: Performance DEGRADED significantly.

## Results Comparison

| Metric | Baseline (30 games) | Team-Aware (10 games) | Change |
|--------|--------------------|-----------------------|--------|
| **Overall Win Rate** | 53.3% (16-14) | **40.0% (4-6)** | **-13.3%** ❌ |
| **Team 1 (Offensive)** | 40% (6-9) | **40.0% (2-3)** | **0.0%** |
| **Team 2 (Defensive)** | 67% (10-5) | **40.0% (2-3)** | **-27.0%** ❌❌ |

## Critical Findings

### 1. Team 2 Performance Collapsed

Team 2 (Defensive) performance dropped from 67% to 40% - a catastrophic 27 percentage point decline.

**Why this matters**: The original TypeAwareBot was ALREADY optimally calibrated for defensive teams (67% win rate). Changing the evaluation weights destroyed this advantage.

### 2. Team 1 Performance Unchanged

Despite being the primary target of the improvement (trying to boost from 40% to 60-70%), Team 1 performance remained exactly at 40%.

**Why this matters**: The "offensive" evaluation weights did not help offensive teams at all.

### 3. Pattern Similar to ImprovedTypeAwareBot

This is the SECOND time that "obvious improvements" backfired:

| Bot | Baseline | After "Improvements" | Change |
|-----|----------|---------------------|--------|
| ImprovedTypeAwareBot | 60% | 50% | -10% |
| Team-Aware TypeAwareBot | 53.3% | 40% | -13.3% |

## What Went Wrong?

### Hypothesis: Team Classification Is Incorrect

Let me analyze the actual team stats:

**Team 1 "Offensive Balance"**:
- Baxcalibur: Atk 145, SpA 45 | Def 80, SpD 80 (Offensive: 190, Defensive: 160)
- Gholdengo: Atk 60, SpA 122 | Def 95, SpD 91 (Offensive: 182, Defensive: 186)
- Great Tusk: Atk 131, SpA 53 | Def 90, SpD 70 (Offensive: 184, Defensive: 160)
- Iron Valiant: Atk 130, SpA 120 | Def 90, SpD 60 (Offensive: 250, Defensive: 150)
- Rotom-Wash: Atk 65, SpA 105 | Def 107, SpD 107 (Offensive: 170, Defensive: 214)
- Kingambit: Atk 135, SpA 60 | Def 120, SpD 85 (Offensive: 195, Defensive: 205)

**Average**: Offensive 195.2, Defensive 179.2
**Ratio**: Offensive / Defensive = 1.09

**Team 2 "Defensive Control"**:
- Hatterene: Atk 90, SpA 136 | Def 95, SpD 103 (Offensive: 226, Defensive: 198)
- Magnezone: Atk 70, SpA 130 | Def 115, SpD 90 (Offensive: 200, Defensive: 205)
- Slowking: Atk 75, SpA 100 | Def 80, SpD 110 (Offensive: 175, Defensive: 190)
- Frosmoth: Atk 65, SpA 125 | Def 60, SpD 90 (Offensive: 190, Defensive: 150)
- Landorus-T: Atk 145, SpA 105 | Def 90, SpD 80 (Offensive: 250, Defensive: 170)
- Zapdos-Galar: Atk 125, SpA 90 | Def 90, SpD 60 (Offensive: 215, Defensive: 150)

**Average**: Offensive 209.3, Defensive 177.2
**Ratio**: Offensive / Defensive = 1.18

### 🚨 CRITICAL REALIZATION

**Team 2 is MORE offensive than Team 1!**

- Team 1: Offensive/Defensive ratio = 1.09 (barely offensive)
- Team 2: Offensive/Defensive ratio = 1.18 (clearly offensive)

The team classification was BACKWARDS! The algorithm applied:
- **Offensive weights to Team 2** (which was already winning 67% with defensive play)
- **Defensive/balanced weights to Team 1** (which needed offensive boost)

This explains EXACTLY why Team 2 performance collapsed (-27%) while Team 1 stayed the same.

## Why The Base Stats Don't Match Playstyle

The teams were classified by their **BASE STAT TOTALS**, but their actual playstyle depends on:

1. **Item Choices**:
   - Team 1: Leftovers (2x), Heavy-Duty Boots, Choice items → SUSTAINED play
   - Team 2: Choice Band/Scarf, Rocky Helmet → AGGRESSIVE trading

2. **Move Sets**:
   - Team 1: Setup moves (Dragon Dance, Swords Dance) → needs HP preservation
   - Team 2: Immediate power moves (Close Combat, Brave Bird) → all-in attacks

3. **Team Role**:
   - Team 1: Sweepers that need setup time → defensive evaluation is CORRECT
   - Team 2: Revenge killers and wallbreakers → offensive evaluation MIGHT work

## Root Cause: Misidentified Classification

The `analyzeTeamStyle()` function classified teams by:
```javascript
const avgOffensive = (atk + spa) / team.length;
const avgDefensive = (def + spd) / team.length;

if (avgOffensive > avgDefensive * 1.1) {
  return 'offensive';
}
```

This is WRONG because:
1. Almost all competitive Pokemon have offensive > defensive stats
2. Doesn't account for items, moves, or roles
3. Doesn't account for HP stat (bulk calculation)

## Correct Classification Should Consider:

1. **Bulk** = (HP + Def + SpD) / 3, not just (Def + SpD) / 2
2. **Item choices** (Life Orb / Choice = offensive, Leftovers / Rocky Helmet = defensive)
3. **Move types** (Setup = defensive, immediate power = offensive)
4. **Speed tier** (Fast = offensive, slow = defensive/bulky)

## Why This Failed (Like ImprovedTypeAwareBot)

Both experiments made the same mistake:

**WRONG ASSUMPTION**: "Losses show problems that need fixing"

**REALITY**: Losses may be CAUSED by optimal calibration being applied to the wrong situations

In TypeAwareBot:
- Defensive evaluation is optimal for Team 1 (setup sweepers)
- Defensive evaluation is NOT optimal for Team 2 (but still worked due to team strength)
- Team-aware evaluation BROKE Team 2 by forcing offensive play

## Lessons Learned

### 1. The 40%/67% differential is NOT an algorithm problem

It's a TEAM STRENGTH problem:
- Team 2 is objectively stronger (better Pokemon)
- Team 1 requires setup and is easier to disrupt
- No amount of evaluation tweaking will fix a team composition imbalance

### 2. "Obvious improvements" often backfire

- Round 1 → ImprovedTypeAwareBot: -10%
- Round 3 → Team-Aware TypeAwareBot: -13.3%
- Pattern: trying to "fix" perceived problems makes things worse

### 3. Current calibration is locally optimal

The original TypeAwareBot evaluation weights (HP preservation 80, type matchup 30, etc.) are the best for the general case.

Changing them helps in some situations but HURTS more than it helps overall.

## Recommendations

### ❌ DO NOT implement team-aware evaluation

The concept is theoretically sound but practically impossible with just base stats.

### ❌ DO NOT try to "fix" Team 1 performance

The 40% win rate is due to team composition, not algorithm.

### ✅ ACCEPT current performance as optimal

Original TypeAwareBot (53.3% over 30 games) is well-calibrated and should not be modified.

### ✅ If improvement is needed, try:

1. **Switch lookahead in minimax** (add switches to search tree)
   - Requires significant code changes
   - Increases branching factor
   - May improve switch timing

2. **Deeper evaluation factors**:
   - Status conditions (burn, paralysis, sleep value)
   - Setup move detection (Dragon Dance, Quiver Dance)
   - Speed control importance
   - NOT just changing weights

3. **Use better teams**:
   - Team 1 is objectively weaker
   - Get better teams from Smogon with balanced win rates

## Conclusion

Team-aware evaluation FAILED because:
1. Team classification by base stats is inaccurate
2. Team 2 was misclassified as needing offensive play (it doesn't)
3. Forced offensive evaluation destroyed Team 2's 67% win rate
4. Team 1 stayed the same because misclassification gave it the "right" weights by accident

**The original TypeAwareBot should be kept as-is.**

Any further improvements must be:
- Tested carefully
- Not based on "obvious" fixes from loss analysis
- Focused on strategic depth, not weight tuning
