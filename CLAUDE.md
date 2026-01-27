# CLAUDE.md - Pokemon Showdown Optimal Move Calculator

## Project Overview

This project builds an AI that determines optimal moves in Pokemon Showdown battles using traditional search algorithms (minimax with alpha-beta pruning). The bot plays Gen 9 OU format using the `@pkmn/sim` battle simulator locally (no server connection required).

**Current Best Bot**: `TypeAwareBot` -- 83-87% win rate vs `TreeSearchBot` in Gen 9 OU with Smogon sample teams.

**Language**: Node.js / JavaScript (no TypeScript, no build step)

## Quick Start

```bash
npm install                              # Install dependencies
npm run battle                           # Single random battle (RandomBot vs RandomBot)
npm run ou-test 1000                     # 1000 OU battles (SmartDamageBot vs RandomBot)
node examples/typeaware-vs-treesearch.js # TypeAwareBot vs TreeSearchBot head-to-head
node examples/ou-battle-test.js 100      # 100 OU battle comparison
```

## Dependencies

All from `package.json`:
- `@pkmn/sim` (^0.10.5) -- Battle simulation engine
- `@pkmn/dex` (^0.10.5) -- Pokemon data (species, moves, abilities, items)
- `@pkmn/randoms` (^0.10.5) -- Random team generation
- `@smogon/calc` (^0.10.0) -- Accurate damage calculation

**No test framework** -- testing uses custom battle statistic scripts running 30-1000+ battles.

## Project Structure

```
showdown/
├── src/                              # All bot and infrastructure code
│   ├── BattleSimulator.js            # Random battle orchestrator (uses @pkmn/sim BattleStreams)
│   ├── OUBattleSimulator.js          # OU battle orchestrator (accepts custom teams)
│   ├── CompetitiveBattleSimulator.js # Variant simulator
│   ├── StatefulBattleSimulator.js    # Stateful variant
│   │
│   ├── GameState.js                  # Lightweight battle state for minimax search
│   ├── MoveSimulator.js              # Move execution + @smogon/calc damage calculation
│   ├── PositionEvaluator.js          # Position scoring (HP, status, boosts, matchups)
│   │
│   ├── RandomBot.js                  # Baseline: random move selection (~50% win rate)
│   ├── SmartDamageBot.js             # Heuristic: base power + STAB + stats (~60-70%)
│   ├── MaxDamageBot.js               # Full @smogon/calc damage calc
│   │
│   ├── TreeSearchBot.js              # Basic minimax with opponent tracking
│   ├── StatefulTreeSearchBot.js      # Minimax + state tracking
│   ├── MinimaxBot.js                 # Minimax + position evaluation
│   ├── EnhancedTreeSearchBot.js      # Enhanced minimax features
│   │
│   ├── DeepSearchBot.js              # 3-ply search
│   ├── ImprovedDeepSearchBot.js      # Improved deep search
│   ├── FixedDeepSearchBot.js         # Bug-fixed deep search
│   ├── OptimizedDeepSearchBot.js     # Performance-optimized variant
│   ├── OrderedDeepSearchBot.js       # Move-ordering optimization
│   │
│   ├── TypeAwareBot.js               # *** CURRENT BEST (1,759 LOC, 83-87%) ***
│   └── ImprovedTypeAwareBot.js       # Experimental variant (761 LOC)
│
├── data/
│   ├── ou-teams.js                   # 2 Smogon Gen 9 OU sample teams
│   └── pure-offense-teams.js         # Pure offense test teams
│
├── examples/                          # 40+ test and benchmark scripts
│   ├── simple-battle.js              # Basic battle demo
│   ├── ou-battle-test.js             # 1000-battle OU comparison
│   ├── typeaware-vs-treesearch.js    # Head-to-head competitive test
│   ├── analyze-losses.js             # Loss analysis tool
│   ├── test-smart-bot.js             # SmartDamageBot tester
│   ├── minimax-ou-test.js            # Minimax testing
│   ├── pure-offense-test.js          # Pure offense variant
│   ├── switch-lookahead-test.js      # Switch strategy testing
│   └── debug-*.js                    # Various debug scripts
│
├── docs/
│   ├── priority-implementation-plan.md   # Priority move implementation plan
│   └── speed-priority-analysis.md        # Speed and priority mechanics analysis
│
├── CLAUDE.md                          # This file
├── README.md                          # Project overview
├── package.json                       # Dependencies and scripts
└── *.md                               # ~15 analysis/results documents (see below)
```

### Analysis Documents (root)

These markdown files document the experimental results and lessons learned at each stage:

| File | Summary |
|------|---------|
| `BOOST_FIX_SUCCESS.md` | 86.7% win rate after boost propagation fix |
| `BOOST_FIX_30_GAME_RESULTS.md` | 30-game validation of boost fix |
| `SWITCH_LOOKAHEAD_V2_SUCCESS.md` | Switch lookahead V2 breakthrough (73.3%) |
| `SWITCH_LOOKAHEAD_RESULTS.md` | V1 results (inconclusive at 50%) |
| `HAZARDS_STATUS_RESULTS.md` | Hazard + status tracking (76.7%) |
| `CHECKPOINT_76.7.md` | Checkpoint at 76.7% win rate |
| `RECOMMENDED_STRATEGIES.md` | 5 ranked improvement strategies |
| `SPEED_CONTROL_ANALYSIS.md` | Speed mechanics analysis |
| `TEAM_COVERAGE_ANALYSIS.md` | Team matchup evaluation |
| `TEAM2_UNDERPERFORMANCE_ANALYSIS.md` | Why Team 2 performs worse |
| `TEAM_AWARE_FAILURE_ANALYSIS.md` | Why team-aware eval degraded performance |
| `SETUP_MOVES_FINAL_RESULTS.md` | Setup move detection results |
| `SETUP_DETECTION_FAILED_V2.md` | Setup detection failures |
| `SETUP_STRATEGIC_VALUE_FAILED.md` | Strategic value approach failure |
| `SETUP_SPEED_COVERAGE_FAILED.md` | Speed/coverage approach failure |
| `OU-RESULTS.md` | 1000-battle OU baseline results |

## Architecture

```
┌─────────────────────────────────────────────┐
│  OUBattleSimulator / BattleSimulator        │
│  (Manages @pkmn/sim BattleStreams)          │
│  - Creates streams for P1 and P2            │
│  - Reads |request| JSON and |turn| events   │
│  - Calls bot.chooseMove(request) each turn  │
│  - Detects |win| and |tie| events           │
└──────────────┬──────────────────────────────┘
               │ request JSON
               ↓
┌─────────────────────────────────────────────┐
│  Bot (e.g., TypeAwareBot)                   │
│  - Parses request → active moves + team     │
│  - Tracks opponent from battle messages     │
│  - Runs minimax search (4-ply, alpha-beta)  │
│  - Evaluates positions via scoring function │
│  - Returns "move N" or "switch N"           │
└──────────────┬──────────────────────────────┘
               │ damage queries
               ↓
┌─────────────────────────────────────────────┐
│  MoveSimulator                              │
│  - Uses @smogon/calc for damage calculation │
│  - Handles speed/priority for move order    │
│  - Simulates turn outcomes on GameState     │
└─────────────────────────────────────────────┘
```

### Data Flow Per Turn

1. `@pkmn/sim` sends `|request|` JSON to each player's stream
2. Bot receives `request` containing: active Pokemon, available moves (with PP), full team roster, force-switch flags
3. Bot also receives battle log lines (used for opponent tracking: `|switch|`, `|move|`, `|-damage|`, `|-boost|`, etc.)
4. Bot's `chooseMove(request)` runs the search algorithm and returns a choice string: `"move 1"`, `"move 2"`, `"switch 3"`, etc.
5. Simulator processes both players' choices and advances the turn

## TypeAwareBot -- Current Best Implementation

`src/TypeAwareBot.js` (1,759 LOC) is the most advanced bot. Key features:

### Search
- **4-ply minimax** with alpha-beta pruning
- Move ordering for better pruning efficiency
- Loop detection to prevent move repetition deadlocks
- State cloning to avoid mutation during search

### Evaluation
- **Type effectiveness scoring** (heavy weight) -- evaluates active matchup
- **HP preservation** with exponential bonus for high-HP Pokemon
- **Pokemon count** advantage (material)
- **Status conditions** (burn, paralysis, sleep tracked for both sides)
- **Entry hazards** (Stealth Rock, Spikes, Toxic Spikes tracked)
- **Stat boosts** propagated through the search tree
- **Speed advantage** as confidence gradient (not binary)

### Intelligence
- **Proactive switching**: considers switches in minimax when at type disadvantage
- **Opponent tracking**: monitors battle messages for opponent species, HP, moves, status
- **Boost propagation**: setup moves (Dragon Dance, Swords Dance, etc.) and stat-lowering attacks (Draco Meteor, Close Combat) update boosts in the search tree
- **Team composition awareness**: cached offensive/defensive style analysis

### Setup Moves Database
The bot tracks stat changes for both setup moves and stat-lowering attacks:
```javascript
// Setup moves
'dragondance': { atk: 1, spe: 1 }
'swordsdance': { atk: 2 }
'shellsmash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }

// Stat-lowering attacks (high power now, penalty later)
'dracometeor': { spa: -2 }
'closecombat': { def: -1, spd: -1 }
```

## Bot Evolution and Win Rates

| Generation | Bot | Win Rate | Key Innovation |
|------------|-----|----------|----------------|
| 1 | `RandomBot` | 50% | Baseline (random moves) |
| 2 | `SmartDamageBot` | 60-70% vs random | Base power + STAB + stat scaling |
| 3 | `TreeSearchBot` | ~59% | Basic minimax + opponent tracking |
| 4 | `FixedDeepSearchBot` | ~80% | 4-ply alpha-beta + loop detection fix |
| 5 | `TypeAwareBot` | **83-87%** | Type effectiveness + smart switching + boost propagation |

### Key Breakthroughs (What Worked)
- **Switch Lookahead V2** (+20%): switching only when at type disadvantage (not all disadvantages)
- **Boost Propagation** (+10-15%): tracking stat changes through the search tree
- **Type Effectiveness Scoring**: heavily weighting type advantage in evaluation
- **Loop Detection Fix**: preventing infinite move repetition (59% -> 80%)

### Key Failures (What Did Not Work)
- **Team-aware evaluation alone**: degraded performance to ~50% (too general, diluted tactical focus)
- **Setup move strategic value**: catastrophic 0-10% win rates (bot would set up instead of attacking)
- **Stat-lowering moves in setup DB** (initially): caused issues without proper context
- **Switch Lookahead V1**: inconclusive at 50% (switching too aggressively)
- **Reinforcement learning approaches**: historically poor vs search-based methods for Pokemon AI

## Testing Methodology

### No Formal Test Framework

Tests are battle simulations run via scripts in `examples/`. Results are measured by win rate over many games.

### Running Tests

```bash
# Standard benchmark: TypeAwareBot vs TreeSearchBot (30 games)
node examples/typeaware-vs-treesearch.js

# Large-scale OU comparison (1000 battles)
node examples/ou-battle-test.js 1000

# SmartDamageBot vs RandomBot (100 battles)
node examples/test-smart-bot.js 100

# Loss analysis (generates detailed logs)
node examples/analyze-losses.js
```

### Test Infrastructure
- **Battle Statistics**: Custom class in example scripts tracks win/loss/draw rates
- **Progress Bars**: Visual feedback during multi-battle runs
- **Loss Logging**: Detailed battle logs written to `loss-logs-*.txt` and `improved-loss-logs-*.txt`
- **Timeout Safety**: Battles capped at 100 turns to prevent infinite loops

### Benchmarking New Changes
When testing a code change:
1. Run 30+ games minimum (statistical significance)
2. Compare against the established baseline (TypeAwareBot at 83-87%)
3. Log and analyze losses with `analyze-losses.js`
4. Document results in a markdown file at the project root

## Key Conventions

### API-First Approach

**ALWAYS** check if the Pokemon Showdown ecosystem provides an official package before implementing something yourself:
- `@pkmn/sim` -- Battle simulation
- `@pkmn/dex` -- Pokemon data (use `Dex.species.get()`, `Dex.moves.get()`, etc.)
- `@smogon/calc` -- Damage calculation (do NOT implement damage calc from scratch)
- `@pkmn/randoms` -- Random team generation

### Damage Calculation

Use `@smogon/calc`. Example:
```javascript
const { calculate, Pokemon, Move, Generations } = require('@smogon/calc');
const gen = Generations.get(9);

const attacker = new Pokemon(gen, 'Charizard', {
  item: 'Choice Specs', nature: 'Timid',
  evs: { spa: 252, spe: 252 }, boosts: { spa: 1 }
});
const defender = new Pokemon(gen, 'Blastoise', {
  item: 'Assault Vest', nature: 'Modest',
  evs: { hp: 252, spd: 252 }
});
const result = calculate(gen, attacker, defender, new Move(gen, 'Flamethrower'));
const damageRolls = result.damage; // Array of possible damage values
```

### Bot Interface

All bots implement the same interface:
```javascript
class MyBot {
  constructor(playerName) {
    this.name = playerName;
  }

  // Called each turn with the battle request JSON
  // Must return a string: "move N" or "switch N"
  chooseMove(request) {
    // request.active[0].moves -- available moves
    // request.side.pokemon -- full team
    // request.forceSwitch -- must switch (Pokemon fainted)
    return "move 1";
  }

  // Optional: called with battle log lines for opponent tracking
  processBattleMessage(line) {
    // Parse |switch|, |move|, |-damage|, etc.
  }
}
```

### Battle Simulator Usage

**Random battles** (no teams needed):
```javascript
const BattleSimulator = require('./src/BattleSimulator');
const sim = new BattleSimulator('gen9randombattle');
const result = await sim.runBattle(); // { winner, turns, ended }
```

**OU battles** (custom teams):
```javascript
const OUBattleSimulator = require('./src/OUBattleSimulator');
const { team1, team2 } = require('./data/ou-teams');
const sim = new OUBattleSimulator(bot1, bot2, team1, team2, { verbose: false, maxTurns: 100 });
const result = await sim.runBattle(); // { winner, turns, ended, bot1Name, bot2Name }
```

### Battle Protocol Reference

**Request JSON** (received from simulator each turn):
```json
{
  "active": [{
    "moves": [
      { "move": "Flamethrower", "id": "flamethrower", "pp": 24, "maxpp": 24, "disabled": false },
      { "move": "Earthquake", "id": "earthquake", "pp": 16, "maxpp": 16, "disabled": false }
    ]
  }],
  "side": {
    "pokemon": [
      { "ident": "p1: Charizard", "condition": "300/300", "active": true, "stats": {...}, "moves": [...] }
    ]
  },
  "forceSwitch": [false]
}
```

**Key battle log lines** for opponent tracking:
```
|switch|p2a: Landorus|Landorus-Therian, M|100/100      # Opponent sent out
|move|p2a: Landorus|Earthquake|p1a: Charizard            # Opponent used move
|-damage|p1a: Charizard|150/300                           # HP change
|-boost|p2a: Landorus|atk|1                               # Stat boost
|-status|p1a: Charizard|brn                               # Status applied
|-weather|Sandstorm|[from] ability: Sand Stream           # Weather change
|faint|p2a: Landorus                                      # Pokemon fainted
```

### Coding Standards

1. **Plain JavaScript** -- no TypeScript, no build step, `require()` for imports
2. **Class-based**: each bot is a class with `chooseMove(request)` method
3. **Immutable search**: clone `GameState` before modifying during minimax
4. **Log decisions**: include `console.log` for search stats (nodes evaluated, prune count) when debugging
5. **Error handling**: gracefully handle missing data in request objects, invalid moves, and fainted Pokemon
6. **Performance**: search must complete per turn; cap at 4-ply depth to avoid timeouts

### Adding a New Bot

1. Create `src/NewBot.js` with the bot interface above
2. Create `examples/test-new-bot.js` modeled after `examples/typeaware-vs-treesearch.js`
3. Run 30+ game benchmark against `TypeAwareBot`
4. Document results in a markdown file at project root

### Common Pitfalls

1. **Setup move overvaluation**: the bot tried valuing setup moves strategically and it caused catastrophic win rate drops. Boost propagation (tracking stat changes through search) works; explicit setup scoring does not.
2. **Over-aggressive switching**: Switch Lookahead V1 switched too often and lost. V2 only switches when at a clear type disadvantage.
3. **Team-aware eval without focus**: broad team evaluation dilutes tactical accuracy. Keep evaluation focused on the active matchup.
4. **Ignoring force-switch**: when `request.forceSwitch` is true, you must switch (no moves available). Always check this first.
5. **Infinite loops**: without loop detection, some battles never end. Track recent moves and break repetition.
6. **State mutation during search**: always clone `GameState` before modifying in minimax branches.

## Current Status

**Phase**: Active optimization (Phases 1-4 complete, Phase 5 in progress)

### Completed
- [x] Local battle simulation with @pkmn/sim
- [x] Battle state parsing from protocol messages
- [x] Random bot baseline (50%)
- [x] Damage heuristic bot (60-70%)
- [x] Full @smogon/calc damage calculation integration
- [x] Minimax with alpha-beta pruning (4-ply)
- [x] Opponent tracking from battle messages
- [x] Type effectiveness evaluation
- [x] Proactive switch intelligence
- [x] Entry hazard tracking (Stealth Rock, Spikes, Toxic Spikes)
- [x] Status condition tracking
- [x] Stat boost propagation in search tree
- [x] Loop detection and prevention

### In Progress / Next Steps
- [ ] **Priority move awareness** (Mach Punch, Aqua Jet, Grassy Slide) -- see `docs/priority-implementation-plan.md`
- [ ] **Coverage-aware move selection** when multiple moves can KO
- [ ] **Terrain tracking** (Grassy, Electric, Psychic, Misty)
- [ ] **Trick Room** handling
- [ ] Speed confidence reframing in evaluation

### Not Started
- [ ] Team preview optimization
- [ ] Ability-specific interactions (Regenerator, Protosynthesis, Prankster)
- [ ] Weather condition effects (partial)
- [ ] Item tracking (Choice Scarf for speed)
- [ ] Doubles/VGC support
- [ ] Tera type mechanics
- [ ] Transposition tables for search optimization

## Resources

### Official
- [Pokemon Showdown Repository](https://github.com/smogon/pokemon-showdown)
- [Battle Protocol Spec](https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md)
- [@pkmn/sim on npm](https://www.npmjs.com/package/@pkmn/sim)
- [@smogon/calc on npm](https://www.npmjs.com/package/@smogon/calc)

### Example Bots
- [foul-play](https://github.com/pmariglia/foul-play) -- Python search-based AI (minimax)
- [showdown-battle-bot](https://github.com/Synedh/showdown-battle-bot) -- Socket bot
- [PokemonShowdownBot](https://github.com/EnrcDamn/PokemonShowdownBot) -- Rule-based AI

### Research
- [PokéChamp Paper](https://arxiv.org/html/2503.04094v1) -- Expert-level minimax agent

---

*Last Updated*: 2026-01-27
