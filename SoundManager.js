// Asset URLs — no special characters, spaces encoded as %20
const IMPACT_URL = 'https://rosebud.ai/assets/dodge%20ball%20impact%20and%20catch.wav?khOx';
const WHOOSH_URL = 'https://rosebud.ai/assets/Whoosh%20for%20tricks.wav?oSLE';
const CATCH_APPROVAL_URL = 'https://rosebud.ai/assets/audience%20catch%20approval.wav?Hkxw';
const CROWD_WOO_2_URL = 'https://rosebud.ai/assets/Crowd%20woo%202.wav?p6KC';
const CROWD_WOO_4_URL = 'https://rosebud.ai/assets/Crowd%20woo%204.wav?IvsG';
// KO Variation 1 & 2 removed per user request
const KO_VARIATION_3_URL = 'https://rosebud.ai/assets/KO%20Variation%203.wav?LaiU';
const KO_VARIATION_4_URL = 'https://rosebud.ai/assets/Ko%20deep.wav?sAJt';
const KO_VARIATION_5_URL = 'https://rosebud.ai/assets/Ko%20medium.wav?26px';
const KO_VARIATION_6_URL = 'https://rosebud.ai/assets/Knock%20out.wav?gcpz';
const KO_VARIATION_7_URL = 'https://rosebud.ai/assets/Hes%20dead.wav?HIjG';
const KO_VARIATION_8_URL = 'https://rosebud.ai/assets/KO%20high.wav?86h1';
const RANK_UP_URL = 'https://rosebud.ai/assets/Level%20Up%20Reward%20Sound%201.wav?XOdi';
const GIANT_BALL_SCREAM_1_URL = 'https://rosebud.ai/assets/screaming%201.wav?fQ0o';
const GIANT_BALL_SCREAM_2_URL = 'https://rosebud.ai/assets/Scream%2011.wav?3lom';
const GIANT_BALL_SCREAM_3_URL = 'https://rosebud.ai/assets/Scream%2012.wav?WsDP';
const GIANT_BALL_SCREAM_4_URL = 'https://rosebud.ai/assets/Scream%2013.wav?jZEz';
const GIANT_BALL_SCREAM_5_URL = 'https://rosebud.ai/assets/Scream%2005%20Revised.wav?kgfg';
const GIANT_BALL_PICKUP_1_URL = 'https://rosebud.ai/assets/Mega%20Ball.wav?Ojmv';
const GIANT_BALL_PICKUP_2_URL = 'https://rosebud.ai/assets/Giant%20Dodgeball.wav?zwrx';
const FIREBALL_PICKUP_1_URL = 'https://rosebud.ai/assets/Pyromaniac.wav?wsHS';
const FIREBALL_PICKUP_2_URL = 'https://rosebud.ai/assets/Fireball.wav?0BMb';
const FREEZE_PICKUP_1_URL = 'https://rosebud.ai/assets/Freeze.wav?Erm4';
const FREEZE_PICKUP_2_URL = 'https://rosebud.ai/assets/Ice%20Age.wav?VIKW';
const LIGHTNING_PICKUP_1_URL = 'https://rosebud.ai/assets/Thors%20Wrath.wav?Dbbx';
const LIGHTNING_PICKUP_2_URL = 'https://rosebud.ai/assets/Lightning%20Bolt.wav?o3D2';
const LASER_PICKUP_1_URL = 'https://rosebud.ai/assets/Laserr.wav?QPGg';
const LASER_PICKUP_2_URL = 'https://rosebud.ai/assets/Zing.wav?wZNg';
const BANANA_PICKUP_1_URL = 'https://rosebud.ai/assets/Banana%20Low.wav?BYsi';
const BANANA_PICKUP_2_URL = 'https://rosebud.ai/assets/Banana%20High.wav?suto';
const SPEED_PICKUP_1_URL = 'https://rosebud.ai/assets/Speed%20Demon.wav?TW0C';
const SPEED_PICKUP_2_URL = 'https://rosebud.ai/assets/Super%20Speed.wav?B7MS';
const SLAPSHOT_PICKUP_1_URL = 'https://rosebud.ai/assets/Slapshot.wav?cd5x';
const SLAPSHOT_PICKUP_2_URL = 'https://rosebud.ai/assets/Enforcer.wav?jSXV';
const TRAPDOOR_PICKUP_1_URL = 'https://rosebud.ai/assets/See%20You%20Next%20Fall.wav?gNTr';
const TRAPDOOR_PICKUP_2_URL = 'https://rosebud.ai/assets/Trap%20Door.wav?lzld';
const OUTRO_MUSIC_URL = 'https://rosebud.ai/assets/Outro%20Music.wav?c9ic';
const LIGHTNING_STRIKE_URL = 'https://rosebud.ai/assets/Lightning%20Strike.wav?763w';
const CHARGE_THROW_URL = 'https://rosebud.ai/assets/Charging%20Up%20Sound%20Revised%2001.wav?OPn9';
const ACHIEVEMENT_SOUND_URL = 'https://rosebud.ai/assets/Achievement%20Sound.wav?E8QL';
const SLAPSHOT_SCREAM_1_URL = 'https://rosebud.ai/assets/Scream%2011.wav?3lom';
const SLAPSHOT_SCREAM_2_URL = 'https://rosebud.ai/assets/Scream%2012.wav?WsDP';
const SLAPSHOT_SCREAM_3_URL = 'https://rosebud.ai/assets/Scream%2013.wav?jZEz';
const SLAPSHOT_SCREAM_4_URL = 'https://rosebud.ai/assets/Scream%2005%20Revised.wav?kgfg';
const HOCKEY_HIT_URL = 'https://rosebud.ai/assets/Hockey%20Hit%2001.wav?QlBC';
const FREEZE_SOUND_URL = 'https://rosebud.ai/assets/Freeze%20Sound%20Effect.wav?0yaW';
const LASER_SOUND_URL = 'https://rosebud.ai/assets/Laser.wav?lHGe';
const WHISTLE_URL = 'https://rosebud.ai/assets/whistle%201.wav?NLMC';

// ─── Music Track Pool ──────────────────────────────────────
// Format: { url: string, volumeMultiplier: number (default 1.0) }
const MUSIC_TRACKS = [
  { url: 'https://rosebud.ai/assets/Alone%20No%20Vox%20Loops.wav?GB6H', volumeMultiplier: 1.0 },
  { url: 'https://rosebud.ai/assets/Believe%20No%20Vox%20Loop.wav?2y3O', volumeMultiplier: 0.75 },
  { url: 'https://rosebud.ai/assets/Make%20Things%20Right%20No%20Vox%20Loop%202.wav?2oze', volumeMultiplier: 1.5 },
  { url: 'https://rosebud.ai/assets/Casualty%20No%20Vox%20Loop.mp3?N13k', volumeMultiplier: 1.0 },
  { url: 'https://rosebud.ai/assets/Capricious%20No%20Vox%20Loop.wav?fALX', volumeMultiplier: 1.0 },
];

export class SoundManager {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.musicVolume = 0.40;
    this.sfxVolume = 0.50;
    this._prevMusicVol = 0.40;
    this._prevSfxVol = 0.50;
    
    // Music track randomizer state
    this._currentTrackIndex = 0;
    this._trackHistory = []; // Prevent repeats
    
    // Web Audio buffers — decoded from fetched wav files
    this._impactBuffer = null;
    this._whooshBuffer = null;
    this._catchApprovalBuffer = null;
    this._crowdWoo2Buffer = null;
    this._crowdWoo4Buffer = null;
    this._catchSoundBuffers = []; // Array of catch sound variations (approval + crowd woos)
    this._lastCatchIndex = -1; // Track last played catch sound to prevent repeats
    this._koBuffers = []; // Array of 8 KO variation buffers
    this._lastKoIndex = -1; // Track last played KO to prevent repeats
    this._rankUpBuffer = null; // Level-up reward sound
    this._giantBallScreamBuffers = []; // Array of 6 scream sounds for giant ball hits
    this._lastGiantBallScreamIndex = -1; // Track last played giant ball scream to prevent repeats
    this._giantBallPickupBuffers = []; // Array of 2 giant ball pickup sounds
    this._fireballPickupBuffers = []; // Array of 2 fireball pickup sounds
    this._freezePickupBuffers = []; // Array of 2 freeze pickup sounds
    this._lightningPickupBuffers = []; // Array of 2 lightning pickup sounds
    this._laserPickupBuffers = []; // Array of 2 laser pickup sounds
    this._bananaPickupBuffers = []; // Array of 2 banana pickup sounds
    this._speedPickupBuffers = []; // Array of 2 speed pickup sounds
    this._slapshotPickupBuffers = []; // Array of 2 slapshot pickup sounds
    this._trapdoorPickupBuffers = []; // Array of 2 trap door pickup sounds
    this._lightningStrikeBuffer = null; // Lightning strike power-up SFX
    this._chargeThrowBuffer = null; // Charging up throw SFX
    this._chargeThrowSource = null; // Active charge sound source (for stopping)
    this._chargeThrowGain = null;   // Gain node for charge sound
    this._achievementBuffer = null; // Achievement unlock sound
    this._slapShotScreamBuffers = []; // 5 scream variations for slap shot hit
    this._lastSlapShotScreamIndex = -1; // Prevent repeat screams
    this._hockeyHitBuffer = null; // Hockey stick impact sound
    this._freezeSoundBuffer = null; // Freeze power-up sound
    this._laserSoundBuffer = null; // Laser ball sound
    this._whistleBuffer = null; // Whistle sound
    this._audioCtx = null;
    
    this.bgMusic = null;
    this.ready = true;
  }
  
  // ─── Load wav samples into Web Audio API buffers ──────────
  // Called from startGame() after user click (AudioContext is unlocked).
  async loadSamples() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const [impact, whoosh, catchApproval, crowdWoo2, crowdWoo4, ko3, ko4, ko5, ko6, ko7, ko8, rankUp, giantScream1, giantScream2, giantScream3, giantScream4, giantScream5, giantPickup1, giantPickup2, fireballPickup1, fireballPickup2, freezePickup1, freezePickup2, lightningPickup1, lightningPickup2, laserPickup1, laserPickup2, bananaPickup1, bananaPickup2, speedPickup1, speedPickup2, slapshotPickup1, slapshotPickup2, trapdoorPickup1, trapdoorPickup2, lightningStrike, chargeThrow, achievementSound, slapScream1, slapScream2, slapScream3, slapScream4, hockeyHit, freezeSound, laserSound, whistle] = await Promise.allSettled([
        this._fetchAndDecode(IMPACT_URL),
        this._fetchAndDecode(WHOOSH_URL),
        this._fetchAndDecode(CATCH_APPROVAL_URL),
        this._fetchAndDecode(CROWD_WOO_2_URL),
        this._fetchAndDecode(CROWD_WOO_4_URL),
        this._fetchAndDecode(KO_VARIATION_3_URL),
        this._fetchAndDecode(KO_VARIATION_4_URL),
        this._fetchAndDecode(KO_VARIATION_5_URL),
        this._fetchAndDecode(KO_VARIATION_6_URL),
        this._fetchAndDecode(KO_VARIATION_7_URL),
        this._fetchAndDecode(KO_VARIATION_8_URL),
        this._fetchAndDecode(RANK_UP_URL),
        this._fetchAndDecode(GIANT_BALL_SCREAM_1_URL),
        this._fetchAndDecode(GIANT_BALL_SCREAM_2_URL),
        this._fetchAndDecode(GIANT_BALL_SCREAM_3_URL),
        this._fetchAndDecode(GIANT_BALL_SCREAM_4_URL),
        this._fetchAndDecode(GIANT_BALL_SCREAM_5_URL),
        this._fetchAndDecode(GIANT_BALL_PICKUP_1_URL),
        this._fetchAndDecode(GIANT_BALL_PICKUP_2_URL),
        this._fetchAndDecode(FIREBALL_PICKUP_1_URL),
        this._fetchAndDecode(FIREBALL_PICKUP_2_URL),
        this._fetchAndDecode(FREEZE_PICKUP_1_URL),
        this._fetchAndDecode(FREEZE_PICKUP_2_URL),
        this._fetchAndDecode(LIGHTNING_PICKUP_1_URL),
        this._fetchAndDecode(LIGHTNING_PICKUP_2_URL),
        this._fetchAndDecode(LASER_PICKUP_1_URL),
        this._fetchAndDecode(LASER_PICKUP_2_URL),
        this._fetchAndDecode(BANANA_PICKUP_1_URL),
        this._fetchAndDecode(BANANA_PICKUP_2_URL),
        this._fetchAndDecode(SPEED_PICKUP_1_URL),
        this._fetchAndDecode(SPEED_PICKUP_2_URL),
        this._fetchAndDecode(SLAPSHOT_PICKUP_1_URL),
        this._fetchAndDecode(SLAPSHOT_PICKUP_2_URL),
        this._fetchAndDecode(TRAPDOOR_PICKUP_1_URL),
        this._fetchAndDecode(TRAPDOOR_PICKUP_2_URL),
        this._fetchAndDecode(LIGHTNING_STRIKE_URL),
        this._fetchAndDecode(CHARGE_THROW_URL),
        this._fetchAndDecode(ACHIEVEMENT_SOUND_URL),
        this._fetchAndDecode(SLAPSHOT_SCREAM_1_URL),
        this._fetchAndDecode(SLAPSHOT_SCREAM_2_URL),
        this._fetchAndDecode(SLAPSHOT_SCREAM_3_URL),
        this._fetchAndDecode(SLAPSHOT_SCREAM_4_URL),
        this._fetchAndDecode(HOCKEY_HIT_URL),
        this._fetchAndDecode(FREEZE_SOUND_URL),
        this._fetchAndDecode(LASER_SOUND_URL),
        this._fetchAndDecode(WHISTLE_URL),
      ]);
      
      if (impact.status === 'fulfilled') {
        this._impactBuffer = impact.value;
        console.log('✅ Impact loaded:', this._impactBuffer.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Impact failed:', impact.reason);
      }
      
      if (whoosh.status === 'fulfilled') {
        this._whooshBuffer = whoosh.value;
        console.log('✅ Whoosh loaded:', this._whooshBuffer.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Whoosh failed:', whoosh.reason);
      }
      
      if (catchApproval.status === 'fulfilled') {
        this._catchApprovalBuffer = catchApproval.value;
        this._catchSoundBuffers[0] = catchApproval.value;
        console.log('✅ Catch approval loaded:', this._catchApprovalBuffer.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Catch approval failed:', catchApproval.reason);
      }
      
      if (crowdWoo2.status === 'fulfilled') {
        this._crowdWoo2Buffer = crowdWoo2.value;
        this._catchSoundBuffers[1] = crowdWoo2.value;
        console.log('✅ Crowd Woo 2 loaded:', crowdWoo2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Crowd Woo 2 failed:', crowdWoo2.reason);
      }
      
      if (crowdWoo4.status === 'fulfilled') {
        this._crowdWoo4Buffer = crowdWoo4.value;
        this._catchSoundBuffers[2] = crowdWoo4.value;
        console.log('✅ Crowd Woo 4 loaded:', crowdWoo4.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Crowd Woo 4 failed:', crowdWoo4.reason);
      }
      
      // Load KO variations (1 & 2 removed, now 6 total)
      if (ko3.status === 'fulfilled') {
        this._koBuffers[0] = ko3.value;
        console.log('✅ KO Variation 3 loaded:', ko3.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 3 failed:', ko3.reason);
      }
      
      if (ko4.status === 'fulfilled') {
        this._koBuffers[1] = ko4.value;
        console.log('✅ KO Variation 4 loaded:', ko4.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 4 failed:', ko4.reason);
      }
      
      if (ko5.status === 'fulfilled') {
        this._koBuffers[2] = ko5.value;
        console.log('✅ KO Variation 5 loaded:', ko5.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 5 failed:', ko5.reason);
      }
      
      if (ko6.status === 'fulfilled') {
        this._koBuffers[3] = ko6.value;
        console.log('✅ KO Variation 6 loaded:', ko6.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 6 failed:', ko6.reason);
      }
      
      if (ko7.status === 'fulfilled') {
        this._koBuffers[4] = ko7.value;
        console.log('✅ KO Variation 7 loaded:', ko7.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 7 failed:', ko7.reason);
      }
      
      if (ko8.status === 'fulfilled') {
        this._koBuffers[5] = ko8.value;
        console.log('✅ KO Variation 8 loaded:', ko8.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ KO Variation 8 failed:', ko8.reason);
      }
      
      if (rankUp.status === 'fulfilled') {
        this._rankUpBuffer = rankUp.value;
        console.log('✅ Rank Up sound loaded:', rankUp.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Rank Up sound failed:', rankUp.reason);
      }
      
      // Load Giant Ball Scream sounds (4 variations)
      if (giantScream1.status === 'fulfilled') {
        this._giantBallScreamBuffers[0] = giantScream1.value;
        console.log('✅ Giant Ball Scream 1 loaded:', giantScream1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Scream 1 failed:', giantScream1.reason);
      }
      
      if (giantScream2.status === 'fulfilled') {
        this._giantBallScreamBuffers[1] = giantScream2.value;
        console.log('✅ Giant Ball Scream 2 loaded:', giantScream2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Scream 2 failed:', giantScream2.reason);
      }
      
      if (giantScream3.status === 'fulfilled') {
        this._giantBallScreamBuffers[2] = giantScream3.value;
        console.log('✅ Giant Ball Scream 3 loaded:', giantScream3.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Scream 3 failed:', giantScream3.reason);
      }
      
      if (giantScream4.status === 'fulfilled') {
        this._giantBallScreamBuffers[3] = giantScream4.value;
        console.log('✅ Giant Ball Scream 4 loaded:', giantScream4.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Scream 4 failed:', giantScream4.reason);
      }
      
      if (giantScream5.status === 'fulfilled') {
        this._giantBallScreamBuffers[4] = giantScream5.value;
        console.log('✅ Giant Ball Scream 5 loaded:', giantScream5.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Scream 5 failed:', giantScream5.reason);
      }
      
      // Load Giant Ball Pickup sounds
      if (giantPickup1.status === 'fulfilled') {
        this._giantBallPickupBuffers[0] = giantPickup1.value;
        console.log('✅ Giant Ball Pickup 1 loaded:', giantPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Pickup 1 failed:', giantPickup1.reason);
      }
      
      if (giantPickup2.status === 'fulfilled') {
        this._giantBallPickupBuffers[1] = giantPickup2.value;
        console.log('✅ Giant Ball Pickup 2 loaded:', giantPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Giant Ball Pickup 2 failed:', giantPickup2.reason);
      }
      
      // Load Fireball Pickup sounds
      if (fireballPickup1.status === 'fulfilled') {
        this._fireballPickupBuffers[0] = fireballPickup1.value;
        console.log('✅ Fireball Pickup 1 loaded:', fireballPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Fireball Pickup 1 failed:', fireballPickup1.reason);
      }
      
      if (fireballPickup2.status === 'fulfilled') {
        this._fireballPickupBuffers[1] = fireballPickup2.value;
        console.log('✅ Fireball Pickup 2 loaded:', fireballPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Fireball Pickup 2 failed:', fireballPickup2.reason);
      }
      
      // Load Freeze Pickup sounds
      if (freezePickup1.status === 'fulfilled') {
        this._freezePickupBuffers[0] = freezePickup1.value;
        console.log('✅ Freeze Pickup 1 loaded:', freezePickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Freeze Pickup 1 failed:', freezePickup1.reason);
      }
      
      if (freezePickup2.status === 'fulfilled') {
        this._freezePickupBuffers[1] = freezePickup2.value;
        console.log('✅ Freeze Pickup 2 loaded:', freezePickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Freeze Pickup 2 failed:', freezePickup2.reason);
      }
      
      // Load Lightning Pickup sounds
      if (lightningPickup1.status === 'fulfilled') {
        this._lightningPickupBuffers[0] = lightningPickup1.value;
        console.log('✅ Lightning Pickup 1 loaded:', lightningPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Lightning Pickup 1 failed:', lightningPickup1.reason);
      }
      
      if (lightningPickup2.status === 'fulfilled') {
        this._lightningPickupBuffers[1] = lightningPickup2.value;
        console.log('✅ Lightning Pickup 2 loaded:', lightningPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Lightning Pickup 2 failed:', lightningPickup2.reason);
      }
      
      // Load Laser Pickup sounds
      if (laserPickup1.status === 'fulfilled') {
        this._laserPickupBuffers[0] = laserPickup1.value;
        console.log('✅ Laser Pickup 1 loaded:', laserPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Laser Pickup 1 failed:', laserPickup1.reason);
      }
      
      if (laserPickup2.status === 'fulfilled') {
        this._laserPickupBuffers[1] = laserPickup2.value;
        console.log('✅ Laser Pickup 2 loaded:', laserPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Laser Pickup 2 failed:', laserPickup2.reason);
      }
      
      // Load Banana Pickup sounds
      if (bananaPickup1.status === 'fulfilled') {
        this._bananaPickupBuffers[0] = bananaPickup1.value;
        console.log('✅ Banana Pickup 1 loaded:', bananaPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Banana Pickup 1 failed:', bananaPickup1.reason);
      }
      
      if (bananaPickup2.status === 'fulfilled') {
        this._bananaPickupBuffers[1] = bananaPickup2.value;
        console.log('✅ Banana Pickup 2 loaded:', bananaPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Banana Pickup 2 failed:', bananaPickup2.reason);
      }
      
      // Load Speed Pickup sounds
      if (speedPickup1.status === 'fulfilled') {
        this._speedPickupBuffers[0] = speedPickup1.value;
        console.log('✅ Speed Pickup 1 loaded:', speedPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Speed Pickup 1 failed:', speedPickup1.reason);
      }
      
      if (speedPickup2.status === 'fulfilled') {
        this._speedPickupBuffers[1] = speedPickup2.value;
        console.log('✅ Speed Pickup 2 loaded:', speedPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Speed Pickup 2 failed:', speedPickup2.reason);
      }
      
      // Load Slapshot Pickup sounds
      if (slapshotPickup1.status === 'fulfilled') {
        this._slapshotPickupBuffers[0] = slapshotPickup1.value;
        console.log('✅ Slapshot Pickup 1 loaded:', slapshotPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Slapshot Pickup 1 failed:', slapshotPickup1.reason);
      }
      
      if (slapshotPickup2.status === 'fulfilled') {
        this._slapshotPickupBuffers[1] = slapshotPickup2.value;
        console.log('✅ Slapshot Pickup 2 loaded:', slapshotPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Slapshot Pickup 2 failed:', slapshotPickup2.reason);
      }
      
      // Trap Door Pickup sounds
      if (trapdoorPickup1.status === 'fulfilled') {
        this._trapdoorPickupBuffers[0] = trapdoorPickup1.value;
        console.log('✅ Trap Door Pickup 1 loaded:', trapdoorPickup1.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Trap Door Pickup 1 failed:', trapdoorPickup1.reason);
      }
      
      if (trapdoorPickup2.status === 'fulfilled') {
        this._trapdoorPickupBuffers[1] = trapdoorPickup2.value;
        console.log('✅ Trap Door Pickup 2 loaded:', trapdoorPickup2.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Trap Door Pickup 2 failed:', trapdoorPickup2.reason);
      }
      
      if (lightningStrike.status === 'fulfilled') {
        this._lightningStrikeBuffer = lightningStrike.value;
        console.log('✅ Lightning Strike loaded:', lightningStrike.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Lightning Strike failed:', lightningStrike.reason);
      }
      
      if (chargeThrow.status === 'fulfilled') {
        this._chargeThrowBuffer = chargeThrow.value;
        console.log('✅ Charge Throw loaded:', chargeThrow.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Charge Throw failed:', chargeThrow.reason);
      }
      
      if (achievementSound.status === 'fulfilled') {
        this._achievementBuffer = achievementSound.value;
        console.log('✅ Achievement Sound loaded:', achievementSound.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Achievement Sound failed:', achievementSound.reason);
      }
      
      // Load slap shot scream variations
      const slapScreams = [slapScream1, slapScream2, slapScream3, slapScream4];
      slapScreams.forEach((s, i) => {
        if (s.status === 'fulfilled') {
          this._slapShotScreamBuffers[i] = s.value;
          console.log(`✅ Slap Shot Scream ${i + 1} loaded:`, s.value.duration.toFixed(2) + 's');
        } else {
          console.warn(`❌ Slap Shot Scream ${i + 1} failed:`, s.reason);
        }
      });
      
      if (hockeyHit.status === 'fulfilled') {
        this._hockeyHitBuffer = hockeyHit.value;
        console.log('✅ Hockey Hit loaded:', hockeyHit.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Hockey Hit failed:', hockeyHit.reason);
      }
      
      if (freezeSound.status === 'fulfilled') {
        this._freezeSoundBuffer = freezeSound.value;
        console.log('✅ Freeze Sound loaded:', freezeSound.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Freeze Sound failed:', freezeSound.reason);
      }
      
      if (laserSound.status === 'fulfilled') {
        this._laserSoundBuffer = laserSound.value;
        console.log('✅ Laser Sound loaded:', laserSound.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Laser Sound failed:', laserSound.reason);
      }
      
      if (whistle.status === 'fulfilled') {
        this._whistleBuffer = whistle.value;
        console.log('✅ Whistle loaded:', whistle.value.duration.toFixed(2) + 's');
      } else {
        console.warn('❌ Whistle failed:', whistle.reason);
      }
    } catch(e) {
      console.warn('loadSamples error:', e);
    }
  }
  
  async _fetchAndDecode(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const arrayBuf = await resp.arrayBuffer();
    return await this._audioCtx.decodeAudioData(arrayBuf);
  }
  
  // ─── Play a decoded AudioBuffer through Web Audio API ─────
  _playBuffer(buffer, volume = 0.5) {
    if (!buffer || !this._audioCtx || this.muted) return;
    try {
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }
      const source = this._audioCtx.createBufferSource();
      source.buffer = buffer;
      const gain = this._audioCtx.createGain();
      gain.gain.value = volume * this.sfxVolume;
      source.connect(gain);
      gain.connect(this._audioCtx.destination);
      source.start(0);
    } catch(e) {}
  }
  
  // ─── BG Music ──────────────────────────────────────────
  playBGMusic(url, volumeMultiplier = 1.0) {
    try {
      // If already playing this URL, don't restart — just update volume
      if (this.bgMusic && this._bgMusicUrl === url) {
        if (!this.muted) this.bgMusic.volume = this.musicVolume * volumeMultiplier;
        return;
      }
      if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic = null; }
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = this.muted ? 0 : this.musicVolume * volumeMultiplier;
      audio.play().catch(e => console.warn('BG music autoplay blocked:', e));
      this.bgMusic = audio;
      this._bgMusicUrl = url;
      this._currentVolumeMultiplier = volumeMultiplier;
    } catch(e) {
      console.warn('BG music failed:', e);
    }
  }
  
  // Play a random track from the music pool (no repeats until all tracks played)
  playRandomTrack() {
    if (MUSIC_TRACKS.length === 0) return;
    
    // If we've played all tracks, reset history
    if (this._trackHistory.length >= MUSIC_TRACKS.length) {
      this._trackHistory = [];
    }
    
    // Build available tracks (not in history)
    const availableTracks = MUSIC_TRACKS.filter((_, idx) => !this._trackHistory.includes(idx));
    
    // Pick random from available
    const randomIdx = availableTracks.length === MUSIC_TRACKS.length
      ? Math.floor(Math.random() * MUSIC_TRACKS.length)
      : MUSIC_TRACKS.indexOf(availableTracks[Math.floor(Math.random() * availableTracks.length)]);
    
    this._currentTrackIndex = randomIdx;
    this._trackHistory.push(randomIdx);
    
    const track = MUSIC_TRACKS[randomIdx];
    this.playBGMusic(track.url, track.volumeMultiplier);
    
    console.log(`🎵 Playing track ${randomIdx + 1}/${MUSIC_TRACKS.length} (vol: ${track.volumeMultiplier}x)`);
  }
  
  // Skip to next random track
  nextTrack() {
    this.stopBGMusic();
    this.playRandomTrack();
  }
  
  // Restart current BG music from the beginning (same track)
  restartBGMusic() {
    if (this.bgMusic) {
      this.bgMusic.currentTime = 0;
      this.bgMusic.volume = this.muted ? 0 : this.musicVolume;
      this.bgMusic.play().catch(e => console.warn('BG music restart blocked:', e));
    }
  }
  
  stopBGMusic() {
    if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic.currentTime = 0; this.bgMusic = null; this._bgMusicUrl = null; }
  }
  
  // ─── Outro Music (game over screen) ──────────────────────
  playOutroMusic() {
    try {
      this.stopOutroMusic(); // Stop any existing outro
      const audio = new Audio(OUTRO_MUSIC_URL);
      audio.loop = false; // Play once, no loop
      audio.volume = this.muted ? 0 : this.musicVolume;
      audio.play().catch(e => console.warn('Outro music autoplay blocked:', e));
      this._outroMusic = audio;
    } catch(e) {
      console.warn('Outro music failed:', e);
    }
  }
  
  stopOutroMusic() {
    if (this._outroMusic) {
      this._outroMusic.pause();
      this._outroMusic.currentTime = 0;
      this._outroMusic = null;
    }
  }
  
  // ─── Volume Controls ──────────────────────────────────
  setMusicVolume(vol) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    const multiplier = this._currentVolumeMultiplier || 1.0;
    if (this.bgMusic && !this.muted) this.bgMusic.volume = this.musicVolume * multiplier;
    if (this._outroMusic && !this.muted) this._outroMusic.volume = this.musicVolume;
  }
  
  setSfxVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }
  
  setMuted(muted) {
    this.muted = muted;
    if (muted) {
      this._prevMusicVol = this.musicVolume;
      this._prevSfxVol = this.sfxVolume;
      if (this.bgMusic) this.bgMusic.volume = 0;
      if (this._outroMusic) this._outroMusic.volume = 0;
    } else {
      const multiplier = this._currentVolumeMultiplier || 1.0;
      if (this.bgMusic) this.bgMusic.volume = this.musicVolume * multiplier;
      if (this._outroMusic) this._outroMusic.volume = this.musicVolume;
    }
  }
  
  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  
  // ─── Music Ducking (temporarily lower music for important SFX) ──────
  duckMusic(duckVolume = 0.15, fadeDuration = 0.3) {
    if (!this.bgMusic || this.muted) return;
    this._isDucked = true;
    this._duckTargetVolume = duckVolume;
    
    // Clear any pending restore
    if (this._duckRestoreTimer) {
      clearTimeout(this._duckRestoreTimer);
      this._duckRestoreTimer = null;
    }
    
    // Smooth fade down using small steps
    const currentVol = this.bgMusic.volume;
    const targetVol = duckVolume * this.musicVolume;
    const steps = 10;
    const stepTime = (fadeDuration * 1000) / steps;
    const volStep = (currentVol - targetVol) / steps;
    
    let step = 0;
    if (this._duckFadeInterval) clearInterval(this._duckFadeInterval);
    this._duckFadeInterval = setInterval(() => {
      step++;
      if (step >= steps || !this.bgMusic) {
        clearInterval(this._duckFadeInterval);
        this._duckFadeInterval = null;
        if (this.bgMusic) this.bgMusic.volume = targetVol;
        return;
      }
      if (this.bgMusic) this.bgMusic.volume = currentVol - volStep * step;
    }, stepTime);
  }
  
  restoreMusic(delay = 2.0, fadeDuration = 0.8) {
    // Restore music volume after a delay (so the SFX can be heard)
    if (this._duckRestoreTimer) clearTimeout(this._duckRestoreTimer);
    
    this._duckRestoreTimer = setTimeout(() => {
      this._isDucked = false;
      this._duckRestoreTimer = null;
      if (!this.bgMusic || this.muted) return;
      
      const multiplier = this._currentVolumeMultiplier || 1.0;
      const targetVol = this.musicVolume * multiplier;
      const currentVol = this.bgMusic.volume;
      const steps = 15;
      const stepTime = (fadeDuration * 1000) / steps;
      const volStep = (targetVol - currentVol) / steps;
      
      if (this._duckFadeInterval) clearInterval(this._duckFadeInterval);
      this._duckFadeInterval = setInterval(() => {
        if (!this.bgMusic || !this._duckFadeInterval) return;
        const newVol = this.bgMusic.volume + volStep;
        if ((volStep > 0 && newVol >= targetVol) || (volStep < 0 && newVol <= targetVol)) {
          this.bgMusic.volume = targetVol;
          clearInterval(this._duckFadeInterval);
          this._duckFadeInterval = null;
          return;
        }
        this.bgMusic.volume = newVol;
      }, stepTime);
    }, delay * 1000);
  }
  
  // ═══════════════════════════════════════════════════════════
  // ═══ SOUND EFFECTS ════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  
  playThrow(isTrick = false, throwPower = 1.0) {
    if (!this.ready) return;
    const powerClamped = Math.max(0, Math.min(1, throwPower));
    
    // Whoosh intensity scales with power
    if (isTrick) {
      this._playBuffer(this._whooshBuffer, 0.8);
    } else if (powerClamped >= 0.9) {
      // MAX power — very loud whoosh
      this._playBuffer(this._whooshBuffer, 1.0);
    } else if (powerClamped >= 0.75) {
      // High power — loud whoosh
      this._playBuffer(this._whooshBuffer, 0.6 + (powerClamped - 0.75) * 1.6);
    } else if (powerClamped >= 0.5) {
      // Medium power — subtle whoosh
      this._playBuffer(this._whooshBuffer, 0.3 + (powerClamped - 0.5) * 0.8);
    }
    // Below 0.5 power: no whoosh (silent throw)
  }
  
  playHit() {
    if (!this.ready) return;
    this._playBuffer(this._impactBuffer, 1.4);
  }
  
  playCatch() {
    if (!this.ready) return;
    this._playBuffer(this._impactBuffer, 0.12);
  }
  
  playCatchApproval() {
    if (!this.ready) return;
    
    // Pick a random catch sound variation, but never the same one twice in a row
    const availableCatchSounds = this._catchSoundBuffers.filter((buffer, index) => buffer && index !== this._lastCatchIndex);
    
    if (availableCatchSounds.length === 0) {
      // Fallback if no catch sounds loaded
      console.warn('No catch sound variations loaded');
      return;
    }
    
    // Random selection from available variations (excluding last played)
    const randomBuffer = availableCatchSounds[Math.floor(Math.random() * availableCatchSounds.length)];
    
    // Find and store the index for next time
    this._lastCatchIndex = this._catchSoundBuffers.indexOf(randomBuffer);
    
    // Play the selected variation at lower volume
    this._playBuffer(randomBuffer, 0.2);
  }
  
  playDeflect() {
    if (!this.ready) return;
    this._playBuffer(this._impactBuffer, 0.7);
  }
  
  playKO() {
    if (!this.ready) return;
    
    // Pick a random KO variation, but never the same one twice in a row
    const availableKOs = this._koBuffers.filter((buffer, index) => buffer && index !== this._lastKoIndex);
    
    if (availableKOs.length === 0) {
      // Fallback if no KO buffers loaded
      console.warn('No KO variations loaded, using fallback');
      this._playBuffer(this._impactBuffer, 0.8);
      return;
    }
    
    // Random selection from available variations (excluding last played)
    const randomBuffer = availableKOs[Math.floor(Math.random() * availableKOs.length)];
    
    // Find and store the index for next time
    this._lastKoIndex = this._koBuffers.indexOf(randomBuffer);
    
    // Play the selected variation — LOUD for satisfying KO feedback
    this._playBuffer(randomBuffer, 2.0);
  }
  
  playBounce() {
    // Removed - ball bounce sounds disabled
  }
  
  playWhistle() {
    if (!this._whistleBuffer) return;
    this._playBuffer(this._whistleBuffer, 0.5);
  }
  
  playPickup() {
    // Removed - pickup sounds disabled
  }
  
  playSwoosh() {
    // Removed - swoosh sounds disabled
  }
  
  playChargeEscalate(power) {
    // Legacy fallback — now handled by startChargeSound/stopChargeSound
  }
  
  startChargeSound() {
    if (!this._chargeThrowBuffer || !this._audioCtx || this.muted) return;
    // Stop any existing charge sound first
    this.stopChargeSound();
    try {
      if (this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }
      const source = this._audioCtx.createBufferSource();
      source.buffer = this._chargeThrowBuffer;
      source.loop = false;
      const gain = this._audioCtx.createGain();
      gain.gain.value = 1.2 * this.sfxVolume;
      source.connect(gain);
      gain.connect(this._audioCtx.destination);
      source.start(0);
      this._chargeThrowSource = source;
      this._chargeThrowGain = gain;
      // Auto-cleanup when playback finishes naturally
      source.onended = () => {
        if (this._chargeThrowSource === source) {
          this._chargeThrowSource = null;
          this._chargeThrowGain = null;
        }
      };
    } catch(e) {}
  }
  
  stopChargeSound() {
    if (this._chargeThrowSource) {
      try {
        this._chargeThrowSource.stop();
      } catch(e) {}
      this._chargeThrowSource = null;
      this._chargeThrowGain = null;
    }
  }
  
  playDodge() {
    if (!this.ready) return;
    this._playBuffer(this._whooshBuffer, 0.5);
  }
  
  playLand() {
    // Removed - landing sounds disabled
  }
  
  playLandImpact(peakHeight) {
    // Removed - landing impact sounds disabled
  }
  
  playBurnTick() {
    // Removed - burn tick sound (no audio file available)
  }
  
  playSlip() {
    // Removed - slip sound (no audio file available)
  }
  
  playRankUp() {
    if (!this._rankUpBuffer) return;
    // Duck music so the fanfare is clearly audible
    this.duckMusic(0.1, 0.2);
    this._playBuffer(this._rankUpBuffer, 1.5);
    // Restore music after fanfare plays (rank-up sound is ~2-3 seconds)
    this.restoreMusic(3.0, 1.0);
  }
  
  playGiantBallScream() {
    // Pick a random scream from the 4 variations, avoiding repeat
    const available = this._giantBallScreamBuffers.filter((buf, i) => buf && i !== this._lastGiantBallScreamIndex);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._lastGiantBallScreamIndex = this._giantBallScreamBuffers.indexOf(pick);
    
    // Scream 05 (index 4) is naturally louder, reduce further
    const volume = this._lastGiantBallScreamIndex === 4 ? 0.6 : 0.9;
    this._playBuffer(pick, volume);
  }
  
  playGiantBallPickup() {
    // Randomly pick one of the 2 giant ball pickup sounds
    const available = this._giantBallPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playFireballPickup() {
    // Randomly pick one of the 2 fireball pickup sounds
    const available = this._fireballPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playFreezePickup() {
    // Randomly pick one of the 2 freeze pickup sounds
    const available = this._freezePickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playLightningPickup() {
    // Randomly pick one of the 2 lightning pickup sounds
    const available = this._lightningPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playLaserPickup() {
    // Randomly pick one of the 2 laser pickup sounds
    const available = this._laserPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playBananaPickup() {
    // Randomly pick one of the 2 banana pickup sounds
    const available = this._bananaPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playSpeedPickup() {
    // Randomly pick one of the 2 speed pickup sounds
    const available = this._speedPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playSlapshotPickup() {
    // Randomly pick one of the 2 slapshot pickup sounds
    const available = this._slapshotPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playTrapDoorPickup() {
    // Randomly pick one of the 2 trap door pickup sounds
    const available = this._trapdoorPickupBuffers.filter(buf => buf);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._playBuffer(pick, 1.5);
  }
  
  playLightningStrike() {
    if (!this._lightningStrikeBuffer) return;
    this._playBuffer(this._lightningStrikeBuffer, 2.5);
  }
  
  playAchievement() {
    if (!this._achievementBuffer) return;
    // Duck music so the achievement jingle is clearly audible
    this.duckMusic(0.1, 0.2);
    this._playBuffer(this._achievementBuffer, 1.0);
    // Restore music after achievement sound plays (~2 seconds)
    this.restoreMusic(2.5, 0.8);
  }
  
  playHockeyHit() {
    if (!this._hockeyHitBuffer) return;
    this._playBuffer(this._hockeyHitBuffer, 2.0);
  }
  
  playSlapShotScream() {
    // Pick a random scream from the 3 variations, avoiding repeat
    const available = this._slapShotScreamBuffers.filter((buf, i) => buf && i !== this._lastSlapShotScreamIndex);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._lastSlapShotScreamIndex = this._slapShotScreamBuffers.indexOf(pick);
    
    // Scream 05 (index 3) is naturally louder, reduce further
    const volume = this._lastSlapShotScreamIndex === 3 ? 0.6 : 0.9;
    this._playBuffer(pick, volume);
  }
  
  playFreeze() {
    if (!this._freezeSoundBuffer) return;
    this._playBuffer(this._freezeSoundBuffer, 1.5);
  }
  
  playLaser() {
    if (!this._laserSoundBuffer) return;
    this._playBuffer(this._laserSoundBuffer, 1.5);
  }
  
  playXPTick() {
    // Removed - XP tick sound (no audio file available)
  }
  
  playSlapshotScream() {
    // Pick a random scream from the 5 variations, avoiding repeat
    const available = this._slapShotScreamBuffers.filter((buf, i) => buf && i !== this._lastSlapShotScreamIndex);
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    this._lastSlapShotScreamIndex = this._slapShotScreamBuffers.indexOf(pick);
    this._playBuffer(pick, 0.9);
  }
}