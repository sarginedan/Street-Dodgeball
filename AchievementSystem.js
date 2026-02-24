// ═══════════════════════════════════════════════════════════
// ═══ STREET DODGEBALL — Achievement System ════════════════
// Inspired by Call of Duty 4: Modern Warfare challenge system
// Persistent stats & unlock state stored in localStorage
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'streetDodgeball_achievements';

// ─── Tier definitions (CoD4 gun challenge style) ─────────
// Each achievement has 4 tiers with escalating requirements
const TIER_NAMES   = ['Bronze', 'Silver', 'Gold', 'Diamond'];
const TIER_COLORS  = ['#cd7f32', '#c0c0c0', '#ffd700', '#b9f2ff'];
const TIER_ICONS   = ['🥉', '🥈', '🥇', '💎'];
const TIER_XP      = [25, 75, 200, 500]; // XP reward per tier

// ─── Achievement Definitions ─────────────────────────────
// Each has a stat key, display info, and 4 tier thresholds
export const ACHIEVEMENT_DEFS = [
  // ── Offensive ──
  {
    id: 'throws',
    name: 'Cannon Arm',
    icon: '🎯',
    description: 'Total ball throws',
    category: 'OFFENSIVE',
    tiers: [10, 100, 250, 1000],
  },
  {
    id: 'kos',
    name: 'Knockout King',
    icon: '💀',
    description: 'Opponents knocked out',
    category: 'OFFENSIVE',
    tiers: [10, 100, 250, 1000],
  },
  // ── Defensive ──
  {
    id: 'catches',
    name: 'Sticky Hands',
    icon: '🧤',
    description: 'Balls caught',
    category: 'DEFENSIVE',
    tiers: [10, 100, 250, 1000],
  },
  {
    id: 'deflections',
    name: 'Iron Wall',
    icon: '🛡️',
    description: 'Balls deflected',
    category: 'DEFENSIVE',
    tiers: [10, 100, 250, 1000],
  },
  // ── Parkour Dodges (individual tracking per dodge style) ──
  {
    id: 'dodge_webster',
    name: 'Webster Master',
    icon: '🤸',
    description: 'Webster dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_kong_vault',
    name: 'Kong Vault Master',
    icon: '🦍',
    description: 'Kong Vault dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_butterfly_kick',
    name: 'Butterfly Kick Master',
    icon: '🦋',
    description: 'Butterfly Kick dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_aerial_spin',
    name: 'Aerial Spin Master',
    icon: '🌪️',
    description: 'Aerial Spin dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_gainer',
    name: 'Gainer Master',
    icon: '🔄',
    description: 'Gainer dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_corkscrew',
    name: 'Corkscrew Master',
    icon: '🌀',
    description: 'Corkscrew dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_cheat_gainer',
    name: 'Cheat Gainer Master',
    icon: '🎭',
    description: 'Cheat Gainer dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'dodge_aerial_twist',
    name: 'Aerial Twist Master',
    icon: '🎪',
    description: 'Aerial Twist dodges performed',
    category: 'DEFENSIVE',
    tiers: [5, 25, 100, 500],
  },
  // ── Power-Ups (individual tracking per power-up type) ──
  {
    id: 'pu_giant_ball',
    name: 'Wrecking Ball',
    icon: '⚫',
    description: 'Giant Ball power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_freeze',
    name: 'Ice Age',
    icon: '❄️',
    description: 'Freeze power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_lightning',
    name: 'Thor\'s Wrath',
    icon: '⚡',
    description: 'Lightning Strike power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_laser_ball',
    name: 'Unstoppable Force',
    icon: '🔮',
    description: 'Laser Ball power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_fireball',
    name: 'Pyromaniac',
    icon: '🔥',
    description: 'Fireball power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_banana_peel',
    name: 'Banana Bandit',
    icon: '🍌',
    description: 'Banana Peel power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_super_speed',
    name: 'Speed Demon',
    icon: '👟',
    description: 'Super Speed power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_slap_shot',
    name: 'Enforcer',
    icon: '🏒',
    description: 'Slap Shot power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'pu_trap_door',
    name: 'See You Next Fall',
    icon: '🚪',
    description: 'Trap Door power-ups used',
    category: 'POWER-UPS',
    tiers: [5, 25, 100, 500],
  },
  // ── Matches ──
  {
    id: 'matches_played',
    name: 'Veteran',
    icon: '🎖️',
    description: 'Total matches played',
    category: 'CAREER',
    tiers: [5, 25, 100, 500],
  },
  {
    id: 'matches_won',
    name: 'Champion',
    icon: '🏆',
    description: 'Matches won',
    category: 'CAREER',
    tiers: [5, 25, 100, 250],
  },
];

// ─── Achievement System Class ─────────────────────────────
export class AchievementSystem {
  constructor() {
    // All-time stats counters
    this.stats = {};
    // Which tier is unlocked for each achievement (0 = none, 1-4 = tier)
    this.unlocked = {};
    // Pending XP awards (collected by main game loop)
    this.pendingXP = 0;
    // Queue of newly unlocked achievements to show notifications
    this.notificationQueue = [];
    
    // Initialize all stats to 0
    ACHIEVEMENT_DEFS.forEach(def => {
      this.stats[def.id] = 0;
      this.unlocked[def.id] = 0;
    });
    
    this.load();
  }
  
  // ── Persistence ──
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        stats: this.stats,
        unlocked: this.unlocked,
        version: 2,
      }));
    } catch (e) {
      // localStorage not available
    }
  }
  
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.stats) {
          // Merge loaded stats (preserves new achievements added later)
          Object.keys(parsed.stats).forEach(key => {
            if (key in this.stats) {
              this.stats[key] = parsed.stats[key];
            }
          });
        }
        if (parsed.unlocked) {
          Object.keys(parsed.unlocked).forEach(key => {
            if (key in this.unlocked) {
              this.unlocked[key] = parsed.unlocked[key];
            }
          });
        }
      }
    } catch (e) {
      // Reset to defaults on error
    }
  }
  
  // ── Increment a stat and check for tier unlock ──
  // Returns { unlocked: bool, achievement, tier, xp } if a new tier was reached
  increment(statId, amount = 1) {
    if (!(statId in this.stats)) return null;
    
    this.stats[statId] += amount;
    this.save();
    
    // Check if we crossed a new tier threshold
    const def = ACHIEVEMENT_DEFS.find(d => d.id === statId);
    if (!def) return null;
    
    const currentTier = this.unlocked[statId];
    if (currentTier >= 4) return null; // Already maxed
    
    const nextThreshold = def.tiers[currentTier]; // Index 0 = tier 1 threshold
    if (this.stats[statId] >= nextThreshold) {
      const newTier = currentTier + 1;
      this.unlocked[statId] = newTier;
      this.save();
      
      const xpReward = TIER_XP[currentTier];
      this.pendingXP += xpReward;
      
      const result = {
        unlocked: true,
        achievement: def,
        tier: newTier,
        tierName: TIER_NAMES[currentTier],
        tierColor: TIER_COLORS[currentTier],
        tierIcon: TIER_ICONS[currentTier],
        xp: xpReward,
      };
      
      this.notificationQueue.push(result);
      return result;
    }
    
    return null;
  }
  
  // ── Drain pending XP (called by rank system) ──
  drainPendingXP() {
    const xp = this.pendingXP;
    this.pendingXP = 0;
    return xp;
  }
  
  // ── Get next notification to display ──
  getNextNotification() {
    if (this.notificationQueue.length === 0) return null;
    return this.notificationQueue.shift();
  }
  
  // ── Get full achievement data for UI display ──
  getAll() {
    return ACHIEVEMENT_DEFS.map(def => {
      const currentTier = this.unlocked[def.id];
      const stat = this.stats[def.id];
      const nextTierIndex = currentTier < 4 ? currentTier : 3;
      const nextThreshold = def.tiers[nextTierIndex];
      const prevThreshold = currentTier > 0 ? def.tiers[currentTier - 1] : 0;
      
      // Progress toward next tier (or 100% if maxed)
      let progress;
      if (currentTier >= 4) {
        progress = 1;
      } else {
        const range = nextThreshold - prevThreshold;
        const into = stat - prevThreshold;
        progress = Math.min(1, Math.max(0, into / range));
      }
      
      return {
        ...def,
        stat,
        currentTier,
        nextThreshold: currentTier >= 4 ? def.tiers[3] : nextThreshold,
        progress,
        maxed: currentTier >= 4,
        tierName: currentTier > 0 ? TIER_NAMES[currentTier - 1] : null,
        tierColor: currentTier > 0 ? TIER_COLORS[currentTier - 1] : '#555',
        tierIcon: currentTier > 0 ? TIER_ICONS[currentTier - 1] : '🔒',
      };
    });
  }
  
  // ── Get achievements grouped by category ──
  getByCategory() {
    const all = this.getAll();
    const categories = {};
    all.forEach(a => {
      if (!categories[a.category]) categories[a.category] = [];
      categories[a.category].push(a);
    });
    return categories;
  }
  
  // ── Summary stats for UI ──
  getTotalUnlocked() {
    let total = 0;
    let max = ACHIEVEMENT_DEFS.length * 4;
    Object.values(this.unlocked).forEach(t => total += t);
    return { unlocked: total, max };
  }
}

export { TIER_NAMES, TIER_COLORS, TIER_ICONS, TIER_XP };
