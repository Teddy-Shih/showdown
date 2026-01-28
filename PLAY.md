# Play Against the Bot

## Quick Start

```bash
node play-vs-bot.js
```

## How to Play

### 1. Choose Your Team
When you start, you'll choose between:
- **Team 1 (Offensive)**: Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-W, Kingambit
- **Team 2 (Defensive)**: Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-G

### 2. Team Preview
Choose which Pokemon to send out first (1-6).

### 3. Battle Turns
Each turn you'll see:
```
--- YOUR TURN ---

Current Battle State:
  Your Pokemon: Baxcalibur
  Bot Pokemon: Hatterene

  Your HP: 265/265

Available moves:
  1. Glaive Rush (8/8 PP)
  2. Icicle Spear (24/24 PP)
  3. Earthquake (16/16 PP)
  4. Dragon Dance (16/16 PP)

Available switches:
  2. Gholdengo - 258/258
  3. Great Tusk - 394/394
  4. Iron Valiant - 284/284
  5. Rotom-Wash - 304/304
  6. Kingambit - 310/310

Your choice (move 1-4 or switch 1-6):
```

### 4. Input Format

**To use a move:**
```
move 1
```
or just
```
1
```

**To switch Pokemon:**
```
switch 3
```

**The bot will automatically make its decision** (you won't see what it's thinking).

### 5. Battle Results
The game will show:
- Move used
- Damage dealt
- HP remaining
- Status effects
- Fainted Pokemon

The battle continues until one side has no Pokemon left!

## Example Session

```
$ node play-vs-bot.js

Choose your team:
1. Offensive (Baxcalibur, Gholdengo, Great Tusk, Iron Valiant, Rotom-W, Kingambit)
2. Defensive (Hatterene, Magnezone, Slowking, Frosmoth, Landorus-T, Zapdos-G)

Select team (1 or 2): 1

You chose: Offensive team
Bot will use: Defensive team

Starting battle...

--- TEAM PREVIEW ---
Your team:
  1. Baxcalibur
  2. Gholdengo
  3. Great Tusk
  4. Iron Valiant
  5. Rotom-Wash
  6. Kingambit

Choose lead Pokemon (1-6): 1

================================================================================
TURN 1
================================================================================

You sent out Baxcalibur!
Bot sent out Hatterene!

--- YOUR TURN ---
[...]
```

## Tips

1. **Type Effectiveness Matters**: The bot is smart - it knows type matchups!
2. **Setup Moves**: Dragon Dance, Swords Dance, etc. boost your stats
3. **Switching**: Don't be afraid to switch to a better matchup
4. **HP Management**: Keep track of your team's health
5. **The Bot Thinks Ahead**: It uses 4-turn deep minimax search

## What the Bot Can Do

The bot you're playing against:
- **88.3% win rate** against other bots
- Uses **minimax search** to plan 4 turns ahead
- Considers **type effectiveness, coverage, priority moves**
- Tracks **weather, terrain, stat boosts**
- Uses **@smogon/calc** for accurate damage calculation
- Makes optimal decisions in most situations

Good luck! 🎮
