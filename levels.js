// Level/Environment Configuration
export const LEVELS = {
  'classic-gym': {
    name: 'Indoor Gym',
    id: 'classic-gym',
    floorTexture: 'https://rosebud.ai/assets/gym-floor.webp?uZ4i',
    wallTexture: 'https://rosebud.ai/assets/gym-wall.webp?Vm6X',
    floorColor: 0xd4a056,
    wallColor: 0x90a4ae,
    ceilingColor: 0x7e8a8f,
    lightIntensity: 0.85,
    lightColor: 0xffffff,
    ambientColor: 0xffffff,
    ambientIntensity: 0.45,
    fogColor: 0x8a7a6a,
    fogNear: 20,
    fogFar: 50,
  },
  
  'street-court': {
    name: 'Street Court',
    id: 'street-court',
    floorTexture: null,
    wallTexture: null,
    floorColor: 0x3a3a3a,
    wallColor: 0x6b3a22,
    ceilingColor: null,
    lightIntensity: 1.4,
    lightColor: 0xffe0b0,
    ambientColor: 0xffcc88,
    ambientIntensity: 0.65,
    fogColor: 0xcc7733,
    fogNear: 35,
    fogFar: 80,
    skyColor: 0x1a0a2e,  // Will be replaced by gradient sky
  },
  
  'colosseum': {
    name: 'Colosseum',
    id: 'colosseum',
    floorTexture: null,
    wallTexture: null,
    floorColor: 0xc9a04a,     // Sandy gold
    wallColor: 0x8b7355,      // Weathered stone
    ceilingColor: null,
    lightIntensity: 1.3,
    lightColor: 0xffe0a0,     // Warm sunset light
    ambientColor: 0xffcc88,
    ambientIntensity: 0.55,
    fogColor: 0xcc8844,
    fogNear: 35,
    fogFar: 90,
    skyColor: 0x2a1040,       // Deep purple sky (gradient dome handles visual)
  },
};

export let currentLevel = 'classic-gym';

export function setCurrentLevel(levelId) {
  if (LEVELS[levelId]) {
    currentLevel = levelId;
    return LEVELS[levelId];
  }
  return LEVELS['classic-gym'];
}

export function getCurrentLevel() {
  return LEVELS[currentLevel];
}
