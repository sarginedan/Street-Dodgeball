import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Gym } from './Gym.js';
import { Player } from './Player.js';
import { Ball } from './Ball.js';
import { EffectsManager } from './Effects.js';
import { SoundManager } from './SoundManager.js';
import { PowerUp, POWERUP_TYPES } from './PowerUp.js';
import { GiantBall } from './GiantBall.js';
import { BananaPeel } from './BananaPeel.js';
import { HockeyStick } from './HockeyStick.js';
import { TrapDoor } from './TrapDoor.js';
import { LEVELS, setCurrentLevel, getCurrentLevel } from './levels.js';
import { RankSystem, RANK_ICONS, TIER_COLORS, XP_AWARDS } from './RankSystem.js';
import { AchievementSystem, ACHIEVEMENT_DEFS, TIER_NAMES, TIER_COLORS as ACHIEVE_TIER_COLORS, TIER_ICONS } from './AchievementSystem.js';

// ─── Game State ─────────────────────────────────────────
let scene, camera, renderer;
let gym, effects, sound;
let players = [];
let balls = [];
let powerUps = [];
let giantBalls = [];
let bananaPeels = [];
let hockeySticks = [];
let trapDoors = [];
let keys = {};
let gameState = 'menu'; // menu, playing, gameover
let humanPlayer = null;
let _deathOverlayShown = false;
let clock;
let gameTimeScale = 1.0; // Time scale for slow-motion effects

// ─── Power-Up Filter State ─────────────────────────────────────
let enabledPowerups = new Set([
  'GIANT_BALL', 'FREEZE_TWO', 'LIGHTNING', 'LASER_BALL',
  'FIREBALL', 'BANANA_PEEL', 'SUPER_SPEED', 'SLAP_SHOT', 'TRAP_DOOR'
]); // All enabled by default

// ─── Ranking System ─────────────────────────────────────
const rankSystem = new RankSystem();
const achievements = new AchievementSystem();

// ─── Mobile Input State ─────────────────────────────────
const mobileInput = {
  active: false,
  joystickX: 0,
  joystickY: 0,
  charging: false,
  joystickTouchId: null,
  actionTouchId: null,
  chargeTouchId: null,
};

// ─── Free Look Camera State ─────────────────────────────
const freeLook = {
  active: false,
  // Spherical coords relative to orbit target
  theta: 0,       // horizontal angle
  phi: Math.PI / 4, // vertical angle (from top)
  radius: 18,
  minRadius: 3,
  maxRadius: 40,
  target: new THREE.Vector3(0, 1.5, 0),
  // Drag state
  dragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  sensitivity: 0.005,
  // Pinch zoom for mobile
  lastPinchDist: 0,
  pinchTouchIds: [],
};

// ─── Game Camera Manual Control ─────────────────────────────
const gameCameraControl = {
  dragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  offsetX: 0,     // manual horizontal pan offset
  offsetY: 0,     // manual vertical pan offset
  zoom: 0,        // zoom level (negative = zoom in, positive = zoom out)
  minZoom: -7,    // closest zoom (7 units closer than default)
  maxZoom: 12,    // furthest zoom (12 units further than default)
};

// ─── Third Person Camera ─────────────────────────────
const thirdPersonCam = {
  active: false,
  distance: 6,      // distance behind player
  height: 3,        // height above player
  heightOffset: 1.5, // look point offset from player ground position
  smoothness: 12,    // camera follow smoothness (higher = smoother)
  currentPos: new THREE.Vector3(),
  currentLookAt: new THREE.Vector3(),
  angle: 0,         // manual camera angle control (horizontal rotation around player)
  dragging: false,  // mouse drag state
  lastMouseX: 0,
  lastMouseY: 0,
};

// ─── Initialize ─────────────────────────────────────────
function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.insertBefore(renderer.domElement, document.body.firstChild);
  renderer.domElement.id = 'game-canvas';
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.FogExp2(0x1a1a2e, 0.012);
  
  // Camera — inside gym, elevated side-scroll view
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, CONFIG.CAMERA_HEIGHT, CONFIG.CAMERA_DISTANCE);
  camera.lookAt(0, 0, -2);
  
  // Lighting
  setupLighting();
  
  // Build gym
  gym = new Gym(scene);
  
  // Effects
  effects = new EffectsManager(scene);
  
  // Sound
  sound = new SoundManager();
  
  // Clock
  clock = new THREE.Clock();
  
  // Input
  setupInput();
  
  // Mobile input
  setupMobileInput();
  
  // Free look camera
  setupFreeLook();
  
  // Game camera controls (drag + zoom)
  setupGameCameraControls();
  
  // UI
  setupUI();
  
  // Achievements UI (start screen modal)
  initAchievementsUI();
  
  // Resize
  window.addEventListener('resize', onResize);
  
  // Initialize rank HUD with persisted data on boot
  updateRankHUD();
  
  // Start render loop
  animate();
}

// ─── Lighting ─────────────────────────────────────────
let mainLight, ambientLight, fillLight, backLight;

function setupLighting() {
  // Ambient — warm gym feel
  ambientLight = new THREE.AmbientLight(0xfff0d4, 0.6);
  scene.add(ambientLight);
  
  // Main directional (simulates light from windows on back wall)
  mainLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
  mainLight.position.set(5, 15, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 1;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.camera.left = -22;
  mainLight.shadow.camera.right = 22;
  mainLight.shadow.camera.top = 18;
  mainLight.shadow.camera.bottom = -18;
  mainLight.shadow.bias = -0.001;
  scene.add(mainLight);
  
  // Fill light from below/front for player visibility
  fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.35);
  fillLight.position.set(-3, 4, 18);
  scene.add(fillLight);
  
  // Back wall fill (window glow)
  const backFill = new THREE.DirectionalLight(0x87ceeb, 0.3);
  backFill.position.set(0, 8, -15);
  scene.add(backFill);
  
  // Overhead point lights (fluorescent ceiling fixtures)
  const lightPositions = [
    [-9, 9.5, -3], [0, 9.5, -3], [9, 9.5, -3],
    [-9, 9.5, 3], [0, 9.5, 3], [9, 9.5, 3],
  ];
  lightPositions.forEach(([x, y, z]) => {
    const pl = new THREE.PointLight(0xfff3cd, 0.5, 20, 1.5);
    pl.position.set(x, y, z);
    scene.add(pl);
  });
  
  // Hemisphere light — sky above, warm floor bounce
  const hemi = new THREE.HemisphereLight(0x87ceeb, 0xd4a056, 0.3);
  scene.add(hemi);
}

// ─── Update Scene for Level ─────────────────────────────────────────
function updateSceneForLevel(levelConfig) {
  const isStreet = levelConfig.id === 'street-court';
  const isColosseum = levelConfig.id === 'colosseum';
  
  // Scene background — outdoor levels use dark sky (sky dome handles visual)
  if (isStreet || isColosseum) {
    scene.background = new THREE.Color(isColosseum ? 0x0e0820 : 0x0d0b1a);
  } else if (levelConfig.skyColor) {
    scene.background = new THREE.Color(levelConfig.skyColor);
  } else {
    scene.background = new THREE.Color(0x1a1a2e);
  }
  
  // Fog
  if (isStreet) {
    scene.fog = new THREE.FogExp2(0x1a0e05, 0.012);
  } else if (isColosseum) {
    scene.fog = new THREE.FogExp2(0x3a2010, 0.008);
  } else {
    scene.fog = new THREE.FogExp2(levelConfig.fogColor, 1 / levelConfig.fogFar);
  }
  
  // Update lighting for level
  if (ambientLight) {
    ambientLight.color.setHex(levelConfig.ambientColor);
    ambientLight.intensity = levelConfig.ambientIntensity;
  }
  
  if (mainLight) {
    mainLight.color.setHex(levelConfig.lightColor);
    mainLight.intensity = levelConfig.lightIntensity;
    if (isStreet) {
      // Sun-like directional from behind/above for golden-hour look
      mainLight.position.set(-15, 12, -20);
    } else if (isColosseum) {
      // Dramatic low-angle sunset light from behind the colosseum
      mainLight.position.set(-20, 14, -25);
    } else {
      mainLight.position.set(5, 15, 10);
    }
  }
  
  if (fillLight) {
    if (isStreet) {
      fillLight.color.setHex(0xffc080);
      fillLight.intensity = 0.5;
    } else if (isColosseum) {
      // Warm torch-like fill light
      fillLight.color.setHex(0xff9944);
      fillLight.intensity = 0.45;
    } else {
      fillLight.color.setHex(0xc8d8f0);
      fillLight.intensity = 0.35;
    }
  }
}

// ─── Input ─────────────────────────────────────────
function setupInput() {
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'KeyF' && (gameState === 'playing' || gameState === 'gameover')) {
      toggleFreeLook();
    }
    
    if (e.code === 'Escape' && freeLook.active) {
      toggleFreeLook();
    }
    
    // M key = global mute toggle
    if (e.code === 'KeyM') {
      const muteBtn = document.getElementById('mute-toggle');
      const audioBtn = document.getElementById('audio-btn');
      const muted = sound.toggleMute();
      muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Unmuted';
      muteBtn.classList.toggle('muted', muted);
      audioBtn.textContent = muted ? '🔇' : '🔊';
      audioBtn.classList.toggle('muted', muted);
    }
    
    // 4 key = next music track
    if (e.code === 'Digit4' && gameState === 'playing') {
      sound.nextTrack();
      showNextTrackIndicator();
    }
    
    if (e.code === 'Digit1' && gameState === 'playing' && !freeLook.active) {
      handleActionDown();
    }
    
    // SPACE = Parkour Dodge
    if (e.code === 'Space' && gameState === 'playing' && !freeLook.active) {
      e.preventDefault();
      handleDodge();
    }
    
    // TAB = Take over teammate when dead
    if (e.code === 'Tab' && gameState === 'playing') {
      e.preventDefault();
      switchToTeammate();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    
    if (e.code === 'Digit1' && gameState === 'playing') {
      handleActionUp();
    }
  });
}

// ─── Mobile Input ─────────────────────────────────────────
function setupMobileInput() {
  // Detect mobile
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 768;
  
  // Show correct start screen hints
  if (isMobile) {
    const dh = document.getElementById('desktop-controls');
    const mh = document.getElementById('mobile-start-hint');
    if (dh) dh.style.display = 'none';
    if (mh) mh.style.display = 'flex';
    mobileInput.active = true;
  }
  
  const joystickZone = document.getElementById('joystick-zone');
  const joystickThumb = document.getElementById('joystick-thumb');
  const btnAction = document.getElementById('btn-action');
  const btnCharge = document.getElementById('btn-charge');
  
  if (!joystickZone || !btnAction || !btnCharge) return;
  
  const baseRadius = 75; // half of 150px base
  const thumbRadius = 28; // half of 56px thumb
  const maxDist = baseRadius - thumbRadius;
  
  // ── Joystick Touch ──
  joystickZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    mobileInput.joystickTouchId = touch.identifier;
    handleJoystickMove(touch);
  }, { passive: false });
  
  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileInput.joystickTouchId) {
        handleJoystickMove(e.changedTouches[i]);
      }
    }
  }, { passive: false });
  
  const resetJoystick = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileInput.joystickTouchId) {
        mobileInput.joystickTouchId = null;
        mobileInput.joystickX = 0;
        mobileInput.joystickY = 0;
        joystickThumb.style.top = (baseRadius - thumbRadius) + 'px';
        joystickThumb.style.left = (baseRadius - thumbRadius) + 'px';
      }
    }
  };
  
  joystickZone.addEventListener('touchend', resetJoystick, { passive: false });
  joystickZone.addEventListener('touchcancel', resetJoystick, { passive: false });
  
  function handleJoystickMove(touch) {
    const rect = joystickZone.getBoundingClientRect();
    const cx = rect.left + baseRadius;
    const cy = rect.top + baseRadius;
    
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    
    // Normalize to -1..1
    mobileInput.joystickX = dx / maxDist;
    mobileInput.joystickY = dy / maxDist;
    
    // Move thumb visually
    joystickThumb.style.left = (baseRadius - thumbRadius + dx) + 'px';
    joystickThumb.style.top = (baseRadius - thumbRadius + dy) + 'px';
  }
  
  // ── Action Button (hold-to-charge on mobile) ──
  btnAction.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mobileInput.actionTouchId = e.changedTouches[0].identifier;
    btnAction.classList.add('active');
    if (gameState === 'playing') handleActionDown();
  }, { passive: false });
  
  const resetAction = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileInput.actionTouchId) {
        mobileInput.actionTouchId = null;
        btnAction.classList.remove('active');
        if (gameState === 'playing') handleActionUp();
      }
    }
  };
  btnAction.addEventListener('touchend', resetAction, { passive: false });
  btnAction.addEventListener('touchcancel', resetAction, { passive: false });
  
  // ── Charge Button ──
  btnCharge.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mobileInput.chargeTouchId = e.changedTouches[0].identifier;
    mobileInput.charging = true;
    btnCharge.classList.add('active');
  }, { passive: false });
  
  const resetCharge = (e) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === mobileInput.chargeTouchId) {
        mobileInput.chargeTouchId = null;
        mobileInput.charging = false;
        btnCharge.classList.remove('active');
      }
    }
  };
  btnCharge.addEventListener('touchend', resetCharge, { passive: false });
  btnCharge.addEventListener('touchcancel', resetCharge, { passive: false });
  
  // ── Mobile Takeover Button ──
  const mobileTakeoverBtn = document.getElementById('mobile-takeover-btn');
  if (mobileTakeoverBtn) {
    mobileTakeoverBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchToTeammate();
    });
  }
}

// ─── Free Look Camera ─────────────────────────────────────────
function setupFreeLook() {
  const btn = document.getElementById('freelook-btn');
  const canvas = renderer.domElement;
  
  // Toggle button click (only if button exists)
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (gameState === 'playing' || gameState === 'gameover') {
        toggleFreeLook();
      }
    });
  }
  
  // Mouse drag for orbit
  canvas.addEventListener('mousedown', (e) => {
    if (!freeLook.active) return;
    freeLook.dragging = true;
    freeLook.lastMouseX = e.clientX;
    freeLook.lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  
  window.addEventListener('mousemove', (e) => {
    if (!freeLook.active || !freeLook.dragging) return;
    const dx = e.clientX - freeLook.lastMouseX;
    const dy = e.clientY - freeLook.lastMouseY;
    freeLook.lastMouseX = e.clientX;
    freeLook.lastMouseY = e.clientY;
    
    freeLook.theta -= dx * freeLook.sensitivity;
    freeLook.phi -= dy * freeLook.sensitivity;
    
    // Clamp phi to avoid flipping
    freeLook.phi = Math.max(0.1, Math.min(Math.PI - 0.1, freeLook.phi));
  });
  
  window.addEventListener('mouseup', () => {
    if (!freeLook.active) return;
    freeLook.dragging = false;
    renderer.domElement.style.cursor = 'grab';
  });
  
  // Scroll for zoom
  canvas.addEventListener('wheel', (e) => {
    if (!freeLook.active) return;
    e.preventDefault();
    const zoomSpeed = freeLook.radius * 0.1;
    freeLook.radius += e.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    freeLook.radius = Math.max(freeLook.minRadius, Math.min(freeLook.maxRadius, freeLook.radius));
  }, { passive: false });
  
  // Touch support for orbit + pinch zoom
  canvas.addEventListener('touchstart', (e) => {
    if (!freeLook.active) return;
    if (e.touches.length === 1) {
      freeLook.dragging = true;
      freeLook.lastMouseX = e.touches[0].clientX;
      freeLook.lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      freeLook.dragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      freeLook.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: true });
  
  canvas.addEventListener('touchmove', (e) => {
    if (!freeLook.active) return;
    if (e.touches.length === 1 && freeLook.dragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - freeLook.lastMouseX;
      const dy = e.touches[0].clientY - freeLook.lastMouseY;
      freeLook.lastMouseX = e.touches[0].clientX;
      freeLook.lastMouseY = e.touches[0].clientY;
      freeLook.theta -= dx * freeLook.sensitivity * 1.5;
      freeLook.phi -= dy * freeLook.sensitivity * 1.5;
      freeLook.phi = Math.max(0.1, Math.min(Math.PI - 0.1, freeLook.phi));
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (freeLook.lastPinchDist > 0) {
        const scale = freeLook.lastPinchDist / dist;
        freeLook.radius *= scale;
        freeLook.radius = Math.max(freeLook.minRadius, Math.min(freeLook.maxRadius, freeLook.radius));
      }
      freeLook.lastPinchDist = dist;
    }
  }, { passive: false });
  
  canvas.addEventListener('touchend', (e) => {
    if (!freeLook.active) return;
    if (e.touches.length < 2) {
      freeLook.lastPinchDist = 0;
    }
    if (e.touches.length === 0) {
      freeLook.dragging = false;
    }
  }, { passive: true });
}

function toggleFreeLook() {
  freeLook.active = !freeLook.active;
  
  const btn = document.getElementById('freelook-btn');
  const hint = document.getElementById('freelook-hint');
  const crosshair = document.getElementById('freelook-crosshair');
  
  if (freeLook.active) {
    // Capture current camera state to initialize orbit
    const camPos = camera.position.clone();
    // Use human player position or origin as target
    if (humanPlayer && humanPlayer.alive) {
      freeLook.target.copy(humanPlayer.mesh.position).add(new THREE.Vector3(0, 1.5, 0));
    } else {
      freeLook.target.set(0, 1.5, 0);
    }
    
    const offset = camPos.clone().sub(freeLook.target);
    freeLook.radius = offset.length();
    freeLook.theta = Math.atan2(offset.x, offset.z);
    freeLook.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / freeLook.radius)));
    
    btn.classList.add('active');
    btn.innerHTML = '<span class="icon">🎮</span> GAME CAM';
    hint.style.display = 'block';
    crosshair.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';
    
    // Auto-hide hint
    setTimeout(() => { hint.style.display = 'none'; }, 4000);
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<span class="icon">📷</span> FREE LOOK';
    hint.style.display = 'none';
    crosshair.style.display = 'none';
    freeLook.dragging = false;
    renderer.domElement.style.cursor = '';
  }
}

function updateFreeLookCamera() {
  if (!freeLook.active) return;
  
  // Spherical to cartesian
  const x = freeLook.radius * Math.sin(freeLook.phi) * Math.sin(freeLook.theta);
  const y = freeLook.radius * Math.cos(freeLook.phi);
  const z = freeLook.radius * Math.sin(freeLook.phi) * Math.cos(freeLook.theta);
  
  camera.position.set(
    freeLook.target.x + x,
    freeLook.target.y + y,
    freeLook.target.z + z
  );
  camera.lookAt(freeLook.target);
}

function toggleThirdPerson() {
  thirdPersonCam.active = !thirdPersonCam.active;
  const btn = document.getElementById('thirdperson-btn');
  const hint = document.getElementById('camera-hint');
  
  if (thirdPersonCam.active) {
    // Disable free look if active
    if (freeLook.active) toggleFreeLook();
    
    // Initialize camera angle to current camera position relative to player
    if (humanPlayer && humanPlayer.alive) {
      const toCamera = new THREE.Vector3().subVectors(camera.position, humanPlayer.mesh.position);
      toCamera.y = 0;
      toCamera.normalize();
      // Calculate angle where 0 = +Z, PI/2 = +X
      thirdPersonCam.angle = Math.atan2(toCamera.x, toCamera.z);
    } else {
      // Default: camera at positive Z (behind blue team)
      thirdPersonCam.angle = 0;
    }
    
    // Initialize camera position to current position to avoid jarring jump
    thirdPersonCam.currentPos.copy(camera.position);
    if (humanPlayer && humanPlayer.alive) {
      const lookTarget = new THREE.Vector3(
        humanPlayer.mesh.position.x,
        humanPlayer.mesh.position.y + thirdPersonCam.heightOffset,
        humanPlayer.mesh.position.z
      );
      thirdPersonCam.currentLookAt.copy(lookTarget);
    }
    
    btn.classList.add('active');
    btn.innerHTML = '<span class="icon">🎮</span> NORMAL CAM';
    
    // Show hint
    if (hint) {
      hint.textContent = '🖱️ Drag to rotate • Scroll to zoom';
      hint.style.display = 'block';
      setTimeout(() => { hint.style.display = 'none'; }, 4000);
    }
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '<span class="icon">🎥</span> THIRD PERSON';
    if (hint) hint.style.display = 'none';
  }
}

function updateThirdPersonCamera(dt) {
  if (!thirdPersonCam.active || !humanPlayer) return;
  
  const player = humanPlayer;
  const playerPos = player.mesh.position.clone();
  
  // Use FIXED camera angle (not player facing)
  // This prevents the circular movement issue
  // Camera angle stays constant until manually rotated
  const cameraAngle = thirdPersonCam.angle;
  
  // Calculate camera position using fixed angle
  // Angle 0 = camera behind player looking toward +Z
  // PI = camera in front looking toward -Z
  const offsetX = Math.sin(cameraAngle) * thirdPersonCam.distance;
  const offsetZ = Math.cos(cameraAngle) * thirdPersonCam.distance;
  
  // Target camera position (offset from player, raised up)
  const targetCamPos = new THREE.Vector3(
    playerPos.x + offsetX,
    playerPos.y + thirdPersonCam.height,
    playerPos.z + offsetZ
  );
  
  // Smooth lerp to target position
  const lerpFactor = Math.min(1, thirdPersonCam.smoothness * dt);
  thirdPersonCam.currentPos.lerp(targetCamPos, lerpFactor);
  camera.position.copy(thirdPersonCam.currentPos);
  
  // Look at point slightly above player (chest/head level)
  const targetLookAt = new THREE.Vector3(
    playerPos.x,
    playerPos.y + thirdPersonCam.heightOffset,
    playerPos.z
  );
  
  // Smooth look-at interpolation
  thirdPersonCam.currentLookAt.lerp(targetLookAt, lerpFactor);
  camera.lookAt(thirdPersonCam.currentLookAt);
}

// ─── Game Camera Controls (Drag + Zoom) ─────────────────────────────────────
function setupGameCameraControls() {
  const canvas = renderer.domElement;
  
  // Mouse drag
  canvas.addEventListener('mousedown', (e) => {
    if (freeLook.active) return; // Don't interfere with free look
    if (gameState !== 'playing') return;
    
    if (thirdPersonCam.active) {
      // Third person: rotate camera
      thirdPersonCam.dragging = true;
      thirdPersonCam.lastMouseX = e.clientX;
      thirdPersonCam.lastMouseY = e.clientY;
    } else {
      // Normal camera: pan
      gameCameraControl.dragging = true;
      gameCameraControl.lastMouseX = e.clientX;
      gameCameraControl.lastMouseY = e.clientY;
    }
    canvas.style.cursor = 'grabbing';
  });
  
  window.addEventListener('mousemove', (e) => {
    // Third person camera rotation
    if (thirdPersonCam.dragging && thirdPersonCam.active) {
      const dx = e.clientX - thirdPersonCam.lastMouseX;
      const dy = e.clientY - thirdPersonCam.lastMouseY;
      thirdPersonCam.lastMouseX = e.clientX;
      thirdPersonCam.lastMouseY = e.clientY;
      
      // Horizontal drag rotates camera around player
      thirdPersonCam.angle -= dx * 0.005;
      
      // Vertical drag adjusts camera height
      thirdPersonCam.height = Math.max(1, Math.min(8, thirdPersonCam.height - dy * 0.02));
      
      return;
    }
    
    // Normal camera pan
    if (!gameCameraControl.dragging) return;
    
    const dx = e.clientX - gameCameraControl.lastMouseX;
    const dy = e.clientY - gameCameraControl.lastMouseY;
    gameCameraControl.lastMouseX = e.clientX;
    gameCameraControl.lastMouseY = e.clientY;
    
    // Pan camera: horizontal movement affects X offset, vertical affects Y offset
    gameCameraControl.offsetX -= dx * 0.02;
    gameCameraControl.offsetY += dy * 0.02;
    
    // Clamp offsets to reasonable ranges
    gameCameraControl.offsetX = Math.max(-10, Math.min(10, gameCameraControl.offsetX));
    gameCameraControl.offsetY = Math.max(-5, Math.min(5, gameCameraControl.offsetY));
  });
  
  window.addEventListener('mouseup', () => {
    if (gameCameraControl.dragging) {
      gameCameraControl.dragging = false;
      canvas.style.cursor = '';
    }
    if (thirdPersonCam.dragging) {
      thirdPersonCam.dragging = false;
      canvas.style.cursor = '';
    }
  });
  
  // Mouse wheel zoom — works on both window and canvas
  const handleWheel = (e) => {
    if (freeLook.active) return; // Don't interfere with free look
    if (gameState !== 'playing' && gameState !== 'gameover') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Normalize deltaY across browsers (line vs pixel scroll modes)
    let rawDelta = e.deltaY;
    // deltaMode 1 = lines (Firefox), 0 = pixels (Chrome/Safari)
    if (e.deltaMode === 1) rawDelta *= 30; // convert lines to ~pixels
    
    if (thirdPersonCam.active) {
      // Third person: adjust camera distance
      const distanceStep = Math.sign(rawDelta) * 0.3;
      thirdPersonCam.distance = Math.max(2, Math.min(15, thirdPersonCam.distance + distanceStep));
    } else {
      // Normal camera: zoom
      const zoomStep = Math.sign(rawDelta) * Math.min(2.0, Math.abs(rawDelta) / 80) * 1.2;
      gameCameraControl.zoom += zoomStep;
      gameCameraControl.zoom = Math.max(gameCameraControl.minZoom, Math.min(gameCameraControl.maxZoom, gameCameraControl.zoom));
    }
  };
  
  window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  
  // Touch drag (mobile)
  let touchStartX = 0, touchStartY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (freeLook.active) return;
    if (gameState !== 'playing') return;
    if (e.touches.length !== 1) return; // Only single-finger drag
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    if (thirdPersonCam.active) {
      thirdPersonCam.dragging = true;
      thirdPersonCam.lastMouseX = touch.clientX;
      thirdPersonCam.lastMouseY = touch.clientY;
    } else {
      gameCameraControl.dragging = true;
    }
  });
  
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    
    // Third person camera rotation
    if (thirdPersonCam.dragging && thirdPersonCam.active) {
      const dx = touch.clientX - thirdPersonCam.lastMouseX;
      const dy = touch.clientY - thirdPersonCam.lastMouseY;
      thirdPersonCam.lastMouseX = touch.clientX;
      thirdPersonCam.lastMouseY = touch.clientY;
      
      // Horizontal drag rotates camera around player
      thirdPersonCam.angle -= dx * 0.005;
      
      // Vertical drag adjusts camera height
      thirdPersonCam.height = Math.max(1, Math.min(8, thirdPersonCam.height - dy * 0.02));
      
      return;
    }
    
    // Normal camera pan
    if (!gameCameraControl.dragging) return;
    
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    gameCameraControl.offsetX -= dx * 0.02;
    gameCameraControl.offsetY += dy * 0.02;
    
    gameCameraControl.offsetX = Math.max(-10, Math.min(10, gameCameraControl.offsetX));
    gameCameraControl.offsetY = Math.max(-5, Math.min(5, gameCameraControl.offsetY));
  });
  
  canvas.addEventListener('touchend', () => {
    gameCameraControl.dragging = false;
    thirdPersonCam.dragging = false;
  });
}

// ─── UI ─────────────────────────────────────────
function setupUI() {
  // HP Selection
  const hpOptions = document.querySelectorAll('.hp-option');
  hpOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      hpOptions.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const hpValue = parseInt(btn.dataset.hp);
      CONFIG.PLAYER_HP = hpValue;
    });
  });
  
  // Power-Up Density Selection
  const powerupOptions = document.querySelectorAll('.powerup-option');
  powerupOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      powerupOptions.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const densityValue = parseInt(btn.dataset.density);
      CONFIG.POWERUP_SPAWN_CHANCE = densityValue / 100; // Convert percentage to 0-1 range
    });
  });
  
  // Power-Up Filter (toggle individual power-ups on/off for testing)
  const powerupToggles = document.querySelectorAll('.powerup-toggle');
  powerupToggles.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('selected');
      updateEnabledPowerups();
    });
  });
  
  // Power-Up Filter - Select All / Deselect All
  document.getElementById('powerup-select-all').addEventListener('click', () => {
    powerupToggles.forEach(btn => btn.classList.add('selected'));
    updateEnabledPowerups();
  });
  
  document.getElementById('powerup-deselect-all').addEventListener('click', () => {
    powerupToggles.forEach(btn => btn.classList.remove('selected'));
    updateEnabledPowerups();
  });
  
  // Power-Up Filter - Toggle Expand/Collapse
  const filterToggleBtn = document.getElementById('powerup-filter-toggle-btn');
  const filterContainer = document.getElementById('powerup-filter-container');
  filterToggleBtn.addEventListener('click', () => {
    const isExpanded = filterContainer.style.display !== 'none';
    filterContainer.style.display = isExpanded ? 'none' : 'flex';
    filterToggleBtn.classList.toggle('expanded', !isExpanded);
  });
  
  // Level selection
  const levelCards = document.querySelectorAll('.level-card');
  levelCards.forEach(card => {
    card.addEventListener('click', () => {
      const levelId = card.dataset.level;
      const badge = card.querySelector('.level-badge');
      
      // Don't allow "Coming Soon" levels
      if (badge && badge.textContent === 'COMING SOON') {
        return;
      }
      
      setCurrentLevel(levelId);
      startGame();
    });
  });
  
  document.getElementById('restart-btn').addEventListener('click', () => {
    // Stop outro music immediately
    sound.stopOutroMusic();
    
    document.getElementById('game-over').classList.remove('active');
    // Reset AAR, rank-up banner, and flash
    const aar = document.getElementById('aar-container');
    if (aar) aar.style.display = 'none';
    const banner = document.getElementById('rankup-banner');
    if (banner) banner.classList.remove('active', 'fadeout');
    const flash = document.getElementById('rankup-flash');
    if (flash) flash.classList.remove('active');
    startGame();
  });
  
  document.getElementById('main-menu-btn').addEventListener('click', () => {
    // Stop outro music immediately
    sound.stopOutroMusic();
    
    // Hide game-over screen
    document.getElementById('game-over').classList.remove('active');
    // Reset AAR, rank-up banner, and flash
    const aar = document.getElementById('aar-container');
    if (aar) aar.style.display = 'none';
    const banner = document.getElementById('rankup-banner');
    if (banner) banner.classList.remove('active', 'fadeout');
    const flash = document.getElementById('rankup-flash');
    if (flash) flash.classList.remove('active');
    
    // Show start screen (use style.display since startGame() hides it with style.display)
    document.getElementById('start-screen').style.display = '';
    gameState = 'menu';
  });
  
  // ─── Third Person Camera Toggle ─────────────────────────────
  const thirdPersonBtn = document.getElementById('thirdperson-btn');
  thirdPersonBtn.addEventListener('click', () => {
    if (gameState === 'playing' || gameState === 'gameover') {
      toggleThirdPerson();
    }
  });
  
  // ─── Audio Settings Panel ─────────────────────────────
  const audioBtn = document.getElementById('audio-btn');
  const audioPanel = document.getElementById('audio-panel');
  const musicSlider = document.getElementById('music-slider');
  const sfxSlider = document.getElementById('sfx-slider');
  const musicPct = document.getElementById('music-vol-pct');
  const sfxPct = document.getElementById('sfx-vol-pct');
  const muteToggle = document.getElementById('mute-toggle');
  
  // Toggle panel open/close
  audioBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audioPanel.classList.toggle('visible');
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!audioPanel.contains(e.target) && e.target !== audioBtn) {
      audioPanel.classList.remove('visible');
    }
  });
  
  // Music slider
  musicSlider.addEventListener('input', () => {
    const val = parseInt(musicSlider.value);
    musicPct.textContent = val + '%';
    sound.setMusicVolume(val / 100);
  });
  
  // SFX slider
  sfxSlider.addEventListener('input', () => {
    const val = parseInt(sfxSlider.value);
    sfxPct.textContent = val + '%';
    sound.setSfxVolume(val / 100);
  });
  
  // Mute toggle
  muteToggle.addEventListener('click', () => {
    const muted = sound.toggleMute();
    muteToggle.textContent = muted ? '🔇 Muted' : '🔊 Unmuted';
    muteToggle.classList.toggle('muted', muted);
    audioBtn.textContent = muted ? '🔇' : '🔊';
    audioBtn.classList.toggle('muted', muted);
  });
  
  // Prevent sliders from triggering game input
  audioPanel.addEventListener('keydown', (e) => e.stopPropagation());
  audioPanel.addEventListener('keyup', (e) => e.stopPropagation());
  
  // ─── Reset Progress Button ─────────────────────────────
  const resetBtn = document.getElementById('reset-progress-btn');
  const resetModal = document.getElementById('reset-confirm-modal');
  const resetCancelBtn = document.getElementById('reset-cancel-btn');
  const resetConfirmBtn = document.getElementById('reset-confirm-btn');
  
  if (resetBtn && resetModal) {
    resetBtn.addEventListener('click', () => {
      resetModal.classList.add('active');
    });
    
    resetCancelBtn.addEventListener('click', () => {
      resetModal.classList.remove('active');
    });
    
    // Click outside card to cancel
    resetModal.addEventListener('click', (e) => {
      if (e.target === resetModal) {
        resetModal.classList.remove('active');
      }
    });
    
    resetConfirmBtn.addEventListener('click', () => {
      // Wipe all saved progress
      try {
        localStorage.removeItem('streetDodgeball_rank');
        localStorage.removeItem('streetDodgeball_achievements');
      } catch(e) {}
      
      // Re-initialize systems from clean state
      rankSystem.xp = 0;
      rankSystem.matchXPLog = [];
      rankSystem.currentRankIndex = rankSystem.getRankIndex();
      
      // Reset achievement stats and unlocks to defaults
      ACHIEVEMENT_DEFS.forEach(def => {
        achievements.stats[def.id] = 0;
        achievements.unlocked[def.id] = 0;
      });
      achievements.pendingXP = 0;
      achievements.notificationQueue = [];
      
      // Update all UI to reflect fresh state
      updateRankHUD();
      
      // Close modal
      resetModal.classList.remove('active');
    });
  }
}

// Update enabled power-ups based on UI selection
function updateEnabledPowerups() {
  enabledPowerups.clear();
  const powerupToggles = document.querySelectorAll('.powerup-toggle');
  let selectedCount = 0;
  powerupToggles.forEach(btn => {
    if (btn.classList.contains('selected')) {
      enabledPowerups.add(btn.dataset.powerup);
      selectedCount++;
    }
  });
  
  // Update toggle button counter
  const filterToggleBtn = document.getElementById('powerup-filter-toggle-btn');
  if (filterToggleBtn) {
    filterToggleBtn.textContent = `🎯 Power-Up Types (${selectedCount}/${powerupToggles.length})`;
  }
}

// ─── Start Game ─────────────────────────────────────────
function startGame() {
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('thirdperson-btn').style.display = 'block';
  
  // Show in-game controls hint (desktop only)
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 768;
  const controlsHint = document.getElementById('ingame-controls');
  if (controlsHint && !isMobile) {
    controlsHint.style.display = 'block';
  }
  
  // Exit free look and third person if active
  if (freeLook.active) toggleFreeLook();
  if (thirdPersonCam.active) toggleThirdPerson();
  
  // Clear old game
  players.forEach(p => {
    // Clean up power-up effects before removing
    p.cleanupFreezeEffect();
    p.cleanupLightningEffect();
    p.cleanupLaserAura();
    p.cleanupFireAura();
    p.cleanupBurnEffect();
    p.cleanupSpeedTrail();
    scene.remove(p.mesh);
  });
  balls.forEach(b => {
    scene.remove(b.mesh);
    scene.remove(b.trailGroup);
  });
  players = [];
  balls = [];
  humanThrowPending = false;
  throwCharge.charging = false;
  throwCharge.amount = 0;
  throwCharge.released = false;
  
  // Clear power-ups, giant balls, banana peels, hockey sticks, and trap doors
  powerUps.forEach(pu => pu.destroy());
  powerUps = [];
  giantBalls.forEach(gb => gb.destroy());
  giantBalls = [];
  bananaPeels.forEach(bp => bp.destroy());
  bananaPeels = [];
  hockeySticks.forEach(hs => hs.destroy());
  hockeySticks = [];
  trapDoors.forEach(td => td.cleanup());
  trapDoors = [];
  
  // Reset game camera controls
  gameCameraControl.offsetX = 0;
  gameCameraControl.offsetY = 0;
  gameCameraControl.zoom = 0;
  gameCameraControl.dragging = false;
  
  // Rebuild environment with selected level
  const level = getCurrentLevel();
  gym.rebuild(level);
  
  // Update scene lighting and atmosphere
  updateSceneForLevel(level);
  
  // Create teams
  for (let i = 0; i < CONFIG.TEAM_SIZE; i++) {
    const bluePlayer = new Player(CONFIG.TEAM_BLUE, i, i === 0);
    scene.add(bluePlayer.mesh);
    players.push(bluePlayer);
    if (i === 0) humanPlayer = bluePlayer;
    
    const redPlayer = new Player(CONFIG.TEAM_RED, i, false);
    scene.add(redPlayer.mesh);
    players.push(redPlayer);
  }
  
  // Register callbacks for all players
  players.forEach(p => {
    p.onLandingImpact = (peakHeight, position) => {
      effects.spawnLandingImpact(position, peakHeight);
      sound.playLandImpact(peakHeight);
    };
    p.onDodgeEffect = (position, style, progress) => {
      effects.spawnDodgeTrail(position, style, progress);
    };
    p.onDodgeStart = (position, style) => {
      sound.playDodge();
      effects.spawnDodgeBurst(position);
    };
  });
  
  // Create individual health bar UI elements
  createPlayerHealthBars();
  
  // Create balls
  for (let i = 0; i < CONFIG.BALL_COUNT; i++) {
    const ball = new Ball(scene, i);
    balls.push(ball);
  }
  
  gameState = 'playing';
  
  // Reset death overlay state
  _deathOverlayShown = false;
  hideDeathOverlay();
  
  // Reset match XP log for the new match
  rankSystem.resetMatchLog();
  
  // Update HUD with current rank info on game start
  updateRankHUD();
  
  // Whistle
  setTimeout(() => sound.playWhistle(), 300);
  
  // Start match music (random track from pool)
  sound.stopBGMusic(); // Stop any existing music first
  sound.playRandomTrack();
  
  // Load wav samples into Web Audio API buffers (fetch + decodeAudioData)
  sound.loadSamples();
}

// ─── Handle E Action — Hold-to-Charge Throw ─────────────────
let humanThrowPending = false;

// Throw charge state: player holds E to charge, releases to throw
const throwCharge = {
  charging: false,     // currently holding throw key
  amount: 0,           // 0→1 charge progress
  released: false,     // just released — triggers the throw
};

// Called on keydown / touch start
function handleActionDown() {
  if (!humanPlayer || !humanPlayer.alive) return;
  
  // Block actions if frozen or stunned
  if (humanPlayer.frozen || humanPlayer.stunned) return;
  
  if (humanPlayer.hasBall) {
    if (humanThrowPending) return;
    
    // Check if an enemy ball is incoming and close — trigger DEFLECT instead of throw
    const incoming = findIncomingBall(humanPlayer);
    if (incoming && humanPlayer.stamina >= CONFIG.DEFLECT_COST) {
      // Enter deflect-ready stance — player holds ball like a bat, timed block
      humanPlayer.isDeflecting = true;
      humanPlayer.deflectWindow = CONFIG.DEFLECT_WINDOW;
      humanPlayer.faceToward(incoming.mesh.position.x, incoming.mesh.position.z);
      return; // Don't start throw charge
    }
    
    // No incoming ball — normal throw charge
    throwCharge.charging = true;
    throwCharge.released = false;
  } else {
    // CATCH attempt — enter ready stance, face nearest incoming ball
    if (humanPlayer.stamina >= CONFIG.CATCH_COST) {
      humanPlayer.isCatching = true;
      humanPlayer.catchWindow = CONFIG.CATCH_WINDOW;
      
      const incoming = balls.find(b =>
        b.active && b.team !== humanPlayer.team && !b.caught
      );
      if (incoming) {
        humanPlayer.faceToward(incoming.mesh.position.x, incoming.mesh.position.z);
      }
    }
  }
}

// Find nearest incoming enemy ball within deflect range
function findIncomingBall(player) {
  let nearest = null;
  let nearestDist = Infinity;
  const detectRange = CONFIG.DEFLECT_RANGE * 4; // wider detection for "is ball incoming?"
  
  for (const ball of balls) {
    if (!ball.active || ball.team === player.team || ball.caught) continue;
    
    const playerPos = new THREE.Vector3(player.mesh.position.x, player.mesh.position.y + 1, player.mesh.position.z);
    const dist = ball.mesh.position.distanceTo(playerPos);
    
    if (dist < detectRange && dist < nearestDist) {
      // Also check that ball is moving TOWARD the player (dot product)
      const toPlayer = playerPos.clone().sub(ball.mesh.position).normalize();
      const ballDir = ball.velocity.clone().normalize();
      if (toPlayer.dot(ballDir) > 0.1) { // ball moving toward player
        nearest = ball;
        nearestDist = dist;
      }
    }
  }
  return nearest;
}

// Called on keyup / touch end
function handleActionUp() {
  if (throwCharge.charging && humanPlayer && humanPlayer.alive && humanPlayer.hasBall) {
    throwCharge.released = true;
    throwCharge.charging = false;
  } else {
    throwCharge.charging = false;
  }
}

// ─── Parkour Dodge ─────────────────────────────────────────
const DODGE_STYLE_NAMES = [
  'WEBSTER!',         // 0: one-handed front flip cartwheel
  'KONG VAULT!',      // 1: dive-roll through
  'BUTTERFLY KICK!',  // 2: horizontal spinning aerial
  'AERIAL SPIN!',     // 3: vertical 360 with legs whipping
  'GAINER!',          // 4: backflip with forward momentum
  'CORKSCREW!',       // 5: diagonal barrel roll
  'CHEAT GAINER!',    // 6: lateral wind-up spinning backflip
  'AERIAL TWIST!'     // 7: 720° helicopter spin
];
const DODGE_STYLE_COLORS = [
  '#00e5ff',  // 0: cyan
  '#7c4dff',  // 1: purple
  '#e040fb',  // 2: magenta
  '#ff6e40',  // 3: orange-red
  '#00ff88',  // 4: mint green
  '#ffea00',  // 5: bright yellow
  '#ff1744',  // 6: hot red
  '#00bcd4'   // 7: teal
];

function handleDodge() {
  if (!humanPlayer || !humanPlayer.alive) return;
  if (freeLook.active) return;
  
  // Block dodge if frozen or stunned
  if (humanPlayer.frozen || humanPlayer.stunned) return;
  
  // Get current movement direction for dodge direction
  let dx = 0, dz = 0;
  if (keys['KeyW']) dz = -1;
  if (keys['KeyS']) dz = 1;
  if (keys['KeyA']) dx = -1;
  if (keys['KeyD']) dx = 1;
  
  if (mobileInput && mobileInput.active) {
    const jx = mobileInput.joystickX;
    const jy = mobileInput.joystickY;
    if (Math.abs(jx) > 0.15 || Math.abs(jy) > 0.15) {
      dx += jx;
      dz += jy;
    }
  }
  
  const success = humanPlayer.startDodge(dx, dz);
  if (success) {
    // Achievement tracking: individual dodge style
    const dodgeStyleIndex = humanPlayer.dodgeStyle;
    const statId = DODGE_ACHIEVEMENT_MAP[dodgeStyleIndex];
    if (statId) {
      achievements.increment(statId);
      checkAchievementNotifications();
    }
    
    // Sound + burst handled by onDodgeStart callback for all players
    // Show dodge style name (human-only UI feedback)
    const styleName = DODGE_STYLE_NAMES[dodgeStyleIndex];
    const styleColor = DODGE_STYLE_COLORS[dodgeStyleIndex];
    showActionText(styleName, styleColor);
  }
}

// Called every frame while charging or when released
function updateThrowCharge(dt) {
  const bar = document.getElementById('throw-charge-bar');
  const container = document.getElementById('throw-charge-container');
  const powerLabel = document.getElementById('throw-charge-power');
  
  // Fill bar while holding (but not if frozen/stunned)
  if (throwCharge.charging && humanPlayer && humanPlayer.alive && humanPlayer.hasBall && !humanThrowPending &&
      !humanPlayer.frozen && !humanPlayer.stunned) {
    const prevAmount = throwCharge.amount;
    throwCharge.amount = Math.min(1, throwCharge.amount + CONFIG.THROW_CHARGE_RATE * dt);
    
    // Start charge sound when charging begins (first frame)
    if (prevAmount === 0) {
      sound.startChargeSound();
    }
    
    // Slow player movement + drive charge windup animation
    humanPlayer.throwCharging = true;
    humanPlayer.throwChargePower = throwCharge.amount;
    
    if (container) container.classList.add('visible');
    if (bar) {
      bar.style.width = (throwCharge.amount * 100) + '%';
      bar.classList.toggle('full', throwCharge.amount >= 1.0);
      
      // Extra dramatic styling at max power
      if (throwCharge.amount >= 0.9) {
        bar.style.background = 'linear-gradient(90deg, #ff0044, #ff1744, #ff0044)';
        bar.style.boxShadow = '0 0 20px rgba(255,23,68,1), inset 0 0 15px rgba(255,255,255,0.5)';
      } else if (throwCharge.amount >= 0.75) {
        bar.style.background = 'linear-gradient(90deg, #ff5722, #ff1744, #ff0044)';
        bar.style.boxShadow = '0 0 12px rgba(255,87,34,0.7)';
      } else {
        bar.style.background = 'linear-gradient(90deg, #ffeb3b, #ff9800, #ff5722)';
        bar.style.boxShadow = 'none';
      }
    }
    if (powerLabel) {
      const pct = Math.round(throwCharge.amount * 100);
      if (throwCharge.amount >= 1.0) {
        powerLabel.textContent = '💥 MAX POWER! 💥';
        powerLabel.style.color = '#ff1744';
        powerLabel.style.textShadow = '0 0 20px rgba(255,23,68,1), 0 0 40px rgba(255,23,68,0.6)';
        powerLabel.style.fontSize = '15px';
        powerLabel.style.fontWeight = '900';
        powerLabel.style.animation = 'pulse 0.3s ease-in-out infinite alternate';
      } else if (throwCharge.amount >= 0.9) {
        powerLabel.textContent = '🔥 CRITICAL! ' + pct + '%';
        powerLabel.style.color = '#ff0044';
        powerLabel.style.textShadow = '0 0 18px rgba(255,0,68,0.9)';
        powerLabel.style.fontSize = '14px';
        powerLabel.style.fontWeight = '900';
        powerLabel.style.animation = 'none';
      } else if (throwCharge.amount >= 0.75) {
        powerLabel.textContent = '⚡ ' + pct + '%';
        powerLabel.style.color = '#ff5722';
        powerLabel.style.textShadow = '0 0 12px rgba(255,87,34,0.6)';
        powerLabel.style.fontSize = '13px';
        powerLabel.style.fontWeight = '900';
        powerLabel.style.animation = 'none';
      } else if (throwCharge.amount >= 0.4) {
        powerLabel.textContent = pct + '%';
        powerLabel.style.color = '#ff9800';
        powerLabel.style.textShadow = '0 0 10px rgba(255,152,0,0.5)';
        powerLabel.style.fontSize = '13px';
        powerLabel.style.fontWeight = '900';
        powerLabel.style.animation = 'none';
      } else {
        powerLabel.textContent = pct + '%';
        powerLabel.style.color = '#ffab00';
        powerLabel.style.textShadow = '0 0 8px rgba(255,171,0,0.4)';
        powerLabel.style.fontSize = '13px';
        powerLabel.style.fontWeight = '900';
        powerLabel.style.animation = 'none';
      }
    }
    return;
  }
  
  // Release — execute the throw with charged power
  if (throwCharge.released && humanPlayer && humanPlayer.alive && humanPlayer.hasBall && !humanThrowPending) {
    // Stop the charge sound immediately on release
    sound.stopChargeSound();
    
    const chargeAmt = throwCharge.amount;
    throwCharge.released = false;
    throwCharge.amount = 0;
    humanPlayer.throwCharging = false;
    humanPlayer.throwChargePower = 0;
    
    if (container) container.classList.remove('visible');
    if (bar) { bar.style.width = '0%'; bar.classList.remove('full'); }
    if (powerLabel) powerLabel.textContent = '';
    
    // Execute throw
    const target = humanPlayer.findNearestEnemy(players);
    if (target) {
      let trickType = null;
      const charge = humanPlayer.trickCharge;
      
      if (charge >= CONFIG.TRICKS.METEOR.charge) {
        trickType = CONFIG.TRICKS.METEOR;
      } else if (charge >= CONFIG.TRICKS.LIGHTNING.charge) {
        trickType = CONFIG.TRICKS.LIGHTNING;
      } else if (charge >= CONFIG.TRICKS.FIREBALL.charge) {
        trickType = CONFIG.TRICKS.FIREBALL;
      } else if (charge >= CONFIG.TRICKS.CURVE.charge) {
        trickType = CONFIG.TRICKS.CURVE;
      }
      
      humanPlayer.startThrow(target);
      humanThrowPending = true;
      
      setTimeout(() => sound.playSwoosh(), 280);
      
      const savedTarget = target; // save reference to re-read live position at release
      const savedCharge = chargeAmt; // capture for closure
      // Ball release timed to whip release phase of throw anim
      // Windup = 300ms, then ~42% into throw (0.85s) = 300 + 357 ≈ 660ms
      setTimeout(() => {
        humanThrowPending = false;
        if (humanPlayer && humanPlayer.alive && humanPlayer.hasBall) {
          // Re-read target position at release time for accuracy
          // Lead the target slightly based on their movement
          const livePos = savedTarget.mesh.position.clone();
          const targetVel = savedTarget.velocity || new THREE.Vector3();
          const leadTime = 0.25; // predict ~250ms ahead
          const targetPos = new THREE.Vector3(
            livePos.x + targetVel.x * leadTime,
            livePos.y,
            livePos.z + targetVel.z * leadTime
          );
          const thrownBall = humanPlayer.throwBall(targetPos, trickType, savedCharge);
          if (thrownBall) {
            // Achievement tracking: throws
            achievements.increment('throws');
            checkAchievementNotifications();
            
            // Play laser sound for laser ball, otherwise normal throw sound
            if (thrownBall.isLaserBall && sound.playLaser) {
              sound.playLaser();
            } else {
              sound.playThrow(!!trickType, savedCharge);
            }
            
            // Power-based camera shake with extreme variation
            if (savedCharge >= 0.9) {
              // MAX POWER — huge shake + brief slow-mo effect + screen distortion
              effects.triggerShake(0.6 + (savedCharge - 0.9) * 0.4); // 0.6-1.0 intensity
              // Brief slow-motion effect for cinematic impact
              gameTimeScale = 0.3;
              setTimeout(() => { gameTimeScale = 1.0; }, 150);
              // Screen distortion effect
              const canvas = document.getElementById('game-canvas');
              if (canvas) {
                canvas.classList.add('max-power-distort');
                setTimeout(() => canvas.classList.remove('max-power-distort'), 150);
              }
              // Haptic feedback on supported devices
              if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50]); // Double pulse
              }
            } else if (savedCharge >= 0.75) {
              // High power — strong shake
              effects.triggerShake(0.25 + (savedCharge - 0.75) * 2.0); // 0.25-0.55
            } else if (savedCharge >= 0.5) {
              // Medium power — light shake
              effects.triggerShake(0.08 + (savedCharge - 0.5) * 0.4); // 0.08-0.18
            }
            // Below 0.5: no shake
            
            if (trickType) {
              showTrickName(trickType.name);
              effects.spawnTrickReleaseEffect(humanPlayer.mesh.position, trickType);
            } else if (savedCharge > 0.8) {
              // Power throw release burst (no trick, but full power)
              effects.spawnPowerBurst(humanPlayer.mesh.position);
            }
          }
        }
      }, 660);
    } else {
      // No target, just reset
    }
    return;
  }
  
  // Player lost ball while charging OR got frozen/stunned — cancel charge
  if ((throwCharge.charging || throwCharge.amount > 0) && humanPlayer && 
      (!humanPlayer.hasBall || !humanPlayer.alive || humanPlayer.frozen || humanPlayer.stunned)) {
    sound.stopChargeSound();
    throwCharge.charging = false;
    throwCharge.released = false;
    throwCharge.amount = 0;
    humanPlayer.throwCharging = false;
    humanPlayer.throwChargePower = 0;
  }
  
  // Not charging and not releasing — hide bar and clear state
  if (!throwCharge.charging && !throwCharge.released) {
    if (throwCharge.amount > 0) {
      throwCharge.amount = 0;
      if (humanPlayer) {
        humanPlayer.throwCharging = false;
        humanPlayer.throwChargePower = 0;
      }
    }
    if (container) container.classList.remove('visible');
    if (bar) { bar.style.width = '0%'; bar.classList.remove('full'); }
    if (powerLabel) powerLabel.textContent = '';
  }
}

// ─── Trick Name Display ─────────────────────────────────────────
function showTrickName(name) {
  const el = document.getElementById('trick-name');
  if (el) {
    el.textContent = name + '!';
    el.style.transform = 'scale(1.3)';
    el.style.transition = 'transform 0.15s ease';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
    setTimeout(() => {
      el.textContent = '';
    }, 1500);
  }
}

// ─── Game Logic Update ─────────────────────────────────────────
function updateGame(dt) {
  if (gameState !== 'playing') return;
  
  // Update players — suppress human input during free look
  const activeKeys = freeLook.active ? {} : keys;
  const activeMobile = freeLook.active ? { ...mobileInput, joystickX: 0, joystickY: 0, charging: false } : mobileInput;
  
  // Calculate camera angle for third-person movement
  let cameraAngle = null;
  if (thirdPersonCam.active && humanPlayer) {
    // Use the camera's fixed angle
    // We need to flip it by PI because the camera is BEHIND the player
    // So if camera is at angle 0 (at +Z looking toward player), 
    // the forward direction is -Z (angle = PI)
    cameraAngle = thirdPersonCam.angle + Math.PI;
  }
  
  players.forEach(p => {
    p.update(dt, activeKeys, players, balls, activeMobile, powerUps, cameraAngle);
    
    // AI throw handling with windup animation
    if (!p.isHuman && p.alive && p.hasBall && p.throwCooldown <= 0) {
      // Initialize throw delay on first ball pickup (so AI doesn't throw instantly)
      if (p._aiThrowDelay === undefined || p._aiThrowDelay === null) {
        const aggression = p.aiPersonality ? p.aiPersonality.aggression : 0.5;
        p._aiThrowDelay = 0.6 + Math.random() * 0.8 - aggression * 0.3;
      }
      p._aiThrowDelay -= dt;
      if (p._aiThrowDelay <= 0) {
        // Use personality-based targeting
        const target = p.findBestTarget(players);
        if (target) {
          // Face the target before throwing (organic wind-up)
          p.faceToward(target.mesh.position.x, target.mesh.position.z);
          
          const trickChance = p.aiPersonality ? p.aiPersonality.trickChance : 0.25;
          const useTrick = Math.random() < trickChance;
          let trickType = null;
          if (useTrick) {
            const tricks = Object.values(CONFIG.TRICKS);
            trickType = tricks[Math.floor(Math.random() * tricks.length)];
          }
          // Start windup, then throw at whip release point
          p.startThrow(target);
          setTimeout(() => sound.playSwoosh(), 280);
          // Snapshot target position at throw commit, not at windup start
          setTimeout(() => {
            if (p.alive && p.hasBall) {
              // Re-read target position at release for accuracy
              const livePos = target.alive ? target.mesh.position.clone() : target.mesh.position.clone();
              const throwPower = p.aiPersonality 
                ? 0.5 + p.aiPersonality.accuracy * 0.5 
                : 0.8;
              
              // Lead the target based on AI accuracy
              const accuracy = p.aiPersonality ? p.aiPersonality.accuracy : 0.5;
              const targetVel = target.velocity || new THREE.Vector3();
              const leadTime = 0.15 + accuracy * 0.25; // better AI leads more (0.15-0.4s)
              const targetPos = new THREE.Vector3(
                livePos.x + targetVel.x * leadTime,
                livePos.y,
                livePos.z + targetVel.z * leadTime
              );
              
              // Add slight inaccuracy for lower-accuracy AI
              const inaccuracy = (1 - accuracy) * 1.5; // 0 to 1.5 units of scatter
              targetPos.x += (Math.random() - 0.5) * inaccuracy;
              targetPos.z += (Math.random() - 0.5) * inaccuracy;
              
              const thrown = p.throwBall(targetPos, trickType, throwPower);
              if (thrown) {
                // Play laser sound for laser ball, otherwise normal throw sound
                if (thrown.isLaserBall && sound.playLaser) {
                  sound.playLaser();
                } else {
                  sound.playThrow(!!trickType, throwPower);
                }
                if (trickType) {
                  effects.spawnTrickReleaseEffect(p.mesh.position, trickType);
                }
              }
            }
          }, 660);
          // Personality-based throw rate: aggressive AI throws faster
          const aggression = p.aiPersonality ? p.aiPersonality.aggression : 0.5;
          p._aiThrowDelay = CONFIG.AI_THROW_COOLDOWN * (1.2 - aggression * 0.5) + Math.random() * 1.0;
        } else {
          p._aiThrowDelay = 0.5; // Re-check in half a second if no target
        }
      }
    } else if (!p.isHuman && !p.hasBall) {
      // Reset throw delay when ball is lost so next pickup has fresh timing
      p._aiThrowDelay = null;
    }
  });
  
  // Update throw charge bar (hold-to-throw)
  updateThrowCharge(dt);
  
  // Update charge effects for human player
  if (humanPlayer && humanPlayer.alive && humanPlayer.hasBall) {
    effects.updateChargeAura(humanPlayer.mesh.position, humanPlayer.trickCharge, dt);
    effects.updateBallChargeGlow(humanPlayer.ball, humanPlayer.trickCharge);
  } else {
    effects.updateChargeAura(
      humanPlayer ? humanPlayer.mesh.position : new THREE.Vector3(), 
      0, dt
    );
  }
  
  // Update balls
  balls.forEach(ball => {
    const wasActive = ball.active;
    const prevY = ball.mesh.position.y;
    ball.update(dt);
    
    // Bounce sound
    if (ball.active && prevY > CONFIG.BALL_RADIUS + 0.05 && ball.mesh.position.y <= CONFIG.BALL_RADIUS + 0.01) {
      sound.playBounce();
    }
    
    // Trick trail effects
    if (ball.active && ball.trickType) {
      if (ball.trickType.name === 'FIREBALL') {
        effects.spawnFireTrail(ball.mesh.position);
      } else if (ball.trickType.name === 'LIGHTNING') {
        if (Math.random() < 0.3) effects.spawnLightning(ball.mesh.position);
      }
    }
    
    // Fireball power-up enhanced fire trail (extra dense fire particles)
    if (ball.active && ball.isFireball) {
      effects.spawnFireTrail(ball.mesh.position);
      if (Math.random() < 0.5) effects.spawnFireTrail(ball.mesh.position);
    }
  });
  
  // Ball-Player collisions
  checkCollisions();
  
  // Ball pickup
  checkPickups();
  
  // Update power-ups
  updatePowerUps(dt);
  
  // Update giant balls
  updateGiantBalls(dt);
  
  // Update banana peels
  updateBananaPeels(dt);
  
  // Update hockey sticks
  updateHockeySticks(dt);
  
  // Update trap doors
  updateTrapDoors(dt);
  
  // Check win/loss
  checkGameOver();
  
  // Update HUD
  updateHUD();
}

// ─── Collision Detection ─────────────────────────────────────────
function checkCollisions() {
  balls.forEach(ball => {
    if (!ball.active || !ball.team) return;
    
    // Skip collision if ball has hit the ground (rolling balls don't damage)
    if (ball.hasHitGround) return;
    
    players.forEach(player => {
      if (!player.alive) return;
      if (player.team === ball.team) return;
      if (player.invincible > 0) return;
      
      const playerCenter = new THREE.Vector3(player.mesh.position.x, player.mesh.position.y + 1, player.mesh.position.z);
      const dist = ball.mesh.position.distanceTo(playerCenter);
      
      if (dist < player.radius + CONFIG.BALL_RADIUS + 0.3) {
        // ── LASER BALL — UNSTOPPABLE! Can't be caught or deflected ──
        if (ball.isLaserBall) {
          // Skip all defensive checks, go straight to hit
          const killed = player.takeDamage(ball.damage);
          effects.spawnHitSparks(ball.mesh.position, 0xff00ff);
          
          if (player.isHuman) {
            effects.flashHit();
            showActionText('LASER HIT!', '#ff00ff');
          }
          
          sound.playHit();
          effects.triggerShake(0.2); // Extra shake for laser impact
          
          if (killed) {
            effects.spawnKOEffect(player.mesh.position);
            effects.showKOPopup();
            sound.playKO();
            // Award KO XP if the thrower was human (or any blue team kill)
            if (ball.thrower && ball.thrower.team === CONFIG.TEAM_BLUE) {
              awardAndShowXP(rankSystem.awardKO());
              achievements.increment('kos');
              checkAchievementNotifications();
            }
          }
          
          // Power-up spawn chance
          trySpawnPowerUp(player.team, player.mesh.position);
          
          // ── BOUNCE LASER BALL OFF PLAYER ──
          const bounceDir = ball.mesh.position.clone().sub(playerCenter).normalize();
          bounceDir.x += (Math.random() - 0.5) * 0.2;
          bounceDir.z += (Math.random() - 0.5) * 0.2;
          bounceDir.normalize();
          
          const incomingSpeed = ball.velocity.length();
          const bounceSpeed = incomingSpeed * 0.45; // Laser ball retains more energy
          
          ball.velocity.set(
            bounceDir.x * bounceSpeed,
            3.0 + Math.random() * 1.0,
            bounceDir.z * bounceSpeed
          );
          
          ball.team = null;
          ball.thrower = null;
          ball.damage = Math.round(ball.damage * 0.6);
          ball.lifetime = 0;
          
          return;
        }
        
        // ── Check DEFLECT (holding ball + timed block) ──
        if (player.isDeflecting && player.deflectWindow > 0 && player.hasBall && player.stamina >= CONFIG.DEFLECT_COST) {
          // Successful deflect! Swat the incoming ball away
          player.stamina = Math.max(0, player.stamina - CONFIG.DEFLECT_COST);
          player.onDeflectSuccess();
          
          // Deflect the ball — bounce it away from the player with scatter
          const awayDir = ball.mesh.position.clone().sub(playerCenter).normalize();
          const speed = ball.velocity.length() * CONFIG.DEFLECT_SPEED_MULT;
          // Add random scatter for unpredictable bounces
          awayDir.x += (Math.random() - 0.5) * CONFIG.DEFLECT_SCATTER;
          awayDir.z += (Math.random() - 0.5) * CONFIG.DEFLECT_SCATTER;
          awayDir.normalize();
          
          ball.velocity.set(
            awayDir.x * speed,
            CONFIG.DEFLECT_BOUNCE_UP,
            awayDir.z * speed
          );
          ball.damage = Math.round(ball.damage * CONFIG.DEFLECT_DAMAGE_MULT);
          ball.team = null;      // deflected ball is neutral (no team ownership)
          ball.thrower = null;
          ball.lifetime = 0;     // reset lifetime so it doesn't instantly expire
          
          // Effects
          effects.spawnDeflectBurst(ball.mesh.position.clone(), playerCenter);
          effects.flashDeflect();
          sound.playDeflect();
          
          // Camera shake for satisfying impact
          effects.triggerShake(0.06);
          
          if (player.isHuman) {
            showActionText('DEFLECTED!', '#ffab00');
            awardAndShowXP(rankSystem.awardDeflect());
            // Achievement tracking: deflections (human only)
            achievements.increment('deflections');
            checkAchievementNotifications();
          } else if (player.team === CONFIG.TEAM_BLUE) {
            // Blue team AI deflects also count toward player XP
            awardAndShowXP(rankSystem.awardDeflect());
          }
          return;
        }
        
        // ── Check CATCH (no ball + timed catch) ──
        if (player.isCatching && player.catchWindow > 0 && player.stamina >= CONFIG.CATCH_COST) {
          // Successful catch!
          player.stamina = Math.max(0, player.stamina - CONFIG.CATCH_COST);
          ball.deactivate();
          player.pickupBall(ball);
          player.isCatching = false;
          player.catchWindow = 0;
          player.onCatchSuccess();
          
          effects.spawnCatchShield(player.mesh.position);
          effects.flashCatch();
          sound.playCatch();
          sound.playCatchApproval(); // Audience cheer!
          
          if (player.isHuman) {
            showActionText('NICE CATCH!', '#00e5ff');
            awardAndShowXP(rankSystem.awardCatch());
            // Achievement tracking: catches (human only)
            achievements.increment('catches');
            checkAchievementNotifications();
          } else if (player.team === CONFIG.TEAM_BLUE) {
            // Blue team AI catches also count toward player XP
            awardAndShowXP(rankSystem.awardCatch());
          }
          return;
        }
        
        // Hit!
        const isFireballHit = ball.isFireball;
        const throwPower = ball.throwPower !== undefined ? ball.throwPower : 1.0;
        const killed = player.takeDamage(ball.damage);
        
        // Hit spark color: fireball = orange, trick = trick color, default = orange
        const sparkColor = isFireballHit ? 0xff4400 : (ball.trickType ? ball.trickType.color : 0xff8800);
        effects.spawnHitSparks(ball.mesh.position, sparkColor);
        
        if (isFireballHit) {
          // Extra fire burst on fireball impact
          effects.spawnFireTrail(ball.mesh.position);
          effects.spawnFireTrail(ball.mesh.position);
          effects.spawnFireTrail(ball.mesh.position);
        }
        
        // Power-based impact effects
        if (throwPower >= 0.9) {
          // MAX POWER HIT — explosive effects
          effects.spawnPowerBurst(ball.mesh.position);
          effects.spawnPowerBurst(ball.mesh.position);
          effects.triggerShake(0.3 + (throwPower - 0.9) * 0.5);
          if (player.isHuman) {
            showActionText('💥 DEVASTATING HIT!', '#ff1744');
          }
        } else if (throwPower >= 0.75) {
          // High power hit — strong effects
          effects.spawnPowerBurst(ball.mesh.position);
          effects.triggerShake(0.15 + (throwPower - 0.75) * 0.6);
          if (player.isHuman && !isFireballHit) {
            showActionText('💢 POWER HIT!', '#ff5722');
          }
        } else if (throwPower >= 0.5) {
          // Medium power — light shake
          effects.triggerShake(0.05 + (throwPower - 0.5) * 0.3);
        }
        
        if (player.isHuman) {
          effects.flashHit();
          if (isFireballHit && throwPower < 0.75) {
            showActionText('🔥 FIREBALL HIT!', '#ff4400');
          }
        }
        
        sound.playHit();
        
        if (killed) {
          effects.spawnKOEffect(player.mesh.position);
          effects.showKOPopup();
          sound.playKO();
          // Award KO XP if the thrower was on blue team
          if (ball.thrower && ball.thrower.team === CONFIG.TEAM_BLUE) {
            awardAndShowXP(rankSystem.awardKO());
            achievements.increment('kos');
            checkAchievementNotifications();
          }
        }
        
        // Apply burn DOT if this was a fireball hit and player survived
        if (isFireballHit && !killed && player.alive) {
          applyBurnToPlayer(player);
        }
        
        // Power-up spawn chance (team that got hit has chance to get power-up)
        trySpawnPowerUp(player.team, player.mesh.position);
        
        // ── BOUNCE BALL OFF PLAYER ──
        // Calculate bounce direction (away from player)
        const bounceDir = ball.mesh.position.clone().sub(playerCenter).normalize();
        
        // Add some randomness to bounce direction for variety
        bounceDir.x += (Math.random() - 0.5) * 0.3;
        bounceDir.z += (Math.random() - 0.5) * 0.3;
        bounceDir.normalize();
        
        // Bounce speed based on incoming velocity (energy conservation with loss)
        const incomingSpeed = ball.velocity.length();
        const bounceSpeed = incomingSpeed * 0.4; // Loses 60% of energy on impact
        
        // Set new velocity (bounce away from player)
        ball.velocity.set(
          bounceDir.x * bounceSpeed,
          2.5 + Math.random() * 1.5, // Upward bounce
          bounceDir.z * bounceSpeed
        );
        
        // Clear ball ownership (becomes neutral after bouncing off player)
        ball.team = null;
        ball.thrower = null;
        ball.damage = Math.round(ball.damage * 0.5); // Reduce damage after bounce
        ball.lifetime = 0; // Reset lifetime so it doesn't instantly expire
        
        // Ball remains active and bounces away instead of deactivating
      }
    });
  });
}

// ─── Pickup Detection ─────────────────────────────────────────
function checkPickups() {
  balls.forEach(ball => {
    if (ball.active || ball.held) return;
    
    // Don't allow pickup of stuck balls (below floor)
    if (ball.mesh.position.y < 0) {
      console.warn('Preventing pickup of stuck ball, will respawn soon');
      return;
    }
    
    players.forEach(player => {
      if (!player.alive || player.hasBall) return;
      
      const dist = new THREE.Vector2(
        ball.mesh.position.x - player.mesh.position.x,
        ball.mesh.position.z - player.mesh.position.z
      ).length();
      
      if (dist < 1.2) {
        player.pickupBall(ball);
        sound.playPickup();
        
        if (player.isHuman) {
          showActionText('BALL!', '#76ff03');
        }
      }
    });
  });
}

// ─── Power-Up System ─────────────────────────────────────────
function trySpawnPowerUp(victimTeam, position) {
  // Check power-up spawn chance (configurable: 0% to 100%)
  if (Math.random() > CONFIG.POWERUP_SPAWN_CHANCE) return;
  
  // Allow up to 7 power-ups on court at once
  if (powerUps.length >= 7) return;
  
  // Filter power-up types based on enabled selection
  const allTypes = Object.entries(POWERUP_TYPES);
  const enabledTypes = allTypes.filter(([key, type]) => enabledPowerups.has(key));
  
  // If no power-ups are enabled, don't spawn anything
  if (enabledTypes.length === 0) return;
  
  // Randomly select power-up type based on weighted spawn chances (only from enabled types)
  const types = enabledTypes.map(([key, type]) => type);
  const totalWeight = types.reduce((sum, t) => sum + t.spawnChance, 0);
  let roll = Math.random() * totalWeight;
  
  let selectedType = types[0];
  for (const type of types) {
    roll -= type.spawnChance;
    if (roll <= 0) {
      selectedType = type;
      break;
    }
  }
  
  // Spawn power-up away from the victim — guaranteed minimum distance
  // so players don't stand on it when grace period ends
  const spawnPos = position.clone();
  const angle = Math.random() * Math.PI * 2;
  const dist = 4 + Math.random() * 4; // 4-8 units away from victim
  spawnPos.x += Math.cos(angle) * dist;
  spawnPos.z += Math.sin(angle) * dist;
  
  // Keep within court bounds
  const hw = CONFIG.COURT_WIDTH / 2 - 2;
  const hd = CONFIG.COURT_DEPTH / 2 - 2;
  spawnPos.x = Math.max(-hw, Math.min(hw, spawnPos.x));
  spawnPos.z = Math.max(-hd, Math.min(hd, spawnPos.z));
  
  const powerUp = new PowerUp(scene, selectedType, spawnPos);
  powerUps.push(powerUp);
  
  // Show notification
  showPowerUpNotification(selectedType.name, victimTeam);
}

function updatePowerUps(dt) {
  // Update all power-ups
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];
    powerUp.update(dt);
    
    // Remove if destroyed
    if (!powerUp.active) {
      powerUps.splice(i, 1);
      continue;
    }
    
    // Don't allow pickup during spawn grace period
    if (!powerUp.collectable) continue;
    
    // Check pickup by players
    let collected = false;
    for (const player of players) {
      if (!player.alive || collected) continue;
      
      const dist = powerUp.mesh.position.distanceTo(player.mesh.position);
      if (dist < 1.8) {
        // Picked up!
        activatePowerUp(powerUp.type, player);
        powerUp.collect();
        powerUps.splice(i, 1);
        collected = true;
      }
    }
  }
}

// Map power-up types to their achievement stat IDs
const POWERUP_ACHIEVEMENT_MAP = {
  [POWERUP_TYPES.GIANT_BALL.name]:  'pu_giant_ball',
  [POWERUP_TYPES.FREEZE_TWO.name]:  'pu_freeze',
  [POWERUP_TYPES.LIGHTNING.name]:   'pu_lightning',
  [POWERUP_TYPES.LASER_BALL.name]:  'pu_laser_ball',
  [POWERUP_TYPES.FIREBALL.name]:    'pu_fireball',
  [POWERUP_TYPES.BANANA_PEEL.name]: 'pu_banana_peel',
  [POWERUP_TYPES.SUPER_SPEED.name]: 'pu_super_speed',
  [POWERUP_TYPES.SLAP_SHOT.name]:   'pu_slap_shot',
  [POWERUP_TYPES.TRAP_DOOR.name]:   'pu_trap_door',
};

// Map dodge style indices to their achievement stat IDs
const DODGE_ACHIEVEMENT_MAP = [
  'dodge_webster',        // 0 = Webster
  'dodge_kong_vault',     // 1 = Kong Vault
  'dodge_butterfly_kick', // 2 = Butterfly Kick
  'dodge_aerial_spin',    // 3 = Aerial Spin
  'dodge_gainer',         // 4 = Gainer
  'dodge_corkscrew',      // 5 = Corkscrew
  'dodge_cheat_gainer',   // 6 = Cheat Gainer
  'dodge_aerial_twist',   // 7 = Aerial Twist
];

function activatePowerUp(type, player) {
  sound.playPickup(); // Reuse pickup sound for now
  
  // Achievement tracking: individual power-up usage (human player only)
  if (player.isHuman) {
    const statId = POWERUP_ACHIEVEMENT_MAP[type.name];
    if (statId) achievements.increment(statId);
    checkAchievementNotifications();
  }
  
  showActionText(`${type.name}!`, `#${type.color.toString(16)}`);
  
  switch (type) {
    case POWERUP_TYPES.GIANT_BALL:
      sound.playGiantBallPickup();
      spawnGiantBall(player.team);
      break;
      
    case POWERUP_TYPES.FREEZE_TWO:
      sound.playFreezePickup();
      freezeRandomOpponents(player.team, 2);
      break;
      
    case POWERUP_TYPES.LIGHTNING:
      sound.playLightningPickup();
      lightningStunAll(player.team);
      break;
      
    case POWERUP_TYPES.LASER_BALL:
      sound.playLaserPickup();
      grantLaserBall(player);
      break;
      
    case POWERUP_TYPES.FIREBALL:
      sound.playFireballPickup();
      grantFireball(player);
      break;
      
    case POWERUP_TYPES.BANANA_PEEL:
      sound.playBananaPickup();
      spawnBananaPeel(player.team);
      break;
      
    case POWERUP_TYPES.SUPER_SPEED:
      sound.playSpeedPickup();
      grantSuperSpeed(player);
      break;
      
    case POWERUP_TYPES.SLAP_SHOT:
      sound.playSlapshotPickup();
      activateSlapShot(player.team);
      break;
      
    case POWERUP_TYPES.TRAP_DOOR:
      sound.playTrapDoorPickup();
      activateTrapDoor(player.team);
      break;
  }
}

function spawnGiantBall(team) {
  // Spawn massive ball that fills entire court width and rolls from team's side
  const giantBall = new GiantBall(scene, team);
  
  // Wire KO callback for XP awards
  giantBall.onKO = (player) => {
    // Giant ball activated by blue team KO'd a red player
    if (team === CONFIG.TEAM_BLUE && player.team === CONFIG.TEAM_RED) {
      awardAndShowXP(rankSystem.awardKO());
      achievements.increment('kos');
      checkAchievementNotifications();
    }
  };
  
  giantBalls.push(giantBall);
  
  showActionText('GIANT BALL INCOMING!', '#ff6600');
  effects.triggerShake(0.25); // Bigger shake for massive ball
}

function freezeRandomOpponents(team, count) {
  // Get all alive opponents
  const opponents = players.filter(p => p.alive && p.team !== team);
  
  // Shuffle and freeze up to 'count' of them
  const toFreeze = opponents.sort(() => Math.random() - 0.5).slice(0, count);
  
  toFreeze.forEach(player => {
    player.frozen = true;
    player.frozenTime = 4.0; // Freeze for 4 seconds
    
    // Create ice effect on player
    createFreezeEffect(player);
    
    // Play freeze sound effect
    if (sound && sound.playFreeze) {
      sound.playFreeze();
    }
  });
  
  showActionText(`${toFreeze.length} FROZEN!`, '#00d4ff');
}

function lightningStunAll(team) {
  // Stun all opponents for 3 seconds
  const opponents = players.filter(p => p.alive && p.team !== team);
  
  // Flash the screen white
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.top = '0';
  flash.style.left = '0';
  flash.style.width = '100%';
  flash.style.height = '100%';
  flash.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '9999';
  flash.style.transition = 'opacity 0.15s';
  document.body.appendChild(flash);
  setTimeout(() => {
    flash.style.opacity = '0';
    setTimeout(() => document.body.removeChild(flash), 150);
  }, 50);
  
  opponents.forEach((player, index) => {
    player.stunned = true;
    player.stunnedTime = 3.0;
    
    // Stagger lightning strikes slightly for dramatic effect
    setTimeout(() => {
      createLightningBoltStrike(player);
      createLightningEffect(player);
    }, index * 80);
  });
  
  // Play the lightning strike sound effect
  sound.playLightningStrike();
  
  showActionText('LIGHTNING STRIKE!', '#ffff00');
  effects.triggerShake(0.3);
}

function grantLaserBall(player) {
  // Give player a laser ball buff for next throw
  player.hasLaserBall = true;
  player.laserBallReady = true;
  
  showActionText('LASER BALL READY!', '#ff00ff');
  
  // Add visual indicator (purple glow around player)
  createLaserAura(player);
}

function createFreezeEffect(player) {
  // Create ice crystal around player
  const iceGeo = new THREE.IcosahedronGeometry(1.2, 0);
  const iceMat = new THREE.MeshPhongMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.4,
    emissive: 0x0088ff,
    emissiveIntensity: 0.5,
    shininess: 100,
  });
  const ice = new THREE.Mesh(iceGeo, iceMat);
  ice.position.copy(player.mesh.position);
  ice.position.y += 1;
  scene.add(ice);
  player.freezeEffect = ice;
}

function createLightningBoltStrike(player) {
  // Create dramatic lightning bolt striking down from above
  const startY = 20; // High above player
  const endY = player.mesh.position.y + 0.5; // At player position
  const playerPos = player.mesh.position.clone();
  
  // Main lightning bolt
  const boltPoints = [];
  const segments = 12;
  const jaggedness = 0.8;
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = startY + (endY - startY) * t;
    
    // Add jagged offsets (less jagged near endpoints)
    const jitter = (1 - Math.abs(t - 0.5) * 2) * jaggedness;
    const x = playerPos.x + (Math.random() - 0.5) * jitter;
    const z = playerPos.z + (Math.random() - 0.5) * jitter;
    
    boltPoints.push(new THREE.Vector3(x, y, z));
  }
  
  // Create the main bolt geometry
  const boltGeo = new THREE.BufferGeometry().setFromPoints(boltPoints);
  const boltMat = new THREE.LineBasicMaterial({
    color: 0xffffaa,
    linewidth: 4,
    transparent: true,
    opacity: 1,
  });
  const bolt = new THREE.Line(boltGeo, boltMat);
  scene.add(bolt);
  
  // Add glow cylinder along bolt path
  const boltLength = startY - endY;
  const glowGeo = new THREE.CylinderGeometry(0.15, 0.15, boltLength, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.6,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(playerPos.x, (startY + endY) / 2, playerPos.z);
  scene.add(glow);
  
  // Add secondary arcs (forked lightning)
  const arcs = [];
  for (let i = 0; i < 3; i++) {
    const forkStart = Math.floor(segments * (0.3 + Math.random() * 0.4));
    const arcPoints = [];
    const arcSegments = 5;
    
    for (let j = 0; j <= arcSegments; j++) {
      const t = j / arcSegments;
      const basePoint = boltPoints[forkStart];
      const y = basePoint.y - t * 3;
      const angle = Math.random() * Math.PI * 2;
      const dist = t * 2;
      const x = basePoint.x + Math.cos(angle) * dist;
      const z = basePoint.z + Math.sin(angle) * dist;
      arcPoints.push(new THREE.Vector3(x, y, z));
    }
    
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
    const arcMat = new THREE.LineBasicMaterial({
      color: 0xffffaa,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    const arc = new THREE.Line(arcGeo, arcMat);
    scene.add(arc);
    arcs.push(arc);
  }
  
  // Ground impact burst
  const burstGeo = new THREE.RingGeometry(0.5, 2.5, 16);
  const burstMat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  const burst = new THREE.Mesh(burstGeo, burstMat);
  burst.position.set(playerPos.x, endY, playerPos.z);
  burst.rotation.x = -Math.PI / 2;
  scene.add(burst);
  
  // Animate and remove
  let life = 0;
  const duration = 0.3;
  const animate = () => {
    life += 0.016;
    const t = life / duration;
    
    if (t >= 1) {
      scene.remove(bolt);
      scene.remove(glow);
      arcs.forEach(arc => scene.remove(arc));
      scene.remove(burst);
      boltGeo.dispose();
      boltMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      arcs.forEach(arc => {
        arc.geometry.dispose();
        arc.material.dispose();
      });
      burstGeo.dispose();
      burstMat.dispose();
      return;
    }
    
    // Flicker effect
    const flicker = Math.sin(t * 60) > 0.3;
    boltMat.opacity = flicker ? 1 - t : 0;
    glowMat.opacity = flicker ? (1 - t) * 0.6 : 0;
    arcs.forEach(arc => {
      arc.material.opacity = flicker ? (1 - t) * 0.8 : 0;
    });
    
    // Burst expands and fades
    burst.scale.setScalar(1 + t * 2);
    burstMat.opacity = (1 - t) * 0.8;
    
    requestAnimationFrame(animate);
  };
  animate();
  
}

function createLightningEffect(player) {
  // Create lightning sparks around player (persistent effect)
  const particles = [];
  for (let i = 0; i < 15; i++) {
    const geo = new THREE.SphereGeometry(0.12, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
    const spark = new THREE.Mesh(geo, mat);
    const angle = (i / 15) * Math.PI * 2;
    spark.position.set(
      Math.cos(angle) * 1.5,
      1 + Math.random() * 1.5,
      Math.sin(angle) * 1.5
    );
    spark.userData.angle = angle;
    spark.userData.speed = 3 + Math.random() * 2;
    spark.userData.life = 3.0;
    player.mesh.add(spark);
    particles.push(spark);
  }
  player.lightningEffect = particles;
}

function createLaserAura(player) {
  // Create purple glow aura as CHILD of player mesh — guaranteed to follow player
  const auraGeo = new THREE.SphereGeometry(1.3, 16, 12);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.position.set(0, 1, 0); // local offset (above player's feet)
  aura.renderOrder = 999;
  player.mesh.add(aura); // child of player mesh — always follows
  player.laserAura = aura;
}

function grantFireball(player) {
  // Give player a fireball buff for next throw
  player.hasFireball = true;
  player.fireballReady = true;
  
  showActionText('🔥 FIREBALL READY!', '#ff4400');
  
  // Add visual indicator (orange/red fire glow around player)
  createFireAura(player);
}

function createFireAura(player) {
  // Create fiery glow aura as CHILD of player mesh — guaranteed to follow player
  const auraGeo = new THREE.SphereGeometry(1.3, 16, 12);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.position.set(0, 1, 0); // local offset (above player's feet)
  aura.renderOrder = 999;
  player.mesh.add(aura); // child of player mesh — always follows
  player.fireAura = aura;
}

function spawnBananaPeel(team) {
  // Spawn banana peel trap on opponent's side of the court, biased toward center
  const opponentTeam = team === CONFIG.TEAM_BLUE ? CONFIG.TEAM_RED : CONFIG.TEAM_BLUE;
  
  // Position near center of opponent's half so it's in the action zone
  // X: from just past the center line (1/8 court width) to midpoint of their half (3/8)
  const xSide = opponentTeam === CONFIG.TEAM_BLUE ? -1 : 1;
  const x = xSide * (CONFIG.COURT_WIDTH / 8 + Math.random() * CONFIG.COURT_WIDTH / 4);
  // Z: tighter range around center so it's in high-traffic lanes
  const z = (Math.random() - 0.5) * (CONFIG.COURT_DEPTH * 0.6);
  
  const position = new THREE.Vector3(x, 0, z);
  const bananaPeel = new BananaPeel(scene, team, position);
  bananaPeels.push(bananaPeel);
  
  showActionText('🍌 BANANA TRAP!', '#ffeb3b');
  effects.spawnHitSparks(position, 0xffeb3b, 8);
}

function grantSuperSpeed(player) {
  // Grant super speed buff for 10 seconds
  player.superSpeed = true;
  player.superSpeedTime = 10.0;
  
  showActionText('👟 SUPER SPEED!', '#00ff88');
  
  // Create visual speed trail aura
  createSpeedTrail(player);
}

function createSpeedTrail(player) {
  // Create speed trail aura (torus ring with green glow)
  const ringGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.copy(player.mesh.position);
  ring.position.y = 0.5;
  scene.add(ring); // Add to scene, not to player.mesh (positioned manually in update)
  player.speedTrail = ring;
}

function activateSlapShot(team) {
  // Pick a random alive opponent
  const opponents = players.filter(p => p.alive && p.team !== team && !p.launchedOffMap);
  if (opponents.length === 0) return;
  
  const target = opponents[Math.floor(Math.random() * opponents.length)];
  
  // Create massive hockey stick that swings and launches them
  const stick = new HockeyStick(scene, target, () => {
    // Callback when animation completes
    hockeySticks = hockeySticks.filter(s => s !== stick);
  });
  hockeySticks.push(stick);
  
  showActionText('🏒 SLAP SHOT!', '#00aaff');
  
  // Timed effects synced with stick hit (windup 400ms + ~50% of swing 150ms ≈ 475ms)
  const hitDelay = 475;
  
  setTimeout(() => {
    // Impact sound
    if (sound && sound.playImpact) {
      sound.playImpact(1.5);
    }
    
    // Hockey stick hit sound — loud crack on contact
    if (sound && sound.playHockeyHit) {
      sound.playHockeyHit();
    }
    
    // Randomized scream on slap shot hit (slight delay after the hit crack)
    setTimeout(() => {
      if (sound && sound.playSlapShotScream) {
        sound.playSlapShotScream();
      }
    }, 120);
    
    // Big screen shake on contact
    effects.triggerShake(0.5);
    
    // Spark burst at player position
    if (target.mesh) {
      effects.spawnHitSparks(target.mesh.position.clone(), 0x00aaff, 24);
      effects.spawnHitSparks(target.mesh.position.clone(), 0xffffff, 12);
    }
    
    // Show who got launched
    if (target.isHuman) {
      showActionText('💫 LAUNCHED!', '#ff4444');
      effects.flashHit();
    } else {
      showActionText('💫 LAUNCHED!', '#00aaff');
    }
  }, hitDelay);
}

function applyBurnToPlayer(player) {
  // Apply burn DOT: 1 extra hit worth of damage (NORMAL_THROW_DAMAGE = 25 HP) over 2.5 seconds
  player.burning = true;
  player.burnDamageRemaining = CONFIG.NORMAL_THROW_DAMAGE; // 25 HP total burn
  player.burnTickTimer = 0.5; // first tick after 0.5s
  player.burnDuration = 2.5;  // total burn duration
  
  // Create fire particles on the burning player
  createBurnEffect(player);
  
  // Register callbacks for burn tick effects
  player.onBurnTick = (position, tickDamage) => {
    // Spawn small fire sparks on each tick
    effects.spawnFireTrail(position);
    effects.spawnHitSparks(position, 0xff4400, 5);
    sound.playBurnTick();
    
    // Show burn damage text for human player
    if (player.isHuman) {
      showActionText(`🔥 -${tickDamage}`, '#ff4400');
    }
  };
  
  player.onBurnKO = (position) => {
    effects.spawnKOEffect(position);
    effects.showKOPopup();
    sound.playKO();
    // Burn KO awards XP if the victim was on the red team (burned by blue)
    if (player.team === CONFIG.TEAM_RED) {
      awardAndShowXP(rankSystem.awardKO());
      achievements.increment('kos');
      checkAchievementNotifications();
    }
  };
}

function createBurnEffect(player) {
  // Clean up existing burn effect first
  player.cleanupBurnEffect();
  
  // Create fire particles attached to the player mesh
  const particles = [];
  for (let i = 0; i < 10; i++) {
    const size = 0.08 + Math.random() * 0.06;
    const geo = new THREE.SphereGeometry(size, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? 0xff4400 : 0xffcc00,
      transparent: true,
      opacity: 0.7,
    });
    const spark = new THREE.Mesh(geo, mat);
    const angle = (i / 10) * Math.PI * 2;
    spark.position.set(
      Math.cos(angle) * 0.3,
      0.5 + Math.random() * 1.0,
      Math.sin(angle) * 0.3
    );
    spark.userData.angle = angle;
    spark.userData.speed = 2 + Math.random() * 3;
    spark.userData.phase = Math.random() * Math.PI * 2;
    player.mesh.add(spark);
    particles.push(spark);
  }
  player.burnEffect = particles;
}

function updateGiantBalls(dt) {
  for (let i = giantBalls.length - 1; i >= 0; i--) {
    const gb = giantBalls[i];
    gb.update(dt, players, sound, effects);
    
    if (!gb.active) {
      giantBalls.splice(i, 1);
    }
  }
}

function updateBananaPeels(dt) {
  for (let i = bananaPeels.length - 1; i >= 0; i--) {
    const bp = bananaPeels[i];
    
    // Check if any player just got slipped this frame
    const prevTriggered = bp.triggered;
    bp.update(dt, players, sound, effects);
    
    // Show action text when banana trap triggers
    if (!prevTriggered && bp.triggered) {
      showActionText('🍌 SLIPPED!', '#ffeb3b');
    }
    
    if (!bp.active) {
      bananaPeels.splice(i, 1);
    }
  }
}

function updateHockeySticks(dt) {
  for (let i = hockeySticks.length - 1; i >= 0; i--) {
    const stick = hockeySticks[i];
    stick.update(dt);
    if (!stick.active) {
      hockeySticks.splice(i, 1);
    }
  }
}

function activateTrapDoor(team) {
  // Pick a random alive opponent
  const opponents = players.filter(p => p.alive && p.team !== team);
  if (opponents.length === 0) return;
  
  const target = opponents[Math.floor(Math.random() * opponents.length)];
  const targetInitialHP = target.hp;
  
  // Create trap door at target's position
  const trapDoor = new TrapDoor(scene, team, target.mesh.position.clone(), target);
  
  // Wire up callback to check if target died and award XP
  trapDoor.onComplete = () => {
    // Award KO XP if target died and activating team is blue
    if (team === CONFIG.TEAM_BLUE && !target.alive && targetInitialHP > 0) {
      awardAndShowXP(rankSystem.awardKO());
      achievements.increment('kos');
      checkAchievementNotifications();
    }
  };
  
  trapDoors.push(trapDoor);
  
  showActionText('🚪 TRAP DOOR!', '#8b4513');
  
  // Play scream when door opens (0.5s delay)
  setTimeout(() => {
    sound.playSlapshotScream();
  }, 500);
}

function updateTrapDoors(dt) {
  for (let i = trapDoors.length - 1; i >= 0; i--) {
    const trapDoor = trapDoors[i];
    trapDoor.update(dt);
    if (!trapDoor.active) {
      trapDoors.splice(i, 1);
    }
  }
}

function showPowerUpNotification(name, team) {
  // Show a brief notification that a power-up spawned on the court
  const teamLabel = team === CONFIG.TEAM_BLUE ? 'BLUE' : 'RED';
  showActionText(`⬡ ${name} SPAWNED!`, '#ffffff');
}

// ─── Show floating action text ─────────────────────────────────────────
function showActionText(text, color) {
  const el = document.getElementById('action-indicator');
  if (el) {
    el.textContent = text;
    el.style.color = color;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 800);
  }
}

// ─── Show next track indicator ─────────────────────────────────────────
function showNextTrackIndicator() {
  const el = document.getElementById('track-indicator');
  if (el) {
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 1200);
  }
}

// ─── Game Over Check ─────────────────────────────────────────
function checkGameOver() {
  const blueAlive = players.filter(p => p.team === CONFIG.TEAM_BLUE && p.alive).length;
  const redAlive = players.filter(p => p.team === CONFIG.TEAM_RED && p.alive).length;
  
  if (blueAlive === 0 || redAlive === 0) {
    gameState = 'gameover';
    hideDeathOverlay();
    _deathOverlayShown = false;
    const blueWins = redAlive === 0;
    
    const title = document.getElementById('game-over-title');
    const sub = document.getElementById('game-over-sub');
    
    if (blueWins) {
      title.textContent = 'VICTORY!';
      title.style.color = '#42a5f5';
      title.style.textShadow = '0 0 30px rgba(66,165,245,0.8)';
      sub.textContent = 'Blue Team wins the match!';
    } else {
      title.textContent = 'DEFEAT';
      title.style.color = '#ef5350';
      title.style.textShadow = '0 0 30px rgba(239,83,80,0.8)';
      sub.textContent = 'Red Team takes the victory...';
    }
    
    // Achievement tracking: matches played & won
    achievements.increment('matches_played');
    if (blueWins) achievements.increment('matches_won');
    checkAchievementNotifications();
    
    // Award match XP (win or loss)
    const matchResult = blueWins ? rankSystem.awardMatchWin() : rankSystem.awardMatchLoss();
    
    // Check for rank-up and show banner
    if (matchResult.ranked_up) {
      showRankUpBanner(matchResult.new_rank, matchResult.old_rank);
    }
    
    // Stop BG music and play outro music
    sound.stopBGMusic();
    sound.playOutroMusic();
    
    setTimeout(() => {
      document.getElementById('game-over').classList.add('active');
      // Populate After-Action Report
      populateAAR();
      // Update rank HUD one final time
      updateRankHUD();
    }, 500);
  }
}

// ─── Teammate Takeover System ─────────────────────────────────────────
function switchToTeammate() {
  if (!humanPlayer || gameState !== 'playing') return;
  if (humanPlayer.alive) return; // Can only switch when dead
  
  // Find alive blue teammates (excluding current human)
  const aliveTeammates = players.filter(p => 
    p.team === CONFIG.TEAM_BLUE && p.alive && p !== humanPlayer
  );
  
  if (aliveTeammates.length === 0) return; // No one to switch to
  
  // Pick the teammate with the most HP
  aliveTeammates.sort((a, b) => b.hp - a.hp);
  const newHuman = aliveTeammates[0];
  
  // ── Transfer control ──
  const oldHuman = humanPlayer;
  
  // Strip human status from old player
  oldHuman.isHuman = false;
  // Remove selection ring from old player
  if (oldHuman.selectionRing) {
    oldHuman.mesh.remove(oldHuman.selectionRing);
    oldHuman.selectionRing.geometry.dispose();
    oldHuman.selectionRing.material.dispose();
    oldHuman.selectionRing = null;
  }
  // Add overhead HP bar to old player (bots have these)
  if (!oldHuman.hpBarMesh) {
    const hbg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    hbg.position.y = 2.05;
    oldHuman.mesh.add(hbg);
    const hfg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x42a5f5, side: THREE.DoubleSide })
    );
    hfg.position.y = 2.05; hfg.position.z = 0.001;
    oldHuman.mesh.add(hfg);
    oldHuman.hpBarMesh = hfg;
    oldHuman.hpBarBg = hbg;
  }
  
  // Grant human status to new player
  newHuman.isHuman = true;
  // Remove overhead HP bar from new player (humans use HUD bar)
  if (newHuman.hpBarMesh) {
    newHuman.mesh.remove(newHuman.hpBarMesh);
    newHuman.hpBarMesh.geometry.dispose();
    newHuman.hpBarMesh.material.dispose();
    newHuman.hpBarMesh = null;
  }
  if (newHuman.hpBarBg) {
    newHuman.mesh.remove(newHuman.hpBarBg);
    newHuman.hpBarBg.geometry.dispose();
    newHuman.hpBarBg.material.dispose();
    newHuman.hpBarBg = null;
  }
  // Add selection ring to new player
  const srGeo = new THREE.RingGeometry(0.5, 0.6, 24);
  const srMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
  const sr = new THREE.Mesh(srGeo, srMat);
  sr.rotation.x = -Math.PI / 2;
  sr.position.y = 0.02;
  newHuman.mesh.add(sr);
  newHuman.selectionRing = sr;
  
  // Clear any AI state on the new human
  newHuman.targetPos = null;
  newHuman.aiState = 'idle';
  newHuman.aiTimer = 0;
  newHuman._aiThrowDelay = null;
  
  // Cancel any active throw charge state
  throwCharge.charging = false;
  throwCharge.amount = 0;
  throwCharge.released = false;
  humanThrowPending = false;
  
  // Update the global reference
  humanPlayer = newHuman;
  
  // Rebuild health bar UI to reflect new human marker
  createPlayerHealthBars();
  
  // Hide death overlay
  hideDeathOverlay();
  
  // Show takeover action text
  showActionText('🔄 TEAMMATE TAKEOVER!', '#00e5ff');
  
  // Play a confirmation sound
  if (sound) sound.playWhistle();
}

function showDeathOverlay() {
  const overlay = document.getElementById('death-overlay');
  const prompt = document.getElementById('death-takeover-prompt');
  const mobileBtn = document.getElementById('mobile-takeover-btn');
  if (overlay) overlay.style.display = 'block';
  
  const aliveTeammates = players.filter(p => 
    p.team === CONFIG.TEAM_BLUE && p.alive && p !== humanPlayer
  );
  
  if (prompt) {
    prompt.style.display = 'block';
    // Re-trigger slide-in animation
    prompt.style.animation = 'none';
    prompt.offsetHeight; // force reflow
    prompt.style.animation = 'takeoverSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    
    const sub = prompt.querySelector('.death-sub');
    const noTeam = prompt.querySelector('.death-no-teammates');
    if (aliveTeammates.length > 0) {
      if (sub) sub.style.display = 'flex';
      if (noTeam) noTeam.style.display = 'none';
      if (mobileBtn && mobileInput.active) mobileBtn.style.display = 'block';
    } else {
      if (sub) sub.style.display = 'none';
      if (noTeam) noTeam.style.display = 'block';
      if (mobileBtn) mobileBtn.style.display = 'none';
    }
  }
}

function hideDeathOverlay() {
  const overlay = document.getElementById('death-overlay');
  const prompt = document.getElementById('death-takeover-prompt');
  const mobileBtn = document.getElementById('mobile-takeover-btn');
  if (overlay) overlay.style.display = 'none';
  if (prompt) prompt.style.display = 'none';
  if (mobileBtn) mobileBtn.style.display = 'none';
}

function updateDeathOverlayState() {
  const prompt = document.getElementById('death-takeover-prompt');
  const mobileBtn = document.getElementById('mobile-takeover-btn');
  if (!prompt || prompt.style.display === 'none') return;
  
  const aliveTeammates = players.filter(p => 
    p.team === CONFIG.TEAM_BLUE && p.alive && p !== humanPlayer
  );
  
  const sub = prompt.querySelector('.death-sub');
  const noTeam = prompt.querySelector('.death-no-teammates');
  if (aliveTeammates.length > 0) {
    if (sub) sub.style.display = 'flex';
    if (noTeam) noTeam.style.display = 'none';
    if (mobileBtn && mobileInput.active) mobileBtn.style.display = 'block';
  } else {
    if (sub) sub.style.display = 'none';
    if (noTeam) noTeam.style.display = 'block';
    if (mobileBtn) mobileBtn.style.display = 'none';
  }
}

// ─── Create Player Health Bars ─────────────────────────────────────────
function createPlayerHealthBars() {
  const blueContainer = document.getElementById('blue-players-container');
  const redContainer = document.getElementById('red-players-container');
  
  if (!blueContainer || !redContainer) return;
  
  // Clear existing
  blueContainer.innerHTML = '';
  redContainer.innerHTML = '';
  
  // Create bars for each player
  players.forEach(player => {
    const container = player.team === CONFIG.TEAM_BLUE ? blueContainer : redContainer;
    const teamClass = player.team === CONFIG.TEAM_BLUE ? 'blue' : 'red';
    
    const healthBar = document.createElement('div');
    healthBar.className = `individual-health-bar ${player.isHuman ? 'human' : ''}`;
    healthBar.id = `player-hp-${player.team}-${player.index}`;
    
    healthBar.innerHTML = `
      <div class="player-number ${teamClass}">${player.isHuman ? '★' : (player.index + 1)}</div>
      <div class="player-hp-bar-bg">
        <div class="player-hp-bar-fill ${teamClass}" style="width: 100%;"></div>
      </div>
      <div class="player-hp-value">100</div>
    `;
    
    container.appendChild(healthBar);
  });
}

// ─── Rank System UI Helpers ─────────────────────────────────────────

// Award XP and show floating popup + check rank-up
function awardAndShowXP(result) {
  // Show floating +XP popup near the HUD portrait
  showXPPopup(result.amount, result.reason);
  
  // XP tick sound
  if (sound) sound.playXPTick();
  
  // Update rank HUD immediately
  updateRankHUD();
  
  // If ranked up mid-match, show the banner
  if (result.ranked_up) {
    showRankUpBanner(result.new_rank, result.old_rank);
  }
}

// Show floating +XP text that rises and fades
function showXPPopup(amount, reason) {
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.textContent = `+${amount} XP`;
  
  // Position near player portrait area
  popup.style.left = '90px';
  popup.style.top = '70px';
  
  document.body.appendChild(popup);
  
  // Remove after animation completes
  setTimeout(() => {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
  }, 1200);
}

// Update rank icon, label, and XP bar in the HUD
function updateRankHUD() {
  const rank = rankSystem.getRank();
  const progress = rankSystem.getProgress();
  const nextRank = rankSystem.getNextRank();
  const icon = rankSystem.getIcon();
  const tierColor = rankSystem.getTierColor();
  
  // Rank icon in portrait
  const rankImg = document.getElementById('rank-icon-img');
  if (rankImg && rankImg.src !== icon) {
    rankImg.src = icon;
  }
  
  // Portrait border color matches tier
  const portrait = document.getElementById('player-portrait');
  if (portrait) {
    portrait.style.borderColor = tierColor;
    portrait.style.boxShadow = `0 0 15px ${tierColor}66`;
  }
  
  // Rank label
  const rankLabel = document.getElementById('player-rank-label');
  if (rankLabel) rankLabel.textContent = rank.title.toUpperCase();
  
  // XP bar
  const xpBar = document.getElementById('xp-bar');
  if (xpBar) xpBar.style.width = (progress * 100) + '%';
  
  // XP label text
  const xpLevel = document.querySelector('#xp-label .xp-level');
  if (xpLevel) xpLevel.textContent = `LVL ${rank.level}`;
  
  const xpText = document.getElementById('xp-text');
  if (xpText) {
    if (nextRank) {
      const xpIntoRank = rankSystem.xp - rank.xpRequired;
      const xpNeeded = nextRank.xpRequired - rank.xpRequired;
      xpText.textContent = `${xpIntoRank} / ${xpNeeded} XP`;
    } else {
      xpText.textContent = 'MAX RANK';
    }
  }
  
  // XP bar gradient matches tier
  if (xpBar) {
    xpBar.style.background = `linear-gradient(90deg, ${tierColor}, #ffd700)`;
  }
  
  // Start screen rank display
  const startIcon = document.getElementById('start-rank-icon');
  if (startIcon) startIcon.src = icon;
  const startTitle = document.getElementById('start-rank-title');
  if (startTitle) startTitle.textContent = rank.title.toUpperCase();
  const startXP = document.getElementById('start-rank-xp');
  if (startXP) {
    startXP.textContent = nextRank 
      ? `LVL ${rank.level} · ${rankSystem.xp} XP` 
      : `LVL ${rank.level} · MAX RANK`;
  }
  // Update start screen rank border color
  const startDisplay = document.getElementById('start-rank-display');
  if (startDisplay) {
    startDisplay.style.borderColor = `${tierColor}55`;
  }
}

// ═══════════════════════════════════════════════════════════
// ═══ ACHIEVEMENT SYSTEM — Notifications & UI ═════════════
// ═══════════════════════════════════════════════════════════

let _achieveToastTimer = null;

function checkAchievementNotifications() {
  // Drain pending XP from achievements into rank system
  const pendingXP = achievements.drainPendingXP();
  if (pendingXP > 0) {
    // awardAndShowXP already handles rank-up banner internally
    const result = rankSystem.awardXP(pendingXP, 'Challenge Bonus');
    awardAndShowXP(result);
  }
  
  // Show notification for next unlocked achievement
  const notification = achievements.getNextNotification();
  if (notification) {
    showAchievementToast(notification);
  }
}

function showAchievementToast(data) {
  // Remove any existing toast
  const existing = document.querySelector('.achievement-toast');
  if (existing) existing.remove();
  if (_achieveToastTimer) { clearTimeout(_achieveToastTimer); _achieveToastTimer = null; }
  
  // Play achievement unlock sound
  if (sound && sound.playAchievement) {
    sound.playAchievement();
  }
  
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="achieve-toast-icon">${data.achievement.icon}</div>
    <div class="achieve-toast-info">
      <div class="achieve-toast-label" style="color: ${data.tierColor};">ACHIEVEMENT UNLOCKED — ${data.tierName.toUpperCase()}</div>
      <div class="achieve-toast-name">${data.achievement.name}</div>
      <div class="achieve-toast-detail">${data.achievement.description} — ${data.achievement.tiers[data.tier - 1]} reached</div>
    </div>
    <div class="achieve-toast-xp">+${data.xp} XP</div>
  `;
  document.body.appendChild(toast);
  
  // Auto-remove after animation completes
  _achieveToastTimer = setTimeout(() => {
    if (toast.parentNode) toast.remove();
    _achieveToastTimer = null;
    // Check for queued notifications
    const next = achievements.getNextNotification();
    if (next) {
      setTimeout(() => showAchievementToast(next), 300);
    }
  }, 4200);
}

function buildAchievementsModal() {
  const listEl = document.getElementById('achieve-list');
  const summaryEl = document.getElementById('achieve-summary');
  if (!listEl) return;
  
  listEl.innerHTML = '';
  
  const byCategory = achievements.getByCategory();
  const totals = achievements.getTotalUnlocked();
  
  if (summaryEl) {
    summaryEl.innerHTML = `<span>${totals.unlocked}</span> / ${totals.max} tiers unlocked`;
  }
  
  const categoryOrder = ['OFFENSIVE', 'DEFENSIVE', 'POWER-UPS', 'CAREER'];
  
  categoryOrder.forEach(catName => {
    const items = byCategory[catName];
    if (!items) return;
    
    const section = document.createElement('div');
    section.className = 'achieve-category';
    
    section.innerHTML = `<div class="achieve-category-label">${catName}</div>`;
    
    items.forEach(a => {
      const card = document.createElement('div');
      card.className = 'achieve-card' + (a.maxed ? ' maxed' : '');
      
      // Build tier pips
      let pipsHTML = '';
      for (let i = 0; i < 4; i++) {
        const filled = i < a.currentTier;
        const pipColor = filled ? ACHIEVE_TIER_COLORS[i] : 'transparent';
        pipsHTML += `<div class="achieve-tier-pip ${filled ? 'filled' : ''}" style="${filled ? `background:${pipColor}22; border-color:${pipColor};` : ''}" title="${TIER_NAMES[i]}: ${a.tiers[i]}">${filled ? TIER_ICONS[i] : ''}</div>`;
      }
      
      // Tier badge
      let badgeHTML = '';
      if (a.currentTier > 0) {
        badgeHTML = `<span class="achieve-card-tier-badge" style="background: ${a.tierColor}22; color: ${a.tierColor}; border: 1px solid ${a.tierColor}55;">${a.tierIcon} ${a.tierName}</span>`;
      }
      
      // Progress bar color
      const barColor = a.currentTier > 0 ? a.tierColor : '#555';
      const nextBarColor = a.currentTier < 4 ? ACHIEVE_TIER_COLORS[a.currentTier] : ACHIEVE_TIER_COLORS[3];
      
      card.innerHTML = `
        <div class="achieve-card-icon">${a.icon}</div>
        <div class="achieve-card-info">
          <div class="achieve-card-top">
            <span class="achieve-card-name">${a.name}</span>
            ${badgeHTML}
          </div>
          <div class="achieve-card-desc">${a.description}</div>
          <div class="achieve-card-progress">
            <div class="achieve-bar-bg">
              <div class="achieve-bar-fill" style="width: ${Math.round(a.progress * 100)}%; background: linear-gradient(90deg, ${barColor}, ${nextBarColor});"></div>
            </div>
            <div class="achieve-card-stat"><span>${a.stat.toLocaleString()}</span> / ${a.nextThreshold.toLocaleString()}</div>
          </div>
        </div>
        <div class="achieve-card-tiers">${pipsHTML}</div>
      `;
      
      section.appendChild(card);
    });
    
    listEl.appendChild(section);
  });
}

function initAchievementsUI() {
  const btn = document.getElementById('achievements-btn');
  const modal = document.getElementById('achievements-modal');
  const closeBtn = document.getElementById('achieve-close-btn');
  
  if (btn) {
    btn.addEventListener('click', () => {
      buildAchievementsModal();
      if (modal) modal.classList.add('active');
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('active');
    });
  }
  
  // Close on background click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

// Full-screen cinematic rank-up notification
function showRankUpBanner(newRank, oldRank) {
  const banner = document.getElementById('rankup-banner');
  if (!banner) return;
  
  const iconEl = document.getElementById('rankup-icon');
  const titleEl = document.getElementById('rankup-title');
  const levelEl = document.getElementById('rankup-level');
  const flash = document.getElementById('rankup-flash');
  const oldTitleEl = document.getElementById('rankup-old-title');
  const newTitleEl = document.getElementById('rankup-new-title');
  
  // Set content
  if (iconEl) iconEl.src = RANK_ICONS[newRank.tier];
  if (titleEl) titleEl.textContent = newRank.title;
  if (levelEl) levelEl.textContent = `LEVEL ${newRank.level}`;
  
  // Old → New transition
  if (oldRank && oldTitleEl && newTitleEl) {
    oldTitleEl.textContent = oldRank.title;
    newTitleEl.textContent = newRank.title;
  }
  
  // ── 1. Golden screen flash ──
  if (flash) {
    flash.classList.remove('active');
    void flash.offsetWidth; // force reflow for re-trigger
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 900);
  }
  
  // ── 2. Show banner with entrance animation ──
  banner.classList.remove('fadeout');
  banner.classList.add('active');
  
  // ── 3. Play rank-up fanfare ──
  if (sound) sound.playRankUp();
  
  // ── 4. HUD portrait pulse + XP bar flash ──
  const portrait = document.getElementById('player-portrait');
  const xpBarContainer = document.getElementById('xp-bar-container');
  if (portrait) {
    portrait.classList.remove('levelup-pulse');
    void portrait.offsetWidth;
    portrait.classList.add('levelup-pulse');
    setTimeout(() => portrait.classList.remove('levelup-pulse'), 1300);
  }
  if (xpBarContainer) {
    xpBarContainer.classList.remove('levelup-flash');
    void xpBarContainer.offsetWidth;
    xpBarContainer.classList.add('levelup-flash');
    setTimeout(() => xpBarContainer.classList.remove('levelup-flash'), 1100);
  }
  
  // ── 5. Spawn floating sparkle particles from center ──
  spawnRankUpSparks(20);
  
  // ── 6. Fade out after 3.5 seconds ──
  setTimeout(() => {
    banner.classList.add('fadeout');
    setTimeout(() => {
      banner.classList.remove('active', 'fadeout');
    }, 600);
  }, 3500);
}

// Spawn floating golden sparkle particles radiating from screen center
function spawnRankUpSparks(count) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'rankup-float-spark';
    
    // Random position around center
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const startDist = 30 + Math.random() * 40;
    const x = cx + Math.cos(angle) * startDist;
    const y = cy + Math.sin(angle) * startDist;
    
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';
    
    // Custom rise/drift per particle
    const rise = -(80 + Math.random() * 120);
    const drift = (Math.random() - 0.5) * 100;
    const dur = 1.0 + Math.random() * 1.0;
    spark.style.setProperty('--rise', rise + 'px');
    spark.style.setProperty('--drift', drift + 'px');
    spark.style.setProperty('--dur', dur + 's');
    spark.style.animationDelay = (Math.random() * 0.4) + 's';
    
    // Random size variation
    const size = 3 + Math.random() * 5;
    spark.style.width = size + 'px';
    spark.style.height = size + 'px';
    
    // Random gold/white color
    const colors = ['#ffd700', '#fff4b0', '#ffaa00', '#ffffff', '#ffc107'];
    spark.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    document.body.appendChild(spark);
    
    // Cleanup
    setTimeout(() => {
      if (spark.parentNode) spark.parentNode.removeChild(spark);
    }, (dur + 0.5) * 1000);
  }
}

// Populate After-Action Report on game-over screen
function populateAAR() {
  const rowsContainer = document.getElementById('aar-rows');
  const totalXPEl = document.getElementById('aar-total-xp');
  const rankIconEl = document.getElementById('aar-rank-icon');
  const rankBarEl = document.getElementById('aar-rank-bar');
  const rankTextEl = document.getElementById('aar-rank-text');
  const aarContainer = document.getElementById('aar-container');
  
  if (!rowsContainer) return;
  
  // Get match summary
  const summary = rankSystem.getMatchSummary();
  
  // Clear old rows
  rowsContainer.innerHTML = '';
  
  // Add each XP category
  const categoryOrder = ['Match Victory', 'Match Played', 'KO Kill', 'Ball Catch', 'Deflection'];
  const categoryEmojis = {
    'Match Victory': '🏆',
    'Match Played': '🎮',
    'KO Kill': '💀',
    'Ball Catch': '🤲',
    'Deflection': '🛡️',
  };
  
  categoryOrder.forEach(reason => {
    const data = summary.breakdown[reason];
    if (!data) return;
    
    const row = document.createElement('div');
    row.className = 'aar-row';
    const emoji = categoryEmojis[reason] || '';
    row.innerHTML = `
      <span class="aar-label">${emoji} ${reason} ${data.count > 1 ? `×${data.count}` : ''}</span>
      <span class="aar-xp">+${data.xp}</span>
    `;
    rowsContainer.appendChild(row);
  });
  
  // Total XP
  if (totalXPEl) totalXPEl.textContent = `+${summary.total}`;
  
  // Rank progress
  const rank = rankSystem.getRank();
  const progress = rankSystem.getProgress();
  
  if (rankIconEl) rankIconEl.src = rankSystem.getIcon();
  if (rankBarEl) {
    rankBarEl.style.width = '0%';
    // Animate the bar fill
    setTimeout(() => {
      rankBarEl.style.width = (progress * 100) + '%';
    }, 200);
  }
  if (rankTextEl) rankTextEl.textContent = `${rank.title} — Lvl ${rank.level}`;
  
  // Show AAR
  if (aarContainer) aarContainer.style.display = 'flex';
}

// ─── HUD Update ─────────────────────────────────────────
function updateHUD() {
  if (!humanPlayer) return;
  
  // ── Death overlay management ──
  if (humanPlayer && !humanPlayer.alive && gameState === 'playing') {
    if (!_deathOverlayShown) {
      _deathOverlayShown = true;
      // Small delay so the KO effect plays first
      setTimeout(() => {
        if (humanPlayer && !humanPlayer.alive && gameState === 'playing') {
          showDeathOverlay();
        }
      }, 600);
    } else {
      // Update availability of teammates while overlay is shown
      updateDeathOverlayState();
    }
  } else if (humanPlayer && humanPlayer.alive) {
    if (_deathOverlayShown) {
      _deathOverlayShown = false;
      hideDeathOverlay();
    }
  }
  
  // HP bar
  const hpBar = document.getElementById('hp-bar');
  if (hpBar) hpBar.style.width = (humanPlayer.hp / humanPlayer.maxHp * 100) + '%';
  
  // Stamina bar
  const stamBar = document.getElementById('stamina-bar');
  if (stamBar) stamBar.style.width = (humanPlayer.stamina / CONFIG.MAX_STAMINA * 100) + '%';
  
  // Team counter
  const blueAlive = players.filter(p => p.team === CONFIG.TEAM_BLUE && p.alive).length;
  const redAlive = players.filter(p => p.team === CONFIG.TEAM_RED && p.alive).length;
  
  const blueCount = document.getElementById('blue-count');
  const redCount = document.getElementById('red-count');
  if (blueCount) blueCount.textContent = blueAlive;
  if (redCount) redCount.textContent = redAlive;
  
  // Individual player health bars
  players.forEach(player => {
    const healthBar = document.getElementById(`player-hp-${player.team}-${player.index}`);
    if (healthBar) {
      const fillBar = healthBar.querySelector('.player-hp-bar-fill');
      const valueText = healthBar.querySelector('.player-hp-value');
      
      if (fillBar) {
        const hpPercent = player.alive ? (player.hp / player.maxHp * 100) : 0;
        fillBar.style.width = hpPercent + '%';
      }
      
      if (valueText) {
        valueText.textContent = player.alive ? Math.ceil(player.hp) : '0';
      }
      
      healthBar.classList.toggle('dead', !player.alive);
    }
  });
  
  // Update mobile buttons state
  const btnCharge = document.getElementById('btn-charge');
  const btnAction = document.getElementById('btn-action');
  if (btnCharge) {
    btnCharge.classList.toggle('hidden', !humanPlayer.hasBall);
  }
  if (btnAction) {
    if (humanPlayer.hasBall) {
      const incoming = findIncomingBall(humanPlayer);
      btnAction.innerHTML = incoming ? '🛡️<br>DEFLECT' : '🎯<br>THROW';
    } else {
      btnAction.innerHTML = '🤲<br>CATCH';
    }
  }
  
  // Trick charge name display
  const trickName = document.getElementById('trick-name');
  const trickChg = humanPlayer.trickCharge || 0;
  if (trickName && humanPlayer.hasBall && trickChg > 0) {
    if (trickChg >= CONFIG.TRICKS.METEOR.charge) {
      trickName.textContent = '☄️ METEOR READY!';
      trickName.style.color = '#ff0044';
      trickName.style.textShadow = '0 0 15px rgba(255,0,68,0.8)';
    } else if (trickChg >= CONFIG.TRICKS.LIGHTNING.charge) {
      trickName.textContent = '⚡ LIGHTNING READY!';
      trickName.style.color = '#00ccff';
      trickName.style.textShadow = '0 0 15px rgba(0,204,255,0.8)';
    } else if (trickChg >= CONFIG.TRICKS.FIREBALL.charge) {
      trickName.textContent = '🔥 FIREBALL READY!';
      trickName.style.color = '#ff6600';
      trickName.style.textShadow = '0 0 15px rgba(255,102,0,0.8)';
    } else if (trickChg >= CONFIG.TRICKS.CURVE.charge) {
      trickName.textContent = '🌀 CURVEBALL READY!';
      trickName.style.color = '#00ff88';
      trickName.style.textShadow = '0 0 15px rgba(0,255,136,0.8)';
    } else {
      trickName.textContent = 'CHARGING...';
      trickName.style.color = '#e040fb';
      trickName.style.textShadow = '0 0 10px rgba(224,64,251,0.5)';
    }
  } else if (trickName) {
    trickName.textContent = '';
  }
}

// ─── Camera Update ─────────────────────────────────────────
function updateCamera(dt) {
  // Free look overrides all
  if (freeLook.active) {
    updateFreeLookCamera();
    return;
  }
  
  // Third person camera
  if (thirdPersonCam.active) {
    updateThirdPersonCamera(dt);
    return;
  }
  
  // Default game camera
  if (!humanPlayer || gameState !== 'playing') return;
  
  const playerX = humanPlayer.mesh.position.x;
  const playerZ = humanPlayer.mesh.position.z;
  const hd = CONFIG.COURT_DEPTH / 2;
  
  // Normalize player Z position: -1 (back wall) to +1 (front/camera side)
  const zNorm = playerZ / hd; // -1 to +1
  
  // Zoom affects BOTH distance and height proportionally
  // This keeps the camera angle consistent instead of just shoving forward
  const zoomFactor = gameCameraControl.zoom;
  const zoomHeightRatio = CONFIG.CAMERA_HEIGHT / CONFIG.CAMERA_DISTANCE; // maintain angle
  
  // Camera tracks player on X (damped) and adjusts Z/Y based on player depth + zoom
  const targetX = playerX * 0.4 + gameCameraControl.offsetX;
  const targetY = CONFIG.CAMERA_HEIGHT + zNorm * 1.0 + gameCameraControl.offsetY + zoomFactor * zoomHeightRatio;
  const targetZ = CONFIG.CAMERA_DISTANCE + zNorm * 2.0 + zoomFactor;
  
  const camSmooth = 3.5 * dt;  // slightly faster smoothing for responsive zoom
  camera.position.x += (targetX - camera.position.x) * camSmooth;
  camera.position.y += (targetY - camera.position.y) * camSmooth;
  camera.position.z += (targetZ - camera.position.z) * camSmooth;
  
  // Clamp camera — keep inside gym walls, and don't go below court level
  const maxCamZ = hd + 3.0;
  camera.position.z = Math.min(camera.position.z, maxCamZ);
  camera.position.y = Math.max(2.0, camera.position.y); // never go below 2 units
  
  // Apply camera shake
  const shake = effects.getShakeOffset();
  camera.position.x += shake.x;
  camera.position.y += shake.y;
  
  // Look target tracks player and adjusts with zoom for clean framing
  // Closer zoom → look target rises slightly to keep court centered
  const lookYBase = 0.5 + zNorm * 0.3 + Math.min(0, zoomFactor) * 0.15;
  const lookY = Math.min(lookYBase, camera.position.y - 1.5);
  const lookTarget = new THREE.Vector3(
    playerX * 0.15,
    lookY,
    -2 + playerZ * 0.3
  );
  camera.lookAt(lookTarget);
}

// ─── Resize ─────────────────────────────────────────
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ─── Animation Loop ─────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = rawDt * gameTimeScale; // Apply time scale for slow-motion effects
  
  if (gameState === 'playing') {
    updateGame(dt);
    updateCamera(rawDt); // Camera uses raw dt so it doesn't slow down
  } else if (gameState === 'gameover' && freeLook.active) {
    updateFreeLookCamera();
  }
  
  effects.update(rawDt); // Effects use raw dt to keep visual smoothness
  renderer.render(scene, camera);
}

// ─── Boot ─────────────────────────────────────────
init();
