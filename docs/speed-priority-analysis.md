# Speed-Aware Move Ordering and Priority Moves Analysis

## Current Implementation Issues

### 1. Priority Moves Not Considered

**Problem**: The current move ordering implementation (TypeAwareBot.js:1053-1095) doesn't account for move priority.

**Example Scenario** (Your Example):
- Ogerpon-Hearthflame with Grassy Terrain active
- Opponent: Urshifu-Rapid-Strike at 10 HP
- Available moves:
  - **Grassy Slide**: +1 priority (with Grassy Terrain), Grass-type
  - **Ivy Cudgel**: Normal priority (0), better coverage (Fire-type)
- Switch threat: Gholdengo in back (immune to Grass)

**Current Behavior**:
```javascript
// Line 1058: Check if we're faster
const weFaster = ourSpeed > oppSpeed;

if (damage >= oppHP) {
  if (weFaster) {
    orderScore = 200000 + damage; // Highest priority
  } else {
    orderScore = 100000 + damage; // High but risky
  }
}
```

**Problem**:
1. If `ourSpeed > oppSpeed` (we outspeed naturally):
   - Both Grassy Slide AND Ivy Cudgel get 200k priority (same!)
   - Bot doesn't consider that Grassy Slide fails on switch to Gholdengo
   - No incentive to choose Ivy Cudgel for better coverage

2. If `ourSpeed < oppSpeed` (we're slower):
   - Grassy Slide gets 200k priority (because +1 priority means we go first)
   - Ivy Cudgel gets 100k priority (we're slower)
   - Bot correctly prefers Grassy Slide
   - BUT: Still loses momentum on switch to Gholdengo

### 2. Speed Evaluation: Binary vs Gradient

**Current Implementation** (TypeAwareBot.js:1544-1569):
```javascript
const speedDiff = Math.min(ourSpeed - oppSpeed, 100); // Cap at 100
score += speedDiff * 0.2; // 0.2 per point (max +20)
```

**Your Point**: Speed should be binary because:
- Being 1 point faster = being 100 points faster (both move first)
- Game mechanics don't have "degrees" of fastness

**Counterargument** (Hidden Information):
- We don't know opponent's exact speed (EVs, IVs, nature unknown)
- We estimate based on base stats + assumptions
- Gradient represents **confidence** in being faster
- 100-point advantage = more likely to be faster even with EV variations
- 1-point advantage = could be slower if opponent invested in speed

**Current Max of +20**: Probably sufficient as an uncertainty approximation.

## Proposed Solutions

### Solution 1: Priority-Aware Move Ordering

**Add Priority to Damage Calculation**:
```javascript
orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
  const moveScores = [];

  const ourSpeed = this.getSpeed(ourPokemon, this.ourBoosts);
  const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);

  for (const move of moves) {
    const moveData = this.dex.moves.get(move.id);
    const damage = this.calculateDamage(...);

    // NEW: Get effective priority
    const movePriority = this.getEffectivePriority(moveData, ourPokemon);

    // NEW: Determine move order accounting for priority
    const weGoFirst = this.determineMovereOrder(
      ourSpeed, movePriority,
      oppSpeed, 0 // Assume opponent uses normal priority
    );

    let orderScore = 0;

    if (damage >= oppHP) {
      // KO move
      if (weGoFirst) {
        orderScore = 200000 + damage;
      } else {
        orderScore = 100000 + damage;
      }
    } else if (damage > 0) {
      // Damaging move
      if (weGoFirst) {
        orderScore = 15000 + damage;
      } else {
        orderScore = 10000 + damage;
      }
    }

    moveScores.push({ move, score: orderScore });
  }

  moveScores.sort((a, b) => b.score - a.score);
  return moveScores.map(ms => ms.move);
}

// NEW: Helper to get effective priority
getEffectivePriority(move, pokemon) {
  let priority = move.priority || 0;

  // Grassy Slide: +1 priority with Grassy Terrain
  if (move.name === 'Grassy Slide' && this.terrain === 'Grassy') {
    priority = 1;
  }

  // Aqua Jet, Bullet Punch, etc: Always +1
  // Extreme Speed: +2
  // Fake Out: +3
  // (handled by move.priority)

  return priority;
}

// NEW: Determine who goes first with priority
determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority) {
  // Higher priority goes first
  if (ourPriority > oppPriority) return true;
  if (oppPriority > ourPriority) return false;

  // Same priority: speed determines order
  return ourSpeed >= oppSpeed;
}
```

### Solution 2: Coverage-Aware KO Moves

**Problem**: When we can KO but opponent might switch, coverage matters.

**Heuristic**:
- If we outspeed naturally (no priority needed), prefer moves with better coverage
- "Better coverage" = hits more of opponent's team super-effectively

**Implementation**:
```javascript
orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
  // ... existing code ...

  for (const move of moves) {
    const moveData = this.dex.moves.get(move.id);
    const damage = this.calculateDamage(...);

    const weGoFirst = this.determineMoveOrder(...);

    let orderScore = 0;

    if (damage >= oppHP && weGoFirst) {
      // Can KO and we go first
      orderScore = 200000 + damage;

      // NEW: Coverage bonus if we outspeed naturally (no priority needed)
      const naturallyFaster = ourSpeed >= oppSpeed;
      const needsPriority = !naturallyFaster && movePriority > 0;

      if (naturallyFaster && !needsPriority) {
        // We outspeed naturally - coverage matters more
        // Evaluate: how many opponent Pokemon does this move hit SE?
        const coverageBonus = this.evaluateMoveCoverageVsTeam(
          moveData,
          this.opponentTeam
        );
        orderScore += coverageBonus * 100; // Boost moves with better coverage
      }
    }

    moveScores.push({ move, score: orderScore });
  }

  // ... rest ...
}

// NEW: Evaluate how many opponent Pokemon this move hits super-effectively
evaluateMoveCoverageVsTeam(move, oppTeam) {
  if (!oppTeam || oppTeam.length === 0) return 0;

  let coverageScore = 0;

  for (const oppPokemon of oppTeam) {
    const species = this.dex.species.get(oppPokemon.species);
    const effectiveness = this.getTypeEffectiveness(move.type, species.types);

    if (effectiveness === 0) {
      // Immune - very bad
      coverageScore -= 3;
    } else if (effectiveness < 1) {
      // Resisted - bad
      coverageScore -= 1;
    } else if (effectiveness > 1) {
      // Super effective - good
      coverageScore += 2;
    }
    // Neutral = 0
  }

  return coverageScore;
}
```

### Solution 3: Keep Speed Gradient (With Justification)

**Recommendation**: Keep the current gradient approach `speedDiff * 0.2` (max +20)

**Rationale**:
1. **Hidden Information**: We don't know exact opponent speeds
2. **Reasonable Approximation**: Larger speed gaps = higher confidence
3. **Already Capped**: Max of +20 prevents overweighting
4. **Works Well in Practice**: 83.3% win rate suggests it's effective

**Alternative (Binary with Confidence)**:
```javascript
// Binary approach with confidence multiplier
if (ourSpeed > oppSpeed) {
  const confidence = Math.min(speedDiff / 50, 1.0); // 0 to 1
  score += 20 * confidence; // Scale from 0 to +20 based on confidence
}
```

This still maxes at +20 but makes the distinction clearer: it's about confidence, not raw speed value.

## Testing Plan

### Test 1: Priority Move Scenarios
- Ogerpon-Hearthflame vs Urshifu (your example)
- Grassy Terrain active
- Measure: Does bot prefer Ivy Cudgel when it outspeeds naturally?

### Test 2: Coverage vs Priority Trade-off
- Create scenarios where:
  - Priority move KOs current opponent
  - Normal move KOs current opponent + has better coverage
- Measure: Does bot make smart coverage decisions?

### Test 3: Speed Evaluation Impact
- Compare binary vs gradient speed evaluation
- Run 30 battles each
- Measure: Which performs better?

## Expected Outcomes

### With Priority-Aware Ordering
- **Better**: Won't waste priority moves when unnecessary
- **Better**: Will choose coverage moves when opponent likely to switch
- **Better**: More strategic move selection in complex scenarios

### Impact on Win Rate
- Current: 83.3% (with +20 heuristic)
- Expected: 85-87% (fixing priority awareness should help 2-4%)

## Implementation Priority

1. **HIGH**: Add priority tracking and move order determination
2. **HIGH**: Add coverage evaluation for KO moves when outspeeding naturally
3. **MEDIUM**: Add terrain tracking (for Grassy Slide, Electric Terrain, etc.)
4. **LOW**: Consider binary speed evaluation (current gradient works well enough)

## Your Specific Questions

### Q1: "Speed should be binary instead of gradient?"

**Answer**: I'd keep the gradient approach (0.2 per speed point, max +20) because:
- It represents confidence with hidden information
- Max of 20 is already conservative
- It's working well (83% win rate)

However, if you want to make it clearer it's about confidence, rename/reframe it:
```javascript
// OLD: Looks like speed itself has gradual value
score += speedDiff * 0.2; // 0.2 per point of speed advantage

// NEW: Makes it clear this is confidence in being faster
const speedConfidence = Math.min(speedDiff / 100, 1.0);
score += 20 * speedConfidence; // Scale from 0 to +20 based on confidence
```

### Q2: "Priority vs coverage for switch-ins?"

**Answer**: Excellent point! The bot should:
1. Track move priority (not currently done)
2. When multiple moves can KO:
   - If priority needed to go first → use priority move
   - If naturally faster → prefer move with better coverage for switch-ins

This is a real gap in the current implementation.

### Q3: "Thoughts on my suggestions?"

**Your Analysis**: Spot on! The priority move handling is definitely missing, and it's a strategic nuance that matters in competitive play.

**Pushback**: The gradient speed evaluation is actually fine as an uncertainty approximation. The issue isn't the evaluation, it's the move ordering not considering priority.

**Next Steps**:
1. Implement priority-aware move ordering (high impact)
2. Add coverage evaluation for KO moves (medium impact)
3. Test and measure improvement

Would these changes align with what you had in mind?
