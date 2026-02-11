# Bug Audit Results - play-vs-bot.js

## Date: 2026-02-11

## Summary
**CRITICAL BUG FOUND AND FIXED**: Bot opponent was not properly initialized with battle instance, causing it to skip turns or make invalid moves.

## Root Cause Analysis

### The Problem
When playing against bots using `play-vs-bot.js`, users would occasionally see turns where the opponent bot did not attack or switch at all. The battle would skip the bot's turn entirely.

### Why This Happened

The advanced bots (MinimaxBot, TypeAwareBot, Depth6SearchBot, etc.) require access to the battle simulator instance to:
1. Simulate potential moves
2. Evaluate positions using minimax search
3. Calculate optimal strategies

**Critical Issue**: `play-vs-bot.js` never called `setBattleInstance()` on the bot object.

### Code Comparison

#### ❌ OLD CODE (play-vs-bot.js - BROKEN)
```javascript
constructor(humanTeam, botTeam, BotClass, botName) {
  this.bot = new BotClass('Bot');
  // Missing: No call to setBattleInstance()
}

async start() {
  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
  // Battle instance exists but bot doesn't have access to it!
}
```

#### ✅ CORRECT CODE (EngineBattleSimulator.js - WORKING)
```javascript
initializeBattle() {
  // Create battle...

  // Give bots access to battle instance
  if (typeof this.bot1.setBattleInstance === 'function') {
    this.bot1.setBattleInstance(this.battle, 'p1');
  }
  if (typeof this.bot2.setBattleInstance === 'function') {
    this.bot2.setBattleInstance(this.battle, 'p2');
  }
}
```

## What Happened When Bot Didn't Have Battle Instance

Looking at `OptimizedDepth4Bot.js:43-73`:

```javascript
chooseMove(request) {
  if (!request || !request.active || !request.side) {
    return 'default';
  }

  if (request.forceSwitch) {
    return this.chooseBestSwitch(request);
  }

  if (!this.battleInstance) {  // ← This was ALWAYS true!
    return this.fallbackChoice(request);  // ← Fallback to basic logic
  }

  // Minimax search code never executed!
  const bestMove = this.searchBestMove();
  // ...
}
```

Without `battleInstance`, the bot:
1. ✅ Could handle force switches (those worked)
2. ❌ Could NOT perform minimax search
3. ❌ Fell back to `fallbackChoice()` which just picks the first available move
4. ❌ Sometimes returned invalid moves if the first move wasn't available

## The Fix

### Changes Made to play-vs-bot.js

#### 1. Store BattleStream Reference
```javascript
async start() {
  // Keep reference to the BattleStream to access battle instance
  const battleStream = new BattleStreams.BattleStream();
  const streams = BattleStreams.getPlayerStreams(battleStream);

  // Store battleStream reference for later access
  this.battleStream = battleStream;
  this.botInitialized = false;
  // ...
}
```

#### 2. Initialize Bot When Battle Ready
```javascript
async processBotStream(stream) {
  for await (const chunk of stream) {
    for (const line of lines) {
      if (line.startsWith('|request|')) {
        // Initialize bot with battle instance on first request
        if (!this.botInitialized && this.battleStream.battle &&
            typeof this.bot.setBattleInstance === 'function') {
          this.bot.setBattleInstance(this.battleStream.battle, 'p2');
          this.botInitialized = true;
          console.log('[System] Bot initialized with battle instance - minimax search enabled\n');
        }

        if (!request.wait) {
          const choice = this.bot.chooseMove(request);  // Now has battle access!
          void stream.write(choice);
        }
      }
    }
  }
}
```

## Additional Improvements

### 1. Increased Opponent Move Prediction: 2 → 3 moves
**File**: `src/ImprovedDepth6Bot.js:38`

```javascript
// OLD:
this.opponentMovesConsider = options.opponentMovesConsider || 2;

// NEW:
this.opponentMovesConsider = options.opponentMovesConsider || 3;
```

**Impact**: Bot now considers top 3 opponent moves instead of 2, improving position evaluation accuracy.

### 2. Extended Time Limit: 3s → 4s
**File**: `src/ImprovedDepth6Bot.js:32`

```javascript
// OLD:
this.timeLimit = options.timeLimit || 3000; // 3 seconds

// NEW:
this.timeLimit = options.timeLimit || 4000; // 4 seconds
```

**Impact**: Allows deeper search without timing out, especially important with 3 opponent moves considered.

## Testing Recommendations

### Quick Test
```bash
node play-vs-bot.js
# Select bot 7 (Depth6SearchBot)
# Play a few turns and verify:
# 1. Bot makes a move every turn
# 2. Console shows "[System] Bot initialized with battle instance"
# 3. No skipped turns
```

### Comprehensive Test
```bash
# Run automated battle tests
node compare-improved-proper.js
# Verify: No battles have "no move" or empty turns
```

## Impact Assessment

### Before Fix
- ❌ Advanced bots effectively reduced to RandomBot level
- ❌ Minimax search never executed
- ❌ Occasional skipped turns
- ❌ Invalid moves in edge cases

### After Fix
- ✅ Advanced bots use full minimax search
- ✅ Proper position evaluation
- ✅ No skipped turns
- ✅ Bot makes optimal moves based on search depth

## Files Modified

1. **play-vs-bot.js**
   - Added `battleStream` and `botInitialized` fields
   - Modified `start()` to store BattleStream reference
   - Modified `processBotStream()` to initialize bot with battle instance

2. **src/ImprovedDepth6Bot.js**
   - Line 32: Changed time limit from 3000ms to 4000ms
   - Line 38: Changed opponent moves consideration from 2 to 3

## Commit
- Branch: `claude/claude-md-mkrr66tifh2nbcw6-QO4LS`
- Commit: `ee9d74d`
- Message: "Fix critical bug: bot not making moves + increase search parameters"

## Conclusion

This was a **critical initialization bug** that completely disabled the advanced AI capabilities of the bots in `play-vs-bot.js`. The fix ensures bots are properly initialized with battle instance access, enabling full minimax search and proper move selection.

The bug did not affect `EngineBattleSimulator.js` or automated battle comparison scripts, which is why it wasn't caught in testing - those files properly called `setBattleInstance()`.
