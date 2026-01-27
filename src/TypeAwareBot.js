const { Dex } = require('@pkmn/sim');

/**
 * TypeAwareBot - Adds type effectiveness and switch intelligence to FixedDeepSearchBot
 *
 * New Features:
 * 1. Type effectiveness scoring in evaluation (heavy weight)
 * 2. Proactive switch intelligence (considers switches in minimax)
 * 3. Team-aware evaluation (considers remaining Pokemon)
 * 4. HP preservation bonus (exponential)
 *
 * Goal: Fix losses from poor type matchup management
 */
class TypeAwareBot {
  constructor(playerName) {
    this.name = playerName;
    this.dex = Dex;
    this.searchDepth = 4;  // Keep at 4 - depth 5 causes too many timeouts with boost propagation

    this.opponentActive = null;
    this.opponentTeam = [];
    this.seenOpponentPokemon = new Set();

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    // Loop detection
    this.moveHistory = [];
    this.maxHistorySize = 6;
    this.turnNumber = 0;

    // Switch tracking
    this.switchBreaks = 0;

    // NEW: Team composition analysis
    this.teamStyle = null; // 'offensive' or 'defensive', cached after first analysis

    // NEW: Team coverage and matchup analysis
    this.teamCoverage = null; // Cached coverage analysis for our team
    this.opponentThreats = new Map(); // Track which opponent Pokemon threaten which of ours

    // NEW: Entry hazard tracking
    this.hazards = {
      ours: { stealthRock: false, spikes: 0, toxicSpikes: 0 },
      opponent: { stealthRock: false, spikes: 0, toxicSpikes: 0 }
    };

    // NEW: Status condition tracking
    this.ourStatus = null;
    this.opponentStatus = null;

    // NEW: Stat boost tracking (for accurate damage calculations in minimax)
    this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    // NEW: Weather tracking (affects damage, abilities, moves)
    this.weather = null; // 'sun', 'rain', 'sand', 'snow', 'harsh_sun', 'heavy_rain'
    this.weatherTurnsLeft = 0;

    // NEW: Terrain tracking (affects priority, damage, status immunity)
    this.terrain = null; // 'Grassy', 'Electric', 'Psychic', 'Misty'
    this.terrainTurnsLeft = 0;

    // NEW: Field condition tracking (affects move order, accuracy, etc.)
    this.fieldConditions = {
      trickRoom: false,
      trickRoomTurnsLeft: 0,
      gravity: false,
      gravityTurnsLeft: 0,
      wonderRoom: false,
      wonderRoomTurnsLeft: 0,
      magicRoom: false,
      magicRoomTurnsLeft: 0
    };

    // Setup moves database for minimax boost propagation
    // Includes both stat-boosting AND stat-lowering moves
    // Bot evaluates trade-offs (e.g., Draco Meteor: high damage now, weak SpA later)
    this.setupMoves = {
      // Stat-boosting setup moves
      'dragondance': { atk: 1, spe: 1 },
      'swordsdance': { atk: 2 },
      'quiverdance': { spa: 1, spd: 1, spe: 1 },
      'nastyplot': { spa: 2 },
      'calmmind': { spa: 1, spd: 1 },
      'bulkup': { atk: 1, def: 1 },
      'coil': { atk: 1, def: 1 },
      'curse': { atk: 1, def: 1, spe: -1 },
      'agility': { spe: 2 },
      'rockpolish': { spe: 2 },
      'shellsmash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 },
      // Stat-lowering attack moves (evaluate trade-off: high power now, penalty later)
      'dracometeor': { spa: -2 },
      'overheat': { spa: -2 },
      'leafstorm': { spa: -2 },
      'makeitrain': { spa: -1 },
      'closecombat': { def: -1, spd: -1 },
      'superpower': { atk: -1, def: -1 },
      'dracobarrage': { spa: -1 }
    };
  }

  processBattleMessage(message) {
    const lines = message.split('\n');
    for (const line of lines) {
      if (line.includes('|switch|') || line.includes('|drag|')) {
        this.processSwitch(line);
      }
      if (line.includes('|-damage|')) {
        this.processDamage(line);
      }
      if (line.includes('|move|')) {
        this.processMove(line);
      }
      if (line.includes('|turn|')) {
        this.turnNumber++;
        this.decrementFieldConditions(); // NEW: Decrement turn counters
      }
      // NEW: Entry hazard tracking
      if (line.includes('|-sidestart|')) {
        this.processHazard(line);
      }
      // NEW: Status condition tracking
      if (line.includes('|-status|')) {
        this.processStatus(line);
      }
      if (line.includes('|-curestatus|')) {
        this.processCureStatus(line);
      }
      // NEW: Stat boost tracking
      if (line.includes('|-boost|') || line.includes('|-unboost|')) {
        this.processBoost(line);
      }
      // NEW: Weather tracking
      if (line.includes('|-weather|')) {
        this.processWeather(line);
      }
      // NEW: Terrain tracking
      if (line.includes('|-fieldstart|')) {
        this.processFieldStart(line);
      }
      if (line.includes('|-fieldend|')) {
        this.processFieldEnd(line);
      }
    }
  }

  processHazard(line) {
    // Format: |-sidestart|p2|move: Stealth Rock
    const parts = line.split('|');
    if (parts.length < 4) return;

    const side = parts[2]; // p1 or p2
    const hazardInfo = parts[3]; // "move: Stealth Rock"

    const isOpponentSide = this.isOpponent(side);
    const targetHazards = isOpponentSide ? this.hazards.opponent : this.hazards.ours;

    if (hazardInfo.includes('Stealth Rock')) {
      targetHazards.stealthRock = true;
    } else if (hazardInfo.includes('Spikes')) {
      targetHazards.spikes = Math.min(targetHazards.spikes + 1, 3); // Max 3 layers
    } else if (hazardInfo.includes('Toxic Spikes')) {
      targetHazards.toxicSpikes = Math.min(targetHazards.toxicSpikes + 1, 2); // Max 2 layers
    }
  }

  processStatus(line) {
    // Format: |-status|p2a: Baxcalibur|brn
    const parts = line.split('|');
    if (parts.length < 4) return;

    const target = parts[2];
    const status = parts[3]; // brn, par, slp, psn, tox, frz

    if (this.isOpponent(target)) {
      this.opponentStatus = status;
      if (this.opponentActive) {
        this.opponentActive.status = status;
      }
    } else {
      this.ourStatus = status;
    }
  }

  processCureStatus(line) {
    // Format: |-curestatus|p2a: Baxcalibur|brn
    const parts = line.split('|');
    if (parts.length < 3) return;

    const target = parts[2];

    if (this.isOpponent(target)) {
      this.opponentStatus = null;
      if (this.opponentActive) {
        this.opponentActive.status = null;
      }
    } else {
      this.ourStatus = null;
    }
  }

  processBoost(line) {
    // Format: |-boost|p2a: Baxcalibur|atk|1
    // Format: |-unboost|p2a: Baxcalibur|def|1
    const parts = line.split('|');
    if (parts.length < 5) return;

    const isBoost = parts[1] === '-boost';
    const target = parts[2];
    const stat = parts[3];
    const amount = parseInt(parts[4]);

    const boostValue = isBoost ? amount : -amount;

    if (this.isOpponent(target)) {
      if (this.opponentBoosts[stat] !== undefined) {
        this.opponentBoosts[stat] = Math.max(-6, Math.min(6, this.opponentBoosts[stat] + boostValue));
      }
    } else {
      if (this.ourBoosts[stat] !== undefined) {
        this.ourBoosts[stat] = Math.max(-6, Math.min(6, this.ourBoosts[stat] + boostValue));
      }
    }
  }

  /**
   * NEW: Process weather changes
   * Format: |-weather|SunnyDay or |-weather|none
   */
  processWeather(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const weatherName = parts[2].toLowerCase();

    // Clear weather
    if (weatherName === 'none' || !weatherName) {
      this.weather = null;
      this.weatherTurnsLeft = 0;
      return;
    }

    // Set weather (default duration: 5 turns, 8 with weather rock items)
    // We assume default duration since we can't detect items from messages
    const weatherMap = {
      'sunnyday': 'sun',
      'raindance': 'rain',
      'sandstorm': 'sand',
      'snow': 'snow',
      'hail': 'snow', // Gen 9: Hail is now Snow
      'desolateland': 'harsh_sun',
      'primordialsea': 'heavy_rain',
      'deltastream': 'strong_winds'
    };

    const normalizedWeather = weatherMap[weatherName.replace(/\s/g, '')] || weatherName;

    // Primal weathers don't end naturally
    if (['harsh_sun', 'heavy_rain', 'strong_winds'].includes(normalizedWeather)) {
      this.weather = normalizedWeather;
      this.weatherTurnsLeft = -1; // Infinite
    } else {
      this.weather = normalizedWeather;
      this.weatherTurnsLeft = 5; // Default duration (could be 8 with items)
    }
  }

  /**
   * NEW: Process field condition start
   * Format: |-fieldstart|move: Grassy Terrain or |-fieldstart|move: Trick Room
   */
  processFieldStart(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const condition = parts[2].toLowerCase();

    // Terrain tracking
    if (condition.includes('grassy terrain')) {
      this.terrain = 'Grassy';
      this.terrainTurnsLeft = 5;
    } else if (condition.includes('electric terrain')) {
      this.terrain = 'Electric';
      this.terrainTurnsLeft = 5;
    } else if (condition.includes('psychic terrain')) {
      this.terrain = 'Psychic';
      this.terrainTurnsLeft = 5;
    } else if (condition.includes('misty terrain')) {
      this.terrain = 'Misty';
      this.terrainTurnsLeft = 5;
    }

    // Room effects
    if (condition.includes('trick room')) {
      this.fieldConditions.trickRoom = true;
      this.fieldConditions.trickRoomTurnsLeft = 5;
    } else if (condition.includes('wonder room')) {
      this.fieldConditions.wonderRoom = true;
      this.fieldConditions.wonderRoomTurnsLeft = 5;
    } else if (condition.includes('magic room')) {
      this.fieldConditions.magicRoom = true;
      this.fieldConditions.magicRoomTurnsLeft = 5;
    } else if (condition.includes('gravity')) {
      this.fieldConditions.gravity = true;
      this.fieldConditions.gravityTurnsLeft = 5;
    }
  }

  /**
   * NEW: Process field condition end
   * Format: |-fieldend|move: Grassy Terrain
   */
  processFieldEnd(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const condition = parts[2].toLowerCase();

    // Terrain end
    if (condition.includes('terrain')) {
      this.terrain = null;
      this.terrainTurnsLeft = 0;
    }

    // Room effects end
    if (condition.includes('trick room')) {
      this.fieldConditions.trickRoom = false;
      this.fieldConditions.trickRoomTurnsLeft = 0;
    } else if (condition.includes('wonder room')) {
      this.fieldConditions.wonderRoom = false;
      this.fieldConditions.wonderRoomTurnsLeft = 0;
    } else if (condition.includes('magic room')) {
      this.fieldConditions.magicRoom = false;
      this.fieldConditions.magicRoomTurnsLeft = 0;
    } else if (condition.includes('gravity')) {
      this.fieldConditions.gravity = false;
      this.fieldConditions.gravityTurnsLeft = 0;
    }
  }

  /**
   * NEW: Decrement field condition turn counters each turn
   */
  decrementFieldConditions() {
    // Weather
    if (this.weather && this.weatherTurnsLeft > 0) {
      this.weatherTurnsLeft--;
      if (this.weatherTurnsLeft === 0) {
        this.weather = null;
      }
    }

    // Terrain
    if (this.terrain && this.terrainTurnsLeft > 0) {
      this.terrainTurnsLeft--;
      if (this.terrainTurnsLeft === 0) {
        this.terrain = null;
      }
    }

    // Trick Room
    if (this.fieldConditions.trickRoom && this.fieldConditions.trickRoomTurnsLeft > 0) {
      this.fieldConditions.trickRoomTurnsLeft--;
      if (this.fieldConditions.trickRoomTurnsLeft === 0) {
        this.fieldConditions.trickRoom = false;
      }
    }

    // Other room effects
    if (this.fieldConditions.wonderRoom && this.fieldConditions.wonderRoomTurnsLeft > 0) {
      this.fieldConditions.wonderRoomTurnsLeft--;
      if (this.fieldConditions.wonderRoomTurnsLeft === 0) {
        this.fieldConditions.wonderRoom = false;
      }
    }

    if (this.fieldConditions.magicRoom && this.fieldConditions.magicRoomTurnsLeft > 0) {
      this.fieldConditions.magicRoomTurnsLeft--;
      if (this.fieldConditions.magicRoomTurnsLeft === 0) {
        this.fieldConditions.magicRoom = false;
      }
    }

    if (this.fieldConditions.gravity && this.fieldConditions.gravityTurnsLeft > 0) {
      this.fieldConditions.gravityTurnsLeft--;
      if (this.fieldConditions.gravityTurnsLeft === 0) {
        this.fieldConditions.gravity = false;
      }
    }
  }

  processSwitch(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];

    // NEW: Reset boosts on switch for both players
    if (this.isOpponent(playerSlot)) {
      this.opponentBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    } else {
      this.ourBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    }

    // Only process opponent switches for tracking
    if (!this.isOpponent(playerSlot)) return;

    const pokemonInfo = parts[3];
    const speciesName = pokemonInfo.split(',')[0].trim();
    const hpInfo = parts[4];
    const hp = this.parseHP(hpInfo);

    const species = this.dex.species.get(speciesName);
    const estimatedMoves = this.estimateCommonMoves(species);

    this.opponentActive = {
      species: speciesName,
      types: species.types,
      hp: hp.current,
      maxHP: hp.max,
      hpPercent: hp.percent,
      status: hp.status,
      stats: this.estimateStats(speciesName, 100),
      boosts: {},
      moves: new Set(estimatedMoves),
      item: null,
      ability: null,
      level: 100
    };

    this.seenOpponentPokemon.add(speciesName);

    if (!this.opponentTeam.find(p => p.species === speciesName)) {
      this.opponentTeam.push({ ...this.opponentActive });
    }
  }

  estimateCommonMoves(species) {
    const moves = [];

    if (species.baseStats.atk > species.baseStats.spa) {
      moves.push('tackle', 'bodyslam', 'earthquake', 'stoneedge');
    } else {
      moves.push('thunderbolt', 'icebeam', 'fireblast', 'hydropump');
    }

    return moves.slice(0, 4);
  }

  processMove(line) {
    const parts = line.split('|');
    if (parts.length < 4) return;

    const playerSlot = parts[2];
    const moveName = parts[3];

    if (this.isOpponent(playerSlot) && this.opponentActive) {
      this.opponentActive.moves.add(moveName.toLowerCase());
    }
  }

  processDamage(line) {
    const parts = line.split('|');
    if (parts.length < 3) return;

    const target = parts[2];
    const newHP = parts[3];

    if (this.isOpponent(target) && this.opponentActive) {
      const hp = this.parseHP(newHP);
      this.opponentActive.hp = hp.current;
      this.opponentActive.maxHP = hp.max;
      this.opponentActive.hpPercent = hp.percent;
      if (hp.status) this.opponentActive.status = hp.status;
    }
  }

  isOpponent(playerSlot) {
    if (!this.playerSide) {
      return !playerSlot.includes(this.name);
    }
    return !playerSlot.includes(this.playerSide);
  }

  parseHP(hpString) {
    if (!hpString) return { current: 100, max: 100, percent: 1, status: null };

    const parts = hpString.trim().split(' ');
    const hpPart = parts[0];
    const status = parts[1] || null;

    if (hpPart.includes('/')) {
      const [current, max] = hpPart.split('/').map(n => parseInt(n));
      return { current, max, percent: current / max, status };
    } else {
      const percent = parseInt(hpPart) / 100;
      return { current: percent * 100, max: 100, percent, status };
    }
  }

  estimateStats(speciesName, level) {
    const species = this.dex.species.get(speciesName);
    const stats = {};

    for (const stat in species.baseStats) {
      const base = species.baseStats[stat];
      if (stat === 'hp') {
        stats[stat] = Math.floor((2 * base + 31 + 63) * level / 100) + level + 10;
      } else {
        stats[stat] = Math.floor((2 * base + 31 + 63) * level / 100) + 5;
      }
    }

    return stats;
  }

  /**
   * NEW: Analyze team coverage and build matchup matrix
   * Returns map of type -> Pokemon that resist/counter it
   */
  analyzeTeamCoverage(team) {
    if (!team || team.length === 0) return null;

    const coverage = {
      resistances: {}, // Which Pokemon resist each type
      offensiveCoverage: {}, // Which Pokemon can hit each type super effectively
      checks: {} // Which Pokemon can handle which opponent Pokemon
    };

    // Build resistance map
    for (const teammate of team) {
      if (!teammate || !teammate.species) continue;

      const speciesName = teammate.species || teammate.ident?.split(':')[1]?.trim()?.split(',')[0];
      if (!speciesName) continue;

      const species = this.dex.species.get(speciesName);
      if (!species) continue;

      // Check what types this Pokemon resists
      for (const attackType of ['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy']) {
        let effectiveness = 1;

        for (const defenseType of species.types) {
          const typeData = this.dex.types.get(defenseType);
          const taken = typeData.damageTaken[attackType];

          if (taken === 3) { // Immune
            effectiveness = 0;
            break;
          } else if (taken === 2) { // Resist
            effectiveness *= 0.5;
          } else if (taken === 1) { // Weak
            effectiveness *= 2;
          }
        }

        // If this Pokemon resists or is immune, track it
        if (effectiveness <= 0.5) {
          if (!coverage.resistances[attackType]) {
            coverage.resistances[attackType] = [];
          }
          coverage.resistances[attackType].push({
            pokemon: speciesName,
            hp: this.parseHP(teammate.condition).current,
            effectiveness
          });
        }
      }
    }

    return coverage;
  }

  /**
   * NEW: Find which teammate has the best matchup against an opponent
   * Returns { pokemon, score, canSwitch } object
   */
  findBestMatchup(team, oppPokemon, currentPokemon, currentHP) {
    if (!team || team.length === 0) return null;

    const oppSpecies = this.dex.species.get(oppPokemon.species);
    if (!oppSpecies) return null;

    let bestMatchup = {
      pokemon: null,
      speciesName: null,
      score: -Infinity,
      typeAdvantage: 0,
      canSwitch: false
    };

    for (const teammate of team) {
      if (!teammate || !teammate.species) continue;

      const speciesName = teammate.species || teammate.ident?.split(':')[1]?.trim()?.split(',')[0];
      if (!speciesName) continue;

      // Skip if this is current Pokemon
      const currentSpeciesName = currentPokemon.species || currentPokemon.ident?.split(':')[1]?.trim()?.split(',')[0];
      if (speciesName === currentSpeciesName) continue;

      // Skip if fainted
      const hp = this.parseHP(teammate.condition).current;
      if (hp <= 0) continue;

      const species = this.dex.species.get(speciesName);
      if (!species) continue;

      // Calculate type matchup score
      const typeScore = this.calculateTypeMatchupScore(species.types, oppSpecies.types);

      // Calculate estimated damage advantage
      const ourMoves = teammate.moves || this.estimateCommonMoves(species);
      let bestDamageToOpp = 0;

      for (const moveName of ourMoves) {
        const moveData = this.dex.moves.get(moveName);
        if (moveData && moveData.basePower) {
          const damage = this.calculateDamageWithTypes(
            { species: speciesName, types: species.types, stats: this.estimateStats(speciesName, 100) },
            moveData,
            oppPokemon
          );
          bestDamageToOpp = Math.max(bestDamageToOpp, damage);
        }
      }

      // Estimate damage taken from opponent
      const oppMoves = Array.from(oppPokemon.moves || []);
      let worstDamageTaken = 0;

      for (const oppMoveName of oppMoves) {
        const oppMoveData = this.dex.moves.get(oppMoveName);
        if (oppMoveData && oppMoveData.basePower) {
          const damage = this.calculateDamageWithTypes(
            oppPokemon,
            oppMoveData,
            { species: speciesName, types: species.types, stats: this.estimateStats(speciesName, 100) }
          );
          worstDamageTaken = Math.max(worstDamageTaken, damage);
        }
      }

      // Score = type advantage + damage ratio + HP
      let score = typeScore * 50;
      score += (bestDamageToOpp - worstDamageTaken) * 0.5;
      score += hp * 0.3; // Prefer healthy Pokemon

      // Check if this is a better matchup
      if (score > bestMatchup.score) {
        bestMatchup = {
          pokemon: teammate,
          speciesName: speciesName,
          score: score,
          typeAdvantage: typeScore,
          canSwitch: hp > worstDamageTaken, // Can survive the switch-in hit
          hp: hp,
          damageAdvantage: bestDamageToOpp - worstDamageTaken
        };
      }
    }

    return bestMatchup;
  }

  /**
   * NEW: Evaluate overall team health and identify weaknesses
   * Returns { healthyCount, threatenedTypes, coverageGaps }
   */
  evaluateTeamHealth(team) {
    if (!team || team.length === 0) return null;

    let healthyCount = 0;
    let totalHP = 0;
    const activeTypes = new Set();

    for (const teammate of team) {
      if (!teammate) continue;

      const hp = this.parseHP(teammate.condition).current;
      if (hp > 0) {
        healthyCount++;
        totalHP += hp;

        const speciesName = teammate.species || teammate.ident?.split(':')[1]?.trim()?.split(',')[0];
        const species = this.dex.species.get(speciesName);

        if (species) {
          species.types.forEach(type => activeTypes.add(type));
        }
      }
    }

    return {
      healthyCount,
      averageHP: healthyCount > 0 ? totalHP / healthyCount : 0,
      activeTypes: Array.from(activeTypes),
      teamSize: team.length
    };
  }

  chooseMove(request) {
    if (!request || !request.active || !request.side) {
      return 'default';
    }

    if (request.forceSwitch) {
      const switches = this.getAvailableSwitches(request);
      if (switches.length > 0) {
        return `switch ${switches[0]}`;
      }
      return 'default';
    }

    const active = request.active[0];
    if (!active || !active.moves) {
      return 'default';
    }

    const ourPokemon = request.side.pokemon.find(p => p.active);
    if (!ourPokemon) {
      return 'default';
    }

    if (!this.opponentActive) {
      return this.fallbackChoice(active);
    }

    this.nodesEvaluated = 0;
    this.pruneCount = 0;

    const ourHP = this.parseHP(ourPokemon.condition).current;
    const oppHP = this.opponentActive.hp;

    // Ensure opponent has moves before searching
    if (this.opponentActive.moves.size === 0) {
      const species = this.dex.species.get(this.opponentActive.species);
      const estimatedMoves = this.estimateCommonMoves(species);
      estimatedMoves.forEach(m => this.opponentActive.moves.add(m));
    }

    // NEW: Search considers both moves AND switches
    const bestChoice = this.searchBestMove(request, active.moves, ourPokemon, ourHP, oppHP);

    // Handle switch vs move decision
    let proposedChoice;
    if (bestChoice.isSwitch) {
      proposedChoice = `switch ${bestChoice.slot}`;
      this.switchBreaks++;
    } else {
      proposedChoice = `move ${bestChoice.slot}`;
    }

    // Loop detection
    if (this.isAboutToLoop(proposedChoice)) {
      // If loop detected and it was a switch, try a move instead
      if (bestChoice.isSwitch) {
        const fallbackMove = `move 1`;
        this.moveHistory.push(fallbackMove);
        if (this.moveHistory.length > this.maxHistorySize) {
          this.moveHistory.shift();
        }
        return fallbackMove;
      } else {
        // If loop detected with move, try alternative move
        const alternativeSlot = this.findAlternativeMove(active.moves, bestChoice.slot);
        if (alternativeSlot) {
          const finalChoice = `move ${alternativeSlot}`;
          this.moveHistory.push(finalChoice);
          if (this.moveHistory.length > this.maxHistorySize) {
            this.moveHistory.shift();
          }
          return finalChoice;
        }
      }
    }

    this.moveHistory.push(proposedChoice);
    if (this.moveHistory.length > this.maxHistorySize) {
      this.moveHistory.shift();
    }

    return proposedChoice;
  }

  isAboutToLoop(proposedMove) {
    if (this.moveHistory.length < 2) return false;
    const last2 = this.moveHistory.slice(-2);
    return last2.every(m => m === proposedMove);
  }

  findAlternativeMove(availableMoves, currentSlot) {
    const recentMoves = new Set(this.moveHistory.slice(-3));

    for (let i = 0; i < availableMoves.length; i++) {
      const slot = i + 1;
      const move = availableMoves[i];
      const moveChoice = `move ${slot}`;

      if (slot !== currentSlot && !move.disabled && move.pp > 0) {
        if (!recentMoves.has(moveChoice)) {
          return slot;
        }
      }
    }

    for (let i = 0; i < availableMoves.length; i++) {
      const slot = i + 1;
      const move = availableMoves[i];

      if (slot !== currentSlot && !move.disabled && move.pp > 0) {
        return slot;
      }
    }

    return null;
  }

  /**
   * NEW: Decide if we should proactively switch based on type matchup
   */
  shouldProactivelySwitch(request, ourPokemon, ourHP) {
    // Don't switch if we just switched recently (prevent switch spam)
    const recentSwitches = this.moveHistory.filter(h => h.startsWith('switch')).length;
    if (recentSwitches >= 2) {
      return false;
    }

    // Only switch if matchup is clearly bad
    const ourSpeciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const ourSpecies = this.dex.species.get(ourSpeciesName);

    const typeMatchup = this.calculateTypeMatchupScore(ourSpecies.types, this.opponentActive.types);

    // Only switch if at major type disadvantage (score < -3)
    // OR if HP is low and matchup isn't favorable
    if (typeMatchup < -3) {
      return true;
    }

    if (ourHP < 30 && typeMatchup < 0) {
      return true;
    }

    return false;
  }

  /**
   * NEW: Find best Pokemon to switch to
   */
  findBestSwitch(request, currentPokemon) {
    const switches = this.getAvailableSwitches(request);
    if (switches.length === 0) return null;

    let bestSlot = null;
    let bestScore = -Infinity;

    for (const switchSlot of switches) {
      const switchTarget = request.side.pokemon[switchSlot - 1];
      const switchHP = this.parseHP(switchTarget.condition).current;

      // Skip if switching to fainted Pokemon
      if (switchHP <= 0) continue;

      const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
      const switchSpecies = this.dex.species.get(switchSpeciesName);

      // Calculate type advantage
      const typeMatchup = this.calculateTypeMatchupScore(
        switchSpecies.types,
        this.opponentActive.types
      );

      // Prefer switches with good type matchup and high HP
      const score = typeMatchup * 50 + switchHP * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestSlot = switchSlot;
      }
    }

    return bestSlot;
  }

  searchBestMove(request, availableMoves, ourPokemon, ourHP, oppHP) {
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    const ourMoveList = availableMoves.filter(m => !m.disabled && m.pp > 0);
    const oppMoveList = Array.from(this.opponentActive.moves);

    if (oppMoveList.length === 0) {
      return { slot: 1, move: ourMoveList[0]?.move || 'tackle', score: 0 };
    }

    const orderedMoves = this.orderMoves(ourMoveList, ourPokemon, this.opponentActive, oppHP);
    const team = request.side ? request.side.pokemon : null;
    const availableSwitches = this.getAvailableSwitches(request);

    // NEW: Consider attack moves
    for (let i = 0; i < availableMoves.length; i++) {
      const move = availableMoves[i];
      if (move.disabled || move.pp === 0) continue;

      const moveData = this.dex.moves.get(move.id);

      let score = this.minimaxDepth(
        ourPokemon, ourHP,
        this.opponentActive, oppHP,
        orderedMoves, oppMoveList,
        moveData, null,
        1, alpha, beta, false, team, availableSwitches, request,
        this.ourBoosts, this.opponentBoosts
      );

      // NEW: Add strategic value bonus for hazards and status moves
      const strategicBonus = this.evaluateMoveStrategicValue(move, this.opponentActive);
      score += strategicBonus;

      if (score > bestScore) {
        bestScore = score;
        bestMove = { slot: i + 1, move: move.move, score, isSwitch: false };
      }

      alpha = Math.max(alpha, score);

      if (beta <= alpha) {
        this.pruneCount++;
        break;
      }
    }

    // NEW: Consider switch options in search tree (only when strategically beneficial)
    // Check if we're at a type disadvantage - only consider switches then
    const ourSpeciesName = ourPokemon.ident.split(':')[1].trim().split(',')[0];
    const ourSpecies = this.dex.species.get(ourSpeciesName);
    const currentMatchup = this.calculateTypeMatchupScore(ourSpecies.types, this.opponentActive.types);

    // Check if current Pokemon has Regenerator (heals 33% HP on switch-out)
    const hasRegenerator = ourSpecies.abilities &&
      (ourSpecies.abilities['0'] === 'Regenerator' ||
       ourSpecies.abilities['1'] === 'Regenerator' ||
       ourSpecies.abilities['H'] === 'Regenerator');

    // Consider switches if:
    // 1. At type disadvantage (matchup < -2), OR
    // 2. Has Regenerator AND low HP (< 40) - can heal by switching
    const shouldConsiderSwitches = currentMatchup < -2 || (hasRegenerator && ourHP < 40);

    if (shouldConsiderSwitches) {
      for (const switchSlot of availableSwitches) {
        const switchTarget = request.side.pokemon[switchSlot - 1];
        const switchHP = this.parseHP(switchTarget.condition).current;

        if (switchHP <= 0) continue;

        // Quick evaluation: only consider if switch-in has better type matchup
        const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
        const switchSpecies = this.dex.species.get(switchSpeciesName);
        const switchMatchup = this.calculateTypeMatchupScore(switchSpecies.types, this.opponentActive.types);

        // Only evaluate this switch if it improves matchup by at least 2 points
        // OR if we have Regenerator (healing can justify neutral matchups)
        if (switchMatchup > currentMatchup + 2 || hasRegenerator) {
          const score = this.evaluateSwitchInSearch(
            ourPokemon, ourHP,
            switchTarget, switchHP,
            this.opponentActive, oppHP,
            oppMoveList, team, availableSwitches, request
          );

          if (score > bestScore) {
            bestScore = score;
            bestMove = { slot: switchSlot, move: `switch to ${switchSpeciesName}`, score, isSwitch: true };
          }

          alpha = Math.max(alpha, score);

          if (beta <= alpha) {
            this.pruneCount++;
            break;
          }
        }
      }
    }

    if (!bestMove) {
      return { slot: 1, move: availableMoves[0].move, score: 0, isSwitch: false };
    }

    return bestMove;
  }

  /**
   * NEW: Calculate hazard damage on switch-in
   */
  calculateHazardDamage(pokemon, hazards) {
    let damage = 0;

    const speciesName = pokemon.species || pokemon.ident.split(':')[1].trim().split(',')[0];
    const species = this.dex.species.get(speciesName);

    // Stealth Rock damage (type-dependent: 12.5% * effectiveness)
    if (hazards.stealthRock) {
      const rockEffectiveness = this.getTypeEffectiveness('Rock', species.types);
      damage += 12.5 * rockEffectiveness; // 6.25% to 50% depending on type
    }

    // Spikes damage (12.5% per layer, max 3 layers)
    damage += hazards.spikes * 12.5; // 0%, 12.5%, 25%, or 37.5%

    // Toxic Spikes (doesn't do immediate damage, but poisons)
    // We'll handle this separately in status tracking

    return Math.floor(damage);
  }

  /**
   * NEW: Evaluate switching to a specific Pokemon within search
   * Opponent gets a free hit since switching takes a turn
   * Accounts for Regenerator healing on switch-out
   * Accounts for entry hazard damage on switch-in
   * Optimized: assumes worst-case (highest damage) opponent move
   */
  evaluateSwitchInSearch(currentPokemon, currentHP, switchTarget, switchHP, oppPokemon, oppHP, oppMoves, team, availableSwitches, request) {
    this.nodesEvaluated++;

    const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
    const switchSpecies = this.dex.species.get(switchSpeciesName);

    // NEW: Use team coverage analysis to boost switches to better matchups
    let teamMatchupBonus = 0;
    if (team && team.length > 0) {
      const bestMatchup = this.findBestMatchup(team, oppPokemon, currentPokemon, currentHP);

      if (bestMatchup && bestMatchup.speciesName === switchSpeciesName) {
        // This is the best matchup for the opponent - reward the switch
        teamMatchupBonus += 50; // Base bonus for being best counter

        if (bestMatchup.typeAdvantage > 2) {
          teamMatchupBonus += 30; // Extra bonus for strong type advantage
        }

        if (bestMatchup.damageAdvantage > 30) {
          teamMatchupBonus += 20; // Bonus for damage advantage
        }
      }

      // Check team health - if low on healthy Pokemon, preserve this one
      const teamHealth = this.evaluateTeamHealth(team);
      if (teamHealth && teamHealth.healthyCount <= 3) {
        // Low on healthy Pokemon - be more conservative
        if (currentHP < 30) {
          teamMatchupBonus += 15; // Switch away from low HP Pokemon to preserve it
        }
      }
    }

    // Check if current Pokemon has Regenerator (heals 33% max HP on switch-out)
    const currentSpeciesName = currentPokemon.ident.split(':')[1].trim().split(',')[0];
    const currentSpecies = this.dex.species.get(currentSpeciesName);
    const hasRegenerator = currentSpecies.abilities &&
      (currentSpecies.abilities['0'] === 'Regenerator' ||
       currentSpecies.abilities['1'] === 'Regenerator' ||
       currentSpecies.abilities['H'] === 'Regenerator');

    // Calculate Regenerator healing (33% of max HP)
    let regeneratorBonus = 0;
    if (hasRegenerator) {
      const maxHP = 100; // Assuming level 50, actual max HP
      const healAmount = Math.floor(maxHP * 0.33); // 33% healing
      regeneratorBonus = healAmount; // Value of getting this Pokemon back with more HP later
    }

    // Find worst-case damage to switch-in target (assume opponent chooses best move)
    let maxDamage = 0;
    for (const oppMoveName of oppMoves) {
      const oppMoveData = this.dex.moves.get(oppMoveName);
      const damage = this.calculateDamageWithTypes(
        oppPokemon, oppMoveData,
        { species: switchSpeciesName, types: switchSpecies.types, stats: this.estimateStats(switchSpeciesName, 100) }
      );
      maxDamage = Math.max(maxDamage, damage);
    }

    // NEW: Add entry hazard damage on switch-in
    const hazardDamage = this.calculateHazardDamage(switchTarget, this.hazards.ours);
    maxDamage += hazardDamage;

    const newSwitchHP = Math.max(0, switchHP - maxDamage);

    // After switch, evaluate the new position
    // Note: Switching resets our boosts to 0, but opponent keeps their boosts
    const resetBoosts = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    let score = this.evaluatePosition(switchTarget, newSwitchHP, oppPokemon, oppHP, team, resetBoosts, null);

    // NEW: Revenge killing evaluation
    // Check if switch-in can outspeed and KO the opponent (revenge kill)
    const switchSpeed = this.getSpeed(switchTarget, resetBoosts);
    const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);

    if (switchSpeed > oppSpeed && newSwitchHP > 0 && oppHP > 0) {
      // Switch-in is faster - check if we can KO
      // Find best damage we can deal to opponent
      let maxOurDamage = 0;
      const switchMoves = switchTarget.moves || [];

      for (const moveName of switchMoves) {
        const moveData = this.dex.moves.get(moveName);
        if (moveData.basePower) {
          const damage = this.calculateDamageWithTypes(
            switchTarget, moveData,
            oppPokemon
          );
          maxOurDamage = Math.max(maxOurDamage, damage);
        }
      }

      // Revenge kill bonus: Can outspeed and KO
      if (maxOurDamage >= oppHP) {
        score += 150; // Big bonus for guaranteed revenge kill
      } else if (maxOurDamage >= oppHP * 0.8) {
        score += 80; // Good bonus for likely revenge kill (with damage rolls)
      } else if (maxOurDamage >= oppHP * 0.5) {
        score += 40; // Moderate bonus for faster + strong hit
      }
    }

    // Add Regenerator healing value (current Pokemon can come back later with more HP)
    score += regeneratorBonus * 0.5; // 50% weight since we might not switch back in

    // NEW: Add team matchup bonus (from coverage analysis)
    score += teamMatchupBonus;

    // Apply switch penalty (giving opponent free turn)
    // Reduced penalty if Regenerator (healing offsets the free turn)
    // Further reduced if revenge killing (worth the switch)
    let switchPenalty = hasRegenerator ? 50 : 100;

    // Reduce penalty significantly if current Pokemon is low HP (forced switch soon anyway)
    if (currentHP < 30) {
      switchPenalty = Math.floor(switchPenalty * 0.5);
    }

    return score - switchPenalty;
  }

  /**
   * NEW: Evaluate the value of switching to a different Pokemon
   */
  evaluateSwitchOption(switchTarget, switchHP, oppPokemon, oppHP, oppMoves) {
    // Calculate type matchup after switch
    const switchSpeciesName = switchTarget.ident.split(':')[1].trim().split(',')[0];
    const switchSpecies = this.dex.species.get(switchSpeciesName);

    const typeAdvantage = this.calculateTypeMatchupScore(
      switchSpecies.types,
      oppPokemon.types
    );

    // Switching takes 1 turn, opponent gets free hit
    // Estimate damage we'll take
    let expectedDamage = 0;
    for (const oppMoveName of oppMoves) {
      const oppMoveData = this.dex.moves.get(oppMoveName);
      const damage = this.calculateDamageWithTypes(
        oppPokemon, oppMoveData,
        { species: switchSpeciesName, types: switchSpecies.types, stats: this.estimateStats(switchSpeciesName, 100) }
      );
      expectedDamage = Math.max(expectedDamage, damage); // Assume worst case
    }

    const newSwitchHP = switchHP - expectedDamage;

    // Evaluate position after switch
    let score = 0;

    // FIXED: Reduced type advantage weight (was 200, now 40)
    // Only worth switching if type advantage is VERY good
    score += typeAdvantage * 40;

    // HP difference after taking hit
    score += newSwitchHP - oppHP;

    // FIXED: Significantly increased switch penalty (was 50, now 150)
    // Switching should only happen when NECESSARY
    score -= 150;

    // Don't switch if it results in immediate KO
    if (newSwitchHP <= 0) {
      score -= 1000;
    }

    // FIXED: Only switch if we're at a major disadvantage
    // Type advantage of +6 or more needed to overcome switch penalty
    // (6 * 40 = 240, vs penalty of 150, net +90)

    return score;
  }

  /**
   * NEW: Calculate type matchup score (offensive and defensive)
   */
  calculateTypeMatchupScore(ourTypes, oppTypes) {
    let score = 0;

    // Offensive matchup: how well we hit them
    for (const ourType of ourTypes) {
      for (const oppType of oppTypes) {
        const typeData = this.dex.types.get(ourType);
        const effectiveness = typeData.damageTaken[oppType];

        // damageTaken is from defender's perspective
        // We need offensive effectiveness
        // Check if our type is super effective against opponent
        const oppTypeData = this.dex.types.get(oppType);
        if (oppTypeData.damageTaken[ourType] === 1) { // Super effective
          score += 2;
        } else if (oppTypeData.damageTaken[ourType] === 2) { // Not very effective
          score -= 1;
        } else if (oppTypeData.damageTaken[ourType] === 3) { // Immune
          score -= 3;
        }
      }
    }

    // Defensive matchup: how well they hit us
    for (const oppType of oppTypes) {
      for (const ourType of ourTypes) {
        const ourTypeData = this.dex.types.get(ourType);
        const effectiveness = ourTypeData.damageTaken[oppType];

        if (effectiveness === 1) { // We take super effective damage
          score -= 2;
        } else if (effectiveness === 2) { // We resist
          score += 1;
        } else if (effectiveness === 3) { // We're immune
          score += 3;
        }
      }
    }

    return score;
  }

  /**
   * NEW: Get effective priority of a move accounting for terrain and abilities
   */
  getEffectivePriority(move, pokemon) {
    if (!move) return 0;

    let priority = move.priority || 0;

    const moveName = move.name.toLowerCase().replace(/[^a-z]/g, '');

    // Terrain-based priority boosts
    if (moveName === 'grassyglide' && this.terrain === 'Grassy') {
      priority = 1; // Grassy Slide gets +1 priority with Grassy Terrain
    }

    // Other terrain priority moves (for completeness)
    if (moveName === 'electricterrain' && this.terrain === 'Electric') {
      // Some moves get priority with Electric Terrain (though rare)
    }

    // TODO: Ability-based priority (Prankster +1 for status moves, Gale Wings +1 for Flying at full HP)
    // This would require tracking abilities accurately, which we don't do yet

    return priority;
  }

  /**
   * NEW: Determine who moves first accounting for priority and Trick Room
   */
  determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority) {
    // Higher priority always goes first (even in Trick Room)
    if (ourPriority > oppPriority) return true;
    if (oppPriority > ourPriority) return false;

    // Same priority: speed determines order
    // Trick Room reverses speed order (slower goes first)
    if (this.fieldConditions.trickRoom) {
      return ourSpeed <= oppSpeed; // Slower goes first in Trick Room
    } else {
      return ourSpeed >= oppSpeed; // Faster goes first normally
    }
  }

  /**
   * NEW: Evaluate how well a move covers the opponent's team
   * Returns score: positive = good coverage, negative = poor coverage
   */
  evaluateMoveCoverageVsTeam(move, oppTeam) {
    if (!oppTeam || oppTeam.length === 0) return 0;
    if (!move || !move.type) return 0;

    let coverageScore = 0;

    for (const oppPokemon of oppTeam) {
      if (!oppPokemon || !oppPokemon.species) continue;

      const species = this.dex.species.get(oppPokemon.species);
      if (!species) continue;

      const effectiveness = this.getTypeEffectiveness(move.type, species.types);

      if (effectiveness === 0) {
        // Immune - very bad (e.g., Grass move vs Gholdengo with Good as Gold fails)
        coverageScore -= 3;
      } else if (effectiveness < 1) {
        // Resisted - bad
        coverageScore -= 1;
      } else if (effectiveness === 1) {
        // Neutral - okay (no bonus/penalty)
        coverageScore += 0;
      } else if (effectiveness >= 2) {
        // Super effective - good
        coverageScore += 2;
      }
    }

    return coverageScore;
  }

  orderMoves(moves, ourPokemon, oppPokemon, oppHP) {
    const moveScores = [];

    const ourSpeed = this.getSpeed(ourPokemon, this.ourBoosts);
    const oppSpeed = this.getSpeed(oppPokemon, this.opponentBoosts);

    for (const move of moves) {
      const moveData = this.dex.moves.get(move.id);
      const damage = this.calculateDamage(ourPokemon, oppPokemon, moveData, this.ourBoosts, this.opponentBoosts);

      // NEW: Get effective priority accounting for terrain
      const ourPriority = this.getEffectivePriority(moveData, ourPokemon);
      const oppPriority = 0; // Assume opponent uses normal priority (worst case)

      // NEW: Determine who goes first (accounts for priority and Trick Room)
      const weGoFirst = this.determineMoveOrder(ourSpeed, ourPriority, oppSpeed, oppPriority);

      // NEW: Check if we naturally outspeed (without needing priority)
      const naturallyFaster = this.determineMoveOrder(ourSpeed, 0, oppSpeed, 0);
      const needsPriorityToGoFirst = weGoFirst && !naturallyFaster && ourPriority > oppPriority;

      let orderScore = 0;

      if (damage >= oppHP) {
        // KO move
        if (weGoFirst) {
          // We go first AND can KO - guaranteed KO
          orderScore = 200000 + damage; // Highest priority

          // NEW: Coverage bonus if we naturally outspeed (priority not needed for move order)
          // When we outspeed naturally, opponent likely to switch on KO prediction
          // Prefer moves with better coverage against their team
          if (naturallyFaster && !needsPriorityToGoFirst) {
            const coverageBonus = this.evaluateMoveCoverageVsTeam(moveData, this.opponentTeam);

            // Scale coverage bonus: each point of coverage = +50 priority
            // This can shift preference between moves with same KO power
            // Example: Grassy Slide (immune to Gholdengo: -3) vs Ivy Cudgel (hits Gholdengo: +0 or better)
            // Coverage difference: 3+ points = 150+ priority difference
            orderScore += coverageBonus * 50;
          }
        } else {
          // We can KO but we're slower - risky (might get KO'd first)
          orderScore = 100000 + damage;
        }
      } else if (damage > 0) {
        // Damaging move but not KO
        if (weGoFirst) {
          // Faster = more valuable (chip damage before opponent can act)
          orderScore = 15000 + damage;
        } else {
          // Slower = less valuable
          orderScore = 10000 + damage;
        }
      } else {
        // Status/utility move
        orderScore = moveData.basePower || 0;
      }

      moveScores.push({ move, score: orderScore, priority: ourPriority, coverage: 0 });
    }

    moveScores.sort((a, b) => b.score - a.score);
    return moveScores.map(ms => ms.move);
  }

  minimaxDepth(ourPokemon, ourHP, oppPokemon, oppHP, ourMoves, oppMoves, ourLastMove, oppLastMove, depth, alpha, beta, maximizing, team = null, availableSwitches = [], request = null, ourBoosts = null, oppBoosts = null) {
    this.nodesEvaluated++;

    if (depth >= this.searchDepth) {
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team, ourBoosts, oppBoosts);
    }

    if (ourHP <= 0 || oppHP <= 0) {
      return this.evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team, ourBoosts, oppBoosts);
    }

    if (maximizing) {
      let maxScore = -Infinity;

      const orderedOurMoves = this.orderMoves(ourMoves, ourPokemon, oppPokemon, oppHP);

      for (const move of orderedOurMoves) {
        const moveData = this.dex.moves.get(move.id);

        for (const oppMoveName of oppMoves) {
          const oppMoveData = this.dex.moves.get(oppMoveName);

          // Step 1: Simulate current turn with CURRENT boosts
          const [newOurHP, newOppHP] = this.simulateExchange(
            ourPokemon, ourHP, moveData,
            oppPokemon, oppHP, oppMoveData,
            ourBoosts, oppBoosts
          );

          // Step 2: Apply boost changes for NEXT turn (if setup moves used)
          let newOurBoosts = ourBoosts;
          let newOppBoosts = oppBoosts;

          // Check if our move is a setup move
          const ourMoveNormalized = moveData.name.toLowerCase().replace(/[^a-z]/g, '');
          if (this.setupMoves[ourMoveNormalized]) {
            newOurBoosts = this.applyBoostChanges(ourBoosts, this.setupMoves[ourMoveNormalized]);
          }

          // Check if opponent's move is a setup move
          const oppMoveNormalized = oppMoveData.name.toLowerCase().replace(/[^a-z]/g, '');
          if (this.setupMoves[oppMoveNormalized]) {
            newOppBoosts = this.applyBoostChanges(oppBoosts, this.setupMoves[oppMoveNormalized]);
          }

          // Step 3: Recursive call with UPDATED boosts (for next turn)
          const score = this.minimaxDepth(
            ourPokemon, newOurHP,
            oppPokemon, newOppHP,
            ourMoves, oppMoves,
            moveData, oppMoveData,
            depth + 1, alpha, beta, false, team, availableSwitches, request,
            newOurBoosts, newOppBoosts
          );

          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);

          if (beta <= alpha) {
            this.pruneCount++;
            return maxScore;
          }
        }
      }

      return maxScore;
    } else {
      let minScore = Infinity;

      for (const oppMoveName of oppMoves) {
        const oppMoveData = this.dex.moves.get(oppMoveName);

        const orderedOurMoves = this.orderMoves(ourMoves, ourPokemon, oppPokemon, oppHP);

        for (const move of orderedOurMoves) {
          const moveData = this.dex.moves.get(move.id);

          // Step 1: Simulate current turn with CURRENT boosts
          const [newOurHP, newOppHP] = this.simulateExchange(
            ourPokemon, ourHP, moveData,
            oppPokemon, oppHP, oppMoveData,
            ourBoosts, oppBoosts
          );

          // Step 2: Apply boost changes for NEXT turn (if setup moves used)
          let newOurBoosts = ourBoosts;
          let newOppBoosts = oppBoosts;

          // Check if our move is a setup move
          const ourMoveNormalized = moveData.name.toLowerCase().replace(/[^a-z]/g, '');
          if (this.setupMoves[ourMoveNormalized]) {
            newOurBoosts = this.applyBoostChanges(ourBoosts, this.setupMoves[ourMoveNormalized]);
          }

          // Check if opponent's move is a setup move
          const oppMoveNormalized = oppMoveData.name.toLowerCase().replace(/[^a-z]/g, '');
          if (this.setupMoves[oppMoveNormalized]) {
            newOppBoosts = this.applyBoostChanges(oppBoosts, this.setupMoves[oppMoveNormalized]);
          }

          // Step 3: Recursive call with UPDATED boosts (for next turn)
          const score = this.minimaxDepth(
            ourPokemon, newOurHP,
            oppPokemon, newOppHP,
            ourMoves, oppMoves,
            moveData, oppMoveData,
            depth + 1, alpha, beta, true, team, availableSwitches, request,
            newOurBoosts, newOppBoosts
          );

          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);

          if (beta <= alpha) {
            this.pruneCount++;
            return minScore;
          }
        }
      }

      return minScore;
    }
  }

  simulateExchange(ourPokemon, ourHP, ourMove, oppPokemon, oppHP, oppMove, ourBoosts = null, oppBoosts = null) {
    let newOurHP = ourHP;
    let newOppHP = oppHP;

    const ourSpeed = this.getSpeed(ourPokemon, ourBoosts);
    const oppSpeed = this.getSpeed(oppPokemon, oppBoosts);

    let firstIsOurs = ourSpeed >= oppSpeed;

    if (firstIsOurs) {
      const damage = this.calculateDamage(ourPokemon, oppPokemon, ourMove, ourBoosts, oppBoosts);
      newOppHP -= damage;
      if (newOppHP <= 0) return [newOurHP, Math.max(0, newOppHP)];

      const oppDamage = this.calculateDamage(oppPokemon, ourPokemon, oppMove, oppBoosts, ourBoosts);
      newOurHP -= oppDamage;
    } else {
      const oppDamage = this.calculateDamage(oppPokemon, ourPokemon, oppMove, oppBoosts, ourBoosts);
      newOurHP -= oppDamage;
      if (newOurHP <= 0) return [Math.max(0, newOurHP), newOppHP];

      const damage = this.calculateDamage(ourPokemon, oppPokemon, ourMove, ourBoosts, oppBoosts);
      newOppHP -= damage;
    }

    return [Math.max(0, newOurHP), Math.max(0, newOppHP)];
  }

  /**
   * NEW: Analyze team composition to determine playstyle
   * Looks at actual movesets, items, and Pokemon roles rather than just base stats
   */
  analyzeTeamStyle(team) {
    if (this.teamStyle) {
      return this.teamStyle; // Cache result
    }

    let setupCount = 0;
    let defensiveCount = 0;
    let offensiveCount = 0;
    let count = 0;

    for (const pokemon of team) {
      const speciesName = pokemon.ident.split(':')[1].trim().split(',')[0];
      const species = this.dex.species.get(speciesName);

      if (!species) continue;
      count++;

      // Check for defensive characteristics
      const isDefensivePivot = ['Slowking', 'Slowbro', 'Rotom-Wash', 'Rotom-Heat', 'Toxapex',
                                'Corviknight', 'Skarmory', 'Ferrothorn', 'Clefable', 'Blissey',
                                'Chansey', 'Magnezone', 'Wo-Chien', 'Ting-Lu', 'Alomomola'].includes(species.name);

      // Check for setup sweepers
      const isSetupSweeper = ['Baxcalibur', 'Kingambit', 'Dragonite', 'Garchomp', 'Volcarona',
                              'Frosmoth', 'Salamence', 'Gyarados', 'Lucario', 'Haxorus'].includes(species.name);

      // Check for immediate offensive threats
      const isWallbreaker = ['Gholdengo', 'Iron Valiant', 'Great Tusk', 'Zapdos-Galar',
                            'Weavile', 'Dragapult', 'Hoopa-Unbound', 'Kyurem'].includes(species.name);

      if (isDefensivePivot) {
        defensiveCount++;
      } else if (isSetupSweeper) {
        setupCount++; // Setup sweepers need defensive evaluation (HP preservation)
      } else if (isWallbreaker) {
        offensiveCount++;
      }
    }

    if (count === 0) {
      this.teamStyle = 'balanced';
      return this.teamStyle;
    }

    // Team classification logic:
    // - OFFENSIVE: Setup sweepers + wallbreakers (hyper offense - aggressive setup)
    //   → Team 1: 2 setup sweepers + 3 wallbreakers = wants to set up and sweep
    // - DEFENSIVE: Defensive pivots + recovery (defensive control - patient grinding)
    //   → Team 2: 2 defensive pivots + 1 setup = wants to wear down and pivot
    // - BALANCED: Mixed or unclear

    if (setupCount >= 2 && offensiveCount >= 2) {
      this.teamStyle = 'offensive'; // Hyper offense: setup + wallbreak strategy
    } else if (defensiveCount >= 2) {
      this.teamStyle = 'defensive'; // Defensive control: pivot and wear down
    } else if (offensiveCount >= 3) {
      this.teamStyle = 'offensive'; // Wallbreaker-heavy teams
    } else {
      this.teamStyle = 'balanced';
    }

    return this.teamStyle;
  }

  /**
   * NEW: Check if a Pokemon type is immune to a status condition
   */
  isImmuneToStatus(pokemonTypes, status) {
    // Status move name to status condition mapping
    const statusConditions = {
      'thunderwave': 'par',
      'willowisp': 'brn',
      'toxic': 'psn',
      'sleeppowder': 'slp',
      'spore': 'slp',
      'stunspore': 'par'
    };

    const condition = statusConditions[status.toLowerCase().replace(/[^a-z]/g, '')] || status;

    // Type immunities
    if (condition === 'par' || condition === 'paralysis') {
      // Electric types immune to paralysis
      if (pokemonTypes.includes('Electric')) return true;
    }

    if (condition === 'brn' || condition === 'burn') {
      // Fire types immune to burn
      if (pokemonTypes.includes('Fire')) return true;
    }

    if (condition === 'psn' || condition === 'tox' || condition === 'poison') {
      // Poison and Steel types immune to poison
      if (pokemonTypes.includes('Poison') || pokemonTypes.includes('Steel')) return true;
    }

    return false;
  }

  /**
   * NEW: Evaluate strategic value of a move (hazards, status, etc.)
   */
  evaluateMoveStrategicValue(move, oppPokemon) {
    let bonus = 0;

    const moveData = this.dex.moves.get(move.id || move);
    if (!moveData) return 0;

    const moveName = moveData.name.toLowerCase();
    const oppSpecies = this.dex.species.get(oppPokemon.species);

    // Entry Hazard Value
    if (moveName.includes('stealth rock') || moveName === 'stealthrock') {
      // High value if we don't have Stealth Rock up yet
      if (!this.hazards.opponent.stealthRock) {
        bonus += 150; // Stealth Rock is extremely valuable
      }
    }

    if (moveName.includes('spikes')) {
      // Value setting up Spikes (diminishing returns)
      if (this.hazards.opponent.spikes < 3) {
        bonus += 100 - (this.hazards.opponent.spikes * 30); // 100, 70, 40
      }
    }

    // Hazard removal value
    if (moveName === 'rapidspin' || moveName === 'rapid spin' || moveName === 'defog') {
      // High value if we have hazards on our side
      if (this.hazards.ours.stealthRock || this.hazards.ours.spikes > 0) {
        bonus += 120;
      }
    }

    // Status Move Value
    const statusMoves = {
      'thunderwave': 'par',
      'thunder wave': 'par',
      'willowisp': 'brn',
      'will-o-wisp': 'brn',
      'toxic': 'tox',
      'sleeppowder': 'slp',
      'sleep powder': 'slp',
      'spore': 'slp',
      'stunspore': 'par',
      'stun spore': 'par'
    };

    const inflictsStatus = statusMoves[moveName];
    if (inflictsStatus) {
      // Don't value status if opponent already has status or is immune
      if (!this.opponentStatus && !oppPokemon.status) {
        if (!this.isImmuneToStatus(oppSpecies.types, inflictsStatus)) {
          // Burn is very valuable against physical attackers
          if (inflictsStatus === 'brn') {
            if (oppSpecies.baseStats.atk > oppSpecies.baseStats.spa) {
              bonus += 100; // Burning a physical attacker is very valuable
            } else {
              bonus += 40; // Still useful but less critical
            }
          }

          // Paralysis is very valuable against fast threats
          if (inflictsStatus === 'par') {
            if (oppSpecies.baseStats.spe > 100) {
              bonus += 90; // Paralyzing fast Pokemon is very valuable
            } else {
              bonus += 50;
            }
          }

          // Toxic is valuable for long battles
          if (inflictsStatus === 'tox' || inflictsStatus === 'psn') {
            bonus += 60;
          }

          // Sleep is extremely powerful
          if (inflictsStatus === 'slp') {
            bonus += 120; // Sleep is nearly as good as a KO
          }
        }
      }
    }

    // NO HEURISTIC BONUS FOR SETUP MOVES
    // Testing showed that ANY heuristic (+150, +20, +5) makes things worse
    // Pure minimax with boost propagation performs better (73.3% vs 30% with heuristics)
    // The search naturally discovers when setup is valuable through simulation

    return bonus;
  }

  /**
   * Enhanced evaluation with type effectiveness (BALANCED weights - proven optimal)
   * NEW: Includes entry hazard and status condition evaluation
   */
  evaluatePosition(ourPokemon, ourHP, oppPokemon, oppHP, team = null, ourBoosts = null, oppBoosts = null) {
    let score = 0;

    // Terminal states (high priority)
    if (oppHP <= 0) score += 1000;
    if (ourHP <= 0) score -= 1000;

    // HP difference (base score)
    score += ourHP - oppHP;

    // Type matchup scoring (BALANCED weight)
    const ourSpecies = this.dex.species.get(
      ourPokemon.species || ourPokemon.ident.split(':')[1].trim().split(',')[0]
    );
    const oppSpecies = this.dex.species.get(oppPokemon.species);

    const typeMatchup = this.calculateTypeMatchupScore(ourSpecies.types, oppSpecies.types);
    score += typeMatchup * 30;  // Balanced weight

    // HP preservation bonus (exponential)
    const ourHPRatio = Math.max(0, ourHP) / 100;
    const oppHPRatio = Math.max(0, oppHP) / 100;

    score += (ourHPRatio ** 2) * 80;  // Balanced HP preservation
    score -= (oppHPRatio ** 2) * 80;

    // Progress bonus (reward reducing opponent HP)
    score += (1 - oppHPRatio) * 50;

    // NOTE: Boost evaluation NOT included in terminal evaluation
    // Testing showed that adding boost values (15 for offensive, 12 for defensive)
    // dropped performance from 83.3% to 73.3% (-10 percentage points)
    // The boost propagation in minimax already handles boost value through simulation
    // Adding explicit boost values creates overvaluation of setup moves

    // NEW: Entry hazard value
    // Having hazards on opponent's side is valuable
    if (this.hazards.opponent.stealthRock) {
      score += 30; // Passive damage on switches
    }
    score += this.hazards.opponent.spikes * 15; // 15 per layer

    // Having hazards on our side is bad
    if (this.hazards.ours.stealthRock) {
      score -= 30;
    }
    score -= this.hazards.ours.spikes * 15;

    // NEW: Status condition value
    // Opponent being statused is valuable
    const oppStatus = oppPokemon.status || this.opponentStatus;
    if (oppStatus) {
      if (oppStatus === 'brn' || oppStatus === 'burn') {
        // Burn is very valuable against physical attackers
        if (oppSpecies.baseStats.atk > oppSpecies.baseStats.spa) {
          score += 80;
        } else {
          score += 30;
        }
      }
      if (oppStatus === 'par' || oppStatus === 'paralysis') {
        // Paralysis is valuable (speed reduction)
        score += 60;
      }
      if (oppStatus === 'slp' || oppStatus === 'sleep') {
        // Sleep is extremely valuable (free turns)
        score += 100;
      }
      if (oppStatus === 'tox' || oppStatus === 'psn') {
        // Toxic accumulates damage over time
        score += 50;
      }
    }

    // We being statused is bad
    const ourStatus = ourPokemon.status || this.ourStatus;
    if (ourStatus) {
      if (ourStatus === 'brn' || ourStatus === 'burn') {
        if (ourSpecies.baseStats.atk > ourSpecies.baseStats.spa) {
          score -= 80; // Very bad for physical attackers
        } else {
          score -= 30;
        }
      }
      if (ourStatus === 'par' || ourStatus === 'paralysis') {
        score -= 60;
      }
      if (ourStatus === 'slp' || ourStatus === 'sleep') {
        score -= 100;
      }
      if (ourStatus === 'tox' || ourStatus === 'psn') {
        score -= 50;
      }
    }

    // NEW: Speed control evaluation (reframed as confidence)
    // Speed advantage is binary (faster = go first), but we have hidden information
    // Gradient represents CONFIDENCE in being faster (unknown EVs/IVs/nature/items)
    if (ourHP > 0 && oppHP > 0) {
      const ourSpeed = this.getSpeed(ourPokemon, ourBoosts);
      const oppSpeed = this.getSpeed(oppPokemon, oppBoosts);

      // Calculate speed confidence: larger gap = more confident in being actually faster
      // (accounts for possible Choice Scarf, speed EVs, nature differences we don't know)
      const speedGap = Math.abs(ourSpeed - oppSpeed);
      const speedConfidence = Math.min(speedGap / 100, 1.0); // 0.0 to 1.0

      if (ourSpeed > oppSpeed) {
        // We're (likely) faster - valuable for moving first
        score += 20 * speedConfidence; // Scale from 0 to +20 based on confidence

        // Extra bonus if faster + type advantage = likely KO before opponent moves
        if (typeMatchup > 0) {
          score += 15;
        }
      } else if (oppSpeed > ourSpeed) {
        // Opponent is (likely) faster - risky at low HP
        score -= 15 * speedConfidence; // Scale from 0 to -15 based on confidence

        // Extra penalty if slower + type disadvantage = likely KO'd before we move
        if (typeMatchup < 0) {
          score -= 15;
        }
      }

      // NOTE: If speeds are equal (speedGap = 0), speedConfidence = 0, so no bonus/penalty
      // This represents maximum uncertainty about who moves first (50/50 tie)
    }

    return score;
  }

  /**
   * Get stat boost multiplier for damage/speed calculations
   * Boost stages: -6 to +6
   * Formula: (2 + boost) / 2 for positive, 2 / (2 - boost) for negative
   */
  getBoostMultiplier(boost) {
    if (boost >= 0) {
      return (2 + boost) / 2;
    } else {
      return 2 / (2 - boost);
    }
  }

  /**
   * Apply setup move boost changes to current boosts with ±6 capping
   */
  applyBoostChanges(currentBoosts, boostChanges) {
    const newBoosts = { ...currentBoosts };

    // Apply each boost change with capping at ±6
    if (boostChanges.atk) {
      newBoosts.atk = Math.max(-6, Math.min(6, (newBoosts.atk || 0) + boostChanges.atk));
    }
    if (boostChanges.def) {
      newBoosts.def = Math.max(-6, Math.min(6, (newBoosts.def || 0) + boostChanges.def));
    }
    if (boostChanges.spa) {
      newBoosts.spa = Math.max(-6, Math.min(6, (newBoosts.spa || 0) + boostChanges.spa));
    }
    if (boostChanges.spd) {
      newBoosts.spd = Math.max(-6, Math.min(6, (newBoosts.spd || 0) + boostChanges.spd));
    }
    if (boostChanges.spe) {
      newBoosts.spe = Math.max(-6, Math.min(6, (newBoosts.spe || 0) + boostChanges.spe));
    }

    return newBoosts;
  }

  getSpeed(pokemon, boosts = null) {
    let speed;
    if (pokemon.stats && pokemon.stats.spe) {
      speed = pokemon.stats.spe;
    } else {
      const speciesName = pokemon.ident.split(':')[1].trim().split(',')[0];
      const species = this.dex.species.get(speciesName);
      speed = Math.floor((2 * species.baseStats.spe + 31 + 63) * 100 / 100) + 5;
    }

    // Apply speed boosts if provided
    if (boosts && boosts.spe) {
      speed = Math.floor(speed * this.getBoostMultiplier(boosts.spe));
    }

    // Paralysis halves speed
    const status = pokemon.status || (pokemon === this.opponentActive ? this.opponentStatus : this.ourStatus);
    if (status === 'par' || status === 'paralysis') {
      speed = Math.floor(speed * 0.5); // Gen 7+ paralysis halves speed
    }

    return speed;
  }

  calculateDamage(attacker, defender, move, attackerBoosts = null, defenderBoosts = null) {
    if (!move.basePower) return 0;

    const attackerSpecies = this.dex.species.get(
      attacker.species || attacker.ident.split(':')[1].trim().split(',')[0]
    );
    const defenderSpecies = this.dex.species.get(defender.species);

    let attackStat = move.category === 'Physical' ?
      (attacker.stats?.atk || 250) :
      (attacker.stats?.spa || 250);
    let defenseStat = move.category === 'Physical' ?
      (defender.stats?.def || 250) :
      (defender.stats?.spd || 250);

    // Apply stat boosts
    if (attackerBoosts) {
      const attackBoost = move.category === 'Physical' ? attackerBoosts.atk : attackerBoosts.spa;
      if (attackBoost) {
        attackStat = Math.floor(attackStat * this.getBoostMultiplier(attackBoost));
      }
    }

    if (defenderBoosts) {
      const defenseBoost = move.category === 'Physical' ? defenderBoosts.def : defenderBoosts.spd;
      if (defenseBoost) {
        defenseStat = Math.floor(defenseStat * this.getBoostMultiplier(defenseBoost));
      }
    }

    let damage = Math.floor(((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    // Burn halves physical attack damage
    const attackerStatus = attacker.status || (attacker === this.opponentActive ? this.opponentStatus : this.ourStatus);
    if (attackerStatus === 'brn' || attackerStatus === 'burn') {
      if (move.category === 'Physical') {
        damage *= 0.5;
      }
    }

    if (attackerSpecies.types.includes(move.type)) {
      damage *= 1.5;
    }

    const effectiveness = this.getTypeEffectiveness(move.type, defenderSpecies.types);
    damage *= effectiveness;

    return Math.floor(damage);
  }

  /**
   * NEW: Helper for calculating damage with explicit types
   */
  calculateDamageWithTypes(attacker, move, defender) {
    if (!move.basePower) return 0;

    const attackStat = move.category === 'Physical' ?
      (attacker.stats?.atk || 250) :
      (attacker.stats?.spa || 250);
    const defenseStat = move.category === 'Physical' ?
      (defender.stats?.def || 250) :
      (defender.stats?.spd || 250);

    let damage = Math.floor(((2 * 100 / 5 + 2) * move.basePower * attackStat / defenseStat) / 50) + 2;

    // STAB
    if (attacker.types && attacker.types.includes(move.type)) {
      damage *= 1.5;
    }

    const effectiveness = this.getTypeEffectiveness(move.type, defender.types);
    damage *= effectiveness;

    return Math.floor(damage);
  }

  getTypeEffectiveness(moveType, defenderTypes) {
    let multiplier = 1;
    for (const defenderType of defenderTypes) {
      // Get defender's type data and check how much damage it takes from moveType
      const defenderTypeData = this.dex.types.get(defenderType);
      if (defenderTypeData.damageTaken[moveType] === 1) multiplier *= 2;    // Super effective
      if (defenderTypeData.damageTaken[moveType] === 2) multiplier *= 0.5;  // Not very effective
      if (defenderTypeData.damageTaken[moveType] === 3) multiplier *= 0;    // Immune
    }
    return multiplier;
  }

  fallbackChoice(active) {
    let bestSlot = 1;
    let bestPower = 0;

    for (let i = 0; i < active.moves.length; i++) {
      const moveData = active.moves[i];
      if (moveData.disabled || moveData.pp === 0) continue;

      const move = this.dex.moves.get(moveData.id);
      const power = move.basePower || 0;

      if (power > bestPower) {
        bestPower = power;
        bestSlot = i + 1;
      }
    }

    return `move ${bestSlot}`;
  }

  getAvailableSwitches(request) {
    const switches = [];
    const team = request.side.pokemon;

    for (let i = 0; i < team.length; i++) {
      const pokemon = team[i];
      if (!pokemon.active && pokemon.condition !== '0 fnt') {
        switches.push(i + 1);
      }
    }

    return switches;
  }
}

module.exports = TypeAwareBot;
