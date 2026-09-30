const Depth6SearchBot = require('./Depth6SearchBot');

/**
 * ImprovedDepth6Bot - Depth6SearchBot with an opponent model.
 *
 * The time-bounded, iteratively deepened search lives in OptimizedDepth4Bot.
 * This class orders the opponent's replies in that search by predicted
 * likelihood: a heuristic score (damage, setup, status, recovery) plus a bonus
 * for moves the opponent has actually been seen using.
 *
 * Ordering alone never changes the search result, only how fast alpha-beta
 * prunes. Setting opponentMovesConsider trims the opponent to its top N
 * predicted moves, which is faster but optimistic if the model is wrong.
 */
class ImprovedDepth6Bot extends Depth6SearchBot {
  constructor(playerName, options = {}) {
    super(playerName, options);

    // Opponent prediction settings
    this.useOpponentPrediction = options.useOpponentPrediction !== false;
    this.opponentMovesConsider = options.opponentMovesConsider || Infinity;

    // Opponent move history: species -> { moveId -> usageCount }
    // Tracks which moves each opponent Pokemon has actually used
    this.opponentMoveHistory = new Map();

    // Opponent switch history: tracks which Pokemon they send out after fainting
    // Last seen active opponent Pokemon
    this.lastOpponentActive = null;

    // Predicted opponent set: moves we know they have but haven't used yet
    this.opponentRevealedMoves = new Map(); // species -> Set of revealed moveIds

    // Additional stats
    this.improvedStats = {
      opponentPredictions: 0,
      predictionAccuracy: [],
      historyHits: 0
    };
  }

  /**
   * Process battle protocol messages to track opponent behavior.
   * Called by StatefulBattleSimulator each turn with the raw message chunk.
   */
  processBattleMessage(chunk) {
    const lines = chunk.split('\n');
    for (const line of lines) {
      this._parseBattleLine(line.trim());
    }
  }

  _parseBattleLine(line) {
    if (!line) return;

    // Track opponent moves: |move|p2a: PokemonName|MoveName|...
    // p2 = opponent when we are p1 (StatefulBattleSimulator always sets us as p1)
    const moveMatch = line.match(/^\|move\|p2a: ([^|]+)\|([^|]+)/);
    if (moveMatch) {
      const speciesRaw = moveMatch[1].trim();
      const moveName = moveMatch[2].trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      // Record in move history
      if (!this.opponentMoveHistory.has(speciesRaw)) {
        this.opponentMoveHistory.set(speciesRaw, new Map());
      }
      const moveMap = this.opponentMoveHistory.get(speciesRaw);
      moveMap.set(moveName, (moveMap.get(moveName) || 0) + 1);

      // Record in revealed moves
      if (!this.opponentRevealedMoves.has(speciesRaw)) {
        this.opponentRevealedMoves.set(speciesRaw, new Set());
      }
      this.opponentRevealedMoves.get(speciesRaw).add(moveName);
    }

    // Track switches: |switch|p2a: PokemonName|...
    const switchMatch = line.match(/^\|switch\|p2a: ([^|]+)\|/);
    if (switchMatch) {
      this.lastOpponentActive = switchMatch[1].trim();
    }

    // Also track drag (forced switch)
    const dragMatch = line.match(/^\|drag\|p2a: ([^|]+)\|/);
    if (dragMatch) {
      this.lastOpponentActive = dragMatch[1].trim();
    }
  }

  chooseMove(request) {
    // Update opponent model from current battle state (works with EngineBattleSimulator)
    this._updateOpponentModelFromBattle();

    return super.chooseMove(request);
  }

  /**
   * Update opponent move history by examining PP depletion in the battle object.
   * Works with EngineBattleSimulator which provides direct battle access.
   * Moves with PP < maxPP have been used at least once.
   */
  _updateOpponentModelFromBattle() {
    if (!this.battleInstance) return;

    try {
      const oppSide = this.playerSide === 'p1' ? this.battleInstance.p2 : this.battleInstance.p1;
      if (!oppSide || !oppSide.pokemon) return;

      for (const pokemon of oppSide.pokemon) {
        if (!pokemon || !pokemon.moveSlots) continue;
        const speciesName = pokemon.species?.name || pokemon.name;
        if (!speciesName) continue;

        for (const slot of pokemon.moveSlots) {
          if (slot.pp < slot.maxpp) {
            // PP was spent - this move was used
            const moveId = slot.id;
            const normalizedId = moveId.replace(/[^a-z0-9]/gi, '').toLowerCase();

            if (!this.opponentMoveHistory.has(speciesName)) {
              this.opponentMoveHistory.set(speciesName, new Map());
            }
            const moveMap = this.opponentMoveHistory.get(speciesName);

            // Only count if not already tracked (to avoid double-counting with processBattleMessage)
            const ppUsed = slot.maxpp - slot.pp;
            const currentCount = moveMap.get(normalizedId) || 0;
            if (ppUsed > currentCount) {
              moveMap.set(normalizedId, ppUsed);
            }

            // Mark as revealed
            if (!this.opponentRevealedMoves.has(speciesName)) {
              this.opponentRevealedMoves.set(speciesName, new Set());
            }
            this.opponentRevealedMoves.get(speciesName).add(normalizedId);
          }
        }
      }
    } catch (e) {
      // Ignore errors - opponent model is best-effort
    }
  }

  /**
   * Order the opponent's replies by predicted likelihood (see
   * predictOpponentMoves); switches follow moves.
   */
  orderOpponentChoices(battle, player, choices) {
    if (!this.useOpponentPrediction) {
      return super.orderOpponentChoices(battle, player, choices);
    }

    const moveChoices = choices.filter(c => c.kind === 'move');
    const rank = new Map(this.predictOpponentMoves(battle, player).map((id, i) => [id, i]));
    const rankOf = c => (rank.has(c.id) ? rank.get(c.id) : Infinity);
    moveChoices.sort((a, b) => rankOf(a) - rankOf(b));

    return [
      ...moveChoices.slice(0, this.opponentMovesConsider),
      ...choices.filter(c => c.kind !== 'move')
    ];
  }

  /**
   * Predict which moves the opponent is likely to make.
   * Combines heuristic scoring with observed move history for better accuracy.
   * Returns moves sorted by likelihood (most likely first).
   */
  predictOpponentMoves(battle, oppPlayer) {
    const moves = this.simulator.getAvailableMoves(battle, oppPlayer);
    if (moves.length === 0) return [];

    const oppSide = battle[oppPlayer];
    const ourSide = battle[oppPlayer === 'p1' ? 'p2' : 'p1'];
    const oppActive = oppSide.active[0];
    const ourActive = ourSide.active[0];

    // Identify current opponent active species for history lookup
    const oppSpeciesName = oppActive?.species?.name || '';
    const moveHistoryForSpecies = this.opponentMoveHistory.get(oppSpeciesName) || new Map();
    const totalHistoryUses = [...moveHistoryForSpecies.values()].reduce((a, b) => a + b, 0);

    // Score each move by expected utility + historical frequency
    const scoredMoves = moves.map(moveId => {
      let score = 0;

      try {
        if (!oppActive || !ourActive) return { moveId, score: 0 };

        // Get move data
        const moveSlot = oppActive.moveSlots.find(s => s.id === moveId);
        if (!moveSlot) return { moveId, score: 0 };

        const move = this.simulator.dex.moves.get(moveSlot.id);
        if (!move) return { moveId, score: 0 };

        // --- HISTORICAL FREQUENCY BONUS ---
        // If we've seen the opponent use this move before, weight it much higher.
        // This is the key opponent modeling improvement.
        const normalizedMoveId = moveId.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const historyCount = moveHistoryForSpecies.get(normalizedMoveId) || 0;
        if (historyCount > 0 && totalHistoryUses > 0) {
          const frequency = historyCount / totalHistoryUses;
          // Strong bonus proportional to frequency (max ~200 for 100% frequency)
          score += frequency * 200;
          this.improvedStats.historyHits++;
        }

        // --- MOVES NEVER SEEN: slight penalty (reveals hidden info) ---
        // If a move hasn't been revealed yet but we know 3+ other moves,
        // it's likely a utility move saved for specific situations
        const revealedMoves = this.opponentRevealedMoves.get(oppSpeciesName) || new Set();
        const isUnrevealed = !revealedMoves.has(normalizedMoveId);
        if (isUnrevealed && revealedMoves.size >= 2) {
          score -= 10; // Slight penalty for unrevealed moves
        }

        // Factor 1: Damage potential (most important)
        if (move.category === 'Physical' || move.category === 'Special') {
          const basePower = move.basePower || 0;

          // Get type effectiveness
          let effectiveness = 1.0;
          if (ourActive.species && move.type) {
            const defender = this.simulator.dex.species.get(ourActive.species.name);
            if (defender && defender.types) {
              for (const defType of defender.types) {
                const eff = this.simulator.dex.types.get(move.type)?.effectiveness?.[defType];
                if (eff !== undefined) {
                  effectiveness *= eff;
                }
              }
            }
          }

          score += basePower * effectiveness * 2;

          // Bonus for super effective moves
          if (effectiveness >= 2.0) {
            score += 100;
          }

          // Bonus for moves that can KO
          if (basePower * effectiveness > 50 && ourActive.hp < ourActive.maxhp * 0.4) {
            score += 150;
          }
        }

        // Factor 2: Setup moves - weighted by HP and historical tendency
        if (move.boosts) {
          const boostTotal = Object.values(move.boosts).reduce((sum, val) => sum + Math.abs(val), 0);
          // Setup is valuable when opponent has HP advantage
          if (oppActive.hp > oppActive.maxhp * 0.5) {
            score += boostTotal * 35;
          } else {
            score += boostTotal * 10;
          }
        }

        // Factor 3: Status moves
        if (move.status) {
          if (ourActive.hp > ourActive.maxhp * 0.5 && !ourActive.status) {
            score += 50;
          }
        }

        // Factor 4: Priority moves (when we are low HP)
        if (move.priority && move.priority > 0) {
          if (ourActive.hp < ourActive.maxhp * 0.3) {
            score += 80;
          }
        }

        // Factor 5: Recovery moves
        if (move.heal || move.id === 'roost' || move.id === 'recover' || move.id === 'moonlight' || move.id === 'morningsun') {
          if (oppActive.hp < oppActive.maxhp * 0.5) {
            score += 70; // High value for low-HP recovery
          }
        }

        // Factor 6: Hazard moves
        if (move.sideCondition) {
          score += 20;
        }

      } catch (error) {
        score = 0;
      }

      return { moveId, score };
    });

    // Sort by score (highest first)
    scoredMoves.sort((a, b) => b.score - a.score);

    this.improvedStats.opponentPredictions++;

    return scoredMoves.map(m => m.moveId);
  }

  printStats() {
    super.printStats();

    console.log('\nOpponent Model:');
    console.log(`  Opponent prediction:    ${this.useOpponentPrediction ? 'YES' : 'NO'}`);
    console.log(`  Opponent moves considered: ${this.opponentMovesConsider}`);
    console.log(`  Prediction calls:       ${this.improvedStats.opponentPredictions}`);
    console.log(`  History-guided scores:  ${this.improvedStats.historyHits}`);
    console.log(`  Opponent species seen:  ${this.opponentMoveHistory.size}`);
  }

  getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      improved: this.improvedStats
    };
  }
}

module.exports = ImprovedDepth6Bot;
