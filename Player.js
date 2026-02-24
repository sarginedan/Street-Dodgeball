import * as THREE from 'three';
import { CONFIG } from './config.js';
import { generateAIPersonality } from './AIPersonality.js';

// ─── Animation State Machine ────────────────────────────────
const ANIM = {
  IDLE: 'idle',
  RUN: 'run',
  HOLD_IDLE: 'holdIdle',
  HOLD_RUN: 'holdRun',
  CHARGE_WINDUP: 'chargeWindup',  // slow-mo windup while holding throw key
  WINDUP: 'windup',
  THROW: 'throw',
  CATCH_READY: 'catchReady',
  CATCH_SUCCESS: 'catchSuccess',
  DEFLECT_READY: 'deflectReady',
  DEFLECT_SUCCESS: 'deflectSuccess',
  HIT_REACT: 'hitReact',
  KO: 'ko',
  DODGE: 'dodge',
};

// Durations for timed animations (seconds)
const ANIM_DURATIONS = {
  [ANIM.WINDUP]: 0.3,
  [ANIM.THROW]: 0.85,
  [ANIM.CATCH_SUCCESS]: 0.5,
  [ANIM.DEFLECT_SUCCESS]: 0.55,
  [ANIM.HIT_REACT]: 0.45,
  [ANIM.DODGE]: CONFIG.DODGE_DURATION,
};

function lerp(a, b, t) { return a + (b - a) * Math.min(1, t); }
function easeOutBack(t) { const c = 1.7; return 1 + (--t) * t * ((c + 1) * t + c); }
function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}
function easeInQuad(t) { return t * t; }
function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export class Player {
  constructor(team, index, isHuman = false) {
    this.team = team;
    this.index = index;
    this.isHuman = isHuman;
    this.hp = CONFIG.PLAYER_HP;
    this.maxHp = CONFIG.PLAYER_HP;
    this.stamina = CONFIG.MAX_STAMINA;
    this.alive = true;
    this.hasBall = false;
    this.ball = null;
    this.radius = CONFIG.PLAYER_RADIUS;
    this.height = CONFIG.PLAYER_HEIGHT;
    this.trickCharge = 0;
    this.throwCooldown = 0;
    this.catchWindow = 0;
    this.isCatching = false;
    this.hitStun = 0;
    this.invincible = 0;
    this.animTime = 0;
    this.velocity = new THREE.Vector3();
    this.targetPos = null;
    this.aiState = 'idle';
    this.aiTimer = 0;
    this.aiThrowTimer = 0;
    this.trickType = null;
    this.throwCharging = false;   // true when human is holding throw key
    this.throwChargePower = 0;    // 0→1 throw charge amount (drives CHARGE_WINDUP anim)
    
    // ─── AI Personality Traits (AAA-level variation) ────────────────────────────────
    if (!isHuman) {
      this.aiPersonality = generateAIPersonality(index);
    } else {
      this.aiPersonality = null;
    }
    this.aiMovementTimer = 0;
    this.aiPositionTarget = null;
    this.aiJukeTimer = 0;
    this.aiJukeDirection = 0;
    this.aiAggressionTimer = 0;
    this.aiLastDodgeTime = -999;
    this._ballSeekTimer = 0;
    this._aiThrowDelay = null;
    this._idleLingerTimer = 0;
    this._pickupGiveUpTimer = 0;
    
    // Animation state machine
    this.animState = ANIM.IDLE;
    this.animStateTime = 0;
    this.prevAnimState = ANIM.IDLE;
    this.blendFactor = 1;
    this.blendSpeed = 10;
    
    // ─── Facing / Rotation ────────────────────────────────
    // targetYRot: the angle we WANT to face (radians, 0 = +Z, PI/2 = +X)
    // currentYRot: smoothly interpolated actual rotation applied to mesh
    // facingMode: 'movement' | 'target' — what drives targetYRot
    const defaultFacing = this.team === CONFIG.TEAM_BLUE ? 0 : Math.PI;
    this.targetYRot = defaultFacing;
    this.currentYRot = defaultFacing;
    this.turnSpeed = 12;           // radians/sec for smooth rotation
    this.lastMoveDir = new THREE.Vector2(0, 0); // last nonzero movement vector
    
    // Spin rotation (additive Y rotation for 360 trick throws — overlaid on facing)
    this.spinYRot = 0;        // current spin offset in radians
    this.spinYRotTarget = 0;  // target spin (0 when not spinning)
    
    // Flip rotation (full-body X rotation for backflip — overlaid on mesh)
    this.flipXRot = 0;
    // Cartwheel rotation (full-body Z rotation — overlaid on mesh)
    this.flipZRot = 0;
    
    // Throw flip style — randomized per throw
    // 0 = backflip+360 twist (NBA Street), 1 = tornado cartwheel (720 spin + lateral roll),
    // 2 = gainer twist (fwd-launch backward flip + behind-back release + stag legs)
    // 3 = corkscrew twist (cartwheel start → corkscrew spin)
    this.throwFlipStyle = 0;
    
    // Landing impact tracking
    this.peakFlipHeight = 0;     // highest Y reached during current throw flip
    this.wasAirborne = false;    // was in the air last frame
    this.landingTriggered = false; // prevents double-triggering
    this.onLandingImpact = null;  // callback set by main.js: (peakHeight, position) => {}
    
    // ─── Deflect System ────────────────────────────────────
    this.isDeflecting = false;       // true when in deflect-ready stance
    this.deflectWindow = 0;          // time remaining for deflect timing window
    
    // ─── Parkour Dodge System ────────────────────────────
    this.dodgeCooldown = 0;          // time remaining before next dodge allowed
    this.dodgeStyle = 0;             // 0=webster, 1=kong vault, 2=butterfly kick, 3=aerial spin, 4=gainer, 5=corkscrew
    this.dodgeDirX = 0;              // dodge displacement direction X
    this.dodgeDirZ = 0;              // dodge displacement direction Z
    this.isDodging = false;          // true during active dodge
    this.onDodgeEffect = null;       // callback: (position, style, progress) => {}
    this.onDodgeStart = null;        // callback: (position, style) => {} — fired once when dodge begins
    
    // ─── Power-Up States ────────────────────────────────────
    this.frozen = false;             // frozen in place (can't move)
    this.frozenTime = 0;             // time remaining frozen
    this.stunned = false;            // stunned (can't act)
    this.stunnedTime = 0;            // time remaining stunned
    this.hasLaserBall = false;       // has laser ball buff
    this.laserBallReady = false;     // laser ball ready to use
    this.hasFireball = false;        // has fireball buff
    this.fireballReady = false;      // fireball ready to use
    this.burning = false;            // currently burning (DOT)
    this.burnDamageRemaining = 0;    // total burn damage left to deal
    this.burnTickTimer = 0;          // timer for next burn tick
    this.burnDuration = 0;           // total burn time remaining
    this.freezeEffect = null;        // visual freeze effect mesh
    this.lightningEffect = null;     // visual lightning effect particles
    this.laserAura = null;           // visual laser ball aura
    this.fireAura = null;            // visual fireball aura
    this.burnEffect = null;          // visual burn fire particles
    this.slipping = false;           // currently slipped on banana peel
    this.slipDuration = 0;           // time remaining on ground
    this.slipRecovery = 0;           // time spent getting back up
    this.superSpeed = false;         // super speed buff active
    this.superSpeedTime = 0;         // time remaining for super speed
    this.speedTrail = null;          // visual speed trail effect
    
    // Respawn system (for launched-off-map power-ups only)
    this.respawnTimer = 0;           // time until respawn after being launched
    this.launchedOffMap = false;     // true when launched by power-up
    
    // Cached pose targets
    this.pose = {
      bodyY: 0.76, bodyRotX: 0, bodyRotZ: 0,
      headRotX: 0, headRotZ: 0,
      lArmRotX: 0, lArmRotZ: 0.05, lArmPosY: 0.50,
      rArmRotX: 0, rArmRotZ: -0.05, rArmPosY: 0.50,
      lForearmRotX: 0, rForearmRotX: 0,
      lLegRotX: 0, rLegRotX: 0,
      lLegRotZ: 0, rLegRotZ: 0,
      meshPosY: 0, meshRotZ: 0,
      spinY: 0,   // 360 spin Y rotation overlay
      flipX: 0,   // backflip X rotation overlay
      flipZ: 0,   // cartwheel Z rotation overlay
    };
    
    this.mesh = this.createMesh();
    this.setupPosition();
  }
  
  // ─── Helpers for organic shape building ──────────────────
  static makeLatheMesh(points, segments, mat) {
    const pts = points.map(p => new THREE.Vector2(p.x, p.y));
    const geo = new THREE.LatheGeometry(pts, segments);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
  
  static makeEllipsoid(rx, ry, rz, mat, segs = 12) {
    const geo = new THREE.SphereGeometry(1, segs, Math.max(8, segs - 2));
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(rx, ry, rz);
    m.castShadow = true;
    return m;
  }
  
  static makeLimb(rTop, rBot, height, mat, segs = 12) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, height, segs);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    return m;
  }

  createMesh() {
    const group = new THREE.Group();
    
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    const teamColor = isBlue ? CONFIG.TEAM_BLUE_COLOR : CONFIG.TEAM_RED_COLOR;
    const accentColor = isBlue ? CONFIG.TEAM_BLUE_ACCENT : CONFIG.TEAM_RED_ACCENT;
    const skinTones = [0xd4a373, 0xc68b59, 0x8d6346, 0xe6c9a8, 0xa67c52];
    const skinColor = skinTones[this.index % skinTones.length];
    
    // ══════════════════════════════════════════════════════════
    // ═══ MATERIALS ═══════════════════════════════════════════
    // ══════════════════════════════════════════════════════════
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.45, metalness: 0.02 });
    const skinDarkMat = new THREE.MeshStandardMaterial({ 
      color: new THREE.Color(skinColor).multiplyScalar(0.72).getHex(), roughness: 0.55, metalness: 0.02 
    });
    
    const jacketColor = isBlue ? 0x182842 : teamColor;
    const jacketDarkColor = isBlue ? 0x101e30 : 0x600000;
    const pantsColor = isBlue ? 0x282e38 : 0x7f0000;
    
    const jacketMat = new THREE.MeshStandardMaterial({
      color: jacketColor, roughness: 0.32, metalness: 0.25,
      emissive: isBlue ? 0x081020 : teamColor, emissiveIntensity: isBlue ? 0.08 : 0.1,
    });
    const jacketSideMat = new THREE.MeshStandardMaterial({
      color: isBlue ? 0x1a2e48 : teamColor, roughness: 0.35, metalness: 0.2,
    });
    const jacketDarkMat = new THREE.MeshStandardMaterial({
      color: jacketDarkColor, roughness: 0.35, metalness: 0.2,
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: pantsColor, roughness: 0.5, metalness: 0.08,
    });
    const cyanMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff, roughness: 0.1, metalness: 0.7,
      emissive: 0x00e5ff, emissiveIntensity: 0.55,
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xff7722, roughness: 0.2, metalness: 0.5,
      emissive: 0xff6600, emissiveIntensity: 0.35,
    });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.35, metalness: 0.4 });
    const kneePadMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.3, metalness: 0.45 });
    
    // ══════════════════════════════════════════════════════════
    // ═══ PROPORTIONS ═════════════════════════════════════════
    // ~7.5 heads tall. Ellipsoid-based body (wider than deep).
    // ══════════════════════════════════════════════════════════
    const ANKLE_Y = 0.12;
    const KNEE_Y = 0.42;
    const HIP_Y = 0.76;
    const WAIST_Y = 0.82;
    const TORSO_BOT = 0.78;
    const NAVEL_Y = 0.90;
    const CHEST_Y = 1.08;
    const SHOULDER_Y = 1.28;
    const NECK_BOT = 1.30;
    const NECK_TOP = 1.40;
    const HEAD_CENTER = 1.53;
    const HEAD_TOP = 1.68;
    
    const SHOULDER_W = 0.40;
    const CHEST_W = 0.32;
    const WAIST_W = 0.22;
    const HIP_W = 0.25;
    const LEG_SPREAD = 0.14;
    const CHEST_D = 0.18;
    const WAIST_D = 0.14;
    const HIP_D = 0.16;
    
    // ══════════════════════════════════════════════════════════
    // ═══ UPPER BODY GROUP — pivot for whole upper body ═══════
    // Everything above the hips (torso, arms, head, neck)
    // goes in this group so body lean/twist moves everything.
    // Pivot at hip level so forward lean looks natural.
    // ══════════════════════════════════════════════════════════
    const BODY_PIVOT_Y = HIP_Y;
    const upperBody = new THREE.Group();
    upperBody.position.set(0, BODY_PIVOT_Y, 0);
    group.add(upperBody);
    this.body = upperBody;
    
    // ══════════════════════════════════════════════════════════
    // ═══ TORSO — Multi-ellipsoid anatomical build ════════════
    // Real torsos are wider than deep. Stacked overlapping
    // ellipsoids create organic V-taper with pec shelf.
    // ══════════════════════════════════════════════════════════
    
    // Main torso core (widest at chest)
    const torsoCore = Player.makeEllipsoid(CHEST_W, 0.28, CHEST_D, jacketMat, 18);
    torsoCore.position.set(0, CHEST_Y - BODY_PIVOT_Y, 0);
    upperBody.add(torsoCore);
    
    // Upper chest / shoulder shelf
    const upperChest = Player.makeEllipsoid(SHOULDER_W - 0.04, 0.12, CHEST_D - 0.02, jacketMat, 16);
    upperChest.position.set(0, SHOULDER_Y - 0.06 - BODY_PIVOT_Y, 0);
    upperBody.add(upperChest);
    
    // Lower torso / abdomen (tapers to waist)
    const abdomen = Player.makeEllipsoid(WAIST_W + 0.03, 0.16, WAIST_D + 0.01, jacketMat, 14);
    abdomen.position.set(0, NAVEL_Y - BODY_PIVOT_Y, 0);
    upperBody.add(abdomen);
    
    // Back volume (shoulder blades / lats)
    const backVol = Player.makeEllipsoid(CHEST_W - 0.04, 0.20, 0.10, jacketMat, 12);
    backVol.position.set(0, CHEST_Y + 0.02 - BODY_PIVOT_Y, -0.10);
    upperBody.add(backVol);
    
    // Pectoral muscles (front chest bulge)
    if (isBlue) {
      [-1, 1].forEach(side => {
        const pec = Player.makeEllipsoid(0.12, 0.08, 0.07, jacketMat, 10);
        pec.position.set(side * 0.10, CHEST_Y + 0.06 - BODY_PIVOT_Y, 0.12);
        upperBody.add(pec);
      });
    }
    
    // ─── Jacket surface detail (blue team) ───
    if (isBlue) {
      // Dark center panel
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.015), jacketDarkMat);
      panel.position.set(0, CHEST_Y - 0.02 - BODY_PIVOT_Y, CHEST_D + 0.005);
      upperBody.add(panel);
      
      // Center zipper (cyan)
      const zip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.55, 0.004), cyanMat);
      zip.position.set(0, CHEST_Y - 0.02 - BODY_PIVOT_Y, CHEST_D + 0.015);
      upperBody.add(zip);
      
      // V-shaped neon trims
      const vTrimGeo = new THREE.BoxGeometry(0.28, 0.012, 0.004);
      [-1, 1].forEach(side => {
        const vCyan = new THREE.Mesh(vTrimGeo, cyanMat);
        vCyan.position.set(side * 0.10, SHOULDER_Y - 0.10 - BODY_PIVOT_Y, CHEST_D + 0.015);
        vCyan.rotation.z = side * 0.45;
        upperBody.add(vCyan);
        
        const vOrange = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.010, 0.004), orangeMat);
        vOrange.position.set(side * 0.09, SHOULDER_Y - 0.16 - BODY_PIVOT_Y, CHEST_D + 0.018);
        vOrange.rotation.z = side * 0.42;
        upperBody.add(vOrange);
        
        // Side seam trim
        const sideTrim = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.30, 0.004), cyanMat);
        sideTrim.position.set(side * (CHEST_W - 0.02), CHEST_Y - BODY_PIVOT_Y, CHEST_D * 0.5);
        upperBody.add(sideTrim);
        
        // Darker side panel
        const sidePanel = Player.makeEllipsoid(0.06, 0.22, 0.08, jacketSideMat, 8);
        sidePanel.position.set(side * (CHEST_W + 0.01), CHEST_Y + 0.02 - BODY_PIVOT_Y, 0);
        upperBody.add(sidePanel);
      });
      
      // Collar
      const collarMat = new THREE.MeshStandardMaterial({ color: 0x202e42, roughness: 0.35, metalness: 0.25 });
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.06, 16), collarMat);
      collar.position.y = NECK_BOT + 0.01 - BODY_PIVOT_Y;
      collar.scale.set(1.0, 1.0, 0.85);
      upperBody.add(collar);
      
      const collarRim = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 6, 18), cyanMat);
      collarRim.position.y = NECK_BOT + 0.04 - BODY_PIVOT_Y;
      collarRim.rotation.x = Math.PI / 2;
      upperBody.add(collarRim);
      
      // Hem trim
      const hemTrim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.007, 6, 20), cyanMat);
      hemTrim.position.y = TORSO_BOT - BODY_PIVOT_Y;
      hemTrim.rotation.x = Math.PI / 2;
      upperBody.add(hemTrim);
      
      // Epaulettes
      [-1, 1].forEach(side => {
        const epMat = new THREE.MeshStandardMaterial({ color: 0x253850, roughness: 0.3, metalness: 0.35 });
        const ep = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.02, 0.14), epMat);
        ep.position.set(side * (SHOULDER_W - 0.03), SHOULDER_Y - BODY_PIVOT_Y, 0.0);
        upperBody.add(ep);
        const epTrim = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.006, 0.145), cyanMat);
        epTrim.position.set(side * (SHOULDER_W - 0.03), SHOULDER_Y + 0.012 - BODY_PIVOT_Y, 0.0);
        upperBody.add(epTrim);
      });
      
      // Pockets
      [-1, 1].forEach(side => {
        const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.005), jacketDarkMat);
        pocket.position.set(side * 0.14, WAIST_Y + 0.12 - BODY_PIVOT_Y, CHEST_D);
        pocket.rotation.z = side * 0.15;
        upperBody.add(pocket);
        const pz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.006, 0.003), cyanMat);
        pz.position.set(side * 0.14, WAIST_Y + 0.14 - BODY_PIVOT_Y, CHEST_D + 0.005);
        pz.rotation.z = side * 0.15;
        upperBody.add(pz);
      });
    }
    
    // ══════════════════════════════════════════════════════════
    // ═══ HIPS — flattened ellipsoid (wider than deep) ════════
    // ══════════════════════════════════════════════════════════
    const hipsCore = Player.makeEllipsoid(HIP_W, 0.12, HIP_D, pantsMat, 14);
    hipsCore.position.set(0, HIP_Y, 0);
    group.add(hipsCore);
    this.shorts = hipsCore;
    
    // Waist-to-hip bridge
    const waistBridge = Player.makeEllipsoid(WAIST_W + 0.01, 0.08, WAIST_D, pantsMat, 12);
    waistBridge.position.set(0, WAIST_Y - 0.02, 0);
    group.add(waistBridge);
    
    if (isBlue) {
      // Belt
      const beltMat = new THREE.MeshStandardMaterial({ color: 0x12151a, roughness: 0.25, metalness: 0.55 });
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.016, 8, 22), beltMat);
      belt.position.y = WAIST_Y;
      belt.rotation.x = Math.PI / 2;
      belt.scale.set(1.0, 0.7, 1.0); // flattened to match body
      group.add(belt);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.012), orangeMat);
      buckle.position.set(0, WAIST_Y, WAIST_D + 0.04);
      group.add(buckle);
    }
    
    // ══════════════════════════════════════════════════════════
    // ═══ NECK — clean cylinder with trapezius slopes ═════════
    // ══════════════════════════════════════════════════════════
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.085, NECK_TOP - NECK_BOT, 12);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = (NECK_TOP + NECK_BOT) / 2 - BODY_PIVOT_Y;
    neck.scale.set(1.0, 1.0, 0.88);
    upperBody.add(neck);
    
    // Trapezius slope (connects neck to shoulders)
    [-1, 1].forEach(side => {
      const trap = Player.makeEllipsoid(0.10, 0.03, 0.08, isBlue ? jacketMat : skinMat, 8);
      trap.position.set(side * 0.18, NECK_BOT - 0.01 - BODY_PIVOT_Y, -0.01);
      trap.rotation.z = side * -0.35;
      upperBody.add(trap);
    });
    
    // ══════════════════════════════════════════════════════════
    // ═══ HEAD — clean sculpted with face plane ═════════════
    // Smooth cranium + face plane for human likeness, jaw,
    // ears, clean features. No micro-bump clutter.
    // ══════════════════════════════════════════════════════════
    
    // Main cranium — slightly wider than deep, taller than wide
    // Head is a child of upperBody so it leans with the torso,
    // but has its own local rotation for head bob/nod.
    const headGeo = new THREE.SphereGeometry(0.17, 24, 20);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = HEAD_CENTER - BODY_PIVOT_Y;
    head.scale.set(1.06, 1.05, 0.94);
    head.castShadow = true;
    upperBody.add(head);
    this.head = head;
    
    // Face plane — flat front of face (gives the non-spherical look)
    const facePlane = Player.makeEllipsoid(0.14, 0.16, 0.04, skinMat, 14);
    facePlane.position.set(0, HEAD_CENTER - 0.02 - BODY_PIVOT_Y, 0.10);
    upperBody.add(facePlane);
    
    // Jaw / mandible — clean angular jawline
    const jaw = Player.makeEllipsoid(0.13, 0.05, 0.09, skinMat, 14);
    jaw.position.set(0, HEAD_CENTER - 0.11 - BODY_PIVOT_Y, 0.03);
    upperBody.add(jaw);
    
    // Ears — simple two-part
    [-1, 1].forEach(side => {
      const ear = Player.makeEllipsoid(0.012, 0.035, 0.025, skinMat, 8);
      ear.position.set(side * 0.18, HEAD_CENTER - 0.01 - BODY_PIVOT_Y, -0.01);
      upperBody.add(ear);
      const lobe = Player.makeEllipsoid(0.008, 0.012, 0.010, skinMat, 6);
      lobe.position.set(side * 0.18, HEAD_CENTER - 0.04 - BODY_PIVOT_Y, 0.0);
      upperBody.add(lobe);
    });
    
    if (isBlue) {
      // ══ HAIR: undercut with swept-back pompadour ══
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x25190f, roughness: 0.85, metalness: 0.0 });
      const hairLightMat = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.75 });
      
      // Close-cropped sides (buzz cut fade) — hemisphere shell
      const sideHairGeo = new THREE.SphereGeometry(0.175, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.42);
      const sideHair = new THREE.Mesh(sideHairGeo, hairMat);
      sideHair.position.y = HEAD_CENTER + 0.03 - BODY_PIVOT_Y;
      sideHair.scale.set(1.06, 1.0, 0.96);
      upperBody.add(sideHair);
      
      // Top volume — swept back pompadour with natural volume
      const topHair = Player.makeEllipsoid(0.16, 0.06, 0.17, hairMat, 14);
      topHair.position.set(0, HEAD_TOP + 0.01 - BODY_PIVOT_Y, -0.02);
      upperBody.add(topHair);
      
      // Front hair lift (pompadour height at front)
      const frontLift = Player.makeEllipsoid(0.12, 0.05, 0.08, hairMat, 10);
      frontLift.position.set(0, HEAD_TOP + 0.02 - BODY_PIVOT_Y, 0.06);
      upperBody.add(frontLift);
      
      // Swept back ridge (gives the slicked-back look)
      const ridgeGeo = new THREE.CapsuleGeometry(0.065, 0.12, 8, 10);
      const ridge = new THREE.Mesh(ridgeGeo, hairMat);
      ridge.position.set(0, HEAD_TOP - BODY_PIVOT_Y, -0.06);
      ridge.rotation.x = -0.55;
      ridge.scale.set(1.5, 0.38, 1.0);
      upperBody.add(ridge);
      
      // Hair strand texture lines (lighter streaks for realism)
      for (let i = -1; i <= 1; i++) {
        const strand = Player.makeEllipsoid(0.02, 0.04, 0.12, hairLightMat, 4);
        strand.position.set(i * 0.04, HEAD_TOP + 0.005 - BODY_PIVOT_Y, -0.01);
        strand.rotation.x = -0.3;
        upperBody.add(strand);
      }
      
      // Fade lines on sides
      [-1, 1].forEach(side => {
        const fadeLine = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.035, 0.10), hairLightMat);
        fadeLine.position.set(side * 0.175, HEAD_CENTER + 0.08 - BODY_PIVOT_Y, -0.02);
        upperBody.add(fadeLine);
        // Lower fade (shorter buzz)
        const fadeLower = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.025, 0.08), hairLightMat);
        fadeLower.position.set(side * 0.178, HEAD_CENTER + 0.04 - BODY_PIVOT_Y, -0.01);
        upperBody.add(fadeLower);
      });
      
      // ══ FACE — clean features ══
      const browMat = new THREE.MeshBasicMaterial({ color: 0x151515 });
      
      // Brow ridge — subtle shelf
      const browRidge = Player.makeEllipsoid(0.13, 0.012, 0.025, skinMat, 12);
      browRidge.position.set(0, HEAD_CENTER + 0.04 - BODY_PIVOT_Y, 0.13);
      upperBody.add(browRidge);
      
      // Eyebrows — thick, angled inward for intensity
      [[-0.058, 0.14], [0.058, -0.14]].forEach(([x, rot]) => {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.012), browMat);
        brow.position.set(x, HEAD_CENTER + 0.052 - BODY_PIVOT_Y, 0.15);
        brow.rotation.z = rot;
        upperBody.add(brow);
      });
      
      // Eyes — sclera, iris, pupil, catchlight
      [-1, 1].forEach(side => {
        const eyeX = side * 0.055;
        const eyeY = HEAD_CENTER + 0.015 - BODY_PIVOT_Y;
        const eyeZ = 0.14;
        
        // Eye socket recess
        const socket = Player.makeEllipsoid(0.032, 0.018, 0.010, skinDarkMat, 10);
        socket.position.set(eyeX, eyeY, eyeZ);
        upperBody.add(socket);
        
        // Sclera
        const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 });
        const sclera = Player.makeEllipsoid(0.024, 0.012, 0.008, whiteMat, 10);
        sclera.position.set(eyeX, eyeY, eyeZ + 0.007);
        upperBody.add(sclera);
        
        // Iris
        const irisMat = new THREE.MeshBasicMaterial({ color: 0x3a2815 });
        const iris = Player.makeEllipsoid(0.012, 0.012, 0.005, irisMat, 8);
        iris.position.set(eyeX, eyeY - 0.001, eyeZ + 0.014);
        upperBody.add(iris);
        
        // Pupil
        const pupil = Player.makeEllipsoid(0.006, 0.006, 0.003, browMat, 6);
        pupil.position.set(eyeX, eyeY - 0.001, eyeZ + 0.017);
        upperBody.add(pupil);
        
        // Catchlight
        const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const catchLight = Player.makeEllipsoid(0.003, 0.003, 0.002, catchMat, 4);
        catchLight.position.set(eyeX + 0.005, eyeY + 0.003, eyeZ + 0.018);
        upperBody.add(catchLight);
        
        // Upper eyelid
        const upperLid = Player.makeEllipsoid(0.028, 0.008, 0.010, skinMat, 8);
        upperLid.position.set(eyeX, eyeY + 0.010, eyeZ + 0.005);
        upperBody.add(upperLid);
      });
      
      // Nose — simple bridge + tip
      const noseBridge = Player.makeEllipsoid(0.016, 0.04, 0.020, skinMat, 8);
      noseBridge.position.set(0, HEAD_CENTER - 0.015 - BODY_PIVOT_Y, 0.148);
      upperBody.add(noseBridge);
      
      const noseTip = Player.makeEllipsoid(0.024, 0.014, 0.016, skinMat, 10);
      noseTip.position.set(0, HEAD_CENTER - 0.055 - BODY_PIVOT_Y, 0.158);
      upperBody.add(noseTip);
      
      // Mouth — clean line + lower lip
      const mouthMat = new THREE.MeshBasicMaterial({ color: 0x6a4535 });
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.005, 0.008), mouthMat);
      mouth.position.set(0, HEAD_CENTER - 0.088 - BODY_PIVOT_Y, 0.146);
      upperBody.add(mouth);
      
      const upperLipMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(skinColor).multiplyScalar(0.85).getHex(), roughness: 0.4 
      });
      const lowerLip = Player.makeEllipsoid(0.028, 0.008, 0.010, upperLipMat, 8);
      lowerLip.position.set(0, HEAD_CENTER - 0.096 - BODY_PIVOT_Y, 0.148);
      upperBody.add(lowerLip);
      
      this.headband = null;
    } else {
      // Red team — headband
      const bandMat = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.3 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 6, 18), bandMat);
      band.position.y = HEAD_CENTER + 0.08 - BODY_PIVOT_Y;
      band.rotation.x = Math.PI / 2;
      upperBody.add(band);
      this.headband = band;
    }
    
    // ══════════════════════════════════════════════════════════
    // ═══ ARMS — with functional elbow joint ════════════════
    // Shoulder pivot → upper arm → ELBOW PIVOT → forearm → hand
    // ══════════════════════════════════════════════════════════
    const ARM_PIVOT_Y = SHOULDER_Y - 0.02;
    const ELBOW_LOCAL_Y = -0.30;  // elbow position relative to shoulder pivot
    
    const buildArm = (side) => {
      // Shoulder pivot (whole arm rotates from here)
      const pivot = new THREE.Group();
      pivot.position.set(side * SHOULDER_W, ARM_PIVOT_Y - BODY_PIVOT_Y, 0);
      upperBody.add(pivot);
      
      // Forearm pivot (at elbow joint — children: forearm, wrist, hand)
      const forearmPivot = new THREE.Group();
      forearmPivot.position.set(0, ELBOW_LOCAL_Y, 0);
      pivot.add(forearmPivot);
      
      if (isBlue) {
        // ── Upper arm section (attached to shoulder pivot) ──
        
        // Deltoid cap
        const deltoid = Player.makeEllipsoid(0.10, 0.08, 0.09, 
          new THREE.MeshStandardMaterial({ color: 0x1e3050, roughness: 0.3, metalness: 0.25 }), 12);
        deltoid.position.set(0, 0.0, 0);
        pivot.add(deltoid);
        
        // Shoulder cyan trim ring
        const sRing = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.006, 6, 14), cyanMat);
        sRing.position.set(0, -0.04, 0);
        sRing.rotation.x = Math.PI / 2;
        pivot.add(sRing);
        
        // Upper arm cylinder
        const upperArm = Player.makeLimb(0.065, 0.055, 0.24, jacketMat, 12);
        upperArm.position.y = -0.15;
        upperArm.scale.set(1.0, 1.0, 0.85);
        pivot.add(upperArm);
        
        // Bicep bulge
        const bicep = Player.makeEllipsoid(0.04, 0.08, 0.035, jacketMat, 8);
        bicep.position.set(0, -0.14, 0.04);
        pivot.add(bicep);
        
        // Sleeve seam
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.24, 0.004), cyanMat);
        seam.position.set(side * 0.058, -0.15, 0);
        pivot.add(seam);
        
        // Elbow joint ball (at the pivot point)
        const elbowBall = Player.makeEllipsoid(0.055, 0.045, 0.050, jacketMat, 10);
        elbowBall.position.set(0, 0, 0);
        forearmPivot.add(elbowBall);
        
        // ── Forearm section (attached to forearm pivot) ──
        
        // Forearm cylinder
        const forearm = Player.makeLimb(0.050, 0.040, 0.22, jacketMat, 12);
        forearm.position.y = -0.13;
        forearm.scale.set(1.0, 1.0, 0.88);
        forearmPivot.add(forearm);
        
        // Forearm muscle bulge
        const foreMusc = Player.makeEllipsoid(0.03, 0.06, 0.025, jacketMat, 6);
        foreMusc.position.set(side * 0.02, -0.09, 0.025);
        forearmPivot.add(foreMusc);
        
        // Wrist cuff
        const cuff = Player.makeLimb(0.046, 0.050, 0.03, gloveMat, 12);
        cuff.position.y = -0.235;
        forearmPivot.add(cuff);
        const wristBand = new THREE.Mesh(new THREE.TorusGeometry(0.050, 0.005, 6, 14), cyanMat);
        wristBand.position.y = -0.24;
        wristBand.rotation.x = Math.PI / 2;
        forearmPivot.add(wristBand);
        
        // ── Hand — large chunky sports gloves ──
        // Palm body
        const palm = Player.makeEllipsoid(0.065, 0.055, 0.040, gloveMat, 10);
        palm.position.set(0, -0.28, 0.005);
        forearmPivot.add(palm);
        
        // Knuckle ridge
        const knuckles = Player.makeEllipsoid(0.068, 0.020, 0.035, gloveMat, 10);
        knuckles.position.set(0, -0.255, 0.035);
        forearmPivot.add(knuckles);
        
        // Fingers (4 + thumb) — chunky
        for (let f = 0; f < 4; f++) {
          const fx = -0.036 + f * 0.024;
          const prox = Player.makeEllipsoid(0.014, 0.030, 0.013, gloveMat, 4);
          prox.position.set(fx, -0.30, 0.028);
          forearmPivot.add(prox);
          const tip = Player.makeEllipsoid(0.013, 0.020, 0.012, skinMat, 4);
          tip.position.set(fx, -0.33, 0.026);
          forearmPivot.add(tip);
        }
        // Thumb
        const thumbBase = Player.makeEllipsoid(0.018, 0.028, 0.015, gloveMat, 4);
        thumbBase.position.set(side * 0.055, -0.275, 0.030);
        thumbBase.rotation.z = side * 0.4;
        forearmPivot.add(thumbBase);
        const thumbTip = Player.makeEllipsoid(0.016, 0.022, 0.014, skinMat, 4);
        thumbTip.position.set(side * 0.068, -0.295, 0.032);
        forearmPivot.add(thumbTip);
        
      } else {
        // Red team — matching proportions, simpler materials
        const redArmMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.5, metalness: 0.1 });
        
        const deltoid = Player.makeEllipsoid(0.08, 0.07, 0.07, redArmMat, 10);
        deltoid.position.set(0, 0.0, 0);
        pivot.add(deltoid);
        
        const upper = Player.makeLimb(0.060, 0.050, 0.24, redArmMat, 10);
        upper.position.y = -0.15;
        upper.scale.set(1.0, 1.0, 0.85);
        pivot.add(upper);
        
        // Elbow joint at forearm pivot
        const elbowBall = Player.makeEllipsoid(0.048, 0.038, 0.044, redArmMat, 8);
        elbowBall.position.set(0, 0, 0);
        forearmPivot.add(elbowBall);
        
        const fore = Player.makeLimb(0.048, 0.038, 0.22, skinMat, 10);
        fore.position.y = -0.13;
        fore.scale.set(1.0, 1.0, 0.88);
        forearmPivot.add(fore);
        
        // Red team bigger hand
        const hand = Player.makeEllipsoid(0.062, 0.060, 0.038, skinMat, 8);
        hand.position.y = -0.26;
        forearmPivot.add(hand);
      }
      
      return { pivot, forearmPivot };
    };
    
    const leftArmResult = buildArm(-1);
    this.leftArmPivot = leftArmResult.pivot;
    this.leftArm = leftArmResult.pivot;
    this.leftForearm = leftArmResult.forearmPivot;
    
    const rightArmResult = buildArm(1);
    this.rightArmPivot = rightArmResult.pivot;
    this.rightArm = rightArmResult.pivot;
    this.rightForearm = rightArmResult.forearmPivot;
    
    // ══════════════════════════════════════════════════════════
    // ═══ LEGS — anatomical with muscle contours ══════════════
    // Quadricep bulk → knee → calf bulge → ankle taper
    // ══════════════════════════════════════════════════════════
    const LEG_PIVOT_Y = HIP_Y - 0.04;
    
    const buildLeg = (side) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(side * LEG_SPREAD, LEG_PIVOT_Y, 0);
      group.add(legGroup);
      
      const localKnee = -(LEG_PIVOT_Y - KNEE_Y);
      const localAnkle = -(LEG_PIVOT_Y - ANKLE_Y);
      const thighLen = -localKnee;
      const shinLen = localKnee - localAnkle;
      
      // Thigh — tapered, elliptical cross-section (wider than deep)
      const thigh = Player.makeLimb(0.090, 0.068, thighLen, pantsMat, 12);
      thigh.position.y = localKnee / 2;
      thigh.scale.set(1.0, 1.0, 0.88); // flattened front-back
      legGroup.add(thigh);
      
      // Quadricep muscle bulge (front of thigh)
      const quad = Player.makeEllipsoid(0.06, 0.10, 0.04, pantsMat, 8);
      quad.position.set(0, localKnee / 2 + 0.02, 0.05);
      legGroup.add(quad);
      
      // Inner thigh (adductor — subtle inner volume)
      const adductor = Player.makeEllipsoid(0.035, 0.08, 0.035, pantsMat, 6);
      adductor.position.set(-side * 0.04, localKnee / 2 + 0.04, 0.01);
      legGroup.add(adductor);
      
      // Knee joint — patella (kneecap) on front
      const knee = Player.makeEllipsoid(0.062, 0.04, 0.055, pantsMat, 10);
      knee.position.y = localKnee;
      legGroup.add(knee);
      
      if (isBlue) {
        // Knee pad
        const padBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), kneePadMat);
        padBody.position.set(0, localKnee, 0.055);
        legGroup.add(padBody);
        const padEdge = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.007, 0.055), cyanMat);
        padEdge.position.set(0, localKnee + 0.045, 0.055);
        legGroup.add(padEdge);
        
        // Orange neon stripes
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.009, thighLen + 0.05, 0.006), orangeMat);
        stripe.position.set(side * 0.082, localKnee / 2, 0.04);
        legGroup.add(stripe);
        const innerStripe = new THREE.Mesh(new THREE.BoxGeometry(0.007, thighLen * 0.7, 0.005), orangeMat);
        innerStripe.position.set(side * 0.035, localKnee / 2 + 0.04, 0.055);
        legGroup.add(innerStripe);
      }
      
      // Shin / calf — with gastrocnemius (calf muscle) bulge at back
      const shin = Player.makeLimb(0.062, 0.046, shinLen, pantsMat, 12);
      shin.position.y = localKnee - shinLen / 2;
      shin.scale.set(1.0, 1.0, 0.88);
      legGroup.add(shin);
      
      // Calf muscle (gastrocnemius — bulges at back of lower leg)
      const calf = Player.makeEllipsoid(0.04, 0.07, 0.04, pantsMat, 8);
      calf.position.set(0, localKnee - shinLen * 0.3, -0.035);
      legGroup.add(calf);
      
      // Shin bone ridge (tibial crest — subtle ridge on front)
      const tibialRidge = Player.makeEllipsoid(0.012, 0.10, 0.010, pantsMat, 4);
      tibialRidge.position.set(0, localKnee - shinLen * 0.45, 0.042);
      legGroup.add(tibialRidge);
      
      if (isBlue) {
        const shinStripe = new THREE.Mesh(new THREE.BoxGeometry(0.007, shinLen * 0.6, 0.005), orangeMat);
        shinStripe.position.set(side * 0.050, localKnee - shinLen * 0.4, 0.030);
        legGroup.add(shinStripe);
      }
      
      // Ankle (malleolus bumps — inner and outer ankle bones)
      const ankle = Player.makeLimb(0.044, 0.048, 0.035, pantsMat, 10);
      ankle.position.y = localAnkle + 0.02;
      legGroup.add(ankle);
      // Lateral malleolus (outer ankle bump)
      const outerAnkle = Player.makeEllipsoid(0.012, 0.015, 0.010, pantsMat, 4);
      outerAnkle.position.set(side * 0.045, localAnkle + 0.02, 0);
      legGroup.add(outerAnkle);
      
      return legGroup;
    };
    
    this.leftLeg = buildLeg(-1);
    this.rightLeg = buildLeg(1);
    
    // ══════════════════════════════════════════════════════════
    // ═══ SHOES — attached to leg groups so they move with legs
    // ══════════════════════════════════════════════════════════
    const buildShoe = (legGroup, side) => {
      // localAnkle is relative to leg pivot — shoe sits at leg bottom
      const localAnkle = -(LEG_PIVOT_Y - ANKLE_Y);
      
      const shoeGroup = new THREE.Group();
      // Position shoe at the ankle in the leg's local space
      // Offset down so shoe bottom sits at world Y=0 when leg is straight
      shoeGroup.position.set(0, localAnkle - ANKLE_Y, 0);
      legGroup.add(shoeGroup);
      
      if (isBlue) {
        const shoeDarkMat = new THREE.MeshStandardMaterial({ color: 0x252a32, roughness: 0.28, metalness: 0.3 });
        const soleMat = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.45, metalness: 0.2 });
        
        // Chunky sole
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.26), soleMat);
        sole.position.set(0, 0.016, 0.02);
        shoeGroup.add(sole);
        
        // Midsole (cyan accent)
        const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.010, 0.25), cyanMat);
        midsole.position.set(0, 0.035, 0.02);
        shoeGroup.add(midsole);
        
        // Shoe upper
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.22), shoeDarkMat);
        upper.position.set(0, 0.072, 0.01);
        upper.castShadow = true;
        shoeGroup.add(upper);
        
        // Toe cap (rounded)
        const toe = Player.makeEllipsoid(0.060, 0.040, 0.045, shoeDarkMat, 10);
        toe.position.set(0, 0.062, 0.13);
        shoeGroup.add(toe);
        
        // Ankle collar
        const shoeCollar = Player.makeLimb(0.048, 0.060, 0.035, shoeDarkMat, 12);
        shoeCollar.position.set(0, 0.110, -0.01);
        shoeGroup.add(shoeCollar);
        
        // Tongue
        const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.040, 0.008), shoeDarkMat);
        tongue.position.set(0, 0.095, 0.06);
        shoeGroup.add(tongue);
        
        // Orange V chevron on tongue
        [-1, 1].forEach(s => {
          const chev = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.010, 0.004), orangeMat);
          chev.position.set(s * 0.007, 0.090, 0.068);
          chev.rotation.z = s * 0.5;
          shoeGroup.add(chev);
        });
        
        // Heel tab
        const heelTab = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.008), cyanMat);
        heelTab.position.set(0, 0.100, -0.11);
        shoeGroup.add(heelTab);
        
      } else {
        // Red team shoes
        const shMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3, metalness: 0.2, emissive: accentColor, emissiveIntensity: 0.1 });
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.24), 
          new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
        sole.position.set(0, 0.014, 0.02);
        shoeGroup.add(sole);
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.22), shMat);
        body.position.set(0, 0.058, 0.02);
        body.castShadow = true;
        shoeGroup.add(body);
        const rToe = Player.makeEllipsoid(0.052, 0.035, 0.040, shMat, 8);
        rToe.position.set(0, 0.055, 0.13);
        shoeGroup.add(rToe);
      }
      return shoeGroup;
    };
    this.leftShoe = buildShoe(this.leftLeg, -1);
    this.rightShoe = buildShoe(this.rightLeg, 1);

    // ── Selection ring / Shadow / HP bar ──
    if (this.isHuman) {
      const srGeo = new THREE.RingGeometry(0.5, 0.6, 24);
      const srMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
      const sr = new THREE.Mesh(srGeo, srMat);
      sr.rotation.x = -Math.PI / 2;
      sr.position.y = 0.02;
      group.add(sr);
      this.selectionRing = sr;
    }
    const shGeo = new THREE.CircleGeometry(0.4, 16);
    const shMat2 = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 });
    const shMesh = new THREE.Mesh(shGeo, shMat2);
    shMesh.rotation.x = -Math.PI / 2;
    shMesh.position.y = 0.01;
    group.add(shMesh);
    if (!this.isHuman) {
      const hbg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.08), new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      hbg.position.y = 2.05;
      group.add(hbg);
      const hfg = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.06), new THREE.MeshBasicMaterial({ color: this.team === CONFIG.TEAM_BLUE ? 0x42a5f5 : 0xef5350, side: THREE.DoubleSide }));
      hfg.position.y = 2.05; hfg.position.z = 0.001;
      group.add(hfg);
      this.hpBarMesh = hfg;
      this.hpBarBg = hbg;
    }
    return group;
  }
  
  setupPosition() {
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    const side = isBlue ? -1 : 1;
    const positions = [
      { x: side * 8, z: 0 },
      { x: side * 10, z: -4 },
      { x: side * 10, z: 4 },
      { x: side * 5, z: -3 },
      { x: side * 5, z: 3 },
    ];
    const pos = positions[this.index];
    this.mesh.position.set(pos.x, 0, pos.z);
    this.spawnPos = new THREE.Vector3(pos.x, 0, pos.z);
    
    // Initial facing: toward the enemy side
    const initFacing = isBlue ? 0 : Math.PI;
    this.targetYRot = initFacing;
    this.currentYRot = initFacing;
    this.mesh.rotation.y = initFacing;
  }
  
  // ─── Smooth Rotation Helpers ──────────────────────────
  // Shortest-path angle interpolation (handles wrap-around)
  static lerpAngle(from, to, t) {
    let diff = to - from;
    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * Math.min(1, t);
  }
  
  // Set facing toward a world position (for throwing at target, etc.)
  faceToward(worldX, worldZ) {
    const dx = worldX - this.mesh.position.x;
    const dz = worldZ - this.mesh.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      this.targetYRot = Math.atan2(dx, dz);
    }
  }
  
  // Set facing from a movement vector (dx, dz in world space)
  faceMovementDirection(dx, dz) {
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      this.targetYRot = Math.atan2(dx, dz);
      this.lastMoveDir.set(dx, dz).normalize();
    }
  }
  
  // Apply smooth rotation interpolation each frame
  updateFacing(dt) {
    this.currentYRot = Player.lerpAngle(this.currentYRot, this.targetYRot, this.turnSpeed * dt);
    // Add spin overlay (360 trick throw rotation) on top of facing
    this.mesh.rotation.y = this.currentYRot + this.spinYRot;
    // Add backflip overlay (full-body X rotation)
    this.mesh.rotation.x = this.flipXRot;
    // Add cartwheel overlay (full-body Z rotation)
    this.mesh.rotation.z = this.flipZRot || 0;
  }
  
  // ─── Animation State Transitions ──────────────────────
  setAnimState(newState) {
    if (this.animState === newState) return;
    
    // If leaving DODGE state without properly finishing, reset isDodging
    if (this.animState === ANIM.DODGE && newState !== ANIM.DODGE && this.isDodging) {
      this.isDodging = false;
    }
    
    this.prevAnimState = this.animState;
    this.animState = newState;
    this.animStateTime = 0;
    this.blendFactor = 0;
  }
  
  // ─── Power-Up State Management ──────────────────────
  updatePowerUpStates(dt) {
    // Update freeze
    if (this.frozen && this.frozenTime > 0) {
      this.frozenTime -= dt;
      if (this.frozenTime <= 0) {
        this.frozen = false;
        this.cleanupFreezeEffect();
      } else if (this.freezeEffect) {
        // Update freeze effect position
        this.freezeEffect.position.copy(this.mesh.position);
        this.freezeEffect.position.y += 1;
        this.freezeEffect.rotation.y += dt * 2;
      }
    } else if (!this.frozen && this.freezeEffect) {
      // Safety cleanup: if not frozen but effect exists, remove it
      this.cleanupFreezeEffect();
    }
    
    // Update stun
    if (this.stunned && this.stunnedTime > 0) {
      this.stunnedTime -= dt;
      if (this.stunnedTime <= 0) {
        this.stunnedTime = 0; // Clamp to 0
        this.stunned = false;
        this.cleanupLightningEffect();
      } else if (this.lightningEffect) {
        // Animate lightning sparks
        this.lightningEffect.forEach(spark => {
          spark.userData.life -= dt;
          spark.userData.angle += dt * 5;
          const radius = 1.5 + Math.sin(spark.userData.angle * 3) * 0.3;
          spark.position.x = Math.cos(spark.userData.angle) * radius;
          spark.position.z = Math.sin(spark.userData.angle) * radius;
          spark.material.opacity = 0.7 + Math.sin(spark.userData.angle * 10) * 0.3;
        });
      }
    } else if (!this.stunned && this.lightningEffect) {
      // Safety cleanup: if not stunned but effect exists, remove it
      this.cleanupLightningEffect();
    }
    
    // Update slip state (banana peel)
    if (this.slipping) {
      if (this.slipDuration > 0) {
        // Lying on ground phase
        this.slipDuration -= dt;
        if (this.slipDuration <= 0) {
          this.slipDuration = 0;
        }
      } else if (this.slipRecovery > 0) {
        // Getting back up phase
        this.slipRecovery -= dt;
        if (this.slipRecovery <= 0) {
          this.slipping = false;
          this.slipRecovery = 0;
        }
      }
    }
    
    // Update super speed
    if (this.superSpeed && this.superSpeedTime > 0) {
      this.superSpeedTime -= dt;
      if (this.superSpeedTime <= 0) {
        this.superSpeed = false;
        this.superSpeedTime = 0;
        this.cleanupSpeedTrail();
      } else if (this.speedTrail) {
        // Update speed trail position
        this.speedTrail.position.copy(this.mesh.position);
        this.speedTrail.position.y += 0.5;
        this.speedTrail.rotation.y += dt * 8;
        // Pulse opacity
        this.speedTrail.material.opacity = 0.3 + Math.sin(this.animTime * 12) * 0.2;
      }
    } else if (!this.superSpeed && this.speedTrail) {
      this.cleanupSpeedTrail();
    }
    
    // Update laser ball aura (now a child of player mesh — no position copy needed)
    if (this.laserAura) {
      this.laserAura.rotation.y += dt * 3;
      const pulse = 0.35 + Math.sin(this.animTime * 8) * 0.15;
      this.laserAura.material.opacity = pulse;
      const s = 1.0 + Math.sin(this.animTime * 6) * 0.08;
      this.laserAura.scale.setScalar(s);
      
      // Remove aura if buff expired
      if (!this.laserBallReady) {
        this.cleanupLaserAura();
      }
    }
    
    // Update fireball aura (now a child of player mesh — no position copy needed)
    if (this.fireAura) {
      this.fireAura.rotation.y += dt * 4;
      const pulse = 0.4 + Math.sin(this.animTime * 10) * 0.15;
      this.fireAura.material.opacity = pulse;
      const s = 1.0 + Math.sin(this.animTime * 7) * 0.1;
      this.fireAura.scale.setScalar(s);
      
      // Remove aura if buff expired
      if (!this.fireballReady) {
        this.cleanupFireAura();
      }
    }
    
    // Update burn DOT
    if (this.burning && this.burnDamageRemaining > 0 && this.alive) {
      this.burnDuration -= dt;
      this.burnTickTimer -= dt;
      
      if (this.burnTickTimer <= 0) {
        // Deal a burn tick (5 ticks over 2.5s = every 0.5s)
        const tickDamage = Math.min(5, this.burnDamageRemaining);
        this.hp -= tickDamage;
        this.burnDamageRemaining -= tickDamage;
        this.burnTickTimer = 0.5; // next tick in 0.5s
        
        // Trigger burn tick callback (for effects/sound in main.js)
        if (this.onBurnTick) {
          this.onBurnTick(this.mesh.position.clone(), tickDamage);
        }
        
        // Check for KO from burn
        if (this.hp <= 0) {
          this.hp = 0;
          this.alive = false;
          this.burning = false;
          this.burnDamageRemaining = 0;
          this.cleanupBurnEffect();
          if (this.onBurnKO) {
            this.onBurnKO(this.mesh.position.clone());
          }
          this.die();
          return;
        }
      }
      
      // Burn expired
      if (this.burnDuration <= 0 || this.burnDamageRemaining <= 0) {
        this.burning = false;
        this.burnDamageRemaining = 0;
        this.cleanupBurnEffect();
      }
      
      // Animate burn fire particles on the player
      if (this.burnEffect) {
        this.burnEffect.forEach(spark => {
          spark.userData.angle += dt * spark.userData.speed;
          const r = 0.3 + Math.sin(spark.userData.angle * 2) * 0.15;
          spark.position.x = Math.cos(spark.userData.angle) * r;
          spark.position.z = Math.sin(spark.userData.angle) * r;
          spark.position.y = 0.5 + Math.sin(spark.userData.angle * 3 + spark.userData.phase) * 0.8 + Math.abs(Math.sin(this.animTime * 5 + spark.userData.phase)) * 0.3;
          spark.material.opacity = 0.5 + Math.sin(this.animTime * 12 + spark.userData.phase) * 0.3;
          const scale = 0.6 + Math.sin(this.animTime * 8 + spark.userData.phase) * 0.4;
          spark.scale.setScalar(scale);
        });
      }
    }
  }
  
  // ─── Power-Up Effect Cleanup Methods ──────────────────────
  cleanupFreezeEffect() {
    if (this.freezeEffect) {
      if (this.freezeEffect.parent) {
        this.freezeEffect.parent.remove(this.freezeEffect);
      }
      this.freezeEffect.geometry.dispose();
      this.freezeEffect.material.dispose();
      this.freezeEffect = null;
    }
  }
  
  cleanupLightningEffect() {
    if (this.lightningEffect) {
      this.lightningEffect.forEach(spark => {
        // Try parent removal
        if (spark.parent) {
          spark.parent.remove(spark);
        }
        // Also try direct removal from player mesh as safety
        if (this.mesh && this.mesh.children.includes(spark)) {
          this.mesh.remove(spark);
        }
        // Dispose resources
        if (spark.geometry) spark.geometry.dispose();
        if (spark.material) spark.material.dispose();
      });
      this.lightningEffect = null;
    }
    
    // Extra safety: scan mesh children for any orphaned lightning sparks
    if (this.mesh) {
      const orphanedSparks = this.mesh.children.filter(child => 
        child.geometry && 
        child.geometry.type === 'SphereGeometry' &&
        child.material &&
        child.material.color &&
        child.material.color.getHex() === 0xffff00
      );
      orphanedSparks.forEach(spark => {
        this.mesh.remove(spark);
        if (spark.geometry) spark.geometry.dispose();
        if (spark.material) spark.material.dispose();
      });
    }
  }
  
  cleanupLaserAura() {
    if (this.laserAura) {
      if (this.laserAura.parent) {
        this.laserAura.parent.remove(this.laserAura);
      }
      this.laserAura.geometry.dispose();
      this.laserAura.material.dispose();
      this.laserAura = null;
    }
  }
  
  cleanupFireAura() {
    if (this.fireAura) {
      if (this.fireAura.parent) {
        this.fireAura.parent.remove(this.fireAura);
      }
      this.fireAura.geometry.dispose();
      this.fireAura.material.dispose();
      this.fireAura = null;
    }
  }
  
  cleanupBurnEffect() {
    if (this.burnEffect) {
      this.burnEffect.forEach(spark => {
        if (spark.parent) {
          spark.parent.remove(spark);
        }
        if (this.mesh && this.mesh.children.includes(spark)) {
          this.mesh.remove(spark);
        }
        if (spark.geometry) spark.geometry.dispose();
        if (spark.material) spark.material.dispose();
      });
      this.burnEffect = null;
    }
  }
  
  cleanupSpeedTrail() {
    if (this.speedTrail) {
      if (this.speedTrail.parent) {
        this.speedTrail.parent.remove(this.speedTrail);
      }
      if (this.mesh && this.mesh.children.includes(this.speedTrail)) {
        this.mesh.remove(this.speedTrail);
      }
      if (this.speedTrail.geometry) this.speedTrail.geometry.dispose();
      if (this.speedTrail.material) this.speedTrail.material.dispose();
      this.speedTrail = null;
    }
  }
  
  // ─── Main Update ──────────────────────────────────────
  update(dt, keys, allPlayers, balls, mobileInput, powerUps = [], cameraAngle = null) {
    if (!this.alive) return;
    
    // ── Launched off map (hockey stick slap shot) — override everything ──
    if (this.launchedOffMap) {
      // Drop any held ball immediately when launched off map
      if (this.hasBall && this.ball) {
        this.dropBall();
      }
      
      // Clean up all visual power-up effects immediately (speed trail, auras, etc.)
      // These are scene-level objects that would otherwise be stuck at old position
      if (this.speedTrail) this.cleanupSpeedTrail();
      if (this.freezeEffect) this.cleanupFreezeEffect();
      if (this.lightningEffect) this.cleanupLightningEffect();
      if (this.laserAura) this.cleanupLaserAura();
      if (this.fireAura) this.cleanupFireAura();
      if (this.burnEffect) this.cleanupBurnEffect();
      this.superSpeed = false;
      this.superSpeedTime = 0;
      this.burning = false;
      this.burnDamageRemaining = 0;
      
      // Decrement respawn timer (only if it exists and is positive)
      if (this.respawnTimer !== undefined && this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        // Clamp to minimum of 0 to prevent negative values
        if (this.respawnTimer < 0) {
          this.respawnTimer = 0;
        }
      }
      
      // Apply velocity + gravity for dramatic flight arc
      this._launchVelY = (this._launchVelY || 0) - 40 * dt; // gravity
      this.mesh.position.x += (this._launchVelX || 0) * dt;
      this.mesh.position.y += (this._launchVelY || 0) * dt;
      this.mesh.position.z += (this._launchVelZ || 0) * dt;
      
      // Tumble spin for visual drama
      this.mesh.rotation.x += 12 * dt;
      this.mesh.rotation.z += 8 * dt;
      
      // Fade out once high enough / far enough
      if (this.mesh.position.y > 10 || Math.abs(this.mesh.position.x) > 40) {
        this.mesh.visible = false;
      }
      
      // Respawn (only trigger once when timer reaches 0)
      if (this.respawnTimer <= 0 && this.launchedOffMap) {
        this.launchedOffMap = false;
        this.respawnTimer = 0;
        this._launchVelX = 0;
        this._launchVelY = 0;
        this._launchVelZ = 0;
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
        
        // Return to spawn position
        const spawnX = this.team === CONFIG.TEAM_BLUE ? -10 : 10;
        const spawnZ = (Math.random() - 0.5) * 6;
        this.mesh.position.set(spawnX, 0, spawnZ);
        this.mesh.visible = true;
        
        // Brief invincibility after landing
        this.invincible = 1.5;
        
        // Reset dodge cooldown on respawn
        this.dodgeCooldown = 0;
        this.isDodging = false;
        
        // Reset AI state on respawn
        if (!this.isHuman) {
          this.aiState = 'idle';
          this.targetPos = null;
          this._ballSeekTimer = 0;
          this._aiThrowDelay = null;
          this._pickupGiveUpTimer = 0;
        }
        
        // If HP is 0, player is dead — trigger proper death
        if (this.hp <= 0) {
          this.hp = 0;
          this.alive = false;
          this.die();
        }
      }
      return; // Skip all normal update logic while airborne
    }
    
    // Store powerUps array for AI to access
    this._powerUpsArray = powerUps;
    
    // Store camera angle for third-person movement
    this._cameraAngle = cameraAngle;
    
    this.animTime += dt;
    this.animStateTime += dt;
    this.throwCooldown = Math.max(0, this.throwCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.hitStun = Math.max(0, this.hitStun - dt);
    this.invincible = Math.max(0, this.invincible - dt);
    this.stamina = Math.max(0, Math.min(CONFIG.MAX_STAMINA, this.stamina + CONFIG.STAMINA_REGEN * dt));
    this.blendFactor = Math.min(1, this.blendFactor + this.blendSpeed * dt);
    
    // Update power-up states
    this.updatePowerUpStates(dt);
    
    if (this.catchWindow > 0) {
      this.catchWindow -= dt;
      if (this.catchWindow <= 0) this.isCatching = false;
    }
    
    if (this.deflectWindow > 0) {
      this.deflectWindow -= dt;
      if (this.deflectWindow <= 0) this.isDeflecting = false;
    }
    
    this.updateAnimStateMachine(dt);
    
    if (this.hitStun > 0 && this.animState !== ANIM.HIT_REACT) {
      this.setAnimState(ANIM.HIT_REACT);
    }
    
    // Allow movement during CHARGE_WINDUP (slowed), block during WINDUP/THROW/DODGE/DEFLECT
    // ALSO block during FROZEN, STUNNED, or SLIPPING states
    if (!this.frozen && !this.stunned && !this.slipping &&
        this.animState !== ANIM.HIT_REACT && this.animState !== ANIM.KO &&
        this.animState !== ANIM.THROW && this.animState !== ANIM.WINDUP &&
        this.animState !== ANIM.CATCH_SUCCESS && this.animState !== ANIM.DEFLECT_SUCCESS && this.animState !== ANIM.DODGE) {
      if (this.isHuman) {
        this.updateHuman(dt, keys, mobileInput);
      } else {
        this.updateAI(dt, allPlayers, balls);
      }
    }
    
    // ── Dodge displacement — move player during dodge animation ──
    if (this.animState === ANIM.DODGE && this.isDodging) {
      const dodgeDur = CONFIG.DODGE_DURATION;
      const progress = Math.min(1, this.animStateTime / dodgeDur);
      // Eased displacement curve: fast start, slow end (parkour deceleration)
      const speedCurve = progress < 0.5
        ? 1.2 - progress * 0.8   // fast burst in first half
        : 0.8 - (progress - 0.5) * 1.2; // decelerating
      const moveSpeed = Math.max(0, speedCurve) * CONFIG.DODGE_DISTANCE / dodgeDur;
      this.mesh.position.x += this.dodgeDirX * moveSpeed * dt;
      this.mesh.position.z += this.dodgeDirZ * moveSpeed * dt;
      
      // Dodge invincibility window
      if (progress >= CONFIG.DODGE_INVINCIBLE_START && progress <= CONFIG.DODGE_INVINCIBLE_END) {
        this.invincible = Math.max(this.invincible, 0.05); // keep refreshing i-frames
      }
      
      // Fire dodge effect callback for afterimage trail
      if (this.onDodgeEffect && Math.random() < 0.6) {
        this.onDodgeEffect(this.mesh.position.clone(), this.dodgeStyle, progress);
      }
    }
    
    // Auto-enter CHARGE_WINDUP when throwCharging is set by main.js
    if (this.throwCharging && this.hasBall && 
        this.animState !== ANIM.WINDUP && this.animState !== ANIM.THROW &&
        this.animState !== ANIM.HIT_REACT && this.animState !== ANIM.KO) {
      if (this.animState !== ANIM.CHARGE_WINDUP) {
        // Pick random flip style at the start of each charge
        this.throwFlipStyle = Math.floor(Math.random() * 6); // 0=backflip, 1=tornado, 2=gainer, 3=corkscrew, 4=superman, 5=windmill
        this.setAnimState(ANIM.CHARGE_WINDUP);
      }
    }
    // Exit CHARGE_WINDUP if no longer charging (cancelled, lost ball, etc.)
    if (this.animState === ANIM.CHARGE_WINDUP && !this.throwCharging) {
      this.setAnimState(this.hasBall ? ANIM.HOLD_IDLE : ANIM.IDLE);
    }
    
    if (this.animState !== ANIM.WINDUP && this.animState !== ANIM.THROW &&
        this.animState !== ANIM.CHARGE_WINDUP &&
        this.animState !== ANIM.CATCH_SUCCESS && this.animState !== ANIM.DEFLECT_SUCCESS &&
        this.animState !== ANIM.HIT_REACT &&
        this.animState !== ANIM.KO && this.animState !== ANIM.DODGE) {
      const isMoving = this.isHuman ?
        (Math.abs(this.mesh.position.x - (this._lastX || this.mesh.position.x)) > 0.01 ||
         Math.abs(this.mesh.position.z - (this._lastZ || this.mesh.position.z)) > 0.01) :
        this.targetPos !== null && this.aiState !== 'idle';
      
      if (this.isDeflecting) {
        this.setAnimState(ANIM.DEFLECT_READY);
      } else if (this.isCatching) {
        this.setAnimState(ANIM.CATCH_READY);
      } else if (this.hasBall) {
        this.setAnimState(isMoving ? ANIM.HOLD_RUN : ANIM.HOLD_IDLE);
      } else {
        this.setAnimState(isMoving ? ANIM.RUN : ANIM.IDLE);
      }
    }
    
    this._lastX = this.mesh.position.x;
    this._lastZ = this.mesh.position.z;
    
    this.computePose(dt);
    
    // Override pose for slip state (banana peel)
    if (this.slipping) {
      const p = this.pose;
      // Track slip animation time
      if (this.slipAnimPhase === undefined) this.slipAnimPhase = 0;
      this.slipAnimPhase += dt;
      
      if (this.slipDuration > 0) {
        const totalDur = 2.0;
        const elapsed = totalDur - this.slipDuration;
        
        if (elapsed < 0.15) {
          // Phase 1: FEET KICK UP — one foot flies forward, body starts tilting back
          const t = elapsed / 0.15;
          const ease = t * t; // ease in
          p.bodyY = 0.76 - ease * 0.2;
          p.bodyRotX = ease * 0.4; // lean backward
          p.bodyRotZ = ease * 0.15;
          p.meshPosY = ease * 0.3; // slight upward before fall
          p.lLegRotX = ease * -1.8; // left leg kicks forward
          p.rLegRotX = ease * 0.4;  // right leg back
          p.lArmRotX = ease * -0.8; // arms flail up
          p.rArmRotX = ease * -1.2;
          p.lArmRotZ = ease * 1.5;  // arms spread wide
          p.rArmRotZ = ease * -1.5;
          p.headRotX = ease * -0.3; // head snaps back
        } else if (elapsed < 0.4) {
          // Phase 2: AIRBORNE SPIN — body rotates backward, legs split, arms windmill
          const t = (elapsed - 0.15) / 0.25;
          const ease = Math.sin(t * Math.PI * 0.5); // ease out
          p.bodyY = 0.56 - ease * 0.3;
          p.bodyRotX = 0.4 + ease * (Math.PI / 2 - 0.4); // rotate to nearly horizontal
          p.bodyRotZ = 0.15 + Math.sin(t * Math.PI) * 0.2; // wobble sideways
          p.meshPosY = 0.3 * (1 - ease); // falling down
          p.lLegRotX = -1.8 + ease * 1.0; // legs closing
          p.rLegRotX = 0.4 + ease * 0.5;
          p.lArmRotX = -0.8 - Math.sin(t * Math.PI * 2) * 0.6; // windmill
          p.rArmRotX = -1.2 + Math.sin(t * Math.PI * 2) * 0.6;
          p.lArmRotZ = 1.5 - ease * 0.3;
          p.rArmRotZ = -1.5 + ease * 0.3;
          p.headRotX = -0.3 + ease * 0.1;
        } else if (elapsed < 0.55) {
          // Phase 3: IMPACT — body slams flat on ground with bounce
          const t = (elapsed - 0.4) / 0.15;
          const bounce = Math.sin(t * Math.PI) * 0.08; // small bounce
          p.bodyY = 0.15 + bounce;
          p.bodyRotX = Math.PI / 2; // fully flat
          p.bodyRotZ = 0;
          p.meshPosY = bounce * 0.5;
          p.meshRotZ = 0;
          p.lArmRotX = 0.2;
          p.rArmRotX = 0.1;
          p.lArmRotZ = 1.0 + bounce * 2;
          p.rArmRotZ = -1.1 - bounce * 2;
          // When body is flat (rotX = PI/2), legs at rotX=0 will point straight out
          // So we DON'T compensate - let them naturally extend from the body
          p.lLegRotX = 0.1 + bounce * 2;
          p.rLegRotX = -0.1 - bounce * 2;
          p.headRotX = 0; // Head lies naturally with body
        } else {
          // Phase 4: LYING DAZED — twitching on ground
          const dazedT = elapsed - 0.55;
          const twitch = Math.sin(dazedT * 8) * Math.max(0, 0.1 - dazedT * 0.05);
          p.bodyY = 0.15;
          p.bodyRotX = Math.PI / 2;
          p.bodyRotZ = twitch * 0.3;
          p.meshPosY = 0;
          p.meshRotZ = twitch * 0.1;
          p.lArmRotX = 0.2 + twitch * 1.5;
          p.rArmRotX = 0.1 - twitch * 1.5;
          p.lArmRotZ = 1.0 + twitch * 0.5;
          p.rArmRotZ = -1.1 - twitch * 0.5;
          // Keep legs naturally extended while lying on ground
          p.lLegRotX = 0.1 + twitch * 0.8;
          p.rLegRotX = -0.1 - twitch * 0.8;
          p.headRotX = twitch * 0.3;
        }
      } else if (this.slipRecovery > 0) {
        // Phase 5: GETTING BACK UP — wobbly recovery
        const recovery = 1 - (this.slipRecovery / 0.5);
        const wobble = Math.sin(recovery * Math.PI * 3) * (1 - recovery) * 0.15;
        p.bodyY = 0.15 + recovery * 0.61;
        p.bodyRotX = (Math.PI / 2) * (1 - recovery);
        p.bodyRotZ = wobble;
        p.meshPosY = 0;
        p.meshRotZ = wobble * 0.5;
        // Arms transition from lying to relaxed
        p.lArmRotX = 0.2 * (1 - recovery) + wobble * 0.5;
        p.rArmRotX = 0.1 * (1 - recovery) - wobble * 0.5;
        p.lArmRotZ = 1.0 * (1 - recovery) + 0.05;
        p.rArmRotZ = -1.1 * (1 - recovery) - 0.05;
        // Smoothly transition legs from extended (0.1/-0.1) to standing (0)
        p.lLegRotX = 0.1 * (1 - recovery) + wobble;
        p.rLegRotX = -0.1 * (1 - recovery) - wobble;
        p.headRotX = wobble * 0.3;
      }
    }
    
    this.applyPose(dt);
    this.updateFacing(dt);
    this.clampPosition();
    this.updateHPBar();
  }
  
  updateAnimStateMachine(dt) {
    const duration = ANIM_DURATIONS[this.animState];
    if (duration && this.animStateTime >= duration) {
      switch (this.animState) {
        case ANIM.WINDUP:
          // Auto-transition to THROW — the spin jump begins immediately
          this.setAnimState(ANIM.THROW);
          break;
        case ANIM.THROW:
          this.setAnimState(this.hasBall ? ANIM.HOLD_IDLE : ANIM.IDLE);
          break;
        case ANIM.CATCH_SUCCESS:
          this.setAnimState(ANIM.HOLD_IDLE);
          break;
        case ANIM.DEFLECT_SUCCESS:
          this.setAnimState(this.hasBall ? ANIM.HOLD_IDLE : ANIM.IDLE);
          break;
        case ANIM.HIT_REACT:
          if (this.hitStun <= 0) {
            this.setAnimState(this.hasBall ? ANIM.HOLD_IDLE : ANIM.IDLE);
          }
          break;
        case ANIM.DODGE:
          this.isDodging = false;
          this.setAnimState(this.hasBall ? ANIM.HOLD_IDLE : ANIM.IDLE);
          break;
      }
    }
  }
  
  // ─── Pose Computation ───────────────────────────────────
  computePose(dt) {
    const t = this.animTime;
    const st = this.animStateTime;
    const p = this.pose;
    const side = this.team === CONFIG.TEAM_BLUE ? 1 : -1;
    
    // Body Y: upperBody group pivot is at HIP_Y (0.76), so BY is its default local position
    // Arm Y: arms are children of upperBody at (SHOULDER_Y - 0.02 - HIP_Y) = 0.50
    const BY = 0.76;  // upperBody group default Y position (= HIP_Y)
    const AY = 0.50;  // arm pivot local Y within upperBody (= ARM_PIVOT_Y - HIP_Y)
    
    switch (this.animState) {
      case ANIM.IDLE: {
        // ═══ SWAGGER IDLE — big rhythmic bounce, weight shift, shoulder rolls ═══
        // Like a street baller in NBA Street or Super Dodgeball Advance.
        // Never truly still — always bouncing with attitude and energy.
        const bounce = Math.sin(t * 3.5);          // main bounce rhythm  
        const bounce2 = Math.sin(t * 7.0);         // double-time accent
        const sway = Math.sin(t * 1.8);            // slow lateral weight shift
        const headBob = Math.sin(t * 3.5 + 0.5);  // head bobs slightly off-beat
        const shoulderRoll = Math.sin(t * 2.2);    // shoulder roll cycle
        const fistPump = Math.max(0, Math.sin(t * 1.3)); // fist clench/pump
        
        // Athletic stance with BIG rhythmic bounce — visible from across the court
        p.bodyY = BY - 0.10 + bounce * 0.08 + bounce2 * 0.03;
        p.bodyRotX = -0.12 + bounce * 0.06;  // forward lean pulses with bounce
        p.bodyRotZ = sway * 0.10;             // big weight shifts side to side
        
        // Head has its own swagger — looks around, bobs to rhythm
        // headRotX is LOCAL to upperBody, so positive = looking up relative to body lean
        p.headRotX = 0.06 + headBob * 0.10;
        p.headRotZ = sway * 0.08 + shoulderRoll * 0.06;
        
        // Arms loose with visible swagger — fists up, elbows out wide
        p.lArmRotX = -0.25 + shoulderRoll * 0.20 + fistPump * 0.15;
        p.lArmRotZ = 0.30 + sway * 0.10 + bounce * 0.08;
        p.rArmRotX = -0.25 - shoulderRoll * 0.20 + fistPump * 0.15;
        p.rArmRotZ = -0.30 - sway * 0.10 - bounce * 0.08;
        p.lArmPosY = AY; p.rArmPosY = AY;
        
        // Forearms bent — "fists up" fighter stance
        p.lForearmRotX = -0.65 - fistPump * 0.30 - bounce * 0.12;
        p.rForearmRotX = -0.65 - fistPump * 0.30 - bounce * 0.12;
        
        // Legs: wide athletic stance with big weight-shifting bounce
        p.lLegRotX = 0.12 + bounce * 0.10 - sway * 0.08;
        p.rLegRotX = 0.12 + bounce * 0.10 + sway * 0.08;
        p.lLegRotZ = -0.06 + sway * 0.05;
        p.rLegRotZ = 0.06 + sway * 0.05;
        
        // Visible whole-body bounce — feet leave the ground slightly
        p.meshPosY = Math.max(0, bounce * 0.04 + bounce2 * 0.015);
        p.meshRotZ = sway * 0.03;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        break;
      }
      case ANIM.RUN: {
        // ═══ EXPLOSIVE SPRINT — wildly exaggerated parkour run ═══
        // Anime-level sprint: knees up to chest, arms pumping past the ears,
        // heavy forward lean, torso twisting, body actually leaves the ground.
        const run = t * 12;
        const stride = Math.sin(run);
        const bounce = Math.abs(Math.sin(run));
        const doubleBounce = Math.abs(Math.sin(run * 2));
        const torsoTwist = Math.sin(run) * 0.18;  // big torso counter-rotation
        
        // Heavy forward lean with huge vertical bounce per stride
        p.bodyY = BY - 0.08 + bounce * 0.12 + doubleBounce * 0.03;
        p.bodyRotX = -0.25 + stride * 0.08;  // deep lean into the run
        p.bodyRotZ = torsoTwist;               // torso twists hard with stride
        
        // Head thrusts forward aggressively, bobs with each step
        // Local to body — positive = looking up relative to body lean
        p.headRotX = 0.08 + bounce * 0.10;
        p.headRotZ = -torsoTwist * 0.5;  // head counters torso twist
        
        // MASSIVE arm pumps — arms swing way past vertical
        const lArmDrive = Math.sin(run + Math.PI);
        const rArmDrive = Math.sin(run);
        p.lArmRotX = lArmDrive * 1.5;  // enormous forward/backward swing
        p.lArmRotZ = 0.15 + Math.abs(lArmDrive) * 0.12;  // elbows flare wide
        p.rArmRotX = rArmDrive * 1.5;
        p.rArmRotZ = -0.15 - Math.abs(rArmDrive) * 0.12;
        p.lArmPosY = AY; p.rArmPosY = AY;
        
        // Forearms: snap tight on forward pump, whip open on backswing
        p.lForearmRotX = -0.9 - Math.max(0, -lArmDrive) * 1.0 - Math.max(0, lArmDrive) * 0.4;
        p.rForearmRotX = -0.9 - Math.max(0, -rArmDrive) * 1.0 - Math.max(0, rArmDrive) * 0.4;
        
        // EXTREME KNEE DRIVE — legs pump to absurd heights
        p.lLegRotX = stride * 1.2;         // knees driving up to chest level
        p.rLegRotX = -stride * 1.2;        // opposite leg kicks back hard
        p.lLegRotZ = stride > 0 ? -stride * 0.06 : 0;   // outward kick on high knee
        p.rLegRotZ = stride < 0 ? stride * 0.06 : 0;
        
        // Whole body LAUNCHES off ground at peak of each stride
        p.meshPosY = Math.max(0, bounce * 0.08 - 0.015);
        p.meshRotZ = torsoTwist * 0.10;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        break;
      }
      case ANIM.HOLD_IDLE: {
        // ═══ SHOWBOAT IDLE — cocky ball display, BIG taunting energy ═══
        // Maximum swagger. Ball held high, body bouncing, head bobbing cockily.
        // Visible from across the court. Pure NBA Street showboating.
        const bounce = Math.sin(t * 3.2);
        const bounce2 = Math.sin(t * 6.4);
        const sway = Math.sin(t * 1.6);
        const taunt = Math.sin(t * 2.4);         // slow taunt cycle
        const ballJuke = Math.sin(t * 5.0);      // ball jukes side to side
        const headSwag = Math.sin(t * 2.0 + 1.0);
        
        // Cocky lean-back stance with BIG bounce
        p.bodyY = BY - 0.08 + bounce * 0.07 + bounce2 * 0.02;
        p.bodyRotX = -0.14 + taunt * 0.06;  // lean back — chest puffed
        p.bodyRotZ = sway * 0.10 + ballJuke * 0.05;
        
        // Head: chin up high, looking around cockily with big bobs
        // Local to body — looking up from the lean = cocky chin-up
        p.headRotX = 0.04 + bounce * 0.08;
        p.headRotZ = headSwag * 0.10 + sway * 0.06;
        
        // Ball arm (right) — held way up, juking, showing off
        p.rArmRotX = -1.7 + ballJuke * 0.25 + bounce * 0.12;
        p.rArmRotZ = -0.20 + ballJuke * 0.15;
        p.rArmPosY = AY + 0.08 + bounce * 0.03;
        p.rForearmRotX = -1.0 + taunt * 0.15;
        
        // Free arm (left) — big swagger motion, fist pump
        p.lArmRotX = -0.30 + taunt * 0.25 + bounce * 0.10;
        p.lArmRotZ = 0.35 + sway * 0.12;
        p.lArmPosY = AY;
        p.lForearmRotX = -0.6 - bounce * 0.15;
        
        // Legs: wide bouncing stance
        p.lLegRotX = 0.10 + bounce * 0.08 + sway * 0.05;
        p.rLegRotX = 0.10 + bounce * 0.08 - sway * 0.05;
        p.lLegRotZ = -0.05 + sway * 0.04;
        p.rLegRotZ = 0.05 + sway * 0.04;
        
        p.meshPosY = Math.max(0, bounce * 0.035 + bounce2 * 0.01);
        p.meshRotZ = sway * 0.025;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        
        // Trick charge override — intensifies into power-up stance
        if (this.trickCharge > 0) {
          const chargeT = this.trickCharge / 100;
          p.rArmRotX = -1.7 - chargeT * 1.0;
          p.rArmRotZ = -0.20 - chargeT * 0.30;
          p.rForearmRotX = -1.0 - chargeT * 0.6;
          p.bodyRotX = -0.14 - chargeT * 0.18;
          p.bodyY -= chargeT * 0.10;  // drops lower
          p.lLegRotX += chargeT * 0.20;
          p.rLegRotX += chargeT * 0.20;
          if (chargeT > 0.3) {
            const shake = Math.sin(t * 30 + Math.sin(t * 7) * 2) * chargeT * 0.05;
            p.meshRotZ += shake;
            p.bodyRotZ += shake * 0.7;
            p.headRotZ += shake * 0.4;
          }
        }
        break;
      }
      case ANIM.HOLD_RUN: {
        // ═══ AGGRESSIVE BALL CARRY — bulldozer sprint with ball held high ═══
        // One arm pumping wildly, ball arm forward like a battering ram.
        // Even more aggressive lean than empty run. Pure charging energy.
        const run = t * 11.5;
        const stride = Math.sin(run);
        const bounce = Math.abs(Math.sin(run));
        const doubleBounce = Math.abs(Math.sin(run * 2));
        const torsoTwist = stride * 0.16;
        
        // Deep forward lean — bulldozing toward the enemy
        p.bodyY = BY - 0.10 + bounce * 0.10 + doubleBounce * 0.025;
        p.bodyRotX = -0.28 + stride * 0.07;  // heavy forward lean
        p.bodyRotZ = torsoTwist * 0.85;
        
        // Head aggressive: chin down, eyes up, locked on target
        // Local to body — slight look-up from the heavy lean
        p.headRotX = 0.10 + bounce * 0.08;
        p.headRotZ = -torsoTwist * 0.4;
        
        // Ball arm (right) — held way up and forward, bounces with stride
        p.rArmRotX = -1.8 + stride * 0.22 + bounce * 0.10;
        p.rArmRotZ = -0.15 + stride * 0.08;
        p.rArmPosY = AY + 0.08 + bounce * 0.03;
        p.rForearmRotX = -0.90 + bounce * 0.10;
        
        // Free arm (left) — massive sprinter pump
        const lDrive = Math.sin(run + Math.PI);
        p.lArmRotX = lDrive * 1.3;  // enormous pump range
        p.lArmRotZ = 0.18 + Math.abs(lDrive) * 0.12;
        p.lArmPosY = AY;
        p.lForearmRotX = -0.85 - Math.max(0, -lDrive) * 0.9 - Math.max(0, lDrive) * 0.35;
        
        // Extreme knee drive — charging stride
        p.lLegRotX = stride * 1.1;
        p.rLegRotX = -stride * 1.1;
        p.lLegRotZ = stride > 0 ? -stride * 0.05 : 0;
        p.rLegRotZ = stride < 0 ? stride * 0.05 : 0;
        
        // Body launches off ground with each stride
        p.meshPosY = Math.max(0, bounce * 0.06 - 0.012);
        p.meshRotZ = torsoTwist * 0.08;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        break;
      }
      // ═══════════════════════════════════════════════════════════
      // ═══ CHARGE WINDUP — slow-mo flip preview while holding ═
      // Plays the windup crouch → early launch → partial aerial
      // at a pace driven by throwChargePower (0→1).
      // Creates the "powering up" feel before releasing the throw.
      // ═══════════════════════════════════════════════════════════
      case ANIM.CHARGE_WINDUP: {
        // throwChargePower drives 0→1 through the preview, then loops the preview at max charge
        let cp = this.throwChargePower;
        const style = this.throwFlipStyle;
        
        // If at max charge (>=1.0), loop the preview animation (cycle 0.4→1.0 repeatedly)
        if (cp >= 1.0) {
          // Loop time with period of 1.2 seconds
          const loopT = (t % 1.2) / 1.2;  // 0→1 repeating
          cp = 0.4 + loopT * 0.6;  // map to 0.4→1.0 range (the flip preview phase)
        }
        
        cp = Math.max(0, Math.min(1, cp));
        
        // Phase 1: 0.0–0.4 → Windup crouch (same for all styles)
        // Phase 2: 0.4–1.0 → Slow-mo preview of the flip (style-dependent, loops when maxed)
        
        if (cp < 0.4) {
          // ── Windup crouch — style-dependent ──
          const windupT = cp / 0.4;
          const ease = easeInQuad(windupT);
          
          // Style 1 (tornado) winds up laterally; Style 2 (gainer) aggressive forward lean
          const fwdLean = style === 1 ? -ease * 0.10 : style === 2 ? -ease * 0.35 : -ease * 0.25;
          const sideLean = style === 1 ? side * ease * 0.25 : style === 2 ? side * ease * 0.06 : side * ease * 0.1;
          
          p.bodyY = BY - ease * 0.22;
          p.bodyRotX = fwdLean;
          p.bodyRotZ = sideLean;
          p.headRotX = ease * 0.12;
          p.headRotZ = -side * ease * 0.1;
          
          p.rArmRotX = -1.3 - ease * 1.5;
          p.rArmRotZ = -0.05 - ease * 0.3;
          p.rArmPosY = AY + ease * 0.16;
          p.rForearmRotX = -0.8 - ease * 1.0;
          
          p.lArmRotX = -ease * 0.8;
          p.lArmRotZ = 0.05 - ease * 0.25;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.6;
          
          p.lLegRotX = style === 2 ? ease * 0.55 : ease * 0.45;
          p.rLegRotX = style === 2 ? -ease * 0.4 : -ease * 0.3;
          p.lLegRotZ = style === 1 ? -ease * 0.15 : 0;
          p.rLegRotZ = style === 1 ? ease * 0.15 : 0;
          
          p.spinY = -side * ease * 0.6;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.10;
          p.meshRotZ = 0;
          
          // Charge intensity shake
          if (cp > 0.25) {
            const shake = Math.sin(t * 30) * (cp - 0.25) * 0.04;
            p.meshRotZ += shake;
            p.bodyRotZ += shake * 0.5;
          }
        } else {
          const launchT = (cp - 0.4) / 0.6; // 0→1 over charge 40%→100%
          const launchEase = easeOutQuad(launchT);
          const previewPeak = style === 1 ? CONFIG.FLIP_HEIGHT_TORNADO : 
                               style === 2 ? CONFIG.FLIP_HEIGHT_GAINER : 
                               style === 3 ? CONFIG.FLIP_HEIGHT_CORKSCREW :
                               style === 4 ? CONFIG.FLIP_HEIGHT_SUPERMAN :
                               style === 5 ? CONFIG.FLIP_HEIGHT_WINDMILL :
                               CONFIG.FLIP_HEIGHT_BACKFLIP;
          const jumpRise = Math.sin(launchT * Math.PI * 0.5) * (previewPeak * 0.35);
          
          if (style === 0) {
            // ── BACKFLIP+360 preview — partial flip X + spin Y ──
            const partialSpin = easeInOutCubic(launchT) * Math.PI * 0.5 * side;
            const partialFlip = -easeInOutCubic(launchT) * Math.PI * 0.33;
            
            p.bodyY = lerp(BY - 0.22, BY + 0.04, launchEase);
            p.bodyRotX = lerp(-0.25, -0.05, launchEase);
            p.bodyRotZ = lerp(side * 0.1, 0, launchEase);
            p.headRotX = lerp(0.12, -0.05, launchEase);
            p.headRotZ = lerp(-side * 0.1, 0, launchEase);
            
            p.rArmRotX = lerp(-2.8, -2.4, launchEase);
            p.rArmRotZ = -0.35;
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = lerp(-1.8, -1.5, launchEase);
            
            p.lArmRotX = lerp(-0.8, -0.6, launchEase);
            p.lArmRotZ = lerp(-0.2, -0.1, launchEase);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.8, launchEase);
            
            p.lLegRotX = lerp(0.45, -0.1, launchEase);
            p.rLegRotX = lerp(-0.3, -0.05, launchEase);
            p.lLegRotZ = -launchEase * 0.03;
            p.rLegRotZ = launchEase * 0.02;
            
            p.spinY = -side * 0.6 * (1 - launchT) + partialSpin;
            p.flipX = partialFlip;
            p.flipZ = 0;
          } else if (style === 2) {
            // ── GAINER TWIST preview — backward flip from forward lean + 360° opposite twist ──
            // The "gainer" in parkour launches forward but flips backward — the body
            // defies intuition. Preview shows the aggressive forward crouch opening into
            // the counter-rotational flip, with a stag leg (one bent, one straight).
            const partialSpin = -easeInOutCubic(launchT) * Math.PI * 0.55 * side; // opposite twist direction
            const partialFlip = -easeInOutCubic(launchT) * Math.PI * 0.35; // backward flip
            
            p.bodyY = lerp(BY - 0.22, BY + 0.06, launchEase);
            p.bodyRotX = lerp(-0.35, -0.12, launchEase); // stays leaned forward
            p.bodyRotZ = lerp(side * 0.06, 0, launchEase);
            p.headRotX = lerp(0.12, -0.10, launchEase);
            p.headRotZ = lerp(-side * 0.1, 0, launchEase);
            
            // Ball arm whips behind back in preview (behind-the-back throw setup)
            p.rArmRotX = lerp(-2.8, -1.8, launchEase);
            p.rArmRotZ = lerp(-0.35, 0.30, launchEase); // arm crosses behind
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = lerp(-1.8, -1.2, launchEase);
            
            // Left arm sweeps forward as counterbalance
            p.lArmRotX = lerp(-0.8, -1.6, launchEase);
            p.lArmRotZ = lerp(-0.2, -0.4, launchEase);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.4, launchEase);
            
            // STAG position preview — one leg bends, one extends
            p.lLegRotX = lerp(0.55, -0.8, launchEase);  // left leg pulls up (stag bent)
            p.rLegRotX = lerp(-0.4, 0.15, launchEase);    // right leg stays straight/extended
            p.lLegRotZ = -launchEase * 0.04;
            p.rLegRotZ = launchEase * 0.03;
            
            p.spinY = -side * 0.6 * (1 - launchT) + partialSpin;
            p.flipX = partialFlip;
            p.flipZ = 0;
          } else if (style === 3) {
            // ── CORKSCREW TWIST preview — cartwheel into spinning corkscrew ──
            const partialSpin = easeInOutCubic(launchT) * Math.PI * 0.65 * side;
            const partialRoll = side * easeInOutCubic(launchT) * Math.PI * 0.50;
            const partialFlip = -easeInOutCubic(launchT) * Math.PI * 0.20; // slight backward tilt
            
            p.bodyY = lerp(BY - 0.22, BY + 0.05, launchEase);
            p.bodyRotX = lerp(-0.25, -0.10, launchEase);
            p.bodyRotZ = lerp(side * 0.20, 0, launchEase);
            p.headRotX = lerp(0.12, -0.06, launchEase);
            p.headRotZ = lerp(-side * 0.1, side * 0.15, launchEase);
            
            // Arms wind into corkscrew position
            p.rArmRotX = lerp(-2.8, -2.2, launchEase);
            p.rArmRotZ = lerp(-0.35, -0.65, launchEase);
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = lerp(-1.8, -0.8, launchEase);
            
            p.lArmRotX = lerp(-0.8, -1.4, launchEase);
            p.lArmRotZ = lerp(-0.2, 0.5, launchEase);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.4, launchEase);
            
            // Legs tuck slightly as body corkscrews
            p.lLegRotX = lerp(0.45, -0.2, launchEase);
            p.rLegRotX = lerp(-0.3, -0.15, launchEase);
            p.lLegRotZ = lerp(0, -0.18, launchEase);
            p.rLegRotZ = lerp(0, 0.18, launchEase);
            
            p.spinY = -side * 0.6 * (1 - launchT) + partialSpin;
            p.flipX = partialFlip;
            p.flipZ = partialRoll;
          } else if (style === 1) {
            // ── TORNADO CARTWHEEL preview — partial roll Z + spin Y ──
            const partialSpin = easeInOutCubic(launchT) * Math.PI * 0.7 * side;
            const partialRoll = side * easeInOutCubic(launchT) * Math.PI * 0.4;
            
            p.bodyY = lerp(BY - 0.22, BY + 0.06, launchEase);
            p.bodyRotX = lerp(-0.10, 0, launchEase);
            p.bodyRotZ = lerp(side * 0.25, 0, launchEase);
            p.headRotX = lerp(0.12, -0.08, launchEase);
            p.headRotZ = lerp(-side * 0.1, side * 0.1, launchEase);
            
            // Arms swing wide for cartwheel
            p.rArmRotX = lerp(-2.8, -2.0, launchEase);
            p.rArmRotZ = lerp(-0.35, -0.8, launchEase);
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = lerp(-1.8, -0.6, launchEase);
            
            p.lArmRotX = lerp(-0.8, -1.6, launchEase);
            p.lArmRotZ = lerp(-0.2, 0.6, launchEase);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.3, launchEase);
            
            // Legs splay for cartwheel
            p.lLegRotX = lerp(0.45, 0, launchEase);
            p.rLegRotX = lerp(-0.3, 0, launchEase);
            p.lLegRotZ = lerp(-0.15, -0.25, launchEase);
            p.rLegRotZ = lerp(0.15, 0.25, launchEase);
            
            p.spinY = -side * 0.6 * (1 - launchT) + partialSpin;
            p.flipX = 0;
            p.flipZ = partialRoll;
          } else if (style === 4) {
            // ── SUPERMAN DIVE preview — horizontal dive with front flip ──
            const partialFlip = easeInOutCubic(launchT) * Math.PI * 0.45; // forward flip
            
            p.bodyY = lerp(BY - 0.22, BY + 0.08, launchEase);
            p.bodyRotX = lerp(-0.25, -0.55, launchEase); // dive forward aggressively
            p.bodyRotZ = lerp(side * 0.08, 0, launchEase);
            p.headRotX = lerp(0.12, -0.25, launchEase);
            p.headRotZ = 0;
            
            // Both arms extend forward (superman pose)
            p.rArmRotX = lerp(-2.8, -2.0, launchEase);
            p.rArmRotZ = lerp(-0.35, 0.05, launchEase);
            p.rArmPosY = AY + lerp(0.16, 0.22, launchEase);
            p.rForearmRotX = lerp(-1.8, -0.2, launchEase);
            
            p.lArmRotX = lerp(-0.8, -2.0, launchEase);
            p.lArmRotZ = lerp(-0.2, -0.05, launchEase);
            p.lArmPosY = AY + lerp(0, 0.22, launchEase);
            p.lForearmRotX = lerp(-0.6, -0.2, launchEase);
            
            // Legs extend back straight (dive bomb pose)
            p.lLegRotX = lerp(0.45, 0.65, launchEase);
            p.rLegRotX = lerp(-0.3, 0.50, launchEase);
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.spinY = 0;
            p.flipX = partialFlip;
            p.flipZ = 0;
          } else if (style === 5) {
            // ── WINDMILL HELICOPTER preview — inverted sideways rotation with splits ──
            const partialRoll = side * easeInOutCubic(launchT) * Math.PI * 0.55;
            const partialFlip = -easeInOutCubic(launchT) * Math.PI * 0.30; // slight backward tilt
            
            p.bodyY = lerp(BY - 0.22, BY + 0.10, launchEase);
            p.bodyRotX = lerp(-0.20, 0.10, launchEase);
            p.bodyRotZ = lerp(side * 0.18, 0, launchEase);
            p.headRotX = lerp(0.10, -0.12, launchEase);
            p.headRotZ = lerp(-side * 0.08, side * 0.20, launchEase);
            
            // Arms spread wide for balance
            p.rArmRotX = lerp(-2.8, -1.8, launchEase);
            p.rArmRotZ = lerp(-0.35, -0.80, launchEase);
            p.rArmPosY = AY + 0.14;
            p.rForearmRotX = lerp(-1.8, -0.5, launchEase);
            
            p.lArmRotX = lerp(-0.8, -1.7, launchEase);
            p.lArmRotZ = lerp(-0.2, 0.75, launchEase);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.4, launchEase);
            
            // Legs begin to split (windmill signature)
            p.lLegRotX = lerp(0.45, 0.70, launchEase);
            p.rLegRotX = lerp(-0.3, -0.65, launchEase);
            p.lLegRotZ = lerp(0, -0.15, launchEase);
            p.rLegRotZ = lerp(0, 0.15, launchEase);
            
            p.spinY = 0;
            p.flipX = partialFlip;
            p.flipZ = partialRoll;
          }
          
          p.meshPosY = jumpRise;
          p.meshRotZ = 0;
          
          // Increasing shake at high charge
          const shake = Math.sin(t * 35) * launchT * 0.03;
          p.meshRotZ += shake;
        }
        break;
      }
      // ═══════════════════════════════════════════════════════════
      // ═══ WINDUP + THROW — style-branching trick animations ══
      // Style 0: BACKFLIP + 360 TWIST  (NBA Street Vol. 2)
      // Style 1: TORNADO CARTWHEEL     (720° spin + lateral roll)
      // Style 2: GAINER TWIST          (fwd-launch bwd flip + behind-back release + stag legs)
      // ═══════════════════════════════════════════════════════════
      case ANIM.WINDUP: {
        const progress = Math.min(1, st / ANIM_DURATIONS[ANIM.WINDUP]);
        const ease = easeInQuad(progress);
        const style = this.throwFlipStyle;
        
        if (style === 1) {
          // ── TORNADO CARTWHEEL windup — lateral coil ──
          p.bodyY = BY - ease * 0.20;
          p.bodyRotX = -ease * 0.10;
          p.bodyRotZ = side * ease * 0.25;
          p.headRotX = ease * 0.10;
          p.headRotZ = -side * ease * 0.15;
          
          p.rArmRotX = -1.3 - ease * 1.2;
          p.rArmRotZ = -0.05 - ease * 0.5;
          p.rArmPosY = AY + ease * 0.14;
          p.rForearmRotX = -0.8 - ease * 0.8;
          
          p.lArmRotX = -ease * 1.0;
          p.lArmRotZ = 0.05 + ease * 0.4;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.4;
          
          p.lLegRotX = ease * 0.35;
          p.rLegRotX = -ease * 0.25;
          p.lLegRotZ = -ease * 0.2;
          p.rLegRotZ = ease * 0.2;
          
          p.spinY = -side * ease * 0.8;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.08;
          p.meshRotZ = 0;
        } else if (style === 2) {
          // ── GAINER TWIST windup — deep forward lean, ball behind back ──
          // The gainer's windup looks like you're about to dive forward.
          // Ball arm crosses behind the back (behind-the-back throw-in).
          // The paradox: this forward-leaning stance launches a backward flip.
          p.bodyY = BY - ease * 0.24;
          p.bodyRotX = -ease * 0.35;    // aggressive forward lean
          p.bodyRotZ = side * ease * 0.06;
          p.headRotX = ease * 0.18;     // head tilts down — intense focus
          p.headRotZ = -side * ease * 0.06;
          
          // Right arm wraps behind back — behind-the-back throw position
          p.rArmRotX = -1.3 - ease * 0.8;
          p.rArmRotZ = -0.05 + ease * 0.55; // crosses body to behind back
          p.rArmPosY = AY + ease * 0.10;
          p.rForearmRotX = -0.8 - ease * 0.6;
          
          // Left arm reaches forward for counterbalance and momentum drive
          p.lArmRotX = -ease * 1.4;
          p.lArmRotZ = 0.05 - ease * 0.35;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.5;
          
          // Legs in lunge — front foot loaded, back foot ready to push
          p.lLegRotX = ease * 0.55;     // front leg bends (loading)
          p.rLegRotX = -ease * 0.4;     // back leg extends back
          p.lLegRotZ = 0;
          p.rLegRotZ = 0;
          
          p.spinY = side * ease * 0.4;  // slight pre-twist OPPOSITE direction (gainer twist goes opposite)
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.12;
          p.meshRotZ = 0;
        } else if (style === 3) {
          // ── CORKSCREW windup — diagonal coil, twist setup ──
          p.bodyY = BY - ease * 0.22;
          p.bodyRotX = -ease * 0.20;
          p.bodyRotZ = side * ease * 0.22;
          p.headRotX = ease * 0.14;
          p.headRotZ = -side * ease * 0.12;
          
          p.rArmRotX = -1.3 - ease * 1.4;
          p.rArmRotZ = -0.05 - ease * 0.45;
          p.rArmPosY = AY + ease * 0.15;
          p.rForearmRotX = -0.8 - ease * 0.9;
          
          p.lArmRotX = -ease * 0.9;
          p.lArmRotZ = 0.05 + ease * 0.35;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.5;
          
          p.lLegRotX = ease * 0.40;
          p.rLegRotX = -ease * 0.30;
          p.lLegRotZ = -ease * 0.12;
          p.rLegRotZ = ease * 0.12;
          
          p.spinY = -side * ease * 0.7;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.10;
          p.meshRotZ = 0;
        } else if (style === 4) {
          // ── SUPERMAN DIVE windup — deep crouch, arms extend forward ──
          p.bodyY = BY - ease * 0.26;
          p.bodyRotX = -ease * 0.30;
          p.bodyRotZ = side * ease * 0.08;
          p.headRotX = ease * 0.15;
          p.headRotZ = 0;
          
          // Both arms reach forward in preparation for dive
          p.rArmRotX = -1.3 - ease * 1.3;
          p.rArmRotZ = -0.05 + ease * 0.10;
          p.rArmPosY = AY + ease * 0.14;
          p.rForearmRotX = -0.8 - ease * 1.0;
          
          p.lArmRotX = -ease * 1.2;
          p.lArmRotZ = 0.05 - ease * 0.15;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.8;
          
          p.lLegRotX = ease * 0.50;
          p.rLegRotX = -ease * 0.35;
          p.lLegRotZ = 0;
          p.rLegRotZ = 0;
          
          p.spinY = 0;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.14;
          p.meshRotZ = 0;
        } else if (style === 5) {
          // ── WINDMILL windup — wide stance, arms spread ──
          p.bodyY = BY - ease * 0.20;
          p.bodyRotX = -ease * 0.18;
          p.bodyRotZ = side * ease * 0.18;
          p.headRotX = ease * 0.10;
          p.headRotZ = -side * ease * 0.08;
          
          p.rArmRotX = -1.3 - ease * 1.2;
          p.rArmRotZ = -0.05 - ease * 0.50;
          p.rArmPosY = AY + ease * 0.14;
          p.rForearmRotX = -0.8 - ease * 0.7;
          
          p.lArmRotX = -ease * 1.0;
          p.lArmRotZ = 0.05 + ease * 0.45;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.6;
          
          // Wide leg stance for windmill prep
          p.lLegRotX = ease * 0.48;
          p.rLegRotX = -ease * 0.38;
          p.lLegRotZ = -ease * 0.10;
          p.rLegRotZ = ease * 0.10;
          
          p.spinY = -side * ease * 0.5;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.09;
          p.meshRotZ = 0;
        } else {
          // ── BACKFLIP windup — forward coil ──
          p.bodyY = BY - ease * 0.22;
          p.bodyRotX = -ease * 0.25;
          p.bodyRotZ = side * ease * 0.1;
          p.headRotX = ease * 0.12;
          p.headRotZ = -side * ease * 0.1;
          
          p.rArmRotX = -1.3 - ease * 1.5;
          p.rArmRotZ = -0.05 - ease * 0.3;
          p.rArmPosY = AY + ease * 0.16;
          p.rForearmRotX = -0.8 - ease * 1.0;
          
          p.lArmRotX = -ease * 0.8;
          p.lArmRotZ = 0.05 - ease * 0.25;
          p.lArmPosY = AY;
          p.lForearmRotX = -ease * 0.6;
          
          p.lLegRotX = ease * 0.45;
          p.rLegRotX = -ease * 0.3;
          p.lLegRotZ = 0;
          p.rLegRotZ = 0;
          
          p.spinY = -side * ease * 0.6;
          p.flipX = 0;
          p.flipZ = 0;
          
          p.meshPosY = -ease * 0.10;
          p.meshRotZ = 0;
        }
        break;
      }
      case ANIM.THROW: {
        const dur = ANIM_DURATIONS[ANIM.THROW];
        const progress = Math.min(1, st / dur);
        const style = this.throwFlipStyle;
        
        // Jump arc — shared between all styles (using config heights)
        const peakH = style === 1 ? CONFIG.FLIP_HEIGHT_TORNADO : 
                       style === 2 ? CONFIG.FLIP_HEIGHT_GAINER : 
                       style === 3 ? CONFIG.FLIP_HEIGHT_CORKSCREW :
                       style === 4 ? CONFIG.FLIP_HEIGHT_SUPERMAN :
                       style === 5 ? CONFIG.FLIP_HEIGHT_WINDMILL :
                       CONFIG.FLIP_HEIGHT_BACKFLIP;
        let jumpHeight;
        if (progress < 0.42) {
          const jumpUp = progress / 0.42;
          jumpHeight = Math.sin(jumpUp * Math.PI) * peakH;
        } else {
          const jumpDown = (progress - 0.42) / 0.58;
          jumpHeight = Math.cos(jumpDown * Math.PI * 0.5) * (peakH * 0.45);
          jumpHeight = Math.max(0, jumpHeight);
        }
        
        // Track peak height for landing impact
        if (jumpHeight > this.peakFlipHeight) {
          this.peakFlipHeight = jumpHeight;
        }
        
        if (style === 2) {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 2: GAINER TWIST ═══════════════════════════
          // Parkour's "gainer full" — launches forward, flips BACKWARD.
          // The body defies intuition: the momentum is forward but the
          // rotation is a backward somersault with a 360° twist in the
          // OPPOSITE direction of the other styles' spins.
          //
          // NBA Street Vol. 2 influence: "Off the Heezay" / behind-the-
          // back releases. The ball releases from behind the back while
          // the player is facing away mid-flip — maximum style.
          //
          // Key visual signatures:
          //   - Asymmetric "stag" legs (one bent at knee, one straight)
          //   - Behind-the-back arm whip release
          //   - Backward flip (-X) from forward-leaning launch
          //   - 360° twist in opposite Y direction (-side)
          //   - Highest jump of all 4 styles (2.6 units peak)
          //   - Wide-stance "superhero drop" landing
          // ═══════════════════════════════════════════════════════
          
          // 360° Y-twist (opposite direction — counter-rotation)
          let gainerSpinProg;
          if (progress < 0.50) {
            gainerSpinProg = easeInOutCubic(progress / 0.50);
          } else {
            gainerSpinProg = 1.0;
          }
          const gainerSpin = -gainerSpinProg * Math.PI * 2 * side; // opposite direction!
          
          // Backward flip X rotation (same axis as backflip but from forward lean)
          let gainerFlipProg;
          if (progress < 0.08) {
            gainerFlipProg = 0;
          } else if (progress < 0.52) {
            gainerFlipProg = easeInOutCubic((progress - 0.08) / 0.44);
          } else {
            gainerFlipProg = 1.0;
          }
          const gainerFlip = -gainerFlipProg * Math.PI * 2; // backward rotation
          
          if (progress < 0.14) {
            // ── LAUNCH — explosive forward-to-backward burst ──
            // The paradox moment: body drives forward but begins flipping backward.
            // Arms swing upward violently. Front leg pushes off.
            const t0 = progress / 0.14;
            const launch = easeOutQuad(t0);
            
            p.bodyY = BY - 0.24 + launch * 0.38;
            p.bodyRotX = -0.35 + launch * 0.30; // opens from forward lean
            p.bodyRotZ = side * 0.06 * (1 - launch);
            p.headRotX = 0.18 - launch * 0.28;
            p.headRotZ = -side * 0.06 * (1 - launch);
            
            // Right arm (ball) swings from behind back to overhead for launch
            p.rArmRotX = -2.1 - launch * 0.8;
            p.rArmRotZ = 0.50 - launch * 0.20; // arm crosses body then opens
            p.rArmPosY = AY + 0.10 + launch * 0.08;
            p.rForearmRotX = -1.4 - launch * 0.4;
            
            // Left arm drives upward for backward flip momentum
            p.lArmRotX = -1.4 - launch * 1.2;
            p.lArmRotZ = -0.30 - launch * 0.2;
            p.lArmPosY = AY;
            p.lForearmRotX = -0.5 - launch * 0.6;
            
            // Front leg drives up, back leg pushes off ground
            p.lLegRotX = 0.55 - launch * 0.9;  // front leg swings up
            p.rLegRotX = -0.4 + launch * 0.3;
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.spinY = side * 0.4 * (1 - launch) + gainerSpin;
            p.flipX = gainerFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.32) {
            // ── STAG AERIAL — the signature gainer pose ──
            // One leg bends sharply at the knee (stag), the other extends straight.
            // This asymmetric shape is instantly recognizable from parkour.
            // Arms spread wide for balance while inverted. Ball held behind back.
            const t1 = (progress - 0.14) / 0.18;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.12;
            p.bodyRotX = -0.05;
            p.bodyRotZ = 0;
            p.headRotX = -0.08;
            p.headRotZ = 0;
            
            // Right arm (ball) tucks behind back — building to behind-the-back release
            p.rArmRotX = lerp(-2.9, -1.2, air);
            p.rArmRotZ = lerp(0.30, 0.65, air);  // arm wraps further behind
            p.rArmPosY = AY + 0.18;
            p.rForearmRotX = lerp(-1.8, -1.0, air);
            
            // Left arm extends outward — wide reaching pose for balance
            p.lArmRotX = lerp(-2.6, -0.5, air);
            p.lArmRotZ = lerp(-0.50, -1.2, air); // extends laterally
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-1.1, -0.2, air);
            
            // STAG LEGS — the defining shape of the gainer
            // Left leg bends sharply at knee (pulled up toward chest then angled)
            // Right leg stays fully extended straight — creates the asymmetric "4" shape
            p.lLegRotX = lerp(-0.35, -1.3, air);  // bent leg pulls up tight
            p.rLegRotX = lerp(-0.1, 0.25, air);     // straight leg extends down/back
            p.lLegRotZ = lerp(0, -0.15, air);       // bent leg angles inward slightly
            p.rLegRotZ = lerp(0, 0.08, air);
            
            p.spinY = gainerSpin;
            p.flipX = gainerFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.46) {
            // ── BEHIND-THE-BACK WHIP RELEASE ──
            // The ball fires from behind the back while the player is facing
            // AWAY from the target. Maximum NBA Street energy. The arm whips
            // from behind-back to a sidearm sling past the hip.
            const t2 = (progress - 0.32) / 0.14;
            const whip = easeOutBack(Math.min(1, t2));
            
            p.bodyY = BY + 0.14 - whip * 0.04;
            p.bodyRotX = -0.05 + whip * 0.18;
            p.bodyRotZ = side * whip * 0.12; // slight lateral twist on release
            p.headRotX = -0.08 + whip * 0.10;
            p.headRotZ = -side * whip * 0.08;
            
            // Right arm WHIPS from behind back → sidearm sling release
            p.rArmRotX = -1.2 + whip * 2.6; // arm swings through from behind
            p.rArmRotZ = 0.65 - whip * 0.85; // from behind-back to side release
            p.rArmPosY = AY + 0.18 - whip * 0.08;
            p.rForearmRotX = -1.0 + whip * 0.9;
            
            // Left arm snaps inward as counterbalance
            p.lArmRotX = -0.5 + whip * 0.2;
            p.lArmRotZ = -1.2 + whip * 0.8;
            p.lArmPosY = AY;
            p.lForearmRotX = -0.2 - whip * 0.3;
            
            // Legs begin transitioning from stag to landing
            p.lLegRotX = lerp(-1.3, -0.2, whip);  // bent leg extends
            p.rLegRotX = lerp(0.25, 0.0, whip);     // straight leg comes forward
            p.lLegRotZ = lerp(-0.15, 0, whip);
            p.rLegRotZ = lerp(0.08, 0, whip);
            
            p.spinY = gainerSpin;
            p.flipX = gainerFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — wide-stance superhero drop ──
            // Lands in a wide power stance with arms spread, like the NBA Street
            // "Gamebreaker" finish. Deeper impact than other styles due to 
            // highest jump height (2.6 units). Fists clench, body compresses hard.
            const t3 = (progress - 0.46) / 0.54;
            const land = easeOutQuad(t3);
            
            const impactCrouch = t3 < 0.25 ? easeOutQuad(t3 / 0.25) : 1.0;
            const recover = t3 < 0.25 ? 0 : easeOutQuad((t3 - 0.25) / 0.75);
            
            // Deep wide-stance compression on impact
            p.bodyY = lerp(BY + 0.10, BY - 0.32, impactCrouch);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0.13, -0.22, impactCrouch);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = lerp(side * 0.12, 0, land);
            p.headRotX = lerp(-0.02, 0.15, impactCrouch);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = lerp(-side * 0.08, 0, land);
            
            // Right arm (threw ball) swings down and out — triumphant spread
            p.rArmRotX = lerp(1.4, 0, land);
            p.rArmRotZ = lerp(-0.20, -0.05, land);
            p.rArmPosY = lerp(AY + 0.10, AY, land);
            p.rForearmRotX = lerp(-0.1, -0.1, land);
            
            // Left arm spreads wide then relaxes — power landing pose
            p.lArmRotX = lerp(-0.3, 0, land);
            p.lArmRotZ = lerp(-0.4, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.5, -0.1, land);
            
            // WIDE stance landing — legs splay further than any other style
            p.lLegRotX = lerp(-0.2, 0.50, impactCrouch);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.0, -0.40, impactCrouch);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(0, -0.18, impactCrouch);  // wider splay than other styles
            p.lLegRotZ = lerp(p.lLegRotZ, 0, recover);
            p.rLegRotZ = lerp(0, 0.18, impactCrouch);
            p.rLegRotZ = lerp(p.rLegRotZ, 0, recover);
            
            // 360° opposite twist (full rotation) resolves to identity (0)
            // But the opposite direction means it started at -2PI*side, fades to 0
            const fadeRate = easeOutQuad(Math.min(1, t3 * 2.5));
            p.spinY = -side * Math.PI * 2 * (1 - fadeRate);
            p.flipX = -Math.PI * 2 * (1 - fadeRate);
            p.flipZ = 0;
            
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        } else if (style === 3) {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 3: CORKSCREW TWIST ═════════════════════════
          // Cartwheel entry → corkscrew spin. 540° Y-spin combined
          // with a full Z-roll (360°). Ball releases mid-spin at apex.
          // Mix of tornado's lateral energy with backflip's twist power.
          // ═══════════════════════════════════════════════════════
          
          // 540° Y-spin (1.5 rotations) — eased over 0→0.58
          let corkscrewSpin;
          if (progress < 0.58) {
            corkscrewSpin = easeInOutCubic(progress / 0.58) * Math.PI * 3 * side; // 540° = 3π
          } else {
            corkscrewSpin = Math.PI * 3 * side; // hold final spin
          }
          p.spinY = corkscrewSpin;
          
          // Full Z-roll (360° cartwheel) — peaks at 0.45, fades out
          let corkscrewRoll;
          if (progress < 0.45) {
            const rollUp = progress / 0.45;
            corkscrewRoll = easeInOutCubic(rollUp) * Math.PI * 2 * side; // full 360°
          } else {
            const rollFade = (progress - 0.45) / 0.55;
            corkscrewRoll = Math.PI * 2 * side * (1 - easeOutQuad(rollFade));
          }
          p.flipZ = corkscrewRoll;
          
          // Slight backward flip component (20% of backflip) for dynamic tilt
          let corkscrewFlip;
          if (progress < 0.50) {
            corkscrewFlip = -easeInOutCubic(progress / 0.50) * Math.PI * 0.4;
          } else {
            corkscrewFlip = -Math.PI * 0.4 * (1 - easeOutQuad((progress - 0.50) / 0.50));
          }
          p.flipX = corkscrewFlip;
          
          // ── CORKSCREW body & limb positions ──
          if (progress < 0.14) {
            // LAUNCH — explode from windup into initial cartwheel
            const t0 = progress / 0.14;
            const launch = easeOutQuad(t0);
            
            p.bodyY = lerp(BY - 0.22, BY + 0.15, launch);
            p.bodyRotX = lerp(-0.20, 0.05, launch);
            p.bodyRotZ = lerp(side * 0.22, 0, launch);
            p.headRotX = lerp(0.14, -0.10, launch);
            p.headRotZ = lerp(-side * 0.12, 0, launch);
            
            // Arms begin to spread wide for corkscrew
            p.rArmRotX = lerp(-2.8, -2.0, launch);
            p.rArmRotZ = lerp(-0.50, -0.75, launch);
            p.rArmPosY = AY + 0.15;
            p.rForearmRotX = lerp(-1.7, -0.5, launch);
            
            p.lArmRotX = lerp(-0.9, -1.5, launch);
            p.lArmRotZ = lerp(0.40, 0.65, launch);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.5, -0.4, launch);
            
            p.lLegRotX = lerp(0.40, -0.1, launch);
            p.rLegRotX = lerp(-0.30, 0, launch);
            p.lLegRotZ = lerp(-0.12, -0.22, launch);
            p.rLegRotZ = lerp(0.12, 0.22, launch);
            
          } else if (progress < 0.42) {
            // CORKSCREW SPIN — arms & legs splay wide, body twisting
            const t1 = (progress - 0.14) / 0.28;
            const twist = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.15;
            p.bodyRotX = 0.05 - twist * 0.10;
            p.bodyRotZ = 0;
            p.headRotX = -0.10;
            p.headRotZ = side * twist * 0.15;
            
            // Arms spread helicopter-wide
            p.rArmRotX = lerp(-2.0, -1.6, twist);
            p.rArmRotZ = lerp(-0.75, -0.95, twist);
            p.rArmPosY = AY + 0.15;
            p.rForearmRotX = -0.5;
            
            p.lArmRotX = lerp(-1.5, -1.3, twist);
            p.lArmRotZ = lerp(0.65, 0.85, twist);
            p.lArmPosY = AY;
            p.lForearmRotX = -0.4;
            
            // Legs splayed wide — corkscrew signature
            p.lLegRotX = -0.1;
            p.rLegRotX = 0;
            p.lLegRotZ = lerp(-0.22, -0.30, twist);
            p.rLegRotZ = lerp(0.22, 0.30, twist);
            
          } else {
            // RECOVERY — begin to stabilize, untwist
            const t2 = (progress - 0.42) / 0.58;
            const recover = easeOutQuad(t2);
            
            p.bodyY = lerp(BY + 0.15, BY - 0.05, recover);
            p.bodyRotX = lerp(-0.05, 0.15, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.10, 0.10, recover);
            p.headRotZ = lerp(side * 0.15, 0, recover);
            
            p.rArmRotX = lerp(-1.6, -0.4, recover);
            p.rArmRotZ = lerp(-0.95, -0.15, recover);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.5, -0.3, recover);
            
            p.lArmRotX = lerp(-1.3, -0.5, recover);
            p.lArmRotZ = lerp(0.85, 0.1, recover);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.4, -0.2, recover);
            
            p.lLegRotX = lerp(-0.1, 0.3, recover);
            p.rLegRotX = lerp(0, -0.25, recover);
            p.lLegRotZ = lerp(-0.30, -0.08, recover);
            p.rLegRotZ = lerp(0.30, 0.08, recover);
          }
          
          p.meshPosY = Math.max(0, jumpHeight);
          p.meshRotZ = 0;
        } else if (style === 1) {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 1: TORNADO CARTWHEEL ═══════════════════════
          // 720° Y-spin + full lateral cartwheel (Z-axis roll)
          // Arms spread wide like a helicopter, legs splayed
          // Absolutely ridiculous. Pure style points.
          // ═══════════════════════════════════════════════════════
          
          // 720° Y-spin (DOUBLE rotation!) — eased over 0→0.55
          let spinProg;
          if (progress < 0.55) {
            spinProg = easeInOutCubic(progress / 0.55);
          } else {
            spinProg = 1.0;
          }
          const tornadoSpin = spinProg * Math.PI * 4 * side; // 720°!
          
          // Full cartwheel Z rotation — one full roll
          let rollProg;
          if (progress < 0.05) {
            rollProg = 0;
          } else if (progress < 0.50) {
            rollProg = easeInOutCubic((progress - 0.05) / 0.45);
          } else {
            rollProg = 1.0;
          }
          const fullRoll = side * rollProg * Math.PI * 2;
          
          if (progress < 0.14) {
            // ── LAUNCH — explosive lateral burst ──
            const t0 = progress / 0.14;
            const launch = easeOutQuad(t0);
            
            p.bodyY = BY - 0.20 + launch * 0.30;
            p.bodyRotX = -0.10 + launch * 0.10;
            p.bodyRotZ = side * 0.25 * (1 - launch);
            p.headRotX = 0.10 - launch * 0.18;
            p.headRotZ = -side * 0.15 * (1 - launch);
            
            // Ball arm stays loaded high
            p.rArmRotX = -2.5 + launch * 0.3;
            p.rArmRotZ = -0.55 - launch * 0.5;
            p.rArmPosY = AY + 0.14;
            p.rForearmRotX = -1.6 + launch * 0.2;
            
            // Left arm starts swinging wide
            p.lArmRotX = -1.0 + launch * 0.5;
            p.lArmRotZ = 0.45 + launch * 0.6;
            p.lArmPosY = AY;
            p.lForearmRotX = -0.4 + launch * 0.2;
            
            // Legs push off laterally
            p.lLegRotX = 0.35 - launch * 0.45;
            p.rLegRotX = -0.25 + launch * 0.15;
            p.lLegRotZ = -0.2 - launch * 0.15;
            p.rLegRotZ = 0.2 + launch * 0.15;
            
            p.spinY = -side * 0.8 + tornadoSpin;
            p.flipX = 0;
            p.flipZ = fullRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.40) {
            // ── AERIAL TORNADO — helicopter arms, legs splayed, spinning ──
            const t1 = (progress - 0.14) / 0.26;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.10;
            p.bodyRotX = 0;
            p.bodyRotZ = 0;
            p.headRotX = -0.05;
            p.headRotZ = 0;
            
            // Arms spread WIDE — helicopter / starfish pose
            p.rArmRotX = lerp(-2.2, -0.3, air);
            p.rArmRotZ = lerp(-1.05, -1.4, air);
            p.rArmPosY = AY + 0.14;
            p.rForearmRotX = lerp(-1.4, -0.15, air);
            
            p.lArmRotX = lerp(-0.5, -0.3, air);
            p.lArmRotZ = lerp(1.05, 1.4, air);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.2, -0.15, air);
            
            // Legs splayed in a wide V — cartwheel straddle
            p.lLegRotX = lerp(-0.1, 0, air);
            p.rLegRotX = lerp(-0.1, 0, air);
            p.lLegRotZ = lerp(-0.35, -0.55, air);
            p.rLegRotZ = lerp(0.35, 0.55, air);
            
            p.spinY = tornadoSpin;
            p.flipX = 0;
            p.flipZ = fullRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.54) {
            // ── WHIP RELEASE — arm snaps from overhead during spin ──
            const t2 = (progress - 0.40) / 0.14;
            const whip = easeOutBack(Math.min(1, t2));
            
            p.bodyY = BY + 0.14 - whip * 0.06;
            p.bodyRotX = whip * 0.15;
            p.bodyRotZ = 0;
            p.headRotX = -0.05 + whip * 0.05;
            p.headRotZ = 0;
            
            // Right arm WHIPS from wide overhead → forward release
            p.rArmRotX = -0.3 + whip * 2.5;
            p.rArmRotZ = -1.4 + whip * 1.2;
            p.rArmPosY = AY + 0.14 - whip * 0.04;
            p.rForearmRotX = -0.15 + whip * 0.1;
            
            // Left arm pulls back for counterbalance
            p.lArmRotX = -0.3 - whip * 0.4;
            p.lArmRotZ = 1.4 - whip * 0.8;
            p.lArmPosY = AY;
            p.lForearmRotX = -0.15 - whip * 0.3;
            
            // Legs come together for landing
            p.lLegRotX = whip * 0.1;
            p.rLegRotX = -whip * 0.1;
            p.lLegRotZ = lerp(-0.55, -0.08, whip);
            p.rLegRotZ = lerp(0.55, 0.08, whip);
            
            p.spinY = tornadoSpin;
            p.flipX = 0;
            p.flipZ = fullRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — tornado winds down (heavy impact!) ──
            const t3 = (progress - 0.54) / 0.46;
            const land = easeOutQuad(t3);
            
            const impactCrouch = t3 < 0.3 ? easeOutQuad(t3 / 0.3) : 1.0;
            const recover = t3 < 0.3 ? 0 : easeOutQuad((t3 - 0.3) / 0.70);
            
            p.bodyY = lerp(BY + 0.10, BY - 0.22, impactCrouch);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0.15, -0.18, impactCrouch);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.03, 0.08, impactCrouch);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(2.2, 0, land);
            p.rArmRotZ = lerp(-0.2, -0.05, land);
            p.rArmPosY = lerp(AY + 0.10, AY, land);
            p.rForearmRotX = lerp(-0.05, -0.1, land);
            
            p.lArmRotX = lerp(-0.7, 0, land);
            p.lArmRotZ = lerp(0.6, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.45, -0.1, land);
            
            p.lLegRotX = lerp(0.1, 0.35, impactCrouch);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(-0.1, -0.30, impactCrouch);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.08, -0.12, impactCrouch);
            p.lLegRotZ = lerp(p.lLegRotZ, 0, recover);
            p.rLegRotZ = lerp(0.08, 0.12, impactCrouch);
            p.rLegRotZ = lerp(p.rLegRotZ, 0, recover);
            
            // 720° spin + cartwheel resolve to 0 (2 full Y + 1 full Z = identity)
            const fadeRate = easeOutQuad(Math.min(1, t3 * 2.5));
            p.spinY = side * Math.PI * 4 * (1 - fadeRate);
            p.flipX = 0;
            p.flipZ = side * Math.PI * 2 * (1 - fadeRate);
            
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        } else if (style === 4) {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 4: SUPERMAN DIVE BOMB ══════════════════════
          // Horizontal dive with arms extended forward (superman pose)
          // Forward flip rotation, ball releases overhead at apex
          // Faster, lower arc — aggressive and dynamic
          // ═══════════════════════════════════════════════════════
          
          // Forward flip (front flip)
          let supermanFlip;
          if (progress < 0.08) {
            supermanFlip = 0;
          } else if (progress < 0.48) {
            supermanFlip = easeInOutCubic((progress - 0.08) / 0.40) * Math.PI * 2;
          } else {
            supermanFlip = Math.PI * 2;
          }
          p.flipX = supermanFlip;
          p.flipZ = 0;
          p.spinY = 0;
          
          if (progress < 0.12) {
            // ── LAUNCH DIVE — explosive forward dive with arms extending ──
            const t0 = progress / 0.12;
            const dive = easeOutQuad(t0);
            
            p.bodyY = lerp(BY - 0.26, BY + 0.12, dive);
            p.bodyRotX = lerp(-0.30, -0.50, dive); // dive angle
            p.bodyRotZ = 0;
            p.headRotX = lerp(0.15, -0.20, dive);
            p.headRotZ = 0;
            
            // Both arms extend forward (superman!)
            p.rArmRotX = lerp(-2.6, -2.2, dive);
            p.rArmRotZ = lerp(0.05, 0.02, dive);
            p.rArmPosY = AY + lerp(0.14, 0.20, dive);
            p.rForearmRotX = lerp(-1.8, -0.15, dive);
            
            p.lArmRotX = lerp(-1.2, -2.2, dive);
            p.lArmRotZ = lerp(-0.10, -0.02, dive);
            p.lArmPosY = AY + lerp(0, 0.20, dive);
            p.lForearmRotX = lerp(-0.8, -0.15, dive);
            
            // Legs extend back straight
            p.lLegRotX = lerp(0.50, 0.75, dive);
            p.rLegRotX = lerp(-0.35, 0.65, dive);
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.45) {
            // ── SUPERMAN AERIAL — full horizontal dive pose rotating forward ──
            const t1 = (progress - 0.12) / 0.33;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.12 - air * 0.04;
            p.bodyRotX = -0.50;
            p.bodyRotZ = 0;
            p.headRotX = -0.20 + air * 0.10;
            p.headRotZ = 0;
            
            // Arms stay extended forward (classic superman)
            p.rArmRotX = -2.2;
            p.rArmRotZ = 0.02;
            p.rArmPosY = AY + 0.20;
            p.rForearmRotX = -0.15;
            
            p.lArmRotX = -2.2;
            p.lArmRotZ = -0.02;
            p.lArmPosY = AY + 0.20;
            p.lForearmRotX = -0.15;
            
            // Legs stay extended back
            p.lLegRotX = 0.75 - air * 0.10;
            p.rLegRotX = 0.65 - air * 0.10;
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── RECOVERY — pull out of dive, arms come down ──
            const t2 = (progress - 0.45) / 0.55;
            const recover = easeOutQuad(t2);
            
            const impactCrouch = t2 < 0.25 ? easeOutQuad(t2 / 0.25) : 1.0;
            const standUp = t2 < 0.25 ? 0 : easeOutQuad((t2 - 0.25) / 0.75);
            
            p.bodyY = lerp(BY + 0.08, BY - 0.18, impactCrouch);
            p.bodyY = lerp(p.bodyY, BY, standUp);
            p.bodyRotX = lerp(-0.50, 0.15, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.10, 0.10, recover);
            p.headRotX = lerp(p.headRotX, 0, standUp);
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(-2.2, 0.2, recover);
            p.rArmRotZ = lerp(0.02, -0.10, recover);
            p.rArmPosY = lerp(AY + 0.20, AY, recover);
            p.rForearmRotX = lerp(-0.15, -0.3, recover);
            
            p.lArmRotX = lerp(-2.2, -0.2, recover);
            p.lArmRotZ = lerp(-0.02, 0.10, recover);
            p.lArmPosY = lerp(AY + 0.20, AY, recover);
            p.lForearmRotX = lerp(-0.15, -0.3, recover);
            
            p.lLegRotX = lerp(0.65, 0.30, impactCrouch);
            p.lLegRotX = lerp(p.lLegRotX, 0, standUp);
            p.rLegRotX = lerp(0.55, -0.25, impactCrouch);
            p.rLegRotX = lerp(p.rLegRotX, 0, standUp);
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            // Unwind the front flip
            const fadeRate = easeOutQuad(Math.min(1, t2 * 2.2));
            p.flipX = Math.PI * 2 * (1 - fadeRate);
            
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        } else if (style === 5) {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 5: WINDMILL HELICOPTER ═════════════════════
          // Full inverted sideways rotation (Z-axis roll) with legs
          // in full splits position — breakdance/gymnastics inspired
          // Arms spread wide for balance, high hangtime
          // Absolutely ridiculous. Maximum style points.
          // ═══════════════════════════════════════════════════════
          
          // Full 360° sideways roll (Z-axis)
          let windmillRoll;
          if (progress < 0.50) {
            windmillRoll = easeInOutCubic(progress / 0.50) * Math.PI * 2 * side;
          } else {
            const fadeRate = (progress - 0.50) / 0.50;
            windmillRoll = Math.PI * 2 * side * (1 - easeOutQuad(fadeRate));
          }
          p.flipZ = windmillRoll;
          
          // Slight backward tilt for dynamics
          let windmillFlip;
          if (progress < 0.45) {
            windmillFlip = -easeInOutCubic(progress / 0.45) * Math.PI * 0.35;
          } else {
            windmillFlip = -Math.PI * 0.35 * (1 - easeOutQuad((progress - 0.45) / 0.55));
          }
          p.flipX = windmillFlip;
          p.spinY = 0;
          
          if (progress < 0.14) {
            // ── LAUNCH — explode upward into windmill ──
            const t0 = progress / 0.14;
            const launch = easeOutQuad(t0);
            
            p.bodyY = lerp(BY - 0.20, BY + 0.18, launch);
            p.bodyRotX = lerp(-0.18, 0.08, launch);
            p.bodyRotZ = lerp(side * 0.18, 0, launch);
            p.headRotX = lerp(0.10, -0.12, launch);
            p.headRotZ = lerp(-side * 0.08, 0, launch);
            
            // Arms begin to spread wide
            p.rArmRotX = lerp(-2.5, -1.8, launch);
            p.rArmRotZ = lerp(-0.55, -0.85, launch);
            p.rArmPosY = AY + 0.14;
            p.rForearmRotX = lerp(-1.5, -0.45, launch);
            
            p.lArmRotX = lerp(-1.0, -1.7, launch);
            p.lArmRotZ = lerp(0.50, 0.80, launch);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.40, launch);
            
            // Legs begin to split
            p.lLegRotX = lerp(0.48, 0.85, launch);
            p.rLegRotX = lerp(-0.38, -0.80, launch);
            p.lLegRotZ = lerp(-0.10, -0.18, launch);
            p.rLegRotZ = lerp(0.10, 0.18, launch);
            
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.48) {
            // ── WINDMILL SPIN — full splits, arms spread, rotating sideways ──
            const t1 = (progress - 0.14) / 0.34;
            const spin = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.18;
            p.bodyRotX = 0.08 - spin * 0.10;
            p.bodyRotZ = 0;
            p.headRotX = -0.12;
            p.headRotZ = side * spin * 0.18;
            
            // Arms spread WIDE (helicopter blades)
            p.rArmRotX = lerp(-1.8, -1.5, spin);
            p.rArmRotZ = lerp(-0.85, -1.0, spin);
            p.rArmPosY = AY + 0.14;
            p.rForearmRotX = -0.45;
            
            p.lArmRotX = lerp(-1.7, -1.4, spin);
            p.lArmRotZ = lerp(0.80, 0.95, spin);
            p.lArmPosY = AY;
            p.lForearmRotX = -0.40;
            
            // FULL SPLITS (signature windmill pose)
            p.lLegRotX = 0.85;
            p.rLegRotX = -0.80;
            p.lLegRotZ = lerp(-0.18, -0.22, spin);
            p.rLegRotZ = lerp(0.18, 0.22, spin);
            
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — windmill resolves, legs close, crouch impact ──
            const t2 = (progress - 0.48) / 0.52;
            const land = easeOutQuad(t2);
            
            const impactCrouch = t2 < 0.30 ? easeOutQuad(t2 / 0.30) : 1.0;
            const standUp = t2 < 0.30 ? 0 : easeOutQuad((t2 - 0.30) / 0.70);
            
            p.bodyY = lerp(BY + 0.18, BY - 0.20, impactCrouch);
            p.bodyY = lerp(p.bodyY, BY, standUp);
            p.bodyRotX = lerp(-0.02, 0.12, impactCrouch);
            p.bodyRotX = lerp(p.bodyRotX, 0, standUp);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.12, 0.08, impactCrouch);
            p.headRotX = lerp(p.headRotX, 0, standUp);
            p.headRotZ = lerp(side * 0.18, 0, land);
            
            // Arms come down from spread
            p.rArmRotX = lerp(-1.5, 0.15, land);
            p.rArmRotZ = lerp(-1.0, -0.12, land);
            p.rArmPosY = lerp(AY + 0.14, AY, land);
            p.rForearmRotX = lerp(-0.45, -0.35, land);
            
            p.lArmRotX = lerp(-1.4, -0.15, land);
            p.lArmRotZ = lerp(0.95, 0.12, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.40, -0.35, land);
            
            // Legs close from splits
            p.lLegRotX = lerp(0.85, 0.32, impactCrouch);
            p.lLegRotX = lerp(p.lLegRotX, 0, standUp);
            p.rLegRotX = lerp(-0.80, -0.28, impactCrouch);
            p.rLegRotX = lerp(p.rLegRotX, 0, standUp);
            p.lLegRotZ = lerp(-0.22, -0.10, impactCrouch);
            p.lLegRotZ = lerp(p.lLegRotZ, 0, standUp);
            p.rLegRotZ = lerp(0.22, 0.10, impactCrouch);
            p.rLegRotZ = lerp(p.rLegRotZ, 0, standUp);
            
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        } else {
          // ═══════════════════════════════════════════════════════
          // ═══ STYLE 0: BACKFLIP + 360 TWIST (original) ════════
          // ═══════════════════════════════════════════════════════
          
          // 360 Y-spin
          let spinProgress;
          if (progress < 0.52) {
            spinProgress = easeInOutCubic(progress / 0.52);
          } else {
            spinProgress = 1.0;
          }
          const fullSpin = spinProgress * Math.PI * 2 * side;
          
          // Backflip X rotation
          let flipProgress;
          if (progress < 0.06) {
            flipProgress = 0;
          } else if (progress < 0.52) {
            flipProgress = easeInOutCubic((progress - 0.06) / 0.46);
          } else {
            flipProgress = 1.0;
          }
          const fullFlip = -flipProgress * Math.PI * 2;
          
          if (progress < 0.12) {
            const t0 = progress / 0.12;
            const launch = easeOutQuad(t0);
            
            p.bodyY = BY - 0.22 + launch * 0.35;
            p.bodyRotX = -0.25 + launch * 0.20;
            p.bodyRotZ = side * 0.1 * (1 - launch);
            p.headRotX = 0.12 - launch * 0.17;
            p.headRotZ = -side * 0.1 * (1 - launch);
            
            p.rArmRotX = -2.8 + launch * 0.2;
            p.rArmRotZ = -0.35;
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = -1.8 + launch * 0.1;
            
            p.lArmRotX = -0.8 + launch * 0.3;
            p.lArmRotZ = -0.2 - launch * 0.15;
            p.lArmPosY = AY;
            p.lForearmRotX = -0.6;
            
            p.lLegRotX = 0.45 - launch * 0.6;
            p.rLegRotX = -0.3 + launch * 0.2;
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.spinY = -side * 0.6 + fullSpin;
            p.flipX = fullFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.38) {
            const t1 = (progress - 0.12) / 0.26;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.08;
            p.bodyRotX = 0;
            p.bodyRotZ = 0;
            p.headRotX = -0.1;
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(-2.6, -1.8, air);
            p.rArmRotZ = -0.35 + air * 0.10;
            p.rArmPosY = AY + 0.16;
            p.rForearmRotX = lerp(-1.7, -1.3, air);
            
            p.lArmRotX = lerp(-0.5, -0.8, air);
            p.lArmRotZ = lerp(-0.35, 0.15, air);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -1.2, air);
            
            p.lLegRotX = lerp(-0.15, -0.7, air);
            p.rLegRotX = lerp(-0.1, -0.5, air);
            p.lLegRotZ = -air * 0.06;
            p.rLegRotZ = air * 0.05;
            
            p.spinY = fullSpin;
            p.flipX = fullFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.52) {
            const t2 = (progress - 0.38) / 0.14;
            const whip = easeOutBack(Math.min(1, t2));
            
            p.bodyY = BY + 0.14 - whip * 0.06;
            p.bodyRotX = whip * 0.20;
            p.bodyRotZ = -side * whip * 0.10;
            p.headRotX = -0.1 + whip * 0.05;
            p.headRotZ = 0;
            
            p.rArmRotX = -1.8 + whip * 3.0;
            p.rArmRotZ = -0.25 + whip * 0.20;
            p.rArmPosY = AY + 0.16 - whip * 0.04;
            p.rForearmRotX = -1.3 + whip * 1.2;
            
            p.lArmRotX = -0.8 + whip * 0.5;
            p.lArmRotZ = 0.15 + whip * 0.20;
            p.lArmPosY = AY;
            p.lForearmRotX = -1.2 + whip * 0.6;
            
            p.lLegRotX = -0.7 + whip * 0.55;
            p.rLegRotX = -0.5 + whip * 0.45;
            p.lLegRotZ = lerp(-0.06, 0, whip);
            p.rLegRotZ = lerp(0.05, 0, whip);
            
            p.spinY = fullSpin;
            p.flipX = fullFlip;
            p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — heavy impact from height ──
            const t3 = (progress - 0.52) / 0.48;
            const land = easeOutQuad(t3);
            
            const impactCrouch = t3 < 0.3 ? easeOutQuad(t3 / 0.3) : 1.0;
            const recover = t3 < 0.3 ? 0 : easeOutQuad((t3 - 0.3) / 0.70);
            
            p.bodyY = lerp(BY + 0.08, BY - 0.20, impactCrouch);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0.20, -0.16, impactCrouch);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = lerp(-side * 0.10, 0, land);
            p.headRotX = lerp(-0.05, 0.08, impactCrouch);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(1.2, 0, land);
            p.rArmRotZ = lerp(-0.05, -0.05, land);
            p.rArmPosY = lerp(AY + 0.12, AY, land);
            p.rForearmRotX = lerp(-0.1, -0.1, land);
            
            p.lArmRotX = lerp(-0.3, 0, land);
            p.lArmRotZ = lerp(0.35, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.6, -0.1, land);
            
            p.lLegRotX = lerp(-0.15, 0.35, impactCrouch);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(-0.05, -0.30, impactCrouch);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(0, -0.08, impactCrouch);
            p.lLegRotZ = lerp(p.lLegRotZ, 0, recover);
            p.rLegRotZ = lerp(0, 0.08, impactCrouch);
            p.rLegRotZ = lerp(p.rLegRotZ, 0, recover);
            
            const fadeRate = easeOutQuad(Math.min(1, t3 * 2.5));
            p.spinY = side * Math.PI * 2 * (1 - fadeRate);
            p.flipX = -Math.PI * 2 * (1 - fadeRate);
            p.flipZ = 0;
            
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        }
        break;
      }
      // ═══════════════════════════════════════════════════════════
      // ═══ PARKOUR DODGE — 8 insane styles, randomized ══════
      // Each dodge is a full-body acrobatic evasion with unique
      // silhouette: webster, kong vault, butterfly kick, aerial spin
      // ═══════════════════════════════════════════════════════════
      case ANIM.DODGE: {
        const dur = CONFIG.DODGE_DURATION;
        const progress = Math.min(1, st / dur);
        const dStyle = this.dodgeStyle;
        const peakH = CONFIG.DODGE_PEAK_HEIGHT;
        
        // Shared jump arc for all styles
        let jumpHeight;
        if (progress < 0.45) {
          jumpHeight = Math.sin((progress / 0.45) * Math.PI) * peakH;
        } else {
          const down = (progress - 0.45) / 0.55;
          jumpHeight = Math.cos(down * Math.PI * 0.5) * (peakH * 0.4);
          jumpHeight = Math.max(0, jumpHeight);
        }
        
        if (dStyle === 0) {
          // ═══ WEBSTER — one-handed front flip cartwheel ════════
          // Parkour's flashiest ground move. Plant one hand, body whips
          // over in a sideways front flip. Legs split wide in a straddle
          // at the peak. The free arm reaches for the sky.
          
          // Full forward flip rotation
          const flipProg = progress < 0.1 ? 0 : progress < 0.55
            ? easeInOutCubic((progress - 0.1) / 0.45)
            : 1.0;
          const websterFlip = -flipProg * Math.PI * 2;
          
          // Lateral roll (slight)
          const rollProg = easeInOutCubic(Math.min(1, progress / 0.6));
          const lateralRoll = side * rollProg * Math.PI * 0.35;
          
          if (progress < 0.15) {
            // ── PLANT — one hand reaches down, body coils ──
            const t0 = progress / 0.15;
            const plant = easeOutQuad(t0);
            
            p.bodyY = BY - plant * 0.30;
            p.bodyRotX = -plant * 0.5;  // deep forward lean
            p.bodyRotZ = side * plant * 0.3;
            p.headRotX = plant * 0.2;
            p.headRotZ = -side * plant * 0.15;
            
            // Plant arm (right) reaches toward ground
            p.rArmRotX = lerp(0, 1.8, plant);    // arm swings down
            p.rArmRotZ = lerp(-0.05, -side * 0.4, plant);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, 0.2, plant);
            
            // Free arm (left) swings back for momentum
            p.lArmRotX = lerp(0, -2.0, plant);
            p.lArmRotZ = lerp(0.05, -side * 0.6, plant);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.8, plant);
            
            // Legs load for launch
            p.lLegRotX = plant * 0.6;
            p.rLegRotX = -plant * 0.3;
            p.lLegRotZ = 0; p.rLegRotZ = 0;
            
            p.spinY = 0; p.flipX = websterFlip; p.flipZ = lateralRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.50) {
            // ── AERIAL STRADDLE — legs split wide, body inverted ──
            const t1 = (progress - 0.15) / 0.35;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.08;
            p.bodyRotX = 0;
            p.bodyRotZ = 0;
            p.headRotX = -0.05;
            p.headRotZ = 0;
            
            // Plant arm tucks in, free arm extends wide
            p.rArmRotX = lerp(1.8, 0.3, air);
            p.rArmRotZ = lerp(-side * 0.4, -0.2, air);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(0.2, -0.3, air);
            
            p.lArmRotX = lerp(-2.0, -0.5, air);
            p.lArmRotZ = lerp(-side * 0.6, -1.3, air);  // extended wide!
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.8, -0.1, air);
            
            // STRADDLE split legs — max separation at peak
            p.lLegRotX = lerp(0.6, -0.2, air);
            p.rLegRotX = lerp(-0.3, 0.1, air);
            p.lLegRotZ = lerp(0, -0.5, air);    // legs split laterally
            p.rLegRotZ = lerp(0, 0.5, air);
            
            p.spinY = 0; p.flipX = websterFlip; p.flipZ = lateralRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — legs snap together, arms out for balance ──
            const t2 = (progress - 0.50) / 0.50;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.3 ? easeOutQuad(t2 / 0.3) : 1.0;
            const recover = t2 < 0.3 ? 0 : easeOutQuad((t2 - 0.3) / 0.7);
            
            p.bodyY = lerp(BY + 0.06, BY - 0.18, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0, -0.12, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.05, 0.06, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(0.3, 0, land);
            p.rArmRotZ = lerp(-0.2, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.3, -0.1, land);
            
            p.lArmRotX = lerp(-0.5, 0, land);
            p.lArmRotZ = lerp(-1.3, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.1, land);
            
            p.lLegRotX = lerp(-0.2, 0.3, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.1, -0.25, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.5, 0, land);
            p.rLegRotZ = lerp(0.5, 0, land);
            
            const fadeSpin = easeOutQuad(Math.min(1, t2 * 2.5));
            p.spinY = 0;
            p.flipX = -Math.PI * 2 * (1 - fadeSpin);
            p.flipZ = side * Math.PI * 0.35 * (1 - fadeSpin);
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 1) {
          // ═══ KONG VAULT — dive forward, tuck, roll through ══════
          // Classic parkour vault. Body launches horizontally like Superman,
          // tucks into a tight ball at peak, then opens into a rolling
          // recovery. Hands-free — pure momentum and body control.
          
          // Forward tumble rotation (1.5 rotations — over-rotating for drama)
          const tumbleProg = progress < 0.08 ? 0 : progress < 0.58
            ? easeInOutCubic((progress - 0.08) / 0.50)
            : 1.0;
          const kongFlip = -tumbleProg * Math.PI * 3; // 1.5 full rotations!
          
          if (progress < 0.18) {
            // ── LAUNCH — explosive horizontal dive ──
            const t0 = progress / 0.18;
            const dive = easeOutQuad(t0);
            
            p.bodyY = BY - 0.10 + dive * 0.15;
            p.bodyRotX = -dive * 0.7;  // extreme forward lean — almost horizontal
            p.bodyRotZ = 0;
            p.headRotX = dive * 0.3;
            p.headRotZ = 0;
            
            // Arms reach forward like Superman
            p.rArmRotX = lerp(0, -2.8, dive);
            p.rArmRotZ = lerp(-0.05, -0.15, dive);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -0.1, dive);
            
            p.lArmRotX = lerp(0, -2.8, dive);
            p.lArmRotZ = lerp(0.05, 0.15, dive);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.1, dive);
            
            // Legs extend back — full streamlined body
            p.lLegRotX = lerp(0, 0.4, dive);
            p.rLegRotX = lerp(0, 0.4, dive);
            p.lLegRotZ = 0; p.rLegRotZ = 0;
            
            p.spinY = 0; p.flipX = kongFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.48) {
            // ── TUCK — body balls up tight, spinning fast ──
            const t1 = (progress - 0.18) / 0.30;
            const tuck = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.04;
            p.bodyRotX = 0;
            p.bodyRotZ = 0;
            p.headRotX = tuck * 0.25;  // chin tucked
            p.headRotZ = 0;
            
            // Arms hug knees — full tuck position
            p.rArmRotX = lerp(-2.8, 0.4, tuck);
            p.rArmRotZ = -0.15;
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -1.8, tuck);  // forearms wrap around legs
            
            p.lArmRotX = lerp(-2.8, 0.4, tuck);
            p.lArmRotZ = 0.15;
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -1.8, tuck);
            
            // Knees pull up to chest
            p.lLegRotX = lerp(0.4, -1.4, tuck);
            p.rLegRotX = lerp(0.4, -1.4, tuck);
            p.lLegRotZ = lerp(0, -0.06, tuck);
            p.rLegRotZ = lerp(0, 0.06, tuck);
            
            p.spinY = 0; p.flipX = kongFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── UNWIND + LANDING — open out, feet down, arms spread ──
            const t2 = (progress - 0.48) / 0.52;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.25 ? easeOutQuad(t2 / 0.25) : 1.0;
            const recover = t2 < 0.25 ? 0 : easeOutQuad((t2 - 0.25) / 0.75);
            
            p.bodyY = lerp(BY + 0.02, BY - 0.22, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0, -0.18, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(0.25, 0, land);
            p.headRotZ = 0;
            
            // Arms spread wide — victory pose from the roll
            p.rArmRotX = lerp(0.4, 0, land);
            p.rArmRotZ = lerp(-0.15, -0.6, impact);
            p.rArmRotZ = lerp(p.rArmRotZ, -0.05, recover);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-1.8, -0.1, land);
            
            p.lArmRotX = lerp(0.4, 0, land);
            p.lArmRotZ = lerp(0.15, 0.6, impact);
            p.lArmRotZ = lerp(p.lArmRotZ, 0.05, recover);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-1.8, -0.1, land);
            
            // Legs extend down, deep crouch on impact
            p.lLegRotX = lerp(-1.4, 0.35, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(-1.4, -0.30, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.06, -0.10, impact);
            p.lLegRotZ = lerp(p.lLegRotZ, 0, recover);
            p.rLegRotZ = lerp(0.06, 0.10, impact);
            p.rLegRotZ = lerp(p.rLegRotZ, 0, recover);
            
            const fadeSpin = easeOutQuad(Math.min(1, t2 * 2.5));
            p.spinY = 0;
            p.flipX = -Math.PI * 3 * (1 - fadeSpin);
            p.flipZ = 0;
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 2) {
          // ═══ BUTTERFLY KICK — horizontal spinning aerial ══════
          // Wushu/tricking classic. Body goes nearly horizontal with
          // legs whipping in a wide circular arc. 720° Y-spin with
          // the body tilted sideways. Maximum visual spectacle.
          
          // 720° Y-spin (double rotation)
          const spinProg = progress < 0.55
            ? easeInOutCubic(progress / 0.55)
            : 1.0;
          const bfSpin = spinProg * Math.PI * 4 * side; // 720°!
          
          if (progress < 0.15) {
            // ── WIND UP — body tilts sideways, leg sweeps ──
            const t0 = progress / 0.15;
            const coil = easeOutQuad(t0);
            
            p.bodyY = BY - coil * 0.15;
            p.bodyRotX = -coil * 0.2;
            p.bodyRotZ = side * coil * 0.6;  // extreme lateral tilt
            p.headRotX = coil * 0.1;
            p.headRotZ = -side * coil * 0.2;
            
            // Arms swing wide for momentum
            p.rArmRotX = -coil * 1.2;
            p.rArmRotZ = -0.05 - coil * 0.8;
            p.rArmPosY = AY;
            p.rForearmRotX = -coil * 0.3;
            
            p.lArmRotX = -coil * 1.2;
            p.lArmRotZ = 0.05 + coil * 0.8;
            p.lArmPosY = AY;
            p.lForearmRotX = -coil * 0.3;
            
            // Lead leg sweeps up to initiate rotation
            p.lLegRotX = coil * 0.5;
            p.rLegRotX = -coil * 0.8;  // sweeping leg
            p.lLegRotZ = 0;
            p.rLegRotZ = coil * 0.3;
            
            p.spinY = bfSpin; p.flipX = 0; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.50) {
            // ── HORIZONTAL SPIN — body nearly flat, legs whipping ──
            const t1 = (progress - 0.15) / 0.35;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.06;
            p.bodyRotX = 0;
            p.bodyRotZ = side * 0.8;  // extremely tilted — almost horizontal!
            p.headRotX = 0;
            p.headRotZ = -side * 0.3;
            
            // Arms extended like helicopter blades
            p.rArmRotX = lerp(-1.2, -0.4, air);
            p.rArmRotZ = lerp(-0.85, -1.4, air);
            p.rArmPosY = AY;
            p.rForearmRotX = -0.15;
            
            p.lArmRotX = lerp(-1.2, -0.4, air);
            p.lArmRotZ = lerp(0.85, 1.4, air);
            p.lArmPosY = AY;
            p.lForearmRotX = -0.15;
            
            // Legs in wide circular sweep — the defining butterfly shape
            const legPhase = air * Math.PI;
            p.lLegRotX = Math.sin(legPhase) * 0.5;
            p.rLegRotX = -Math.sin(legPhase) * 0.5;
            p.lLegRotZ = -0.3 - Math.cos(legPhase) * 0.25;
            p.rLegRotZ = 0.3 + Math.cos(legPhase) * 0.25;
            
            p.spinY = bfSpin; p.flipX = 0; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — uncoil from horizontal ──
            const t2 = (progress - 0.50) / 0.50;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.25 ? easeOutQuad(t2 / 0.25) : 1.0;
            const recover = t2 < 0.25 ? 0 : easeOutQuad((t2 - 0.25) / 0.75);
            
            p.bodyY = lerp(BY + 0.04, BY - 0.16, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0, -0.12, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = lerp(side * 0.8, 0, land);
            p.headRotX = lerp(0, 0.05, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = lerp(-side * 0.3, 0, land);
            
            p.rArmRotX = lerp(-0.4, 0, land);
            p.rArmRotZ = lerp(-1.4, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.15, -0.1, land);
            
            p.lArmRotX = lerp(-0.4, 0, land);
            p.lArmRotZ = lerp(1.4, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.15, -0.1, land);
            
            p.lLegRotX = lerp(0, 0.25, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0, -0.20, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.3, 0, land);
            p.rLegRotZ = lerp(0.3, 0, land);
            
            const fadeSpin = easeOutQuad(Math.min(1, t2 * 2.5));
            p.spinY = side * Math.PI * 4 * (1 - fadeSpin);
            p.flipX = 0;
            p.flipZ = 0;
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 3) {
          // ═══ AERIAL SPIN — vertical 360 with legs whipping ═══
          // Breakdance/parkour hybrid. Vertical spin with the body
          // going upside-down. Legs swing in a massive arc like
          // a compass. Most dramatic silhouette of all dodges.
          
          // 360° Z-roll (full lateral cartwheel rotation)
          const rollProg = progress < 0.08 ? 0 : progress < 0.55
            ? easeInOutCubic((progress - 0.08) / 0.47)
            : 1.0;
          const wallRoll = side * rollProg * Math.PI * 2;
          
          // 180° Y-spin (half turn — end up facing opposite)
          const yProg = easeInOutCubic(Math.min(1, progress / 0.55));
          const wallYSpin = yProg * Math.PI * side;
          
          if (progress < 0.15) {
            // ── COIL — lateral lean, arms load ──
            const t0 = progress / 0.15;
            const coil = easeOutQuad(t0);
            
            p.bodyY = BY - coil * 0.20;
            p.bodyRotX = -coil * 0.1;
            p.bodyRotZ = side * coil * 0.4;
            p.headRotX = coil * 0.08;
            p.headRotZ = -side * coil * 0.15;
            
            p.rArmRotX = -coil * 1.5;
            p.rArmRotZ = -0.05 - coil * 0.3;
            p.rArmPosY = AY;
            p.rForearmRotX = -coil * 0.5;
            
            p.lArmRotX = -coil * 1.5;
            p.lArmRotZ = 0.05 + coil * 0.3;
            p.lArmPosY = AY;
            p.lForearmRotX = -coil * 0.5;
            
            p.lLegRotX = coil * 0.4;
            p.rLegRotX = -coil * 0.3;
            p.lLegRotZ = -coil * 0.15;
            p.rLegRotZ = coil * 0.15;
            
            p.spinY = wallYSpin; p.flipX = 0; p.flipZ = wallRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.50) {
            // ── AERIAL — inverted with legs in massive arc ──
            const t1 = (progress - 0.15) / 0.35;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.08;
            p.bodyRotX = 0;
            p.bodyRotZ = 0;
            p.headRotX = 0;
            p.headRotZ = 0;
            
            // Arms spread like a pinwheel
            p.rArmRotX = lerp(-1.5, -0.2, air);
            p.rArmRotZ = lerp(-0.35, -1.5, air);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.5, -0.1, air);
            
            p.lArmRotX = lerp(-1.5, -0.2, air);
            p.lArmRotZ = lerp(0.35, 1.5, air);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.5, -0.1, air);
            
            // Legs whip in opposite directions — compass effect
            p.lLegRotX = lerp(0.4, -0.3, air);
            p.rLegRotX = lerp(-0.3, 0.3, air);
            p.lLegRotZ = lerp(-0.15, -0.45, air);
            p.rLegRotZ = lerp(0.15, 0.45, air);
            
            p.spinY = wallYSpin; p.flipX = 0; p.flipZ = wallRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — snap upright from vertical spin ──
            const t2 = (progress - 0.50) / 0.50;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.25 ? easeOutQuad(t2 / 0.25) : 1.0;
            const recover = t2 < 0.25 ? 0 : easeOutQuad((t2 - 0.25) / 0.75);
            
            p.bodyY = lerp(BY + 0.06, BY - 0.20, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0, -0.15, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(0, 0.06, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            p.rArmRotX = lerp(-0.2, 0, land);
            p.rArmRotZ = lerp(-1.5, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -0.1, land);
            
            p.lArmRotX = lerp(-0.2, 0, land);
            p.lArmRotZ = lerp(1.5, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.1, land);
            
            p.lLegRotX = lerp(-0.3, 0.30, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.3, -0.25, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.45, 0, land);
            p.rLegRotZ = lerp(0.45, 0, land);
            
            const fadeSpin = easeOutQuad(Math.min(1, t2 * 2.5));
            p.spinY = side * Math.PI * (1 - fadeSpin);
            p.flipX = 0;
            p.flipZ = side * Math.PI * 2 * (1 - fadeSpin);
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 4) {
          // ═══ GAINER — backflip with forward momentum ═══
          // The paradox flip. Body launches FORWARD but flips BACKWARD.
          // The "gainer" in parkour launches forward but flips backward — the body
          // explodes into the air with forward momentum while rotating in reverse.
          // Peak has arms reaching skyward, body arched like a crescent moon.
          // Lands facing original direction after full 360° backward rotation.
          
          // Full backward flip rotation (360°)
          const gainerFlip = progress < 0.12 ? 0 : progress < 0.60
            ? easeInOutCubic((progress - 0.12) / 0.48)
            : 1.0;
          const backFlip = gainerFlip * Math.PI * 2; // backward rotation
          
          if (progress < 0.18) {
            // ── EXPLOSIVE LAUNCH — knees load, arms swing back ──
            const t0 = progress / 0.18;
            const launch = easeOutQuad(t0);
            
            p.bodyY = BY - launch * 0.35; // deep crouch
            p.bodyRotX = -launch * 0.6;   // lean forward for power
            p.bodyRotZ = 0;
            p.headRotX = launch * 0.3;    // look up
            p.headRotZ = 0;
            
            // Arms swing back for momentum
            p.rArmRotX = lerp(0, -2.2, launch); // way back
            p.rArmRotZ = -0.05 - launch * 0.2;
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -1.0, launch);
            
            p.lArmRotX = lerp(0, -2.2, launch);
            p.lArmRotZ = 0.05 + launch * 0.2;
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -1.0, launch);
            
            // Legs coiled tight
            p.lLegRotX = launch * 0.8;
            p.rLegRotX = -launch * 0.8;
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.spinY = 0; p.flipX = backFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.52) {
            // ── PEAK — arched back, arms reaching skyward, inverted ──
            const t1 = (progress - 0.18) / 0.34;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.12; // extended upward
            p.bodyRotX = lerp(-0.6, 0.4, air); // arch backward
            p.bodyRotZ = 0;
            p.headRotX = lerp(0.3, -0.3, air); // head back
            p.headRotZ = 0;
            
            // Arms reach for sky then tuck
            p.rArmRotX = lerp(-2.2, -0.4, air);
            p.rArmRotZ = lerp(-0.25, -0.1, air);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-1.0, -0.2, air);
            
            p.lArmRotX = lerp(-2.2, -0.4, air);
            p.lArmRotZ = lerp(0.25, 0.1, air);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-1.0, -0.2, air);
            
            // Legs tuck then extend
            p.lLegRotX = lerp(0.8, -0.4, air);
            p.rLegRotX = lerp(-0.8, 0.4, air);
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            p.spinY = 0; p.flipX = backFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — snap down, arms out for balance ──
            const t2 = (progress - 0.52) / 0.48;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.35 ? easeOutQuad(t2 / 0.35) : 1.0;
            const recover = t2 < 0.35 ? 0 : easeOutQuad((t2 - 0.35) / 0.65);
            
            p.bodyY = lerp(BY + 0.08, BY - 0.22, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0.4, -0.18, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.3, 0.08, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            // Arms spread wide for balance
            p.rArmRotX = lerp(-0.4, 0.2, land);
            p.rArmRotZ = lerp(-0.1, -0.6, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.2, -0.1, land);
            
            p.lArmRotX = lerp(-0.4, 0.2, land);
            p.lArmRotZ = lerp(0.1, 0.6, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.2, -0.1, land);
            
            p.lLegRotX = lerp(-0.4, 0.35, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.4, -0.30, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = 0;
            p.rLegRotZ = 0;
            
            const fadeFlip = easeOutQuad(Math.min(1, t2 * 2.2));
            p.spinY = 0;
            p.flipX = Math.PI * 2 * (1 - fadeFlip);
            p.flipZ = 0;
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 5) {
          // ═══ CORKSCREW — diagonal barrel roll with asymmetric twist ═══
          // The fighter jet maneuver. Body rotates on a diagonal axis,
          // creating a spiraling corkscrew motion. One arm reaches high,
          // the other tucks low, legs scissor asymmetrically. This asymmetric
          // shape is instantly recognizable from parkour. The rotation is
          // on a tilted axis — not pure X, Y, or Z, but a diagonal vector.
          
          // Combined rotation: 360° roll + 180° twist
          const screwProg = progress < 0.10 ? 0 : progress < 0.58
            ? easeInOutCubic((progress - 0.10) / 0.48)
            : 1.0;
          const screwRoll = screwProg * Math.PI * 2; // Z-axis barrel roll
          const screwTwist = screwProg * Math.PI * side; // Y-axis twist
          const screwTilt = screwProg * Math.PI * 0.6 * side; // X-axis tilt
          
          if (progress < 0.16) {
            // ── WIND-UP — asymmetric coil, one shoulder drops ──
            const t0 = progress / 0.16;
            const coil = easeOutQuad(t0);
            
            p.bodyY = BY - coil * 0.25;
            p.bodyRotX = -coil * 0.3;
            p.bodyRotZ = side * coil * 0.5; // shoulder drop
            p.headRotX = coil * 0.15;
            p.headRotZ = -side * coil * 0.2;
            
            // Asymmetric arm positions — high/low split
            p.rArmRotX = lerp(0, -1.8, coil);  // high arm
            p.rArmRotZ = lerp(-0.05, -0.6, coil);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -0.6, coil);
            
            p.lArmRotX = lerp(0, 0.8, coil);   // low arm
            p.lArmRotZ = lerp(0.05, 0.5, coil);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, 0.3, coil);
            
            // Legs prepare for scissor
            p.lLegRotX = coil * 0.6;
            p.rLegRotX = -coil * 0.4;
            p.lLegRotZ = -coil * 0.2;
            p.rLegRotZ = coil * 0.2;
            
            p.spinY = screwTwist; p.flipX = screwTilt; p.flipZ = screwRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.50) {
            // ── CORKSCREW — full diagonal rotation, limbs asymmetric ──
            const t1 = (progress - 0.16) / 0.34;
            const air = easeInOutCubic(t1);
            
            p.bodyY = BY + 0.10;
            p.bodyRotX = 0;
            p.bodyRotZ = side * lerp(0.5, -0.3, air); // rolling
            p.headRotX = 0;
            p.headRotZ = -side * lerp(0.2, 0.1, air);
            
            // Asymmetric spiral — high arm extends, low arm tucks
            p.rArmRotX = lerp(-1.8, -0.3, air);
            p.rArmRotZ = lerp(-0.6, -1.6, air); // reaching wide
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.6, -0.15, air);
            
            p.lArmRotX = lerp(0.8, -0.5, air);
            p.lArmRotZ = lerp(0.5, 0.8, air);  // tucked
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(0.3, -0.2, air);
            
            // Scissor kick — legs in opposite diagonal positions
            p.lLegRotX = lerp(0.6, -0.5, air);
            p.rLegRotX = lerp(-0.4, 0.4, air);
            p.lLegRotZ = lerp(-0.2, -0.5, air);
            p.rLegRotZ = lerp(0.2, 0.5, air);
            
            p.spinY = screwTwist; p.flipX = screwTilt; p.flipZ = screwRoll;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — unwind from spiral, stabilize ──
            const t2 = (progress - 0.50) / 0.50;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.30 ? easeOutQuad(t2 / 0.30) : 1.0;
            const recover = t2 < 0.30 ? 0 : easeOutQuad((t2 - 0.30) / 0.70);
            
            p.bodyY = lerp(BY + 0.06, BY - 0.20, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0, -0.14, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = lerp(-side * 0.3, 0, land);
            p.headRotX = lerp(0, 0.07, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = lerp(-side * 0.1, 0, land);
            
            // Arms return to neutral
            p.rArmRotX = lerp(-0.3, 0, land);
            p.rArmRotZ = lerp(-1.6, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.15, -0.1, land);
            
            p.lArmRotX = lerp(-0.5, 0, land);
            p.lArmRotZ = lerp(0.8, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.2, -0.1, land);
            
            p.lLegRotX = lerp(-0.5, 0.32, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.4, -0.28, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.5, 0, land);
            p.rLegRotZ = lerp(0.5, 0, land);
            
            const fadeRotations = easeOutQuad(Math.min(1, t2 * 2.3));
            p.spinY = side * Math.PI * (1 - fadeRotations);
            p.flipX = side * Math.PI * 0.6 * (1 - fadeRotations);
            p.flipZ = Math.PI * 2 * (1 - fadeRotations);
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 6) {
          // ═══ CHEAT GAINER — lateral wind-up into spinning backflip ═══
          // The explosive hybrid. Body winds up with a lateral "cheat" step,
          // plants outside leg, then launches into a full backflip WITH a
          // 180° twist. Combines the gainer's backward rotation with a
          // side-entry that creates natural spin. One arm swings across
          // body for torque, other arm trails. Peak has body fully inverted
          // in a tight arch. The "cheat" makes it faster and more explosive
          // than a standard gainer.
          
          // 360° backward flip + 180° twist
          const cheatFlipProg = progress < 0.12 ? 0 : progress < 0.62
            ? easeInOutCubic((progress - 0.12) / 0.50)
            : 1.0;
          const backFlip = cheatFlipProg * Math.PI * 2; // backward rotation
          const cheatTwist = cheatFlipProg * Math.PI * side; // 180° twist
          
          if (progress < 0.18) {
            // ── CHEAT STEP — lateral wind-up, outside leg plants ──
            const t0 = progress / 0.18;
            const cheat = easeOutQuad(t0);
            
            p.bodyY = BY - cheat * 0.28;
            p.bodyRotX = -cheat * 0.3;  // lean forward
            p.bodyRotZ = -side * cheat * 0.6; // big lateral lean (away from twist direction)
            p.headRotX = cheat * 0.2;
            p.headRotZ = side * cheat * 0.25;
            
            // Lead arm swings ACROSS body for torque
            p.rArmRotX = lerp(0, -1.6, cheat);
            p.rArmRotZ = lerp(-0.05, side * 0.8, cheat);  // crosses body
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -0.5, cheat);
            
            // Trail arm sweeps back
            p.lArmRotX = lerp(0, -2.2, cheat);
            p.lArmRotZ = lerp(0.05, -side * 0.5, cheat);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.8, cheat);
            
            // Outside leg plants, inside leg cocks back
            p.lLegRotX = lerp(0, side > 0 ? 0.7 : -0.3, cheat);
            p.rLegRotX = lerp(0, side > 0 ? -0.3 : 0.7, cheat);
            p.lLegRotZ = lerp(0, -0.3, cheat);
            p.rLegRotZ = lerp(0, 0.3, cheat);
            
            p.spinY = cheatTwist; p.flipX = backFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.55) {
            // ── AERIAL — full backward flip with twist, tight arch at peak ──
            const t1 = (progress - 0.18) / 0.37;
            const air = easeInOutCubic(t1);
            
            // At peak (t1 ~= 0.5), body is fully inverted and arched
            const archAmount = Math.sin(t1 * Math.PI); // peaks at middle
            
            p.bodyY = BY + 0.12 - archAmount * 0.08;  // arched back dip
            p.bodyRotX = -archAmount * 0.3;  // back arch
            p.bodyRotZ = lerp(-side * 0.6, side * 0.2, air);
            p.headRotX = -archAmount * 0.25;  // head thrown back
            p.headRotZ = lerp(side * 0.25, 0, air);
            
            // Arms reach back overhead at peak, then come forward
            const armReach = Math.sin(t1 * Math.PI) * 2.0;
            p.rArmRotX = lerp(-1.6, -armReach, air);
            p.rArmRotZ = lerp(side * 0.8, -side * 0.4, air);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.5, -0.2, air);
            
            p.lArmRotX = lerp(-2.2, -armReach, air);
            p.lArmRotZ = lerp(-side * 0.5, side * 0.4, air);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.8, -0.2, air);
            
            // Legs whip through - tucked at start, extend at peak, prepare for landing
            p.lLegRotX = lerp(side > 0 ? 0.7 : -0.3, 0.4, air);
            p.rLegRotX = lerp(side > 0 ? -0.3 : 0.7, 0.4, air);
            p.lLegRotZ = lerp(-0.3, -0.2, air);
            p.rLegRotZ = lerp(0.3, 0.2, air);
            
            p.spinY = cheatTwist; p.flipX = backFlip; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — spot landing from inverted position ──
            const t2 = (progress - 0.55) / 0.45;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.28 ? easeOutQuad(t2 / 0.28) : 1.0;
            const recover = t2 < 0.28 ? 0 : easeOutQuad((t2 - 0.28) / 0.72);
            
            p.bodyY = lerp(BY + 0.04, BY - 0.24, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(-0.15, -0.20, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = lerp(side * 0.2, 0, land);
            p.headRotX = lerp(-0.1, 0.08, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = lerp(0, 0, land);
            
            // Arms come down from overhead
            p.rArmRotX = lerp(-1.0, 0, land);
            p.rArmRotZ = lerp(-side * 0.4, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.2, -0.1, land);
            
            p.lArmRotX = lerp(-1.0, 0, land);
            p.lArmRotZ = lerp(side * 0.4, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.2, -0.1, land);
            
            // Legs absorb impact
            p.lLegRotX = lerp(0.4, 0.35, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.4, -0.30, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.2, 0, land);
            p.rLegRotZ = lerp(0.2, 0, land);
            
            const fadeRotations = easeOutQuad(Math.min(1, t2 * 2.2));
            p.spinY = side * Math.PI * (1 - fadeRotations);
            p.flipX = Math.PI * 2 * (1 - fadeRotations);
            p.flipZ = 0;
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
          
        } else if (dStyle === 7) {
          // ═══ AERIAL TWIST — 720° helicopter spin with extended limbs ═══
          // Pure vertical rotation mastery. Body jumps straight up and
          // spins TWO full rotations (720°) with arms and legs extended
          // like helicopter blades. The extended limbs create a massive
          // visual silhouette - you see the full spread from every angle
          // as the body whirls. This is the "look at me" dodge - maximum
          // air time, maximum spin, maximum style. Breakdancers call this
          // an "aerial" or "B-twist" when done on the ground.
          
          // Two full rotations (720°)
          const twistProg = progress < 0.08 ? 0 : progress < 0.60
            ? easeInOutCubic((progress - 0.08) / 0.52)
            : 1.0;
          const helicSpin = twistProg * Math.PI * 4 * side; // 720 degrees
          
          if (progress < 0.12) {
            // ── COIL — squat with arms pulling in ──
            const t0 = progress / 0.12;
            const coil = easeOutQuad(t0);
            
            p.bodyY = BY - coil * 0.32;
            p.bodyRotX = coil * 0.15;
            p.bodyRotZ = side * coil * 0.2;
            p.headRotX = -coil * 0.1;
            p.headRotZ = -side * coil * 0.15;
            
            // Arms pull in tight before explosion
            p.rArmRotX = lerp(0, 0.3, coil);
            p.rArmRotZ = lerp(-0.05, -0.3, coil);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.1, -0.8, coil);
            
            p.lArmRotX = lerp(0, 0.3, coil);
            p.lArmRotZ = lerp(0.05, 0.3, coil);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.1, -0.8, coil);
            
            // Legs coil
            p.lLegRotX = coil * 0.8;
            p.rLegRotX = -coil * 0.6;
            p.lLegRotZ = -coil * 0.15;
            p.rLegRotZ = coil * 0.15;
            
            p.spinY = helicSpin; p.flipX = 0; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else if (progress < 0.52) {
            // ── HELICOPTER — full extension, spinning fast ──
            const t1 = (progress - 0.12) / 0.40;
            const spin = easeInOutCubic(t1);
            
            // Body stays relatively neutral - the spin is the star
            p.bodyY = BY + 0.08;
            p.bodyRotX = 0.05;
            p.bodyRotZ = 0;
            p.headRotX = -0.08;  // looking at horizon
            p.headRotZ = 0;
            
            // Arms WIDE - creating the helicopter blade effect
            p.rArmRotX = lerp(0.3, -1.0, spin);
            p.rArmRotZ = lerp(-0.3, -1.8, spin);  // maximum extension
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(-0.8, 0, spin);  // forearms extend
            
            p.lArmRotX = lerp(0.3, -1.0, spin);
            p.lArmRotZ = lerp(0.3, 1.8, spin);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(-0.8, 0, spin);
            
            // Legs extend in slight V-shape - adds to blade silhouette
            const legSpread = spin * 0.4;
            p.lLegRotX = lerp(0.8, 0.2, spin);
            p.rLegRotX = lerp(-0.6, 0.2, spin);
            p.lLegRotZ = -legSpread;
            p.rLegRotZ = legSpread;
            
            p.spinY = helicSpin; p.flipX = 0; p.flipZ = 0;
            p.meshPosY = jumpHeight;
            p.meshRotZ = 0;
            
          } else {
            // ── LANDING — pull in and stick it ──
            const t2 = (progress - 0.52) / 0.48;
            const land = easeOutQuad(t2);
            const impact = t2 < 0.30 ? easeOutQuad(t2 / 0.30) : 1.0;
            const recover = t2 < 0.30 ? 0 : easeOutQuad((t2 - 0.30) / 0.70);
            
            p.bodyY = lerp(BY + 0.05, BY - 0.22, impact);
            p.bodyY = lerp(p.bodyY, BY, recover);
            p.bodyRotX = lerp(0.05, -0.16, impact);
            p.bodyRotX = lerp(p.bodyRotX, 0, recover);
            p.bodyRotZ = 0;
            p.headRotX = lerp(-0.08, 0.06, impact);
            p.headRotX = lerp(p.headRotX, 0, recover);
            p.headRotZ = 0;
            
            // Arms pull in from wide extension
            p.rArmRotX = lerp(-1.0, 0, land);
            p.rArmRotZ = lerp(-1.8, -0.05, land);
            p.rArmPosY = AY;
            p.rForearmRotX = lerp(0, -0.1, land);
            
            p.lArmRotX = lerp(-1.0, 0, land);
            p.lArmRotZ = lerp(1.8, 0.05, land);
            p.lArmPosY = AY;
            p.lForearmRotX = lerp(0, -0.1, land);
            
            // Legs come together for landing
            p.lLegRotX = lerp(0.2, 0.32, impact);
            p.lLegRotX = lerp(p.lLegRotX, 0, recover);
            p.rLegRotX = lerp(0.2, -0.28, impact);
            p.rLegRotX = lerp(p.rLegRotX, 0, recover);
            p.lLegRotZ = lerp(-0.4, 0, land);
            p.rLegRotZ = lerp(0.4, 0, land);
            
            const fadeSpin = easeOutQuad(Math.min(1, t2 * 2.4));
            p.spinY = side * Math.PI * 4 * (1 - fadeSpin);
            p.flipX = 0;
            p.flipZ = 0;
            p.meshPosY = Math.max(0, jumpHeight);
            p.meshRotZ = 0;
          }
        }
        break;
      }
      case ANIM.CATCH_READY: {
        // ═══ AGGRESSIVE CATCH STANCE — wide sumo-like stance, arms hungry ═══
        // Deep athletic squat, arms outstretched and pulsing, fingers spread.
        // Like a goalkeeper about to make a diving save. Maximum readiness.
        const readyPulse = Math.sin(t * 8) * 0.06;
        const breathe = Math.sin(t * 4) * 0.03;
        const fingerTwitch = Math.sin(t * 12) * 0.04;
        
        p.bodyY = BY - 0.20 + breathe;       // deep squat
        p.bodyRotX = 0.20 + readyPulse * 0.5; // leaning into it
        p.bodyRotZ = fingerTwitch * 0.3;
        p.headRotX = -0.20 + readyPulse; // eyes locked on ball
        p.headRotZ = fingerTwitch * 0.4;
        
        // Both arms out wide and forward — open "bear hug" catch
        p.lArmRotX = -1.3 + readyPulse;
        p.lArmRotZ = -0.50 + fingerTwitch;  // wider spread
        p.lArmPosY = AY;
        p.rArmRotX = -1.3 - readyPulse;
        p.rArmRotZ = 0.50 - fingerTwitch;
        p.rArmPosY = AY;
        p.lForearmRotX = -0.95 + fingerTwitch;
        p.rForearmRotX = -0.95 - fingerTwitch;
        
        // Wide athletic stance — sumo base
        p.lLegRotX = 0.30 + breathe;
        p.rLegRotX = -0.25 + breathe;
        p.lLegRotZ = -0.08; p.rLegRotZ = 0.08;  // feet wider
        p.meshPosY = -0.10; p.meshRotZ = 0;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        break;
      }
      case ANIM.CATCH_SUCCESS: {
        // Two-handed catch: arms CLAMP together to secure the ball, then
        // pull into chest, then transition to one-arm hold-idle.
        // 3 phases: CLAMP (0–25%), SECURE (25–55%), SETTLE (55–100%)
        const progress = Math.min(1, st / ANIM_DURATIONS[ANIM.CATCH_SUCCESS]);
        p.lLegRotZ = 0; p.rLegRotZ = 0;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        
        if (progress < 0.25) {
          // ── CLAMP — both arms snap together to trap the ball ──
          // Arms come from wide ready position to center, hands meeting
          const t0 = progress / 0.25;
          const snap = easeOutBack(t0);
          
          p.bodyY = BY - 0.15 + snap * 0.02;
          p.bodyRotX = 0.15 - snap * 0.08;   // slight backward lean from impact
          p.bodyRotZ = 0;
          p.headRotX = -0.15 + snap * 0.05;
          p.headRotZ = 0;
          
          // Both arms drive inward to center — the catch "clamp"
          p.lArmRotX = lerp(-1.1, -1.3, snap);    // arms slightly higher at catch
          p.lArmRotZ = lerp(-0.35, -0.08, snap);   // left arm swings inward (toward center)
          p.lArmPosY = AY;
          p.rArmRotX = lerp(-1.1, -1.3, snap);    // mirror
          p.rArmRotZ = lerp(0.35, 0.08, snap);     // right arm swings inward
          p.rArmPosY = AY;
          
          // Forearms curl inward hard — hands meet around the ball
          p.lForearmRotX = lerp(-0.85, -1.4, snap);
          p.rForearmRotX = lerp(-0.85, -1.4, snap);
          
          p.lLegRotX = 0.2; p.rLegRotX = -0.2;
          p.meshPosY = -0.08 + snap * 0.02;
          p.meshRotZ = 0;
          
        } else if (progress < 0.55) {
          // ── SECURE — pull ball into chest with both hands, body absorbs ──
          // The "hug it in" moment — ball pressed against torso
          const t1 = (progress - 0.25) / 0.30;
          const pull = easeOutQuad(t1);
          
          p.bodyY = lerp(BY - 0.13, BY - 0.06, pull);
          p.bodyRotX = lerp(0.07, -0.06, pull);   // body straightens, slight lean back
          p.bodyRotZ = 0;
          p.headRotX = lerp(-0.10, -0.08, pull);
          p.headRotZ = 0;
          
          // Both arms pull down and in — securing ball against chest
          p.lArmRotX = lerp(-1.3, -0.85, pull);    // arms come down toward chest
          p.lArmRotZ = lerp(-0.08, -0.03, pull);    // stay close together
          p.lArmPosY = AY;
          p.rArmRotX = lerp(-1.3, -0.85, pull);
          p.rArmRotZ = lerp(0.08, 0.03, pull);
          p.rArmPosY = AY;
          
          // Forearms stay clamped — ball firmly held
          p.lForearmRotX = lerp(-1.4, -1.2, pull);
          p.rForearmRotX = lerp(-1.4, -1.2, pull);
          
          p.lLegRotX = lerp(0.2, 0.1, pull);
          p.rLegRotX = lerp(-0.2, -0.1, pull);
          p.meshPosY = lerp(-0.06, -0.02, pull);
          p.meshRotZ = 0;
          
        } else {
          // ── SETTLE — transition from two-handed chest hold to one-arm carry ──
          // Right arm lifts ball overhead, left arm relaxes to side
          const t2 = (progress - 0.55) / 0.45;
          const rise = easeOutElastic(Math.min(1, t2 * 1.5));
          
          p.bodyY = lerp(BY - 0.06, BY + 0.02, rise);
          p.bodyRotX = lerp(-0.06, -0.05, rise);
          p.bodyRotZ = 0;
          p.headRotX = lerp(-0.08, -0.10, rise);
          p.headRotZ = 0;
          
          // Right arm rises with ball — transitions to hold-idle pose
          p.rArmRotX = lerp(-0.85, -1.3, rise);
          p.rArmRotZ = lerp(0.03, -0.05, rise);
          p.rArmPosY = lerp(AY, AY + 0.04, rise);
          p.rForearmRotX = lerp(-1.2, -0.8, rise);
          
          // Left arm relaxes to side — releasing the two-handed grip
          p.lArmRotX = lerp(-0.85, -0.3, rise);
          p.lArmRotZ = lerp(-0.03, 0.05, rise);
          p.lArmPosY = AY;
          p.lForearmRotX = lerp(-1.2, -0.3, rise);
          
          p.lLegRotX = lerp(0.1, 0, t2);
          p.rLegRotX = lerp(-0.1, 0, t2);
          p.meshPosY = lerp(-0.02, 0, t2);
          p.meshRotZ = 0;
        }
        break;
      }
      case ANIM.DEFLECT_READY: {
        // ═══ DEFLECT READY — samurai batting stance, wound-up for devastating swat ═══
        // Ball-arm cocked way back like a batter, body coiled, front arm guards.
        // Pulsing with barely contained energy — about to EXPLODE forward.
        const readyPulse = Math.sin(t * 10) * 0.05;
        const coilTwitch = Math.sin(t * 15) * 0.03;
        const breathe = Math.sin(t * 3.5) * 0.02;
        
        p.bodyY = BY - 0.14 + breathe;
        p.bodyRotX = 0.22 + readyPulse * 0.4; // leaning forward into it
        p.bodyRotZ = -0.08 + coilTwitch;       // coiled to one side
        p.headRotX = -0.25 + readyPulse;       // intense focus
        p.headRotZ = 0.06 + coilTwitch * 2;
        
        // Right arm cocked back HIGH — loaded spring
        p.rArmRotX = -2.5 + readyPulse;
        p.rArmRotZ = -0.45 + coilTwitch;
        p.rArmPosY = AY + 0.08;
        p.rForearmRotX = -0.7 + readyPulse * 0.5;
        
        // Left arm extended forward as guard — shield arm
        p.lArmRotX = -1.2 - readyPulse;
        p.lArmRotZ = -0.35 + coilTwitch;
        p.lArmPosY = AY;
        p.lForearmRotX = -1.0;
        
        // Wide fighting stance
        p.lLegRotX = 0.32 + breathe;
        p.rLegRotX = -0.20 + breathe;
        p.lLegRotZ = -0.06; p.rLegRotZ = 0.04;
        p.meshPosY = -0.08 + breathe;
        p.meshRotZ = coilTwitch * 0.5;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        break;
      }
      case ANIM.DEFLECT_SUCCESS: {
        // ═══ DEFLECT SUCCESS — violent overhead smash swing ═══
        // 3 phases: SWING (0–30%), IMPACT (30–55%), RECOVER (55–100%)
        // The player smashes their ball downward onto the incoming ball,
        // swatting it away with a satisfying overhead slam.
        const progress = Math.min(1, st / ANIM_DURATIONS[ANIM.DEFLECT_SUCCESS]);
        p.lLegRotZ = 0; p.rLegRotZ = 0;
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        
        if (progress < 0.30) {
          // ── SWING — ball arm whips forward and down in vicious arc ──
          const t0 = progress / 0.30;
          const swing = easeOutBack(t0);
          
          p.bodyY = BY - 0.10 + swing * 0.06;
          p.bodyRotX = lerp(0.18, -0.25, swing);  // lean INTO the swing
          p.bodyRotZ = lerp(0, 0.12, swing);       // slight twist
          p.headRotX = lerp(-0.20, 0.15, swing);   // head tracks the swat
          p.headRotZ = lerp(0, -0.10, swing);
          
          // Right arm (ball) swings from cocked-back to full forward slam
          p.rArmRotX = lerp(-2.2, 0.6, swing);     // overhead → forward+down
          p.rArmRotZ = lerp(-0.35, 0.15, swing);
          p.rArmPosY = lerp(AY + 0.05, AY - 0.08, swing);
          p.rForearmRotX = lerp(-0.6, -1.2, swing); // forearm snaps on contact
          
          // Left arm swings opposite for balance — pulls back
          p.lArmRotX = lerp(-1.0, 0.4, swing);
          p.lArmRotZ = lerp(-0.25, -0.5, swing);
          p.lArmPosY = AY;
          p.lForearmRotX = lerp(-0.9, -0.3, swing);
          
          p.lLegRotX = lerp(0.25, -0.10, swing);
          p.rLegRotX = lerp(-0.15, 0.20, swing);
          p.meshPosY = lerp(-0.06, 0, swing);
          p.meshRotZ = 0;
          
        } else if (progress < 0.55) {
          // ── IMPACT — body absorbs the shock, slight recoil ──
          const t1 = (progress - 0.30) / 0.25;
          const recoil = easeOutQuad(t1);
          
          p.bodyY = lerp(BY - 0.04, BY - 0.08, recoil);
          p.bodyRotX = lerp(-0.25, -0.12, recoil);
          p.bodyRotZ = lerp(0.12, 0.04, recoil);
          p.headRotX = lerp(0.15, 0.05, recoil);
          p.headRotZ = lerp(-0.10, -0.03, recoil);
          
          // Right arm holds at impact point — slight vibration
          const vib = Math.sin(t * 40) * (1 - recoil) * 0.08;
          p.rArmRotX = 0.6 + vib;
          p.rArmRotZ = 0.15;
          p.rArmPosY = AY - 0.08;
          p.rForearmRotX = -1.2 + vib * 0.5;
          
          p.lArmRotX = lerp(0.4, 0.1, recoil);
          p.lArmRotZ = lerp(-0.5, -0.3, recoil);
          p.lArmPosY = AY;
          p.lForearmRotX = lerp(-0.3, -0.4, recoil);
          
          p.lLegRotX = -0.10; p.rLegRotX = 0.20;
          p.meshPosY = lerp(0, -0.03, recoil);
          p.meshRotZ = 0;
          
        } else {
          // ── RECOVER — return to hold idle, flex out of it ──
          const t2 = (progress - 0.55) / 0.45;
          const recover = easeOutElastic(Math.min(1, t2 * 1.3));
          
          p.bodyY = lerp(BY - 0.08, BY + 0.02, recover);
          p.bodyRotX = lerp(-0.12, -0.05, recover);
          p.bodyRotZ = lerp(0.04, 0, recover);
          p.headRotX = lerp(0.05, -0.10, recover);
          p.headRotZ = lerp(-0.03, 0, recover);
          
          // Right arm rises back to hold-idle position
          p.rArmRotX = lerp(0.6, -1.3, recover);
          p.rArmRotZ = lerp(0.15, -0.05, recover);
          p.rArmPosY = lerp(AY - 0.08, AY + 0.04, recover);
          p.rForearmRotX = lerp(-1.2, -0.8, recover);
          
          // Left arm relaxes
          p.lArmRotX = lerp(0.1, -0.3, recover);
          p.lArmRotZ = lerp(-0.3, 0.05, recover);
          p.lArmPosY = AY;
          p.lForearmRotX = lerp(-0.4, -0.3, recover);
          
          p.lLegRotX = lerp(-0.10, 0, t2);
          p.rLegRotX = lerp(0.20, 0, t2);
          p.meshPosY = lerp(-0.03, 0, t2);
          p.meshRotZ = 0;
        }
        break;
      }
      case ANIM.HIT_REACT: {
        // ═══ OVER-THE-TOP HIT REACT — dramatic stagger, whiplash, arm fling ═══
        // Like getting drilled in anime — head snaps, body crumples, arms fly out,
        // then a dramatic recovery with a stagger step.
        const progress = Math.min(1, st / ANIM_DURATIONS[ANIM.HIT_REACT]);
        const shake = Math.sin(t * 30) * (1 - progress);
        const shake2 = Math.sin(t * 22 + 1.5) * (1 - progress);
        p.spinY = 0; p.flipX = 0; p.flipZ = 0;
        
        if (progress < 0.2) {
          // ── IMPACT — violent snap backward, arms fling out wide ──
          const impact = easeOutQuad(progress / 0.2);
          p.bodyY = BY - impact * 0.25;
          p.bodyRotX = -impact * 0.6;              // violent backward lean
          p.bodyRotZ = shake * 0.20 + impact * 0.12;  // lateral whip
          p.headRotX = impact * 0.5;                // head snaps forward from whiplash
          p.headRotZ = shake * 0.30 + shake2 * 0.15;  // head rattles
          
          // Arms fling out wide — ragdoll-like reaction
          p.lArmRotX = impact * 1.2;
          p.lArmRotZ = 0.05 + impact * 0.7;   // flung wide left
          p.lArmPosY = AY;
          p.rArmRotX = impact * 1.0;
          p.rArmRotZ = -0.05 - impact * 0.7;  // flung wide right
          p.rArmPosY = AY;
          p.lForearmRotX = -0.1 - impact * 0.8;
          p.rForearmRotX = -0.1 - impact * 0.8;
          
          // Legs buckle — one knee collapses
          p.lLegRotX = -impact * 0.35;
          p.rLegRotX = impact * 0.50;   // one leg gives way
          p.lLegRotZ = impact * 0.08;
          p.rLegRotZ = -impact * 0.06;
          
          p.meshPosY = impact * 0.06;  // slight lift from impact force
          p.meshRotZ = shake * 0.12;
        } else if (progress < 0.45) {
          // ── STAGGER — stumble backward, arms windmill for balance ──
          const stagger = (progress - 0.2) / 0.25;
          const wobble = Math.sin(stagger * Math.PI * 3) * (1 - stagger);
          
          p.bodyY = lerp(BY - 0.25, BY - 0.12, stagger);
          p.bodyRotX = lerp(-0.6, -0.25, stagger) + wobble * 0.08;
          p.bodyRotZ = shake * 0.10 + wobble * 0.10;
          p.headRotX = lerp(0.5, 0.15, stagger) + wobble * 0.12;
          p.headRotZ = shake * 0.12 + wobble * 0.08;
          
          // Arms flail for balance — windmilling
          p.lArmRotX = lerp(1.2, 0.3, stagger) + wobble * 0.3;
          p.lArmRotZ = lerp(0.75, 0.2, stagger) + wobble * 0.15;
          p.lArmPosY = AY;
          p.rArmRotX = lerp(1.0, 0.2, stagger) - wobble * 0.3;
          p.rArmRotZ = lerp(-0.75, -0.2, stagger) - wobble * 0.15;
          p.rArmPosY = AY;
          p.lForearmRotX = lerp(-0.9, -0.4, stagger);
          p.rForearmRotX = lerp(-0.9, -0.4, stagger);
          
          p.lLegRotX = lerp(-0.35, -0.08, stagger) + wobble * 0.06;
          p.rLegRotX = lerp(0.50, 0.15, stagger) - wobble * 0.06;
          p.lLegRotZ = lerp(0.08, 0.02, stagger);
          p.rLegRotZ = lerp(-0.06, -0.02, stagger);
          
          p.meshPosY = lerp(0.06, 0, stagger);
          p.meshRotZ = shake * 0.06 + wobble * 0.04;
        } else {
          // ── RECOVERY — snap back to stance with attitude ──
          const recover = (progress - 0.45) / 0.55;
          const recoverEase = easeOutElastic(Math.min(1, recover * 1.2));
          
          p.bodyY = lerp(BY - 0.12, BY - 0.06, recoverEase);
          p.bodyRotX = lerp(-0.25, -0.08, recoverEase);
          p.bodyRotZ = shake * 0.03;
          p.headRotX = lerp(0.15, -0.05, recoverEase);
          p.headRotZ = shake * 0.03;
          
          p.lArmRotX = lerp(0.3, -0.15, recoverEase);
          p.lArmRotZ = lerp(0.2, 0.18, recoverEase);
          p.lArmPosY = AY;
          p.rArmRotX = lerp(0.2, -0.15, recoverEase);
          p.rArmRotZ = lerp(-0.2, -0.18, recoverEase);
          p.rArmPosY = AY;
          p.lForearmRotX = lerp(-0.4, -0.45, recoverEase);
          p.rForearmRotX = lerp(-0.4, -0.45, recoverEase);
          
          p.lLegRotX = lerp(-0.08, 0.08, recoverEase);
          p.rLegRotX = lerp(0.15, 0.08, recoverEase);
          p.lLegRotZ = lerp(0.02, -0.03, recover);
          p.rLegRotZ = lerp(-0.02, 0.03, recover);
          
          p.meshPosY = 0;
          p.meshRotZ = shake * 0.02;
        }
        break;
      }
    }
  }
  
  // ─── Apply Pose to Meshes ─────────────────────────────
  applyPose(dt) {
    const p = this.pose;
    // Faster lerp for snappier, more responsive animations across the board
    const lerpRate = 18 * dt;
    // Use faster lerp for spin during throw (needs to be snappy, not mushy)
    const isThrowing = this.animState === 'windup' || this.animState === 'throw' || this.animState === 'chargeWindup' || this.animState === 'dodge';
    const spinLerp = isThrowing ? 28 * dt : lerpRate;
    
    this.body.position.y = lerp(this.body.position.y, p.bodyY, lerpRate);
    this.body.rotation.x = lerp(this.body.rotation.x, p.bodyRotX, lerpRate);
    this.body.rotation.z = lerp(this.body.rotation.z, p.bodyRotZ, lerpRate);
    
    this.head.rotation.x = lerp(this.head.rotation.x, p.headRotX, lerpRate);
    this.head.rotation.z = lerp(this.head.rotation.z, p.headRotZ, lerpRate);
    
    this.leftArm.rotation.x = lerp(this.leftArm.rotation.x, p.lArmRotX, lerpRate);
    this.leftArm.rotation.z = lerp(this.leftArm.rotation.z, p.lArmRotZ, lerpRate);
    this.leftArm.position.y = lerp(this.leftArm.position.y, p.lArmPosY, lerpRate);
    
    this.rightArm.rotation.x = lerp(this.rightArm.rotation.x, p.rArmRotX, lerpRate);
    this.rightArm.rotation.z = lerp(this.rightArm.rotation.z, p.rArmRotZ, lerpRate);
    this.rightArm.position.y = lerp(this.rightArm.position.y, p.rArmPosY, lerpRate);
    
    // Forearm (elbow) bending
    if (this.leftForearm) {
      this.leftForearm.rotation.x = lerp(this.leftForearm.rotation.x, p.lForearmRotX, lerpRate);
    }
    if (this.rightForearm) {
      this.rightForearm.rotation.x = lerp(this.rightForearm.rotation.x, p.rForearmRotX, lerpRate);
    }
    
    this.leftLeg.rotation.x = lerp(this.leftLeg.rotation.x, p.lLegRotX, lerpRate);
    this.rightLeg.rotation.x = lerp(this.rightLeg.rotation.x, p.rLegRotX, lerpRate);
    this.leftLeg.rotation.z = lerp(this.leftLeg.rotation.z, p.lLegRotZ || 0, lerpRate);
    this.rightLeg.rotation.z = lerp(this.rightLeg.rotation.z, p.rLegRotZ || 0, lerpRate);
    
    // 360 spin overlay — additive Y rotation on top of facing direction
    this.spinYRot = lerp(this.spinYRot, p.spinY || 0, spinLerp);
    
    // Backflip overlay — full-body X rotation
    this.flipXRot = lerp(this.flipXRot, p.flipX || 0, spinLerp);
    
    // Cartwheel overlay — full-body Z rotation
    this.flipZRot = lerp(this.flipZRot || 0, p.flipZ || 0, spinLerp);
    
    this.mesh.position.y = lerp(this.mesh.position.y, p.meshPosY, isThrowing ? spinLerp : lerpRate);
    
    // ─── Landing Impact Detection ───
    // Track when a throw flip touches down
    const isAirborne = this.mesh.position.y > 0.08;
    if (this.animState === ANIM.THROW || this.animState === ANIM.WINDUP) {
      if (isAirborne) {
        this.wasAirborne = true;
        this.landingTriggered = false;
      }
      if (this.wasAirborne && !isAirborne && !this.landingTriggered && this.peakFlipHeight > 0.3) {
        this.landingTriggered = true;
        if (this.onLandingImpact) {
          this.onLandingImpact(this.peakFlipHeight, this.mesh.position.clone());
        }
      }
    } else if (this.animState !== ANIM.CHARGE_WINDUP) {
      // Reset tracking when not in throw states
      if (this.wasAirborne) {
        this.wasAirborne = false;
        this.peakFlipHeight = 0;
        this.landingTriggered = false;
      }
    }
    
    if (this.selectionRing) {
      this.selectionRing.material.opacity = 0.4 + Math.sin(this.animTime * 4) * 0.2;
      this.selectionRing.rotation.z = this.animTime * 0.5;
    }
    
    if (this.invincible > 0) {
      this.mesh.visible = Math.floor(this.animTime * 10) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }
  }
  
  // ─── Human Input ──────────────────────────────────────
  updateHuman(dt, keys, mobileInput) {
    let dx = 0, dz = 0;
    
    // Get raw input (world-space or local input)
    let inputX = 0, inputZ = 0;
    if (keys['KeyW']) inputZ = -1;
    if (keys['KeyS']) inputZ = 1;
    if (keys['KeyA']) inputX = -1;
    if (keys['KeyD']) inputX = 1;
    
    if (mobileInput && mobileInput.active) {
      const jx = mobileInput.joystickX;
      const jy = mobileInput.joystickY;
      const deadzone = 0.15;
      if (Math.abs(jx) > deadzone || Math.abs(jy) > deadzone) {
        inputX += jx;
        inputZ += jy;
      }
    }
    
    // ═══ THIRD PERSON MODE: Camera-relative movement ═══
    if (this._cameraAngle !== null && this._cameraAngle !== undefined) {
      // Transform input based on camera forward direction
      // cameraAngle is the forward direction (angle in radians)
      // W key (inputZ = -1) should move forward in that direction
      // A/D keys (inputX) should move perpendicular (left/right)
      const cos = Math.cos(this._cameraAngle);
      const sin = Math.sin(this._cameraAngle);
      
      // Rotate input vector by camera angle (with reversed controls)
      // Negate inputs to reverse left/right and forward/backward
      dx = -inputZ * sin - inputX * cos;
      dz = -inputZ * cos + inputX * sin;
    } else {
      // ═══ NORMAL MODE: World-space movement ═══
      dx = inputX;
      dz = inputZ;
    }
    
    const baseSpeed = CONFIG.PLAYER_SPEED;
    let speed = this.throwCharging ? baseSpeed * CONFIG.THROW_CHARGE_SLOW : baseSpeed;
    // Apply super speed multiplier
    if (this.superSpeed) {
      speed *= 2.5;
    }
    if (dx !== 0 || dz !== 0) {
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len > 1) { dx /= len; dz /= len; }
      this.mesh.position.x += dx * speed * dt;
      this.mesh.position.z += dz * speed * dt;
      
      // Face the direction of movement (smooth rotation handled by updateFacing)
      this.faceMovementDirection(dx, dz);
    }
    // When standing still: keep last facing direction (no reset)
    
    const isCharging = keys['ArrowUp'] || keys['ShiftLeft'] || keys['ShiftRight'] || keys['ArrowDown'] ||
      (mobileInput && mobileInput.charging);
    if (this.hasBall) {
      if (isCharging) {
        this.trickCharge = Math.min(100, this.trickCharge + 55 * dt);
      }
    } else {
      this.trickCharge = Math.max(0, this.trickCharge - 30 * dt);
    }
  }
  
  // ─── AI ───────────────────────────────────────────────
  
  // Helper: can this AI physically reach a world position? (respects team side clamping)
  // Includes pickup range buffer so balls right at center line are reachable
  _canReachPosition(x, z) {
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    const pickupReach = 1.2; // pickup distance — can grab balls slightly past our boundary
    // Blue team can walk to x=-0.3, but can PICK UP a ball up to x=(-0.3 + 1.2) = 0.9
    // Red team can walk to x=0.3, but can PICK UP a ball down to x=(0.3 - 1.2) = -0.9
    if (isBlue) {
      if (x < -hw + 0.3 || x > pickupReach) return false;
    } else {
      if (x > hw - 0.3 || x < -pickupReach) return false;
    }
    if (z < -hd + 0.3 || z > hd - 0.3) return false;
    return true;
  }
  
  updateAI(dt, allPlayers, balls) {
    if (!this.aiPersonality) return null;
    
    const p = this.aiPersonality;
    
    this.aiTimer -= dt;
    this.aiMovementTimer -= dt;
    this.aiJukeTimer -= dt;
    // Idle linger: counts down when standing at a reached position
    if (this._idleLingerTimer === undefined) this._idleLingerTimer = 0;
    if (this._pickupGiveUpTimer === undefined) this._pickupGiveUpTimer = 0;
    
    // Juke/feint movement for unpredictable AI
    if (p.movementStyle === 'unpredictable' && this.aiJukeTimer <= 0) {
      this.aiJukeTimer = p.jukeFrequency;
      this.aiJukeDirection = (Math.random() > 0.5 ? 1 : -1) * p.strafePreference;
    }
    
    // ── Continuous threat scanning (every frame, not just on timer) ──
    this.handleIncomingThreats(dt, allPlayers, balls);
    
    // ══════ ULTRA-RESPONSIVE AWARENESS — React immediately like human players ══════
    const inReactiveState = this.isDodging || this.isCatching || this.isDeflecting ||
      this.animState === ANIM.THROW || this.animState === ANIM.WINDUP ||
      this.animState === ANIM.CHARGE_WINDUP || this.animState === ANIM.HIT_REACT ||
      this.animState === ANIM.KO || this.animState === ANIM.DODGE;
    
    if (!inReactiveState && !this.hasBall) {
      // ── INSTANT BALL DETECTION — scan every 2-3 frames like human vision ──
      if (!this._ballScanCooldown) this._ballScanCooldown = 0;
      this._ballScanCooldown -= dt;
      
      // Ultra-fast scan: 15-20x per second (human-like perception)
      if (this._ballScanCooldown <= 0) {
        this._ballScanCooldown = 0.05 + Math.random() * 0.017; // ~50-60ms
        
        const foundBall = this._scanForNearestBall(allPlayers, balls);
        if (foundBall) {
          const distToBall = this.mesh.position.distanceTo(foundBall.mesh.position);
          
          // ALWAYS interrupt for balls within reach — no hesitation
          // Only check if this is a better target if already chasing something
          const shouldSwitch = !this.targetPos || 
            this.aiState !== 'pickup' ||
            distToBall < this.mesh.position.distanceTo(this.targetPos) - 1.5;
          
          if (shouldSwitch) {
            this.targetPos = new THREE.Vector3(
              foundBall.mesh.position.x, 0, foundBall.mesh.position.z
            );
            this.aiState = 'pickup';
            this._idleLingerTimer = 0; // Zero delay
            this._pickupGiveUpTimer = 3.0 + Math.random() * 0.5; // Persistent chase
          }
        }
      }
      
      // ── Power-up awareness — scan ALWAYS when no ball in hand ──
      // Removed condition that prevented power-up scanning during ball chase
      if (!this._powerUpScanCooldown) this._powerUpScanCooldown = 0;
      this._powerUpScanCooldown -= dt;
      
      if (this._powerUpScanCooldown <= 0) {
        this._powerUpScanCooldown = 0.08 + Math.random() * 0.04; // ~10-12x/sec
        
        if (this._powerUpsArray && this._powerUpsArray.length > 0) {
          const foundPU = this._scanForBestPowerUp(allPlayers, this._powerUpsArray);
          if (foundPU) {
            const distToPU = this.mesh.position.distanceTo(foundPU.mesh.position);
            
            // Power-ups can interrupt ball chase if they're very close OR high priority
            const puPriority = this._getPowerUpPriority(foundPU, this.aiPersonality);
            const isHighPriority = puPriority >= 0.85; // laser/fireball/giantball
            const isVeryClose = distToPU < 3.0;
            
            // Switch to power-up if:
            // 1. No current target
            // 2. Already chasing power-up and this is closer
            // 3. High priority power-up that's nearby
            const shouldSwitch = !this.targetPos ||
              (this.aiState === 'powerup' && distToPU < this.mesh.position.distanceTo(this.targetPos) - 2.0) ||
              (isHighPriority && isVeryClose && this.aiState !== 'pickup');
            
            if (shouldSwitch) {
              this.targetPos = new THREE.Vector3(
                foundPU.mesh.position.x, 0, foundPU.mesh.position.z
              );
              this.aiState = 'powerup';
              this._idleLingerTimer = 0;
            }
          }
        }
      }
    }
    
    // ── Pickup give-up timer: if chasing a ball for too long, stop ──
    if (this.aiState === 'pickup') {
      this._pickupGiveUpTimer -= dt;
      if (this._pickupGiveUpTimer <= 0) {
        this.targetPos = null;
        this.aiState = 'idle';
        this._ballScanCooldown = 0.2 + Math.random() * 0.15;
      }
    }
    
    // Reposition/re-evaluate at personality-specific intervals
    // DON'T interrupt active pickup or power-up chase
    if (this.aiTimer <= 0 && this._idleLingerTimer <= 0 && 
        this.aiState !== 'pickup' && this.aiState !== 'powerup') {
      this.aiTimer = p.repositionTime * (0.7 + Math.random() * 0.3);
      this.decideAIAction(allPlayers, balls);
    }
    
    // ── ZERO-IDLE POLICY: Never stand around doing nothing ──
    if (!this.targetPos && this._idleLingerTimer <= 0 && !inReactiveState) {
      // Immediate action — human players don't hesitate
      this.decideAIAction(allPlayers, balls);
      this.aiTimer = p.repositionTime * (0.4 + Math.random() * 0.2); // Faster reassessment
    }
    
    // ── SUPER SPEED URGENCY: Sprint constantly during buff ──
    if (this.superSpeed && !inReactiveState) {
      // No idle time during speed buff — constant motion
      this._idleLingerTimer = 0;
      // If no target, immediately pick one
      if (!this.targetPos) {
        this.decideAIAction(allPlayers, balls);
      }
    }
    
    // ── Movement execution — human-like speed and responsiveness ──
    if (this.targetPos) {
      const diff = new THREE.Vector3().subVectors(this.targetPos, this.mesh.position);
      diff.y = 0;
      const distToTarget = diff.length();
      
      // Tight arrival thresholds — AI gets right on top of targets like humans do
      const arriveThreshold = (this.aiState === 'pickup' || this.aiState === 'powerup') ? 0.25 : 0.5;
      
      if (distToTarget > arriveThreshold) {
        diff.normalize();
        
        // Apply juke/strafe for unpredictable movement (smoother, less extreme)
        if (p.movementStyle === 'unpredictable' && this.aiJukeTimer > p.jukeFrequency - 0.5) {
          diff.x += this.aiJukeDirection * 0.3;
          diff.z += this.aiJukeDirection * 0.2;
          diff.normalize();
        }
        
        // AGGRESSIVE SPEED — match human sprint intensity
        let speedMult = 1.0 + p.mobility * 0.25; // base 1.0-1.25x (was 0.85-1.2x)
        
        // High-priority targets: SPRINT HARD
        if (this.aiState === 'pickup') speedMult *= 1.4;  // URGENT ball chase (was 1.25)
        if (this.aiState === 'powerup') speedMult *= 1.3; // Fast power-up grab (was 1.15)
        if (this.aiState === 'attacking') speedMult *= 1.15; // Aggressive positioning
        
        // Minimal deceleration for wander — keep moving
        if (this.aiState === 'wander' && distToTarget < 1.2) {
          speedMult *= 0.6 + 0.4 * (distToTarget / 1.2); // Less slowdown
        }
        
        // Apply super speed buff
        if (this.superSpeed) speedMult *= 2.5;
        
        const speed = CONFIG.AI_MOVE_SPEED * speedMult;
        this.mesh.position.x += diff.x * speed * dt;
        this.mesh.position.z += diff.z * speed * dt;
        
        this.faceMovementDirection(diff.x, diff.z);
        
        // ── RETARGET while moving: update target to current object position ──
        if (this.aiState === 'pickup') {
          const trackedBall = balls.find(b => 
            b.active && !b.held && b.mesh.position.y >= 0 &&
            this._canReachPosition(b.mesh.position.x, b.mesh.position.z) &&
            Math.abs(b.mesh.position.x - this.targetPos.x) < 3.0 &&
            Math.abs(b.mesh.position.z - this.targetPos.z) < 3.0
          );
          if (trackedBall) {
            // Dynamically update target to where ball actually is now
            this.targetPos.x = trackedBall.mesh.position.x;
            this.targetPos.z = trackedBall.mesh.position.z;
          } else {
            // Ball gone (picked up by someone else), immediately look for next thing
            this.targetPos = null;
            this.aiState = 'idle';
            this._ballScanCooldown = 0; // Scan immediately
          }
        } else if (this.aiState === 'powerup' && this._powerUpsArray) {
          // Track power-up position (in case they haven't been collected yet)
          const trackedPU = this._powerUpsArray.find(pu =>
            pu.active && pu.collectable &&
            Math.abs(pu.mesh.position.x - this.targetPos.x) < 2.0 &&
            Math.abs(pu.mesh.position.z - this.targetPos.z) < 2.0
          );
          if (trackedPU) {
            // Update to current power-up position
            this.targetPos.x = trackedPU.mesh.position.x;
            this.targetPos.z = trackedPU.mesh.position.z;
          } else {
            // Power-up gone, look for next thing
            this.targetPos = null;
            this.aiState = 'idle';
            this._powerUpScanCooldown = 0;
          }
        }
      } else {
        // ── Arrived at target — immediate next action ──
        if (this.aiState === 'pickup') {
          this.targetPos = null;
          this.aiState = 'idle';
          this._ballScanCooldown = 0; // Instant re-scan
        } else if (this.aiState === 'powerup') {
          this.targetPos = null;
          this.aiState = 'idle';
          this._powerUpScanCooldown = 0; // Instant re-scan
        } else {
          // Arrived at wander/attack/evade — MINIMAL pause, stay active
          this.targetPos = null;
          // Dramatically reduced idle time — humans barely pause
          this._idleLingerTimer = this.superSpeed 
            ? 0 // Zero pause with speed buff
            : (0.05 + Math.random() * 0.15); // Very brief (was 0.15-0.55)
          if (this.aiState !== 'attacking') {
            this.aiState = 'idle';
          }
        }
      }
    } else if (this._idleLingerTimer > 0) {
      // Brief pause — count down quickly
      this._idleLingerTimer -= dt;
      // Stay alert: face nearest enemy
      const enemy = this.findNearestEnemy(allPlayers);
      if (enemy) {
        this.faceToward(enemy.mesh.position.x, enemy.mesh.position.z);
      }
    }
    
    // ── Safety: Detect stuck AI states and force reset ──
    // If AI has been in pickup/powerup state for too long without reaching target, reset
    if (!this.isHuman && (this.aiState === 'pickup' || this.aiState === 'powerup')) {
      this._stuckTimer = (this._stuckTimer || 0) + dt;
      if (this._stuckTimer > 4.0) {
        // Stuck for 4+ seconds, force reset
        this.aiState = 'idle';
        this.targetPos = null;
        this._stuckTimer = 0;
        this._pickupGiveUpTimer = 0;
        this._ballSeekTimer = 0;
      }
    } else if (!this.isHuman) {
      this._stuckTimer = 0;
    }
    
    return null;
  }
  
  // ── Aggressive ball scanner — finds nearest reachable ball immediately ──
  _scanForNearestBall(allPlayers, balls) {
    // Count teammates chasing balls
    const teammatesOnPickup = allPlayers.filter(pl =>
      pl.team === this.team && pl.alive && pl !== this && pl.aiState === 'pickup'
    ).length;
    
    // Team ball status — affects urgency
    const teamHasBall = allPlayers.some(pl => 
      pl.team === this.team && pl.alive && pl.hasBall
    );
    const desperate = !teamHasBall; // No balls = everyone chases
    
    let bestBall = null;
    let bestDist = Infinity;
    
    for (const b of balls) {
      // Skip active throws, held balls, and underground balls
      if (b.active || b.held || b.mesh.position.y < 0) continue;
      if (!this._canReachPosition(b.mesh.position.x, b.mesh.position.z)) continue;
      
      const dist = this.mesh.position.distanceTo(b.mesh.position);
      
      // EXPANDED range — aggressive ball pursuit (was 12/18, now 15/22)
      const maxRange = desperate ? 22 : 15;
      if (dist > maxRange) continue;
      
      // Smart clustering prevention — but don't be TOO polite
      if (!desperate && teammatesOnPickup >= 2) {
        // Only skip if someone is SIGNIFICANTLY closer (was 1.0, now 2.5)
        const closerTeammate = allPlayers.some(pl =>
          pl.team === this.team && pl.alive && pl !== this && pl.aiState === 'pickup' &&
          pl.mesh.position.distanceTo(b.mesh.position) < dist - 2.5
        );
        if (closerTeammate) continue;
      }
      
      // When desperate, compete for ANY ball
      if (desperate || teammatesOnPickup < 2) {
        if (dist < bestDist) {
          bestDist = dist;
          bestBall = b;
        }
      } else if (dist < bestDist) {
        // Normal case: closest ball
        bestDist = dist;
        bestBall = b;
      }
    }
    
    return bestBall;
  }
  
  // ── Aggressive power-up scanner — finds best reachable power-up ──
  _scanForBestPowerUp(allPlayers, powerUps) {
    const p = this.aiPersonality;
    
    // Allow some clustering — humans compete for power-ups
    const teammatesOnPowerUp = allPlayers.filter(pl =>
      pl.team === this.team && pl.alive && pl !== this && pl.aiState === 'powerup'
    ).length;
    // Only skip if 3+ teammates already going (was 2, now 3)
    if (teammatesOnPowerUp >= 3) return null;
    
    let bestPU = null;
    let bestScore = -Infinity;
    
    for (const pu of powerUps) {
      if (!pu.active) continue;
      // Don't target power-ups still in spawn grace (not collectable yet)
      if (pu.collectable !== undefined && !pu.collectable) continue;
      if (!this._canReachPosition(pu.mesh.position.x, pu.mesh.position.z)) continue;
      
      const dist = this.mesh.position.distanceTo(pu.mesh.position);
      // Expanded range: 10 → 14 (humans run further for power-ups)
      if (dist > 14) continue;
      
      // Score: priority / distance (closer + higher priority = better)
      const priority = this._getPowerUpPriority(pu, p);
      const score = priority * 12 - dist; // Increased weight (was 10, now 12)
      
      if (score > bestScore) {
        bestScore = score;
        bestPU = pu;
      }
    }
    
    return bestPU;
  }
  
  // ── Continuous threat response — react to incoming balls every frame ──
  handleIncomingThreats(dt, allPlayers, balls) {
    if (!this.aiPersonality) return;
    const p = this.aiPersonality;
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    
    // Don't react if already in a reaction state
    if (this.isDodging || this.isCatching || this.isDeflecting) return;
    if (this.animState === ANIM.THROW || this.animState === ANIM.WINDUP || 
        this.animState === ANIM.CHARGE_WINDUP || this.animState === ANIM.HIT_REACT ||
        this.animState === ANIM.KO || this.animState === ANIM.DODGE) return;
    
    // Find the most threatening incoming ball
    let closestThreat = null;
    let closestDist = Infinity;
    
    balls.forEach(b => {
      if (!b.active || !b.team || b.team === this.team || b.caught) return;
      
      // Check if ball is moving toward this player
      const toBall = new THREE.Vector3().subVectors(b.mesh.position, this.mesh.position);
      toBall.y = 0;
      const dist = toBall.length();
      
      // Only react to balls within threat range AND moving toward us
      if (dist > 8) return;
      
      const ballDir = b.velocity.clone();
      ballDir.y = 0;
      if (ballDir.length() < 1) return;
      ballDir.normalize();
      toBall.normalize();
      
      // Ball should be moving toward us (dot product < 0 means approaching)
      const approaching = toBall.dot(ballDir) < -0.2;
      if (!approaching) return;
      
      // Predict if ball will pass near us
      const lateralDist = Math.abs(
        (b.mesh.position.z - this.mesh.position.z) * ballDir.x -
        (b.mesh.position.x - this.mesh.position.x) * ballDir.z
      ) / ballDir.length();
      
      if (lateralDist < 2.5 && dist < closestDist) {
        closestDist = dist;
        closestThreat = b;
      }
    });
    
    if (!closestThreat) return;
    
    // Reaction based on distance — closer = more urgent
    const urgency = closestDist < 3 ? 1.0 : closestDist < 5 ? 0.7 : 0.4;
    
    // Decision: dodge, catch, or deflect based on personality
    const roll = Math.random();
    
    if (this.hasBall && roll < p.catchChance * 0.5 * urgency) {
      // Deflect (has ball + incoming threat)
      this.isDeflecting = true;
      this.deflectWindow = CONFIG.DEFLECT_WINDOW * (0.8 + p.reflexes * 0.4);
      this.aiState = 'deflecting';
      this.faceToward(closestThreat.mesh.position.x, closestThreat.mesh.position.z);
    } else if (!this.hasBall && roll < p.catchChance * urgency && closestDist < 5) {
      // Catch attempt
      this.isCatching = true;
      this.catchWindow = CONFIG.CATCH_WINDOW * (0.8 + p.reflexes * 0.4);
      this.aiState = 'catching';
      this.faceToward(closestThreat.mesh.position.x, closestThreat.mesh.position.z);
    } else if (roll < (p.catchChance + p.dodgeChance * 0.7) * urgency && closestDist < 5.5) {
      // ── PARKOUR DODGE — AI uses the trick dodge system! ──
      if (this.stamina >= CONFIG.DODGE_STAMINA_COST && !this.isDodging && this.dodgeCooldown <= 0) {
        // Dodge perpendicular to the incoming ball direction
        const ballVel = closestThreat.velocity.clone();
        ballVel.y = 0;
        ballVel.normalize();
        // Perpendicular direction (left or right based on strafe preference)
        const perpX = -ballVel.z * p.strafePreference;
        const perpZ = ballVel.x * p.strafePreference;
        this.startDodge(perpX, perpZ);
      } else {
        // Fallback: sidestep away if can't dodge
        const dodgeDir = p.strafePreference * (Math.random() > 0.5 ? 1 : -1);
        this.targetPos = new THREE.Vector3(
          this.mesh.position.x, 0,
          this.mesh.position.z + dodgeDir * 3
        );
        this.aiState = 'evading';
      }
    }
  }
  
  // (Old seekLooseBall/seekPowerUp replaced by _scanForNearestBall/_scanForBestPowerUp above)
  
  // Determine how valuable a power-up is to this AI based on personality
  _getPowerUpPriority(powerUp, personality) {
    const name = powerUp.type.name;
    
    // Aggressive AI prioritizes offensive power-ups
    if (personality.movementStyle === 'aggressive') {
      if (name === 'LASER BALL' || name === 'FIREBALL') return 1.0;
      if (name === 'GIANT BALL') return 0.95;
      if (name === 'SLAP SHOT') return 0.9;
      if (name === 'LIGHTNING STRIKE') return 0.85;
      if (name === 'FREEZE x2') return 0.7;
      if (name === 'SUPER SPEED') return 0.8;
      if (name === 'BANANA PEEL') return 0.6;
      return 0.6;
    }
    
    // Defensive AI prioritizes defensive/utility power-ups
    if (personality.movementStyle === 'defensive') {
      if (name === 'FREEZE x2') return 1.0;
      if (name === 'SUPER SPEED') return 0.9;
      if (name === 'BANANA PEEL') return 0.85;
      if (name === 'LASER BALL' || name === 'FIREBALL') return 0.7;
      if (name === 'LIGHTNING STRIKE') return 0.75;
      if (name === 'GIANT BALL') return 0.6;
      if (name === 'SLAP SHOT') return 0.65;
      return 0.5;
    }
    
    // Positioning/unpredictable AI has balanced priorities
    if (name === 'LASER BALL' || name === 'FIREBALL') return 0.95;
    if (name === 'GIANT BALL') return 0.9;
    if (name === 'SLAP SHOT') return 0.85;
    if (name === 'LIGHTNING STRIKE') return 0.8;
    if (name === 'SUPER SPEED') return 0.8;
    if (name === 'FREEZE x2') return 0.75;
    if (name === 'BANANA PEEL') return 0.7;
    return 0.6;
  }
  
  decideAIAction(allPlayers, balls) {
    if (!this.aiPersonality) return;
    
    const p = this.aiPersonality;
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    const myHalf = isBlue ? -1 : 1;
    
    // Don't override active high-priority states
    if (this.aiState === 'pickup' || this.aiState === 'powerup') return;
    
    // ── Count alive enemies and teammates ──
    const aliveEnemies = allPlayers.filter(pl => pl.team !== this.team && pl.alive);
    const aliveTeammates = allPlayers.filter(pl => pl.team === this.team && pl.alive && pl !== this);
    const teamHasBall = aliveTeammates.some(pl => pl.hasBall);
    
    // Determine preferred position based on personality and range
    let baseX = myHalf * 7;
    if (p.preferredRange === 'far') baseX = myHalf * 9.5;
    else if (p.preferredRange === 'close') baseX = myHalf * 4;
    else if (p.preferredRange === 'medium') baseX = myHalf * 7;
    
    if (this.hasBall) {
      // ═══ ATTACKING — advance toward throwing range, then face enemy ═══
      const nearestEnemy = this.findNearestEnemy(allPlayers);
      
      let targetX, targetZ;
      if (p.movementStyle === 'aggressive') {
        // Push toward center line for close-range power throws
        targetX = myHalf * (1.5 + Math.random() * 2.5);
      } else if (p.movementStyle === 'positioning') {
        // Stay in optimal shooting position — medium range
        targetX = myHalf * (5 + Math.random() * 2);
      } else if (p.movementStyle === 'defensive') {
        // Stay back but advance slightly
        targetX = myHalf * (7 + Math.random() * 3);
      } else {
        // Default: advance toward a good throwing position
        targetX = myHalf * (3 + Math.random() * 4);
      }
      
      // Aim laterally toward the nearest enemy's Z position (flanking)
      if (nearestEnemy) {
        const enemyZ = nearestEnemy.mesh.position.z;
        // Move toward their Z with some randomness for unpredictability
        targetZ = enemyZ * (0.4 + Math.random() * 0.4) + (Math.random() - 0.5) * 3;
      } else {
        targetZ = (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.6;
      }
      
      this.targetPos = new THREE.Vector3(targetX, 0, targetZ);
      this.aiState = 'attacking';
    } else {
      // ═══ NO BALL — strategic positioning ═══
      let wanderX, wanderZ;
      
      // If team has a ball, spread out to create space and dodging room
      if (teamHasBall) {
        // Position to avoid clustering — spread across the court depth
        const spreadOffset = aliveTeammates.length > 0 
          ? ((this.index % 3) - 1) * (CONFIG.COURT_DEPTH * 0.25)
          : 0;
        wanderX = baseX + (Math.random() - 0.5) * 4;
        wanderZ = spreadOffset + (Math.random() - 0.5) * 3;
      } else if (aliveEnemies.length <= 2 && aliveEnemies.length > 0) {
        // ── Few enemies left: position more aggressively near center ──
        wanderX = myHalf * (3 + Math.random() * 4);
        const nearestEnemy = this.findNearestEnemy(allPlayers);
        if (nearestEnemy) {
          wanderZ = nearestEnemy.mesh.position.z * 0.5 + (Math.random() - 0.5) * 4;
        } else {
          wanderZ = (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.5;
        }
      } else {
        // Default: personality-driven positioning with lateral movement
        if (p.movementStyle === 'defensive') {
          wanderX = myHalf * (7 + Math.random() * 3);
          wanderZ = (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.5;
        } else if (p.movementStyle === 'aggressive') {
          wanderX = myHalf * (2 + Math.random() * 3);
          wanderZ = (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.65;
        } else {
          wanderX = baseX + (Math.random() - 0.5) * 5;
          wanderZ = (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.55;
        }
      }
      
      // Clamp to reachable area
      const hw = CONFIG.COURT_WIDTH / 2;
      const hd = CONFIG.COURT_DEPTH / 2;
      if (isBlue) {
        wanderX = Math.max(-hw + 1, Math.min(-0.5, wanderX));
      } else {
        wanderX = Math.min(hw - 1, Math.max(0.5, wanderX));
      }
      wanderZ = Math.max(-hd + 1, Math.min(hd - 1, wanderZ));
      
      this.targetPos = new THREE.Vector3(wanderX, 0, wanderZ);
      this.aiState = 'wander';
    }
  }
  
  findBestTarget(allPlayers) {
    if (!this.aiPersonality) return this.findNearestEnemy(allPlayers);
    
    const p = this.aiPersonality;
    const enemies = allPlayers.filter(pl => pl.team !== this.team && pl.alive);
    
    if (enemies.length === 0) return null;
    
    // Score each enemy based on personality
    let bestTarget = null;
    let bestScore = -Infinity;
    
    enemies.forEach(enemy => {
      const dist = this.mesh.position.distanceTo(enemy.mesh.position);
      let score = 0;
      
      // Distance scoring based on preferred range
      if (p.preferredRange === 'far') {
        score += (dist > 10) ? 10 : (20 - dist);
      } else if (p.preferredRange === 'close') {
        score += (20 - dist);
      } else {
        score += (dist > 6 && dist < 12) ? 10 : (18 - Math.abs(dist - 9));
      }
      
      // Accuracy affects targeting - prefer stationary or slow targets
      if (enemy.velocity.length() < 1) {
        score += p.accuracy * 5;
      }
      
      // Aggression affects targeting - prefer low HP enemies
      score += p.aggression * (1 - enemy.hp / enemy.maxHp) * 8;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    });
    
    return bestTarget;
  }
  
  findNearestEnemy(allPlayers) {
    let nearest = null;
    let minDist = Infinity;
    allPlayers.forEach(p => {
      if (p.team !== this.team && p.alive) {
        const d = this.mesh.position.distanceTo(p.mesh.position);
        if (d < minDist) { minDist = d; nearest = p; }
      }
    });
    return nearest;
  }
  
  clampPosition() {
    const isBlue = this.team === CONFIG.TEAM_BLUE;
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    if (isBlue) {
      this.mesh.position.x = Math.max(-hw + 0.5, Math.min(-0.3, this.mesh.position.x));
    } else {
      this.mesh.position.x = Math.min(hw - 0.5, Math.max(0.3, this.mesh.position.x));
    }
    this.mesh.position.z = Math.max(-hd + 0.5, Math.min(hd - 0.5, this.mesh.position.z));
  }
  
  // ─── Actions ──────────────────────────────────────────
  takeDamage(amount) {
    if (this.invincible > 0) return false;
    this.hp -= amount;
    this.hitStun = 0.35;
    this.invincible = 0.5;
    this.setAnimState(ANIM.HIT_REACT);
    
    // Interrupt super speed when hit
    if (this.superSpeed) {
      this.superSpeed = false;
      this.superSpeedTime = 0;
      this.cleanupSpeedTrail();
    }
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.die();
      return true;
    }
    return false;
  }
  
  die() {
    this.setAnimState(ANIM.KO);
    
    // CRITICAL: Drop any held ball before dying!
    // Without this, the ball follows the dead player underground and gets permanently stuck
    this.dropBall();
    
    // Clean up all power-up effects when player dies
    this.cleanupFreezeEffect();
    this.cleanupLightningEffect();
    this.cleanupLaserAura();
    this.cleanupFireAura();
    this.cleanupBurnEffect();
    this.cleanupSpeedTrail();
    this.burning = false;
    this.burnDamageRemaining = 0;
    
    // Reset dodge cooldown so respawned players can dodge again
    this.dodgeCooldown = 0;
    this.isDodging = false;
    
    // Reset AI state so AI doesn't get stuck in old behaviors
    if (!this.isHuman) {
      this.aiState = 'idle';
      this.targetPos = null;
      this._ballSeekTimer = 0;
      this._aiThrowDelay = null;
      this._pickupGiveUpTimer = 0;
      this._stuckTimer = 0;
    }
    
    this.mesh.scale.y = 0.1;
    this.mesh.position.y = -0.2;
    this.mesh.traverse(child => {
      if (child.material) {
        child.material.transparent = true;
        child.material.opacity = 0.3;
      }
    });
  }
  
  pickupBall(ball) {
    this.hasBall = true;
    this.ball = ball;
    ball.held = true;
    ball.holder = this;
    ball.team = this.team;
  }
  
  // Drop the ball without throwing — places it on the floor at player's position
  dropBall() {
    if (!this.hasBall || !this.ball) return;
    const ball = this.ball;
    ball.held = false;
    ball.holder = null;
    ball.active = false;
    ball.team = null;
    ball.thrower = null;
    ball.velocity.set(0, 0, 0);
    ball.isLaserBall = false;
    ball.isFireball = false;
    ball.hasHitGround = false;
    ball._stuckCheckTimer = 0;
    ball.idleTime = 0;
    // Place ball at player's XZ but on the floor (not at player Y which may be underground)
    ball.mesh.position.set(
      this.mesh.position.x,
      CONFIG.BALL_RADIUS,
      this.mesh.position.z
    );
    ball.mesh.scale.setScalar(1.0);
    ball.glowMat.opacity = 0;
    ball.glow.scale.setScalar(1);
    ball.mesh.material.emissive.setHex(0x000000);
    ball.mesh.material.emissiveIntensity = 0;
    this.hasBall = false;
    this.ball = null;
  }
  
  startThrow(targetPlayer) {
    if (!this.hasBall || this.throwCooldown > 0) return false;
    // Randomize flip style for this throw (if not already set by charge preview)
    if (this.animState !== ANIM.CHARGE_WINDUP) {
      this.throwFlipStyle = Math.floor(Math.random() * 6); // 0=backflip, 1=tornado, 2=gainer, 3=corkscrew, 4=superman, 5=windmill
    }
    // Reset landing impact tracking for this new throw
    this.peakFlipHeight = 0;
    this.wasAirborne = false;
    this.landingTriggered = false;
    this.setAnimState(ANIM.WINDUP);
    // Face the throw target during windup
    if (targetPlayer && targetPlayer.mesh) {
      this.faceToward(targetPlayer.mesh.position.x, targetPlayer.mesh.position.z);
    }
    return true;
  }
  
  throwBall(targetPos, trickType = null, throwPower = 1.0) {
    if (!this.hasBall || this.throwCooldown > 0) return null;
    if (this.slipping || this.frozen || this.stunned) return null;
    // Don't reset THROW anim state — it auto-transitioned from WINDUP
    // and we want the spin to continue seamlessly through release
    if (this.animState !== ANIM.THROW) {
      this.setAnimState(ANIM.THROW);
    }
    // Snap-face toward throw target at release
    this.faceToward(targetPos.x, targetPos.z);
    const ball = this.ball;
    this.hasBall = false;
    this.ball = null;
    this.throwCooldown = 0.5;
    this.trickCharge = 0;
    this.throwCharging = false;
    ball.held = false;
    ball.holder = null;
    ball.active = true;
    ball.caught = false;
    ball.hasHitGround = false; // Reset ground flag for new throw
    ball.team = this.team;
    ball.trickType = trickType;
    ball.throwPower = throwPower; // Store for visual/sound variation
    
    // ── Normalize ball release position ──
    // During acrobatic flips the hand can be very high in the air.
    // We pin the release to a consistent "shoulder height" launch point
    // at the player's ground XZ so the throw arc stays predictable.
    const releaseHeight = 1.4; // consistent shoulder-height release
    ball.mesh.position.set(
      this.mesh.position.x,
      releaseHeight,
      this.mesh.position.z
    );
    
    // ── Calculate aim direction with proper 3D targeting ──
    // Target the enemy's body center (y=1.0) rather than ground position
    const aimTarget = new THREE.Vector3(targetPos.x, 1.0, targetPos.z);
    const toTarget = new THREE.Vector3().subVectors(aimTarget, ball.mesh.position);
    const horizontalDist = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z);
    
    // Horizontal direction (normalized XZ only)
    const dir = new THREE.Vector3(toTarget.x, 0, toTarget.z);
    if (dir.length() > 0.01) dir.normalize();
    
    // Apply throw power from charge bar (0→1) to speed and damage multipliers
    const tp = Math.max(0, Math.min(1, throwPower));
    let spdMult = CONFIG.THROW_CHARGE_SPEED_MIN + tp * (CONFIG.THROW_CHARGE_SPEED_MAX - CONFIG.THROW_CHARGE_SPEED_MIN);
    let dmgMult = CONFIG.THROW_CHARGE_DMG_MIN + tp * (CONFIG.THROW_CHARGE_DMG_MAX - CONFIG.THROW_CHARGE_DMG_MIN);
    
    // ── LASER BALL POWER-UP ──
    // Massive speed boost + instant KO damage + special visual flag
    if (this.laserBallReady) {
      spdMult *= 3.5; // 3.5x speed multiplier (insanely fast)
      dmgMult = 100;  // Instant KO damage
      ball.isLaserBall = true; // Flag for special rendering
      this.laserBallReady = false; // Consume the buff
      this.hasLaserBall = false;
    } else {
      ball.isLaserBall = false;
    }
    
    // ── FIREBALL POWER-UP ──
    // Enhanced fire trail + applies burn DOT on hit
    if (this.fireballReady) {
      spdMult *= 1.3; // Slightly faster
      ball.isFireball = true; // Flag for fire trail rendering + burn on hit
      this.fireballReady = false; // Consume the buff
      this.hasFireball = false;
    } else {
      ball.isFireball = false;
    }
    
    const baseSpeed = trickType ? CONFIG.BALL_TRICK_SPEED : CONFIG.BALL_SPEED;
    const speed = baseSpeed * spdMult;
    
    // ── Calculate proper Y velocity for arc to reach target ──
    // Use projectile physics: given horizontal speed and distance, compute
    // the Y velocity needed so the ball arrives at target height (1.0)
    // Gravity = CONFIG.BALL_GRAVITY (negative), release height = 1.4, target height = 1.0
    const travelTime = horizontalDist / Math.max(speed, 1); // time to reach target
    const dy = aimTarget.y - releaseHeight; // height difference (-0.4)
    // vy = (dy - 0.5 * g * t^2) / t — solve for initial Y velocity
    // g is negative so -0.5 * g = positive, giving upward push
    const vy = travelTime > 0.01 
      ? (dy - 0.5 * CONFIG.BALL_GRAVITY * travelTime * travelTime) / travelTime
      : 2;
    // Clamp vy to reasonable range so throws don't go crazy
    const clampedVy = Math.max(0.5, Math.min(8, vy));
    
    ball.velocity.set(dir.x * speed, clampedVy, dir.z * speed);
    const baseDamage = trickType ? trickType.damage : CONFIG.NORMAL_THROW_DAMAGE;
    ball.damage = Math.round(baseDamage * dmgMult);
    ball.thrower = this;
    if (trickType) {
      if (trickType.name === 'CURVEBALL') {
        ball.curve = (Math.random() > 0.5 ? 1 : -1) * 8;
      } else if (trickType.name === 'METEOR') {
        // High arc — boost Y velocity for dramatic lob but keep horizontal aim
        ball.velocity.y = Math.max(clampedVy + 3, 6);
      } else {
        ball.curve = 0;
      }
    } else {
      ball.curve = 0;
    }
    return ball;
  }
  
  // ─── Parkour Dodge ──────────────────────────────────────
  startDodge(dirX, dirZ) {
    // Can't dodge while already dodging, stunned, dead, throwing, slipping, or on cooldown
    if (!this.alive || this.isDodging || this.dodgeCooldown > 0) return false;
    if (this.slipping || this.frozen || this.stunned) return false;
    if (this.animState === ANIM.THROW || this.animState === ANIM.WINDUP ||
        this.animState === ANIM.CHARGE_WINDUP || this.animState === ANIM.KO ||
        this.animState === ANIM.HIT_REACT) return false;
    if (this.stamina < CONFIG.DODGE_STAMINA_COST) return false;
    
    // Consume stamina (with safety clamp to prevent negative)
    this.stamina = Math.max(0, this.stamina - CONFIG.DODGE_STAMINA_COST);
    this.dodgeCooldown = CONFIG.DODGE_COOLDOWN;
    
    // Randomize parkour style (0-7)
    this.dodgeStyle = Math.floor(Math.random() * 8);
    
    // Normalize dodge direction (uses movement input, or default to facing direction)
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len > 0.1) {
      this.dodgeDirX = dirX / len;
      this.dodgeDirZ = dirZ / len;
    } else {
      // Default: dodge in the direction the player is facing
      this.dodgeDirX = Math.sin(this.currentYRot);
      this.dodgeDirZ = Math.cos(this.currentYRot);
    }
    
    // Face dodge direction
    this.faceMovementDirection(this.dodgeDirX, this.dodgeDirZ);
    
    // Cancel throw charging if active
    if (this.throwCharging) {
      this.throwCharging = false;
      this.throwChargePower = 0;
    }
    
    this.isDodging = true;
    this.setAnimState(ANIM.DODGE);
    
    // Fire dodge start callback (for sound/effects)
    if (this.onDodgeStart) {
      this.onDodgeStart(this.mesh.position.clone(), this.dodgeStyle);
    }
    
    return true;
  }
  
  onCatchSuccess() {
    this.setAnimState(ANIM.CATCH_SUCCESS);
  }
  
  onDeflectSuccess() {
    this.isDeflecting = false;
    this.deflectWindow = 0;
    this.setAnimState(ANIM.DEFLECT_SUCCESS);
  }
  
  updateHPBar() {
    if (this.hpBarMesh) {
      const pct = this.hp / this.maxHp;
      this.hpBarMesh.scale.x = Math.max(0.001, pct);
      this.hpBarMesh.position.x = -(0.39 * (1 - pct));
      if (pct > 0.5) this.hpBarMesh.material.color.setHex(this.team === CONFIG.TEAM_BLUE ? 0x42a5f5 : 0xef5350);
      else if (pct > 0.25) this.hpBarMesh.material.color.setHex(0xffb300);
      else this.hpBarMesh.material.color.setHex(0xff1744);
      if (this.hpBarBg) {
        // Counter-rotate HP bar to always face camera regardless of character rotation
        // Since these are children of the rotating mesh group, we negate the parent's Y rot
        const counterY = -this.mesh.rotation.y;
        this.hpBarBg.rotation.y = counterY;
        this.hpBarMesh.rotation.y = counterY;
        // Billboard toward camera position (elevated behind)
        this.hpBarBg.lookAt(new THREE.Vector3(0, 20, 30));
        this.hpBarMesh.lookAt(new THREE.Vector3(0, 20, 30));
      }
    }
    
    // Also counter-rotate selection ring so it stays flat on ground
    if (this.selectionRing) {
      // Ring is already flat (rotated -PI/2 on X), just counter-rotate Y
      // No action needed — ring is circular so Y rotation doesn't matter
    }
  }
}