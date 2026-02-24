// Game Configuration
export const CONFIG = {
  // Court dimensions
  COURT_WIDTH: 28,
  COURT_DEPTH: 16,
  COURT_HALF: 14,
  
  // Player
  PLAYER_SPEED: 8,
  PLAYER_SPRINT_SPEED: 12,
  PLAYER_HP: 200,
  PLAYER_RADIUS: 0.5,
  PLAYER_HEIGHT: 1.8,
  
  // Dodgeball
  BALL_RADIUS: 0.25,
  BALL_SPEED: 18,
  BALL_TRICK_SPEED: 22,
  BALL_GRAVITY: -12,
  BALL_COUNT: 5,
  
  // Catch
  CATCH_WINDOW: 0.35,  // seconds window to catch
  CATCH_RANGE: 2.0,
  
  // Teams
  TEAM_SIZE: 5,
  TEAM_BLUE: 'blue',
  TEAM_RED: 'red',
  
  // AI
  AI_REACTION_TIME: 0.4,
  AI_THROW_COOLDOWN: 1.5,
  AI_CATCH_CHANCE: 0.35,
  AI_DODGE_CHANCE: 0.3,
  AI_MOVE_SPEED: 7.2,
  
  // Damage
  NORMAL_THROW_DAMAGE: 25,
  TRICK_THROW_DAMAGE: 40,
  POWER_THROW_DAMAGE: 35,
  
  // Power-Up Spawn
  POWERUP_SPAWN_CHANCE: 0.75, // 75% chance to spawn power-up after ball hits player (0-1 range)
  
  // Trick throws
  TRICKS: {
    FIREBALL: { name: 'FIREBALL', damage: 35, speed: 24, color: 0xff6600, charge: 30 },
    LIGHTNING: { name: 'LIGHTNING', damage: 40, speed: 28, color: 0x00ccff, charge: 50 },
    CURVE: { name: 'CURVEBALL', damage: 25, speed: 20, color: 0x00ff88, charge: 15 },
    METEOR: { name: 'METEOR', damage: 50, speed: 16, color: 0xff0044, charge: 80 },
  },
  
  // Throw Charge (hold-to-throw power bar)
  THROW_CHARGE_RATE: 1.6,       // fills 0→1 in ~0.62s
  THROW_CHARGE_SLOW: 0.3,       // movement speed multiplier while charging throw
  THROW_MIN_CHARGE: 0.0,        // minimum charge to release (0 = instant throw ok)
  THROW_CHARGE_DMG_MIN: 0.6,    // damage multiplier at 0 charge
  THROW_CHARGE_DMG_MAX: 1.3,    // damage multiplier at full charge
  THROW_CHARGE_SPEED_MIN: 0.7,  // ball speed multiplier at 0 charge
  THROW_CHARGE_SPEED_MAX: 1.25, // ball speed multiplier at full charge

  // Stamina
  MAX_STAMINA: 100,
  STAMINA_REGEN: 15,  // per second
  SPRINT_COST: 25,    // per second
  DODGE_COST: 30,
  CATCH_COST: 20,     // stamina cost for catching
  DEFLECT_COST: 25,   // stamina cost for deflecting
  
  // Deflect System (block incoming ball while holding your own)
  DEFLECT_WINDOW: 0.35,         // timing window to deflect (same as catch)
  DEFLECT_RANGE: 2.5,           // detection range for incoming balls
  DEFLECT_SPEED_MULT: 0.7,      // deflected ball keeps this fraction of speed
  DEFLECT_DAMAGE_MULT: 0.5,     // deflected ball does this fraction of original damage
  DEFLECT_BOUNCE_UP: 3,         // upward velocity added to deflected ball
  DEFLECT_SCATTER: 0.4,         // random lateral scatter on deflect
  
  // Parkour Dodge System
  DODGE_STAMINA_COST: 25,       // stamina drained per dodge
  DODGE_DURATION: 0.65,         // total dodge animation time (seconds)
  DODGE_COOLDOWN: 0.8,          // minimum time between dodges (seconds)
  DODGE_DISTANCE: 4.5,          // total lateral displacement (units)
  DODGE_INVINCIBLE_START: 0.0,  // invincibility starts immediately
  DODGE_INVINCIBLE_END: 0.52,   // invincibility ends at 52% through animation
  DODGE_PEAK_HEIGHT: 1.6,       // peak jump height during dodge
  // 8 parkour dodge styles:
  // 0 = WEBSTER (front-to-back one-handed cartwheel)
  // 1 = KONG VAULT (dive-roll over imaginary obstacle)
  // 2 = BUTTERFLY KICK (horizontal spinning aerial kick — wushu style)
  // 3 = AERIAL SPIN (vertical 360 spin with legs whipping around — breakdance/parkour)
  // 4 = GAINER (backflip with forward momentum — the paradox flip)
  // 5 = CORKSCREW (diagonal barrel roll with asymmetric twist — fighter jet maneuver)
  // 6 = CHEAT GAINER (lateral wind-up into spinning backflip — explosive hybrid)
  // 7 = AERIAL TWIST (720° helicopter spin with extended limbs — pure showmanship)
  
  // Throw flip jump heights
  FLIP_HEIGHT_BACKFLIP: 2.8,    // base peak height for backflip+360
  FLIP_HEIGHT_TORNADO: 3.2,     // base peak height for tornado cartwheel (higher arc)
  FLIP_HEIGHT_GAINER: 3.6,      // base peak height for gainer twist (highest — hangtime king)
  FLIP_HEIGHT_CORKSCREW: 3.0,   // base peak height for corkscrew twist
  FLIP_HEIGHT_SUPERMAN: 2.4,    // base peak height for superman dive (lower, faster arc)
  FLIP_HEIGHT_WINDMILL: 3.4,    // base peak height for windmill helicopter (high hangtime)
  FLIP_LANDING_SHAKE_MIN: 0.03, // camera shake at minimum jump height
  FLIP_LANDING_SHAKE_MAX: 0.12, // camera shake at max jump height
  
  // Camera — inside gym, elevated side-scroll view looking down at court
  CAMERA_DISTANCE: 12,
  CAMERA_HEIGHT: 9,
  CAMERA_ANGLE: Math.PI / 6,
  
  // Colors
  TEAM_BLUE_COLOR: 0x2979ff,
  TEAM_BLUE_ACCENT: 0x00e5ff,
  TEAM_RED_COLOR: 0xef5350,
  TEAM_RED_ACCENT: 0xff8a65,
  FLOOR_COLOR: 0xd4a056,
  WALL_COLOR: 0x90a4ae,
  
  // Textures
  FLOOR_TEXTURE: 'https://rosebud.ai/assets/gym-floor.webp?uZ4i',
  WALL_TEXTURE: 'https://rosebud.ai/assets/gym-wall.webp?Vm6X',
  BALL_TEXTURE: 'https://rosebud.ai/assets/dodgeball-texture.webp?41f0',
};
