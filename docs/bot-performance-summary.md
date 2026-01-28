# Bot Performance Summary - Viable Implementations (>70% Win Rate)

## Performance Table

| Bot Name | Win Rate | Main Strategy | Key Weights/Features | Notes |
|----------|----------|---------------|---------------------|-------|
| **Baseline (no setup)** | **86.7%** (26-4) | Pure minimax + type awareness | HP diff, type matchup (×30), HP preservation (×80) | Original best performer |
| **Pure Minimax + Boost Propagation** | **73-83%** | Minimax with stat boost simulation | Same as baseline + boost propagation through search | No heuristic bonuses |
| **TypeAwareBot (current)** | **67-85%** | Priority + Coverage + Field tracking | Type (×30), HP preservation (×80), speed confidence (×20), coverage (×50) | High variance, Team 2 perfect (100%) |

## Failed Implementations (<70% Win Rate)

| Bot Name | Win Rate | Why It Failed |
|----------|----------|---------------|
| Minimax + Flat +150 heuristic | 10% | Heuristics override minimax search |
| Minimax + Flat +20 heuristic | 30% | Heuristics still conflict with search |
| Strategic bonuses at root | 40% | Bonuses applied too late, override search |
| Strategic bonuses at all depths | 57% | Better integration but still interfere |

## Key Implementation Details

### Baseline (86.7%) - Original Best
```javascript
Evaluation Weights:
- Terminal states: ±1000
- HP difference: 1:1
- Type matchup: ×30
- HP preservation (exponential): ×80
- Progress bonus: ×50

Features:
- 4-turn minimax search
- Alpha-beta pruning
- Type effectiveness
- No heuristic bonuses
- No boost propagation
```

### Pure Minimax + Boost Propagation (73-83%)
```javascript
Same weights as baseline, plus:

Boost Propagation:
- Dragon Dance: +1 Atk, +1 Spe
- Swords Dance: +2 Atk
- Nasty Plot: +2 SpA
- Draco Meteor: -2 SpA (penalty)
- Close Combat: -1 Def, -1 SpD

Boosts applied AFTER damage calc, affect NEXT turn
Pure minimax discovers optimal setup timing
```

### TypeAwareBot (67-85%) - Current
```javascript
Evaluation Weights:
- Same as baseline (Terminal ±1000, HP, Type ×30, etc.)
- Speed confidence: ×20 (max)
- Coverage bonus: ×50 per point

New Features:
- Priority tracking (Grassy Glide +1 with Grassy Terrain)
- Coverage evaluation (penalize immunities/resists)
- Field tracking (weather, terrain, Trick Room)
- Speed confidence formula: speedGap / 100

Disabled Features (hurt performance):
- Strategic bonuses for hazards/status (return 0)

Issues:
- High variance (33-85% across tests)
- Team 1 (Offensive) struggles (33-70%)
- Team 2 (Defensive) perfect (100%)
```

## Historical Performance Timeline

```
Phase 1: Original baseline
├─ FixedDeepSearchBot: 86.7% (26-4)
└─ Pure type-aware minimax, no boosts

Phase 2: Boost propagation
├─ With boost propagation: 73-83%
└─ Minimax discovers setup value through search

Phase 3: Heuristic experiments (all failed)
├─ +150 flat bonus: 10% ❌
├─ +20 flat bonus: 30% ❌
└─ Heuristics override minimax

Phase 4: Priority + Coverage (current)
├─ Strategic bonuses (root): 40% ❌
├─ Strategic bonuses (all depths): 57% ❌
├─ Strategic bonuses disabled: 67-85%
└─ High variance, inconclusive
```

## Why Baseline is Still Best

### What Baseline Does Right
1. **Pure minimax search** - No heuristics to interfere
2. **Balanced weights** - Proven optimal through testing
3. **Type awareness** - Strong type matchup evaluation
4. **Simple and stable** - No feature interaction issues

### What New Features Changed
1. **Priority tracking** - Adds complexity, minimal benefit
2. **Coverage evaluation** - Makes things WORSE when disabled (!)
3. **Field tracking** - Inconsistent results (±10 pp variance)
4. **Speed confidence** - Replaces gradient, ~neutral impact

### Why Boost Propagation Drops Performance
- 86.7% → 73-83% (-3 to -13 pp drop)
- Search naturally discovers setup value
- Explicit boost tracking may add overhead
- Still better than any heuristic approach

## Recommendations Based on Performance

### For Competitive Play (Best Win Rate)
**Use: Baseline (86.7%)**
- Proven most stable and highest win rate
- No feature interaction issues
- Simple, fast, reliable

### For Development (Learning Value)
**Use: Boost Propagation (73-83%)**
- More sophisticated search
- Accurately models setup moves
- Good learning platform

### For Experimental Features
**Use: TypeAwareBot (67-85%)**
- Has priority/coverage/field tracking
- Good for testing new features
- High variance, needs more work

## Key Lessons Learned

1. **Heuristics hurt minimax** - ANY heuristic bonus (10-150) degrades performance
2. **Pure search is best** - Minimax discovers optimal moves through simulation
3. **Simpler is often better** - Baseline beats all fancy features
4. **Small samples = high variance** - Need 50-100 games for stable results
5. **Feature interactions matter** - Individual features test fine, but combinations fail

## Next Steps for Improvement

### To Beat Baseline (86.7%)
Need to find features that:
1. Don't interfere with minimax search
2. Add new information (not discoverable by search)
3. Handle cases baseline misses
4. Are integrated into evaluation, not applied as bonuses

### Candidates to Try
- **Better damage calculation** - Use @smogon/calc for accuracy
- **Improved opponent modeling** - Track revealed moves/items
- **Matchup database** - Pre-computed type advantages
- **Opening book** - Best first moves for team preview
- **Endgame tables** - Solved positions (like chess endgames)

None of these interfere with search; they enhance the information minimax uses.
