# Checkpoint: Entry Hazards + Status Conditions - 76.7% Win Rate

**Commit**: 865c16d17c3dfd93cb573c601f9d692229ad518c
**Tag**: v76.7-hazards-status (local only)
**Date**: 2026-01-26

## Performance

- **Overall**: 76.7% (23-7 in 30 games)
- **Team 1**: 73.3% (11-4)
- **Team 2**: 80.0% (12-3)
- **Improvement from baseline**: +23.4 percentage points (53.3% → 76.7%)

## Features Implemented

1. **Entry Hazards**:
   - Stealth Rock tracking and damage calculation (type-dependent)
   - Spikes tracking (0-3 layers)
   - Hazard damage integrated into switch evaluation
   - Strategic value: +150 for Stealth Rock, +100/70/40 for Spikes

2. **Status Conditions**:
   - Burn, Paralysis, Sleep, Poison, Toxic tracking
   - Burn halves physical damage
   - Paralysis halves speed (Gen 7+)
   - Type immunity checks (Electric immune to paralysis, Fire to burn, etc.)
   - Strategic value: +100 for burning physical attackers, +90 for paralyzing fast threats

3. **Switch Lookahead V2**:
   - Switches considered in minimax tree
   - Only at type disadvantage (matchup < -2)
   - NOT on low HP (sacrifice > transfer damage)
   - Regenerator-aware switching

## Revert Instructions

To revert to this checkpoint if needed:

```bash
git checkout 865c16d17c3dfd93cb573c601f9d692229ad518c
# Or
git checkout v76.7-hazards-status
```

## Next Steps

Attempting to fix boost application bug to enable accurate damage calculations in minimax search.

**Risk**: Boost tracking has failed twice (40% and 6.7% win rates). If this attempt fails, revert to this checkpoint.
