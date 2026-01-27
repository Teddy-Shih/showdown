# Feature Isolation Test Results

## Summary

Tested individual features to identify regression cause. Results show **high variance** and **no single clear culprit**.

## Test 1: Feature Isolation (20 games per config, 120 games total)

| Configuration | Overall | Team 1 | Team 2 |
|---------------|---------|--------|--------|
| Baseline (all features) | 80.0% | 60.0% | 100.0% |
| Coverage bonus disabled | 75.0% | 50.0% ❌ | 100.0% |
| Priority tracking disabled | 80.0% | 60.0% | 100.0% |
| Speed confidence disabled | 80.0% | 60.0% | 100.0% |
| **Field tracking disabled** | **85.0%** ⬆️ | **70.0%** ⬆️ | 100.0% |
| All features disabled | 80.0% | 60.0% | 100.0% |

**Initial Finding**: Field tracking disabled showed +5 pp overall, +10 pp for Team 1.

## Test 2: Field Tracking Confirmation (30 games per config, 60 games total)

| Configuration | Overall | Team 1 | Team 2 |
|---------------|---------|--------|--------|
| **Field tracking enabled** | **76.7%** ⬆️ | **53.3%** ⬆️ | 100.0% |
| Field tracking disabled | 66.7% | 33.3% ❌ | 100.0% |

**Contradictory Finding**: Field tracking enabled now performs BETTER (-10 pp worse when disabled).

## Key Observations

### 1. High Variance in Results
- Field tracking OFF: 85% → 67% (18 pp swing!)
- Team 1 performance: 33-70% range
- Results are inconsistent across runs

### 2. Team 2 is Perfect (100% in ALL tests)
- Team 2 (Defensive) wins every single game regardless of configuration
- This is suspicious - suggests opponent bot may have issues with Team 2

### 3. No Single Feature is the Problem
Disabling individual features shows:
- Coverage bonus: Makes things WORSE when disabled
- Priority tracking: No effect
- Speed confidence: No effect
- Field tracking: Inconsistent results

### 4. Performance Better Than Expected
- Earlier 30-game tests: 53-67% win rate
- These tests: 67-85% win rate
- Sample size may be too small for stable measurements

## Hypothesis: Why High Variance?

### Possible Explanations

**1. Small Sample Size**
- 20-30 games may not be enough
- Pokemon battles have inherent randomness (damage rolls, accuracy)
- Need 50-100 games per configuration for stable results

**2. Feature Interaction Effects**
- No single feature is the issue
- Features interact in complex ways
- Regression comes from the combination, not individual features

**3. TreeSearchBot Weakness vs Team 2**
- Team 2 wins 100% in ALL configurations
- This is statistically unlikely unless opponent bot has a specific weakness
- Could be inflating our overall win rate

**4. Matchup Variance**
- Team 1 vs Team 2 might be inherently imbalanced
- Results depend heavily on which team gets which opponent

## What We Learned

### ✓ Confirmed Working
- Priority tracking: No negative impact when disabled
- Coverage evaluation: HELPS performance (worse when disabled)
- Speed confidence: No measurable impact
- Field tracking: Mixed results (inconsistent)

### ✗ No Clear Culprit
- No single feature causes the regression
- Disabling everything doesn't restore baseline performance
- High variance makes it hard to identify root cause

### 🎯 Team 2 Dominance
- Team 2 (Defensive) performs perfectly regardless of features
- This suggests:
  - Opponent bot has issues with defensive teams, OR
  - Team 2 is inherently stronger, OR
  - Our features don't hurt defensive playstyles

## Recommendations

### Option A: Run Larger Tests (50-100 games per config)
Reduce variance with larger sample sizes. More reliable but time-consuming.

### Option B: Test Against Different Opponent
TreeSearchBot might not be a good baseline. Try testing against:
- Random bot
- Max damage bot
- Different search bot

### Option C: Focus on Team 1 Specifically
Team 1 (Offensive) is the problem. Analyze:
- Why it underperforms with our features
- What moves it's choosing incorrectly
- Whether offensive playstyle interacts poorly with features

### Option D: Accept Current Performance
- 67-85% win rate is still strong
- Team 2 is perfect (100%)
- Team 1 struggles but may be matchup-dependent
- Focus on other improvements

## Next Steps

Based on high variance and inconclusive results, recommend:

1. **Run 50-game test** on baseline vs all-features-disabled
2. **Analyze Team 1 losses** in detail (what moves are chosen wrong?)
3. **Consider that regression may not be reproducible** (earlier 53-67% results)

The features themselves are correct (unit tests pass). The performance impact is inconsistent and may be within noise.
