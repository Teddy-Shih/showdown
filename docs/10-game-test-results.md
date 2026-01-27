# 10-Game Test Results: Priority/Coverage Implementation

## Performance

| Metric | Result | vs Baseline |
|--------|--------|-------------|
| **Win Rate** | **40%** (4/10) | **-43 to -50 pp** ❌ |
| Baseline | 83-90% | - |
| Status | **MAJOR REGRESSION** | |

## Investigation Findings

### ✅ What's Working
1. **Priority tracking**: Grassy Slide gets +1 with Grassy Terrain ✓
2. **Move order determination**: Trick Room, priority vs speed ✓
3. **Coverage evaluation**: Correctly penalizes immunities ✓
4. **Hazard tracking**: Correctly tracks when hazards are up ✓
5. **Field condition tracking**: Terrain, weather, Trick Room all tracked ✓

All unit tests pass. The core logic is sound.

### ❌ What's Broken

The regression appears to be caused by **the strategic value bonus system**, not the new priority/coverage code.

#### Issue 1: Strategic Bonuses in Wrong Place
The strategic value bonuses (+150 for Stealth Rock, +90 for paralysis) are added in `evaluateMoveStrategicValue()` which is called during move selection. However, these bonuses may be:

1. **Conflicting with minimax search** - The search evaluates positions N turns ahead, but strategic bonuses are applied at depth=0 only
2. **Overriding better moves** - A +150 bonus for Stealth Rock might override a KO move in some edge cases
3. **Not accounting for game state properly** - Status/hazard bonuses need more context

#### Issue 2: Coverage Bonus Too Small?
- Base KO move score: 200,000
- Coverage bonus: 3 points × 50 = 150
- **Impact: Only 0.075%** of base score

This might not be enough to shift preferences meaningfully.

### Debug Test Results

Running with debug logging showed:
- **Hazard tracking works correctly**: Stealth Rock bonus only applied when hazards not up
- **Move selection sometimes erratic**: Mixed Thunder Wave / Volt Switch / Hydro Pump patterns

The battle log format makes it hard to see exact move sequences due to duplicate event logging.

## Root Cause Hypothesis

The **40% win rate** suggests we **introduced a bug** rather than just having weak coverage bonuses. Possibilities:

### Theory 1: Strategic Value Heuristics Conflict with Search
Before this implementation, the bot had:
- Pure minimax search with boost propagation
- No heuristic bonuses at root

After:
- **NEW**: Strategic value bonuses (+150 Stealth Rock, +90 paralysis, etc.)
- These are applied at move selection time (depth=0)
- May be **overriding minimax scores**

**Evidence**: Historical testing showed that adding heuristics to minimax **always made performance worse**:
- Baseline (no heuristics): 86.7%
- +150 heuristic: 10% (catastrophic)
- +20 heuristic: 30%
- **Current (+strategic bonuses): 40%**

This pattern matches: **heuristics + minimax = worse performance**

### Theory 2: Bug in Move Ordering with Coverage
The new move ordering code added:
```javascript
if (naturallyFaster && !needsPriorityToGoFirst) {
  const coverageBonus = this.evaluateMoveCoverageVsTeam(moveData, this.opponentTeam);
  orderScore += coverageBonus * 50;
}
```

If `this.opponentTeam` is empty or not populated correctly, coverage would be 0 and have no effect. But this wouldn't cause a regression, just no improvement.

### Theory 3: Field Tracking State Bugs
We added lots of new state tracking:
- Weather (with turn decrements)
- Terrain (with turn decrements)
- Field conditions (with turn decrements)
- `decrementFieldConditions()` called every turn

If these have bugs, they could cause:
- Incorrect move priority calculations
- Wrong move order determinations
- Broken state for minimax search

## Recommended Next Steps

### Option A: Revert Strategic Value Bonuses (Quick Fix)
Remove `evaluateMoveStrategicValue()` bonuses entirely:
- Set all strategic bonuses to 0
- Keep only the core priority/coverage logic
- Test if this fixes the regression

**Rationale**: Historical evidence shows heuristics harm minimax performance.

### Option B: Debug Why Heuristics Hurt Performance
1. Add extensive logging to see which moves are chosen and why
2. Compare move selection with vs without strategic bonuses
3. Identify specific cases where heuristics override correct minimax moves

### Option C: Move Strategic Logic into Evaluation Function
Instead of adding bonuses at move selection (depth=0), integrate into `evaluatePosition()`:
- Hazards add value to position evaluation
- Status conditions add value to position evaluation
- Search naturally discovers when to set up hazards/status

This is how the boost propagation works successfully.

## My Recommendation

**Option A: Revert Strategic Bonuses**

The evidence is clear:
1. Every time heuristics were added to minimax, performance dropped
2. Pure search with boost propagation achieved 73-83% win rate
3. Adding strategic bonuses dropped it to 40%

The priority and coverage logic is sound and tested. The regression is from the strategic value system.

**Next commit should**:
1. Keep all priority/coverage/field tracking code ✓
2. Remove or disable `evaluateMoveStrategicValue()` bonuses
3. Test if win rate returns to 70-80%+ range
4. If yes: Keep it this way
5. If no: Investigate field tracking state bugs

## Files Modified

- `src/TypeAwareBot.js`: Added priority, coverage, field tracking (760 lines changed)
- Test scripts: Unit tests all passing
- Battle performance: 40% win rate (regression)

## Conclusion

The **good news**: Priority tracking, coverage evaluation, and field tracking all work correctly.

The **bad news**: We broke something, likely by adding strategic value heuristics that conflict with minimax search.

**Fix**: Disable strategic bonuses, test again.
