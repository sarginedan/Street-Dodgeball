// ═══════════════════════════════════════════════════════════
// ═══ STREET DODGEBALL — Ranking System ═══════════════════
// Inspired by Call of Duty 4: Modern Warfare progression
// Persistent XP stored in localStorage
// ═══════════════════════════════════════════════════════════

const STORAGE_KEY = 'streetDodgeball_rank';

// ─── XP Awards ──────────────────────────────────────────
export const XP_AWARDS = {
  MATCH_WIN:    100,
  MATCH_LOSS:   25,
  KO_KILL:      5,
  CATCH:        5,
  DEFLECT:      5,
};

// ─── Rank Definitions (Dodgeball Movie-inspired progression) ───────
// 45 sub-ranks spread across 8 tiers with escalating XP thresholds
export const RANKS = [
  // Tier 1: Rubber Rookie — Bronze ball with single star
  { level: 1,  title: 'Rubber Rookie I',          xpRequired: 0,    tier: 0 },
  { level: 2,  title: 'Rubber Rookie II',         xpRequired: 50,   tier: 0 },
  { level: 3,  title: 'Rubber Rookie III',        xpRequired: 125,  tier: 0 },
  { level: 4,  title: 'Rubber Rookie IV',         xpRequired: 225,  tier: 0 },
  { level: 5,  title: 'Rubber Rookie V',          xpRequired: 350,  tier: 0 },
  
  // Tier 2: Bounce Back — Bronze-gold ball with double stars
  { level: 6,  title: 'Bounce Back I',          xpRequired: 500,  tier: 1 },
  { level: 7,  title: 'Bounce Back II',         xpRequired: 675,  tier: 1 },
  { level: 8,  title: 'Bounce Back III',        xpRequired: 875,  tier: 1 },
  { level: 9,  title: 'Bounce Back IV',         xpRequired: 1100, tier: 1 },
  { level: 10, title: 'Bounce Back V',          xpRequired: 1350, tier: 1 },
  
  // Tier 3: Sidestep Specialist — Silver ball with motion
  { level: 11, title: 'Sidestep Specialist I',         xpRequired: 1650,  tier: 2 },
  { level: 12, title: 'Sidestep Specialist II',        xpRequired: 1975,  tier: 2 },
  { level: 13, title: 'Sidestep Specialist III',       xpRequired: 2350,  tier: 2 },
  { level: 14, title: 'Sidestep Specialist IV',        xpRequired: 2775,  tier: 2 },
  { level: 15, title: 'Sidestep Specialist V',         xpRequired: 3250,  tier: 2 },
  
  // Tier 4: Wrench Warrior — Silver-blue ball with wrench (movie ref)
  { level: 16, title: 'Wrench Warrior I',         xpRequired: 3800,  tier: 3 },
  { level: 17, title: 'Wrench Warrior II',        xpRequired: 4400,  tier: 3 },
  { level: 18, title: 'Wrench Warrior III',       xpRequired: 5075,  tier: 3 },
  { level: 19, title: 'Wrench Warrior IV',        xpRequired: 5825,  tier: 3 },
  { level: 20, title: 'Wrench Warrior V',         xpRequired: 6650,  tier: 3 },
  
  // Tier 5: Average Joe — Gold ball with trophy (movie ref)
  { level: 21, title: 'Average Joe I',       xpRequired: 7600,  tier: 4 },
  { level: 22, title: 'Average Joe II',      xpRequired: 8625,  tier: 4 },
  { level: 23, title: 'Average Joe III',     xpRequired: 9750,  tier: 4 },
  { level: 24, title: 'Average Joe IV',      xpRequired: 10975, tier: 4 },
  { level: 25, title: 'Average Joe V',       xpRequired: 12300, tier: 4 },
  
  // Tier 6: Cotton McKinney — Amber-gold ball with crown (movie ref)
  { level: 26, title: 'Cotton McKinney I',          xpRequired: 13750, tier: 5 },
  { level: 27, title: 'Cotton McKinney II',         xpRequired: 15325, tier: 5 },
  { level: 28, title: 'Cotton McKinney III',        xpRequired: 17025, tier: 5 },
  { level: 29, title: 'Cotton McKinney IV',         xpRequired: 18875, tier: 5 },
  { level: 30, title: 'Cotton McKinney V',          xpRequired: 20875, tier: 5 },
  
  // Tier 7: White Goodman — Fire-gold ball with flames (movie villain ref)
  { level: 31, title: 'White Goodman I',        xpRequired: 23050, tier: 6 },
  { level: 32, title: 'White Goodman II',       xpRequired: 25400, tier: 6 },
  { level: 33, title: 'White Goodman III',      xpRequired: 27950, tier: 6 },
  { level: 34, title: 'White Goodman IV',       xpRequired: 30700, tier: 6 },
  { level: 35, title: 'White Goodman V',        xpRequired: 33700, tier: 6 },
  
  // Tier 8: Globo Gym Legend — Red-gold prestige ball with diamonds (movie ref)
  { level: 36, title: 'Globo Gym Legend I',          xpRequired: 36950,  tier: 7 },
  { level: 37, title: 'Globo Gym Legend II',         xpRequired: 40450,  tier: 7 },
  { level: 38, title: 'Globo Gym Legend III',        xpRequired: 44200,  tier: 7 },
  { level: 39, title: 'Globo Gym Legend IV',         xpRequired: 48250,  tier: 7 },
  { level: 40, title: 'Globo Gym Legend V',          xpRequired: 52600,  tier: 7 },
  
  // Prestige levels
  { level: 41, title: '★ Globo Gym Legend',          xpRequired: 57300,  tier: 7 },
  { level: 42, title: '★★ Globo Gym Legend',         xpRequired: 62400,  tier: 7 },
  { level: 43, title: '★★★ Globo Gym Legend',        xpRequired: 67900,  tier: 7 },
  { level: 44, title: '★★★★ Globo Gym Legend',       xpRequired: 73900,  tier: 7 },
  { level: 45, title: '★★★★★ Globo Gym Legend',      xpRequired: 80400,  tier: 7 },
];

// Rank icon URLs for each tier
export const RANK_ICONS = [
  'https://rosebud.ai/assets/rank-01-rubber-rookie.png.webp?lHTN',     // Tier 0: Rubber Rookie
  'https://rosebud.ai/assets/rank-02-bounce-back.png.webp?W1ur',       // Tier 1: Bounce Back
  'https://rosebud.ai/assets/rank-03-sidestep-specialist.png.webp?qHHl', // Tier 2: Sidestep Specialist
  'https://rosebud.ai/assets/rank-04-wrench-warrior.png.webp?qvPX',    // Tier 3: Wrench Warrior
  'https://rosebud.ai/assets/rank-05-average-joe.png.webp?CRW5',       // Tier 4: Average Joe
  'https://rosebud.ai/assets/rank-06-cotton-mckinney.png.webp?i6yW',   // Tier 5: Cotton McKinney
  'https://rosebud.ai/assets/rank-07-white-goodman.png.webp?0MjK',     // Tier 6: White Goodman
  'https://rosebud.ai/assets/rank-08-globo-gym-legend.png.webp?WCaZ',  // Tier 7: Globo Gym Legend
];

// Tier glow colors for visual flair
export const TIER_COLORS = [
  '#cd7f32',  // Bronze
  '#cd9834',  // Bronze-Gold
  '#a0b0c0',  // Silver
  '#7ec8e3',  // Ice Blue
  '#ffd700',  // Gold
  '#ffaa00',  // Amber Gold
  '#ff6600',  // Fire Gold
  '#ff4444',  // Red-Gold (Prestige)
];

// ─── Rank System Class ──────────────────────────────────
export class RankSystem {
  constructor() {
    this.xp = 0;
    this.currentRankIndex = 0;
    this.matchXPLog = [];       // accumulates XP events during a match
    this.load();
  }
  
  // ── Persistence ──
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        xp: this.xp,
        version: 1,
      }));
    } catch (e) {
      // localStorage not available — graceful degradation
    }
  }
  
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.xp = parsed.xp || 0;
      }
    } catch (e) {
      this.xp = 0;
    }
    this.currentRankIndex = this.getRankIndex();
  }
  
  // ── Get current rank info ──
  getRankIndex() {
    let idx = 0;
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (this.xp >= RANKS[i].xpRequired) {
        idx = i;
        break;
      }
    }
    return idx;
  }
  
  getRank() {
    return RANKS[this.currentRankIndex];
  }
  
  getNextRank() {
    if (this.currentRankIndex >= RANKS.length - 1) return null;
    return RANKS[this.currentRankIndex + 1];
  }
  
  getProgress() {
    const rank = this.getRank();
    const next = this.getNextRank();
    if (!next) return 1; // Max rank
    const xpIntoRank = this.xp - rank.xpRequired;
    const xpNeeded = next.xpRequired - rank.xpRequired;
    return Math.min(1, xpIntoRank / xpNeeded);
  }
  
  getIcon() {
    return RANK_ICONS[this.getRank().tier];
  }
  
  getTierColor() {
    return TIER_COLORS[this.getRank().tier];
  }
  
  // ── Match XP Tracking ──
  resetMatchLog() {
    this.matchXPLog = [];
  }
  
  logXP(reason, amount) {
    this.matchXPLog.push({ reason, amount, timestamp: Date.now() });
  }
  
  // ── Award XP ── returns { amount, newLevel, ranked_up, old_rank, new_rank }
  awardXP(amount, reason) {
    const oldRankIndex = this.currentRankIndex;
    const oldRank = RANKS[oldRankIndex];
    
    this.xp += amount;
    this.currentRankIndex = this.getRankIndex();
    this.save();
    this.logXP(reason, amount);
    
    const newRank = RANKS[this.currentRankIndex];
    const ranked_up = this.currentRankIndex > oldRankIndex;
    
    return {
      amount,
      reason,
      ranked_up,
      old_rank: oldRank,
      new_rank: newRank,
      totalXP: this.xp,
    };
  }
  
  // Convenience methods for game events
  awardMatchWin()  { return this.awardXP(XP_AWARDS.MATCH_WIN,  'Match Victory'); }
  awardMatchLoss() { return this.awardXP(XP_AWARDS.MATCH_LOSS, 'Match Played');  }
  awardKO()        { return this.awardXP(XP_AWARDS.KO_KILL,    'KO Kill');       }
  awardCatch()     { return this.awardXP(XP_AWARDS.CATCH,      'Ball Catch');    }
  awardDeflect()   { return this.awardXP(XP_AWARDS.DEFLECT,    'Deflection');    }
  
  // Get match summary for end-of-game screen
  getMatchSummary() {
    const summary = {};
    let total = 0;
    this.matchXPLog.forEach(entry => {
      if (!summary[entry.reason]) {
        summary[entry.reason] = { count: 0, xp: 0 };
      }
      summary[entry.reason].count++;
      summary[entry.reason].xp += entry.amount;
      total += entry.amount;
    });
    return { breakdown: summary, total };
  }
}
