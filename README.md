# Pokemon Showdown Optimal Move Calculator

A local Pokemon battle simulator with AI capabilities. Currently implements a random move bot as a baseline for testing more advanced search algorithms.

## Features

- ✅ Local battle simulation (no server required)
- ✅ Random move selection bot
- ✅ Complete battles that run to victory/defeat
- ✅ Support for Gen 9 Random Battles
- ✅ Built on official @pkmn/sim library

## Quick Start

### Installation

```bash
npm install
```

### Run a Battle

```bash
npm run battle
```

This will simulate a complete Pokemon battle between two players, both using random move selection. The battle will run until one player wins or the turn limit is reached.

### Example Output

```
Starting Pokemon Showdown Battle Simulation
Both players using random move selection
Teams are randomly generated

============================================================
BATTLE START
============================================================

--- Turn 1 ---
Player 1: move 2
Player 2: move 4

--- Turn 2 ---
Player 1: move 4
Player 2: move 1

...

============================================================
BATTLE END
============================================================
Winner: Player 2
Total turns: 26
```

## Project Structure

```
showdown/
├── src/
│   ├── BattleSimulator.js  # Main battle orchestration
│   └── RandomBot.js         # Random move selection AI
├── examples/
│   └── simple-battle.js     # Example battle script
├── CLAUDE.md                # AI assistant documentation
├── README.md                # This file
└── package.json
```

## Components

### BattleSimulator

The `BattleSimulator` class manages the entire battle lifecycle:

- Creates battle streams using @pkmn/sim
- Generates random teams for both players
- Processes battle events and requests
- Tracks turn count and winner

**Usage:**

```javascript
const BattleSimulator = require('./src/BattleSimulator');

const simulator = new BattleSimulator('gen9randombattle');
const result = await simulator.runBattle();

console.log(`Winner: ${result.winner}`);
console.log(`Turns: ${result.turns}`);
```

### RandomBot

The `RandomBot` class implements the simplest possible battle AI:

- Randomly selects from available moves
- Switches when forced or when no moves are available
- Respects move PP and disabled states

**Usage:**

```javascript
const RandomBot = require('./src/RandomBot');

const bot = new RandomBot('Player 1');
const choice = bot.chooseMove(request);
// Returns: "move 1", "move 2", "switch 3", etc.
```

## Battle Formats

The simulator supports any Pokemon Showdown format. Common formats:

- `gen9randombattle` - Gen 9 Random Battle (default)
- `gen9ou` - Gen 9 OU (requires custom teams)
- `gen8randombattle` - Gen 8 Random Battle
- `gen7randombattle` - Gen 7 Random Battle

## Next Steps

This minimal implementation serves as a foundation for building more sophisticated battle AIs. Planned enhancements:

### Phase 1: Position Evaluation (Not Implemented)
- [ ] Evaluate battle states (HP, type advantages, hazards)
- [ ] Score moves based on expected damage
- [ ] Consider stat boosts and status conditions

### Phase 2: Search Algorithms (Not Implemented)
- [ ] Implement minimax algorithm
- [ ] Add alpha-beta pruning
- [ ] Set configurable search depth (2-3 turns)

### Phase 3: Advanced Features (Not Implemented)
- [ ] Handle damage roll ranges
- [ ] Account for accuracy and secondary effects
- [ ] Implement team preview selection
- [ ] Add support for doubles battles

## Technical Details

### Dependencies

- **@pkmn/sim**: Official Pokemon Showdown battle simulator
- **@pkmn/dex**: Pokemon data (species, moves, abilities, items)
- **@pkmn/randoms**: Random team generator

### How It Works

1. **Battle Initialization**: Creates two battle streams (one per player)
2. **Team Generation**: Generates random teams using @pkmn/randoms
3. **Battle Loop**:
   - Receives requests from the simulator
   - Bots make move selections
   - Choices are sent to the simulator
   - Simulator processes the turn
4. **Battle End**: Detects win/tie conditions and reports results

### Battle Protocol

The simulator communicates using Pokemon Showdown's protocol:

**Request Format** (received from simulator):
```json
{
  "active": [{
    "moves": [
      {"move": "Flamethrower", "id": "flamethrower", "pp": 24, "maxpp": 24, "disabled": false},
      ...
    ]
  }],
  "side": {
    "pokemon": [...]
  }
}
```

**Choice Format** (sent to simulator):
- `move 1` - Use move in slot 1
- `move 2` - Use move in slot 2
- `switch 3` - Switch to Pokemon in slot 3

## Resources

- [Pokemon Showdown Repository](https://github.com/smogon/pokemon-showdown)
- [@pkmn/sim Documentation](https://www.npmjs.com/package/@pkmn/sim)
- [Battle Protocol Specification](https://github.com/smogon/pokemon-showdown/blob/master/sim/SIM-PROTOCOL.md)
- [CLAUDE.md](./CLAUDE.md) - Detailed documentation for AI assistants

## Development

### Running Tests

```bash
npm test  # Not yet implemented
```

### Creating Custom Battles

You can create custom battle scenarios by modifying `examples/simple-battle.js` or creating new scripts:

```javascript
const BattleSimulator = require('./src/BattleSimulator');

async function customBattle() {
  // Use a different format
  const simulator = new BattleSimulator('gen8ou');
  const result = await simulator.runBattle();
  console.log(result);
}

customBattle();
```

## License

ISC

---

**Status**: Minimal working version complete ✅

This implementation successfully simulates complete Pokemon battles locally using random move selection. It serves as a foundation for implementing more advanced search-based AI algorithms.
