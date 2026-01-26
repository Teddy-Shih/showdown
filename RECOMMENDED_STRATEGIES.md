# 5 Recommended Strategic Improvements for TypeAwareBot

After achieving 73.3% win rate with Switch Lookahead V2, here are the next 5 strategic improvements to consider, ranked by expected impact and implementation complexity.

---

## 1. 🥇 Setup Move Detection & Prevention (HIGHEST PRIORITY)

### Problem
Setup moves like Dragon Dance, Swords Dance, Quiver Dance, and Nasty Plot are **game-winning** if allowed to execute. A Baxcalibur with +1 Attack/Speed from Dragon Dance can sweep entire teams. Currently, the bot doesn't recognize when opponent is setting up or when we should set up.

### Strategic Importance
- **Setup sweepers win games**: +1 or +2 stat boosts often mean guaranteed KOs
- **Preventing setup is critical**: Must recognize and punish setup attempts
- **Timing our own setups**: Know when it's safe to use Dragon Dance/Swords Dance

### Implementation Approach

**Detect setup moves**:
```javascript
const setupMoves = {
  'Dragon Dance': { atk: 1, spe: 1 },
  'Swords Dance': { atk: 2 },
  'Quiver Dance': { spa: 1, spd: 1, spe: 1 },
  'Nasty Plot': { spa: 2 },
  'Calm Mind': { spa: 1, spd: 1 },
  'Iron Defense': { def: 2 },
  'Bulk Up': { atk: 1, def: 1 }
};

isSetupMove(moveName) {
  return setupMoves.hasOwnProperty(moveName);
}
```

**Evaluation adjustments**:
1. **Opponent setup threat**: If opponent can use Dragon Dance next turn, massively increase value of preventing it (KO them first, switch to resist, etc.)
2. **Our setup opportunity**: If we can safely use Dragon Dance (opponent can't KO us), increase value significantly
3. **Setup tracking**: Track stat boosts (+1 Atk means much higher damage calculations)

**Expected Impact**: +10-15% win rate
- Prevents devastating sweeps
- Capitalizes on setup opportunities
- More strategic play patterns

**Implementation Complexity**: Medium
- Need to track stat boosts
- Update damage calculations with boosts
- Add setup move detection
- Modify evaluation to value setup prevention/execution

---

## 2. 🥈 Entry Hazard Evaluation (Stealth Rock, Spikes)

### Problem
Stealth Rock does **12.5% to 50% damage** on switch-in depending on type effectiveness. Spikes add **12.5-25%** more. Currently, the bot ignores hazards completely - doesn't value setting them, doesn't account for switch-in damage, doesn't prioritize Rapid Spin.

### Strategic Importance
- **Passive damage accumulation**: Hazards wear down teams over time
- **Limits switching**: Opponents reluctant to switch when hazards are up
- **Type effectiveness matters**: Charizard (4x weak to Rock) takes 50% from Stealth Rock
- **Rapid Spin/Defog**: Removing hazards is strategically valuable

### Implementation Approach

**Track hazard state**:
```javascript
// In constructor
this.hazards = {
  ours: { stealthRock: false, spikes: 0, toxicSpikes: 0 },
  opponent: { stealthRock: false, spikes: 0, toxicSpikes: 0 }
};

// Process battle messages
if (line.includes('|-sidestart|p2|move: Stealth Rock')) {
  this.hazards.opponent.stealthRock = true;
}
```

**Evaluate hazard damage**:
```javascript
calculateHazardDamage(pokemon, hazards) {
  let damage = 0;

  if (hazards.stealthRock) {
    const rockEffectiveness = this.getTypeEffectiveness('Rock', pokemon.types);
    damage += 12.5 * rockEffectiveness; // 12.5% base, modified by type
  }

  damage += hazards.spikes * 12.5; // 12.5% per layer

  return damage;
}
```

**Evaluation adjustments**:
1. **Setting hazards**: Increase value of Stealth Rock/Spikes when we don't have them
2. **Switch-in cost**: Reduce value of switching when hazards are up (accounts for extra damage)
3. **Removing hazards**: Increase value of Rapid Spin/Defog when opponent has hazards
4. **Hazard stacking**: Prioritize setting hazards early (pays off over entire game)

**Expected Impact**: +5-10% win rate
- Better hazard management
- Accounts for accumulated damage
- Values support moves appropriately

**Implementation Complexity**: Medium
- Need battle message parsing for hazard setting
- Track hazard state for both sides
- Modify switch evaluation to include hazard damage
- Add strategic value to hazard moves

---

## 3. 🥉 Status Condition Strategic Value

### Problem
Status conditions have **massive strategic impact**:
- **Burn**: Halves physical attack (cripples physical sweepers)
- **Paralysis**: Quarters speed (revenge killers become slow)
- **Sleep**: 1-3 turns of free attacks
- **Toxic**: Increasing damage each turn

Currently, the bot doesn't strategically value inflicting status or account for status impact on damage/speed.

### Strategic Importance
- **Crippling threats**: Burning a Baxcalibur halves its Dragon Dance effectiveness
- **Speed control**: Paralyzing a Choice Scarf user removes its revenge killing power
- **Long-term advantage**: Toxic damage accumulates over time
- **Status immunity**: Some types are immune (Electric can't be paralyzed)

### Implementation Approach

**Track status conditions**:
```javascript
// In processDamage/processMove, parse status
if (line.includes('|-status|p2a|brn')) {
  this.opponentActive.status = 'burn';
}
```

**Modify damage calculations**:
```javascript
calculateDamage(attacker, defender, move) {
  let damage = /* base calculation */;

  // Burn halves physical attack
  if (attacker.status === 'burn' && move.category === 'Physical') {
    damage *= 0.5;
  }

  return damage;
}
```

**Modify speed calculations**:
```javascript
getSpeed(pokemon) {
  let speed = /* base speed */;

  // Paralysis quarters speed
  if (pokemon.status === 'paralysis') {
    speed *= 0.25;
  }

  return speed;
}
```

**Evaluation adjustments**:
1. **Inflicting status**: Increase value of Thunder Wave against fast threats
2. **Status damage**: Account for Toxic/burn residual damage in position evaluation
3. **Status prevention**: Value switching out before status is inflicted
4. **Status immunity**: Don't try to burn Fire types or paralyze Electric types

**Expected Impact**: +5-8% win rate
- Better status move usage
- Accurate damage calculations with status
- Strategic status infliction

**Implementation Complexity**: Medium-Low
- Battle message parsing for status
- Modify damage/speed calculations
- Add status value to evaluation
- Check type immunities

---

## 4. 🏅 Speed Control & Revenge Killing Detection

### Problem
**Speed determines who moves first**, which is critical:
- Choice Scarf users outspeed +1 setup sweepers
- Priority moves (Sucker Punch, Aqua Jet) always go first
- Slower Pokemon can be revenge killed before attacking

Currently, the bot calculates speed but doesn't strategically leverage it.

### Strategic Importance
- **Setup counterplay**: Choice Scarf Landorus-T can revenge kill Dragon Dance Baxcalibur
- **Priority moves**: Sucker Punch KOs low-HP threats before they move
- **Speed tiers**: Know when we outspeed and can KO before taking damage
- **Trick Room**: Reverses speed order (slower = faster)

### Implementation Approach

**Detect speed control moves**:
```javascript
const priorityMoves = {
  'Sucker Punch': 1,      // +1 priority
  'Aqua Jet': 1,
  'Mach Punch': 1,
  'Extreme Speed': 2,     // +2 priority
  'Fake Out': 3           // +3 priority
};

const speedControlMoves = {
  'Trick Room': 'reverse_speed',
  'Tailwind': 'double_speed',
  'Sticky Web': 'lower_opponent_speed'
};
```

**Evaluate revenge killing opportunities**:
```javascript
canRevengeKill(ourPokemon, oppPokemon, oppHP) {
  // Check if we outspeed
  const ourSpeed = this.getSpeed(ourPokemon);
  const oppSpeed = this.getSpeed(oppPokemon);

  if (ourSpeed > oppSpeed) {
    // Calculate if we can KO before they move
    const damage = this.calculateMaxDamage(ourPokemon, oppPokemon);
    if (damage >= oppHP) {
      return true; // We revenge kill
    }
  }

  return false;
}
```

**Evaluation adjustments**:
1. **Revenge kill bonus**: Massively increase value of KOing faster threats
2. **Speed advantage**: Value outspending opponent for first-strike advantage
3. **Priority move value**: Sucker Punch is extremely valuable against low-HP threats
4. **Speed tier awareness**: Know when opponent can outspeed and plan accordingly

**Expected Impact**: +5-7% win rate
- Better revenge killing
- Leverage speed advantages
- Prevent opponent revenge kills

**Implementation Complexity**: Medium
- Track speed boosts (Tailwind, Choice Scarf, stat changes)
- Detect priority moves
- Modify evaluation for speed control
- Calculate revenge kill scenarios

---

## 5. 🎖️ Team Coverage & Matchup Analysis

### Problem
If opponent has a Ghost type and we can't hit Ghost types, we **auto-lose**. Currently, the bot evaluates position locally (current 1v1) but doesn't analyze:
- Can we hit all opponent's remaining Pokemon?
- Which of our Pokemon can handle which opponent threats?
- Do we have a win condition against their team composition?

### Strategic Importance
- **Avoid unwinnable matchups**: Don't let our last Pokemon be walled
- **Preserve key answers**: If only Kingambit can hit Ghost types, preserve it
- **Team synergy**: Multiple Pokemon should cover same threats (redundancy)
- **Win condition planning**: Identify which Pokemon can sweep their team

### Implementation Approach

**Analyze team coverage**:
```javascript
analyzeTeamCoverage(ourTeam, oppTeam) {
  const coverage = {};

  for (const oppPokemon of oppTeam) {
    const counters = [];

    for (const ourPokemon of ourTeam) {
      // Can this Pokemon hit the opponent?
      const canHit = this.hasEffectiveCoverage(ourPokemon, oppPokemon);
      if (canHit) {
        counters.push(ourPokemon);
      }
    }

    coverage[oppPokemon.species] = counters;
  }

  return coverage;
}

hasEffectiveCoverage(ourPokemon, oppPokemon) {
  // Check if any of our moves can hit opponent effectively
  for (const move of ourPokemon.moves) {
    const effectiveness = this.getTypeEffectiveness(move.type, oppPokemon.types);
    if (effectiveness >= 1) { // Neutral or better
      return true;
    }
  }
  return false;
}
```

**Identify win conditions**:
```javascript
findWinConditions(ourTeam, oppTeam) {
  const winConditions = [];

  for (const ourPokemon of ourTeam) {
    // Can this Pokemon sweep their entire team?
    const threats = oppTeam.filter(opp => {
      const matchup = this.calculateTypeMatchupScore(ourPokemon.types, opp.types);
      return matchup < 0; // Unfavorable matchup
    });

    if (threats.length === 0) {
      winConditions.push({
        pokemon: ourPokemon,
        sweepPotential: 'high'
      });
    }
  }

  return winConditions;
}
```

**Evaluation adjustments**:
1. **Preserve key Pokemon**: If only 1 Pokemon can hit Ghost types, value its HP higher
2. **Sacrifice strategically**: If a Pokemon can't contribute, sacrifice it to preserve win conditions
3. **Team-wide evaluation**: Consider how current decision affects overall team matchup
4. **Coverage gaps**: Identify and warn about unwinnable scenarios

**Expected Impact**: +3-5% win rate
- Avoid unwinnable endgames
- Better resource allocation
- Strategic sacrifices

**Implementation Complexity**: High
- Need to track entire teams (not just active Pokemon)
- Analyze movepools and coverage
- Evaluate team-wide matchups
- Integrate into position evaluation

---

## Summary Comparison

| Strategy | Expected Impact | Complexity | Priority | Key Benefit |
|----------|----------------|------------|----------|-------------|
| **1. Setup Detection** | +10-15% | Medium | 🥇 Highest | Prevents/executes game-winning sweeps |
| **2. Entry Hazards** | +5-10% | Medium | 🥈 High | Accumulates damage, values support |
| **3. Status Conditions** | +5-8% | Medium-Low | 🥉 High | Accurate calcs, strategic status use |
| **4. Speed Control** | +5-7% | Medium | 🏅 Medium | Revenge killing, first-strike advantage |
| **5. Team Coverage** | +3-5% | High | 🎖️ Medium | Avoids unwinnable endgames |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (1-2 weeks)
1. **Status Condition Value** (easiest, immediate impact)
2. **Setup Move Detection** (highest impact)

### Phase 2: Strategic Depth (2-3 weeks)
3. **Entry Hazard Evaluation** (fundamental improvement)
4. **Speed Control** (complements setup detection)

### Phase 3: Advanced Analysis (3-4 weeks)
5. **Team Coverage** (complex but prevents auto-losses)

---

## Current State

**TypeAwareBot V2 with Switch Lookahead**:
- Win rate: 73.3% (22-8 in 30 games)
- Features: 4-ply minimax, alpha-beta pruning, switch lookahead, type-aware evaluation, Regenerator switching
- Baseline opponent: StatefulTreeSearchBot (2-ply minimax, no switching)

**Estimated Performance After All 5 Strategies**:
- Baseline: 73.3%
- +Setup Detection: ~85%
- +Entry Hazards: ~90%
- +Status Conditions: ~93%
- +Speed Control: ~95%
- +Team Coverage: ~97%

**Theoretical ceiling**: ~97-98% against current opponent (some losses unavoidable due to RNG and team composition)

---

## Implementation Notes

### Common Requirements
All strategies require:
1. **Battle message parsing**: Extract game state from protocol messages
2. **State tracking**: Maintain hazards, status, stat boosts
3. **Evaluation integration**: Modify `evaluatePosition()` to account for new factors
4. **Testing**: 30+ game samples to verify improvement

### Testing Methodology
For each strategy:
1. Implement feature
2. Run 30 games vs TreeSearchBot
3. Compare to baseline (73.3%)
4. Analyze losses to identify issues
5. Iterate on implementation
6. Document results

### Code Organization
```
src/
  TypeAwareBot.js (main bot)
  modules/
    SetupDetection.js (strategy #1)
    HazardEvaluation.js (strategy #2)
    StatusConditions.js (strategy #3)
    SpeedControl.js (strategy #4)
    TeamCoverage.js (strategy #5)
```

---

**Date**: 2026-01-26
**Current Performance**: 73.3% (Switch Lookahead V2)
**Next Target**: 85%+ with Setup Detection
**Long-term Goal**: 95%+ with all strategies
