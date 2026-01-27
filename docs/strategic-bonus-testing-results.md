# Strategic Bonus Testing Results

## Summary

Tested three approaches for strategic bonuses (Stealth Rock, Thunder Wave, etc.):

| Approach | Win Rate | vs Baseline | Notes |
|----------|----------|-------------|-------|
| **Baseline (no priority/coverage)** | **73-86%** | - | Original performance |
| Strategic bonuses at root only | 40% | -33 to -46 pp | Heuristics override minimax |
| Strategic bonuses at all depths | 57% | -16 to -29 pp | Better integration, still hurts |
| **Strategic bonuses disabled** | **53-67%** | **-6 to -33 pp** | Best of new implementations |

## Key Findings

### 1. Strategic Bonuses Hurt Performance (Confirmed)

Adding strategic value bonuses (+150 Stealth Rock, +90 Thunder Wave) consistently degrades performance:
- Root only: 40% (catastrophic)
- All depths: 57% (better but still poor)
- Disabled: 53-67% (best)

**Conclusion**: Pure minimax discovers optimal hazard/status timing through search. Explicit bonuses interfere with this.

### 2. Regression Persists Without Strategic Bonuses

Even with strategic bonuses disabled, performance is 53-67% vs 73-86% baseline. This suggests **something else in the priority/coverage code is causing issues**.

### 3. Team-Specific Performance

With bonuses disabled (30 games):
- **Team 1 (Offensive)**: 53% (vs 87.5% baseline, **-34 pp**)
- **Team 2 (Defensive)**: 80% (vs 85.7% baseline, **-6 pp**)

Team 2 is near baseline. **Team 1 is struggling significantly.**

## Hypothesis: What's Causing Team 1 Regression?

Possible causes:
1. **Coverage bonus too aggressive** - Might be choosing suboptimal moves for switch coverage
2. **Priority tracking bugs** - Could be miscalculating move order
3. **Move ordering changes** - New priority-aware ordering might be evaluating wrong moves first
4. **Field tracking overhead** - Extra state tracking causing subtle bugs

## Next Steps

### Option A: Investigate Team 1 Losses
Analyze why Team 1 (offensive) performs poorly while Team 2 (defensive) is fine.

### Option B: Binary Search for Regression
Disable features one by one to identify the culprit:
1. Disable coverage bonus (keep priority tracking)
2. Disable priority tracking (keep coverage)
3. Disable field tracking
4. Check each in isolation

### Option C: Revert to Baseline + Add Only Priority Tracking
Start with known-good baseline, add ONLY priority tracking (no coverage, no strategic bonuses). Test if priority alone causes issues.

## Recommendation

**Option C**: Test minimal changes incrementally.

The priority/coverage/field tracking code is all tested and working correctly in isolation. The issue is how it integrates with minimax search. Start minimal and add features one at a time to find what breaks.

## Code Changes

### Disabled in this commit:
- `evaluateMoveStrategicValue()` now returns 0
- Strategic bonuses completely disabled
- All code preserved in comments for potential future use

### Still active:
- Priority tracking (terrain-aware)
- Coverage evaluation (team matchup scoring)
- Field condition tracking (Trick Room, weather, terrain)
- Speed confidence evaluation

## Performance Timeline

```
Baseline (original):                    73-86%
+ Priority/Coverage/Field tracking:     ?
+ Strategic bonuses (root only):        40% ❌
+ Strategic bonuses (all depths):       57% ⬆️
+ Strategic bonuses disabled:           53-67% ⬆️⬆️
```

Still investigating why 53-67% vs 73-86% baseline.
