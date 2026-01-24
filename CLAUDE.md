# CLAUDE.md - Pokemon Showdown Optimal Move Calculator

## Project Overview

This project aims to build a program that can determine the optimal move(s) in any given Pokemon Showdown battle situation using traditional search algorithms (e.g., minimax, alpha-beta pruning, Monte Carlo tree search).

**Goal**: Create an AI that can analyze a battle state and recommend the best possible move(s) based on lookahead search and state evaluation.

## Pokemon Showdown API Overview

### What is Pokemon Showdown?

Pokemon Showdown is an open-source Pokemon battle simulator that:
- Simulates singles, doubles, and triples battles for Generations 1-9
- Provides a complete JavaScript/Node.js battle simulation engine
- Offers programmatic access via various APIs and libraries
- Uses a newline-and-pipe-delimited text protocol for battle communication

**Official Repository**: https://github.com/smogon/pokemon-showdown

### Key Components

#### 1. Battle Simulator (✅ Available)

Pokemon Showdown **DOES offer a battle simulator** that can be used programmatically:

**Installation**:
```bash
npm install pokemon-showdown
```

**What the Simulator Provides**:
- Complete battle simulation in Node.js
- Pokédex data access (stats, types, moves, abilities, items)
- Team validation and generation
- Full battle mechanics for all generations
- TypeScript type definitions

**Important Documentation Files**:
- `sim/README.md` - Main simulator documentation
- `sim/SIMULATOR.md` - Battle simulation API
- `sim/TEAMS.md` - Team management
- `sim/DEX.md` - Pokédex data access
- `sim/SIM-PROTOCOL.md` - Battle protocol specification

#### 2. Battle Protocol

The simulator uses a text-based protocol with these key features:

**Battle State Information Available**:
- Current turn number
- Weather and field conditions (Trick Room, terrain, etc.)
- Side conditions (Stealth Rock, screens, hazards, etc.)
- Pokemon identification and details (species, level, gender)
- HP values (exact for your team, percentages for opponent)
- Stats, moves, and PP for your Pokemon
- Status conditions (burn, paralysis, sleep, etc.)
- Volatile effects (confusion, Substitute, stat changes, etc.)

**Move Selection Format**:
```
/choose move MOVENAME
/choose move SLOTNUMBER
/choose switch POKEMONNAME
/choose switch SLOTNUMBER
```

**Request Object**: The `|request|` message provides a JSON object containing:
- Active Pokemon information
- Available moves with PP, name, target, disabled status
- Full team roster
- Force switch requirements

#### 3. Command-Line Interface

Pokemon Showdown includes CLI tools for:
- Simulating battles from scripts
- Testing team compositions
- Debugging battle mechanics

See `COMMANDLINE.md` in the official repository.

### Alternative Libraries for Bot Development

#### poke-env (Python)
- **Language**: Python
- **Purpose**: Reinforcement learning and bot development
- **Features**: High-level API for battles, moves, Pokemon
- **Integration**: Farama Gymnasium interface
- **Documentation**: https://poke-env.readthedocs.io/

#### pkmn/engine (Zig/C)
- **Language**: Zig (with C bindings)
- **Purpose**: Performance-optimized battle simulation
- **Features**: Minimal, complete simulation engine
- **Use Case**: Embedded systems, AI, tooling
- **Compatibility**: Can build Showdown-compatible library
- **Repository**: https://github.com/pkmn/engine

#### poke-engine (Python/Rust)
- **Language**: Python with Rust backend
- **Purpose**: Fast battle search for AI
- **Used By**: foul-play battle bot
- **Features**: Efficient state exploration for minimax/MCTS
- **Note**: Less complete than official engine, optimized for competitive singles

## Architecture for Optimal Move Calculator

### Recommended Approach

Based on successful implementations (foul-play, smogon bots), the recommended architecture is:

```
┌─────────────────────────────────────────────────┐
│           Search Algorithm                       │
│  (Minimax, Alpha-Beta, MCTS)                    │
└─────────────┬───────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────┐
│        State Evaluator                          │
│  - Material advantage                           │
│  - Type matchups                                │
│  - Hazards/conditions                           │
│  - Win probability                              │
└─────────────┬───────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────┐
│      Battle Simulator                           │
│  - Simulate move outcomes                       │
│  - Handle damage calculation                    │
│  - Apply effects and abilities                  │
│  - Generate successor states                    │
└─────────────┬───────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────┐
│   Pokemon Showdown API/Engine                   │
│  - Official simulator (pokemon-showdown)        │
│  - OR pkmn/engine (performance)                 │
│  - OR poke-engine (Python/Rust)                 │
└─────────────────────────────────────────────────┘
```

### Key Implementation Considerations

#### 1. Search Depth
- **Standard**: 2-turn lookahead
- **Advanced**: 3+ turns (may timeout in real games)
- **Tradeoff**: Deeper search = better moves but slower
- **Time Constraints**: Pokemon Showdown has turn timers

#### 2. State Space Complexity
- **Branching Factor**: 4-10 moves per turn
- **Hidden Information**: Opponent's items, EVs, exact HP
- **Randomness**: Damage rolls, accuracy, secondary effects
- **Switching**: Must consider switch options

#### 3. Evaluation Function Components

Successful bots evaluate positions using:
- **Material**: HP percentage, fainted Pokemon count
- **Type Advantage**: Current matchup quality
- **Speed Control**: Which Pokemon moves first
- **Hazards**: Stealth Rock, spikes, screens
- **Status**: Burn, paralysis, sleep value
- **Setup**: Stat boosts, field conditions
- **Coverage**: Ability to hit opponent's team

#### 4. Handling Uncertainty

**Damage Ranges**:
- Simulate both min and max damage
- Use expected value or minimax over range

**Unknown Information**:
- Assume standard sets for unknown Pokemon
- Track revealed information during battle
- Update assumptions based on observed moves/items

**Accuracy/Secondary Effects**:
- Use probability trees (computationally expensive)
- Use expected values (faster approximation)

## Development Workflow

### Initial Setup

1. **Choose Battle Engine**:
   - Node.js → Use official `pokemon-showdown` package
   - Python → Use `poke-env` or `poke-engine`
   - Performance-critical → Use `pkmn/engine`

2. **Install Dependencies**:
   ```bash
   # Node.js
   npm install pokemon-showdown

   # Python
   pip install poke-env
   # OR for poke-engine
   pip install poke-engine  # Requires Rust toolchain
   ```

3. **Study Protocol**:
   - Read `sim/SIM-PROTOCOL.md` to understand battle messages
   - Examine `|request|` JSON structure
   - Test with sample battles

### Development Phases

#### Phase 1: Connect and Parse
- [ ] Connect to Pokemon Showdown server (or use simulator locally)
- [ ] Parse battle state from protocol messages
- [ ] Extract available moves and Pokemon information

#### Phase 2: Basic Move Selection
- [ ] Implement simple heuristic (e.g., max damage)
- [ ] Handle switch decisions
- [ ] Test against weak opponents

#### Phase 3: State Evaluation
- [ ] Implement position evaluation function
- [ ] Calculate type effectiveness
- [ ] Consider HP, status, hazards

#### Phase 4: Search Algorithm
- [ ] Implement minimax with alpha-beta pruning
- [ ] Set reasonable search depth (2-3 turns)
- [ ] Handle move randomness and damage ranges

#### Phase 5: Optimization
- [ ] Add transposition tables
- [ ] Implement move ordering
- [ ] Optimize evaluation function
- [ ] Profile and improve performance

#### Phase 6: Advanced Features
- [ ] Team preview selection
- [ ] Predictive switching
- [ ] Doubles/VGC support
- [ ] Generation-specific mechanics

## Key Conventions for AI Assistants

### Code Organization

```
showdown/
├── src/
│   ├── battle/          # Battle state management
│   ├── simulator/       # Wrapper around PS engine
│   ├── search/          # Search algorithms (minimax, etc.)
│   ├── evaluation/      # Position evaluation
│   ├── data/            # Type charts, base stats, move data
│   └── bot/             # Bot runner and connection logic
├── tests/
│   ├── battle.test.js   # Battle state tests
│   ├── search.test.js   # Search algorithm tests
│   └── eval.test.js     # Evaluation function tests
├── docs/                # Additional documentation
├── examples/            # Example battles and usage
└── CLAUDE.md           # This file
```

### Coding Standards

1. **Prefer Official APIs**: Use documented Pokemon Showdown APIs when available
2. **Pin Versions**: If using undocumented APIs, pin exact package versions
3. **Type Safety**: Use TypeScript or type hints for better reliability
4. **Test Coverage**: Write tests for search algorithms and evaluation
5. **Performance**: Profile code; search algorithms must be fast
6. **Logging**: Log battle states and decisions for debugging
7. **Error Handling**: Handle network errors, invalid moves gracefully

### Testing Approach

1. **Unit Tests**: Test individual components (evaluator, type calc)
2. **Integration Tests**: Test full move selection in known positions
3. **Battle Tests**: Simulate complete battles vs baseline strategies
4. **Performance Tests**: Ensure search completes within time limits

### Important Files to Reference

When working on this project, frequently consult:

1. **Pokemon Showdown Docs**:
   - `PROTOCOL.md` - Client-server communication
   - `sim/SIM-PROTOCOL.md` - Battle message format
   - `sim/SIMULATOR.md` - Simulation API
   - `sim/DEX.md` - Pokédex data access

2. **Community Resources**:
   - Smogon Forums: Bot development discussions
   - Pokemon Showdown Discord: API update channel

3. **Example Implementations**:
   - [foul-play](https://github.com/pmariglia/foul-play) - Python search-based AI
   - [Synedh/showdown-battle-bot](https://github.com/Synedh/showdown-battle-bot) - Efficiency calculator
   - [EnrcDamn/PokemonShowdownBot](https://github.com/EnrcDamn/PokemonShowdownBot) - Rule-based AI

### Common Pitfalls to Avoid

1. **Over-relying on RL**: Reinforcement learning has historically performed poorly vs search-based approaches due to state complexity
2. **Ignoring Hidden Info**: Always account for unknown opponent details
3. **Static Evaluation**: Position quality changes dramatically based on teams; avoid overly general evaluations
4. **Timeout Issues**: Search too deep and you'll lose on time
5. **Ignoring Randomness**: Pokemon has many random elements (accuracy, damage rolls, crits)
6. **Not Testing Edge Cases**: Handle force switches, choice-locked moves, etc.

### Development Tips

1. **Start Simple**: Begin with a greedy damage calculator before implementing search
2. **Benchmark Early**: Test against baseline bots (random, max damage) to measure improvement
3. **Visualize Decisions**: Log the search tree to understand why moves are chosen
4. **Use Established Formats**: Start with Gen 8 OU (most documented, no dynamax in older gens)
5. **Incremental Complexity**: Add features one at a time and verify improvement

## Battle Simulator - Detailed API

### Using Official pokemon-showdown Package

```javascript
// Node.js example
const Sim = require('pokemon-showdown');

// Access Pokédex data
const Dex = Sim.Dex;
const pokemon = Dex.species.get('Charizard');
const move = Dex.moves.get('Flamethrower');
const ability = Dex.abilities.get('Blaze');

// Simulate damage calculation
const attacker = Dex.species.get('Charizard');
const defender = Dex.species.get('Blastoise');
// Use battle simulation for exact damage
```

### Key API Features

1. **Dex.species.get(name)**: Get Pokemon data
   - Base stats, types, abilities, movepool

2. **Dex.moves.get(name)**: Get move data
   - Base power, type, category, accuracy, effects

3. **Dex.types.get(name)**: Get type effectiveness data

4. **Dex.items.get(name)**: Get item data

5. **Dex.abilities.get(name)**: Get ability data

6. **Battle Simulation**: Create simulated battles to test scenarios

### Protocol Message Examples

**Battle Start**:
```
|player|p1|Username1|avatar
|player|p2|Username2|avatar
|teamsize|p1|6
|teamsize|p2|6
|gen|8
```

**Request for Move**:
```
|request|{"active":[{"moves":[{"move":"Flamethrower","id":"flamethrower","pp":24,"maxpp":24,"target":"normal","disabled":false},...]}],"side":{"pokemon":[...]}}
```

**Move Execution**:
```
|move|p1a: Charizard|Flamethrower|p2a: Blastoise
|-damage|p2a: Blastoise|50/100
```

## Resources

### Official Documentation
- [Pokemon Showdown Repository](https://github.com/smogon/pokemon-showdown)
- [Protocol Documentation](https://github.com/smogon/pokemon-showdown/blob/master/PROTOCOL.md)
- [Simulator Protocol](https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md)

### Alternative Engines
- [pkmn/engine](https://github.com/pkmn/engine) - Performance-optimized simulator
- [poke-env Documentation](https://poke-env.readthedocs.io/) - Python RL library

### Example Bots
- [foul-play](https://github.com/pmariglia/foul-play) - Search-based AI
- [showdown-battle-bot](https://github.com/Synedh/showdown-battle-bot) - Socket bot
- [PokemonShowdownBot](https://github.com/EnrcDamn/PokemonShowdownBot) - Rule-based AI

### Community
- [Smogon Forums - Bot Development](https://www.smogon.com/forums/)
- Pokemon Showdown Discord - API updates channel
- [Game Developer Article](https://www.gamedeveloper.com/programming/programming-ai-for-pokemon-showdown-bot-battle-royale-) - AI development overview

### Research
- [PokéChamp Paper](https://arxiv.org/html/2503.04094v1) - Expert-level minimax agent

## Quick Start Guide

### For AI Assistants Working on This Project

1. **First Time Setup**:
   - Determine if codebase uses Node.js or Python
   - Check `package.json` or `requirements.txt` for dependencies
   - Verify if simulator library is already installed

2. **Before Implementing Features**:
   - Read relevant protocol documentation
   - Check if similar functionality exists in example bots
   - Consider performance implications of search depth

3. **When Adding Search Algorithms**:
   - Start with 2-turn lookahead
   - Implement alpha-beta pruning early
   - Add timing logs to prevent timeouts
   - Test with simple positions before complex ones

4. **When Debugging**:
   - Log the battle state in human-readable format
   - Print the search tree for analyzed positions
   - Compare against manual calculation for known positions
   - Test against random opponent to verify legality

5. **Before Committing**:
   - Run all tests
   - Verify bot can complete battles without crashing
   - Check performance metrics (time per decision)
   - Update documentation if APIs changed

## Status

**Current Phase**: Initial setup and exploration

**Next Steps**:
1. Choose battle engine (Node.js vs Python)
2. Set up basic connection to simulator
3. Implement battle state parsing
4. Create simple move selection heuristic

---

*Last Updated*: 2026-01-24
*Created By*: Claude (AI Assistant)
*For*: Pokemon Showdown Optimal Move Calculator Project
