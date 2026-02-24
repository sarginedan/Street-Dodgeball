import * as THREE from 'three';
import { CONFIG } from './config.js';

// ─── Helpers ──────────────────────────────────────────
function disposeNode(node) {
  if (node.geometry) node.geometry.dispose();
  if (node.material) {
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach(m => {
      if (m.map) m.map.dispose();
      if (m.normalMap) m.normalMap.dispose();
      if (m.roughnessMap) m.roughnessMap.dispose();
      m.dispose();
    });
  }
}

export class Gym {
  constructor(scene, levelConfig = null) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.loader = new THREE.TextureLoader();
    this.levelConfig = levelConfig;
    this.build();
    scene.add(this.group);
  }

  rebuild(levelConfig) {
    // Deep recursive disposal
    this.group.traverse(child => disposeNode(child));
    this.group.clear();
    this.levelConfig = levelConfig;
    this.build();
  }

  // ═══════════════════════════════════════════════════════
  //  LEVEL ROUTER
  // ═══════════════════════════════════════════════════════
  build() {
    const id = this.levelConfig?.id || 'classic-gym';

    if (id === 'street-court') {
      this.buildStreetCourt();
    } else if (id === 'colosseum') {
      this.buildColosseum();
    } else {
      this.buildClassicGym();
    }
  }

  // ═══════════════════════════════════════════════════════
  //  CLASSIC GYM — original indoor gymnasium
  // ═══════════════════════════════════════════════════════
  buildClassicGym() {
    this.buildGymFloor();
    this.buildCourtLines(0xffffff, 0.85, 0xffff00, 0.25);
    this.buildBackWall();
    this.buildSideWalls();
    this.buildFrontWall();
    this.buildBleachers();
    this.buildWindows();
    this.buildCeilingStructure();
    this.buildGymLighting();
    this.buildBanners();
    this.buildScoreboard();
  }

  // ═══════════════════════════════════════════════════════
  //  STREET COURT — urban outdoor environment
  // ═══════════════════════════════════════════════════════
  buildStreetCourt() {
    this.buildStreetSky();
    this.buildStreetGround();
    this.buildStreetCourtLines();
    this.buildStreetWalls();
    this.buildChainLinkFences();
    this.buildStreetLights();
    this.buildBuildings();
    this.buildStreetProps();
    this.buildGraffiti();
  }

  // ─── Street: Sky dome with sunset gradient ────────────────────
  buildStreetSky() {
    // Large sky dome
    const skyGeo = new THREE.SphereGeometry(80, 32, 24);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const ctx = skyCanvas.getContext('2d');

    // Golden-hour gradient — deep indigo → magenta → orange → gold
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0d0b2e');
    grad.addColorStop(0.2, '#1a1040');
    grad.addColorStop(0.4, '#4a1942');
    grad.addColorStop(0.55, '#8b2040');
    grad.addColorStop(0.7, '#d4602a');
    grad.addColorStop(0.82, '#f0a030');
    grad.addColorStop(0.92, '#ffcc55');
    grad.addColorStop(1, '#ffe8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Scatter small cloud wisps
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 18; i++) {
      const cx = Math.random() * 512;
      const cy = 180 + Math.random() * 180;
      ctx.fillStyle = '#ffddcc';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 60 + Math.random() * 80, 8 + Math.random() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);

    // Sun glow sprite
    const sunGeo = new THREE.SphereGeometry(4, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.85,
      fog: false,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(-35, 12, -55);
    this.group.add(sun);

    // Outer glow around sun
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.2,
      fog: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    this.group.add(glow);
  }

  // ─── Street: Ground plane — cracked asphalt ────────────────────
  buildStreetGround() {
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    const pad = 20;

    // Large surrounding area — rough asphalt
    const outerGeo = new THREE.PlaneGeometry(hw * 2 + pad * 2, hd * 2 + pad * 2, 32, 32);
    // Vertex displacement for roughness
    const posAttr = outerGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      // Only displace vertices outside the court rectangle
      if (Math.abs(x) > hw + 1 || Math.abs(y) > hd + 1) {
        posAttr.setZ(i, (Math.random() - 0.5) * 0.15);
      }
    }
    outerGeo.computeVertexNormals();

    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.92,
      metalness: 0.02,
    });
    const outer = new THREE.Mesh(outerGeo, asphaltMat);
    outer.rotation.x = -Math.PI / 2;
    outer.receiveShadow = true;
    this.group.add(outer);

    // Court surface — slightly lighter, painted concrete
    const courtGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH + 2, CONFIG.COURT_DEPTH + 2);
    const courtMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a48,
      roughness: 0.75,
      metalness: 0.05,
    });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.01;
    court.receiveShadow = true;
    this.group.add(court);

    // Faded paint splotches on court
    const splotchMat = new THREE.MeshBasicMaterial({ color: 0x555550, transparent: true, opacity: 0.12 });
    for (let i = 0; i < 12; i++) {
      const sGeo = new THREE.CircleGeometry(0.6 + Math.random() * 1.5, 16);
      const s = new THREE.Mesh(sGeo, splotchMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(
        (Math.random() - 0.5) * CONFIG.COURT_WIDTH,
        0.02,
        (Math.random() - 0.5) * CONFIG.COURT_DEPTH
      );
      this.group.add(s);
    }

    // Drain grates (small details)
    const grateMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.7 });
    [[-hw - 4, -hd + 2], [hw + 4, hd - 2]].forEach(([x, z]) => {
      const grateGeo = new THREE.BoxGeometry(1.2, 0.04, 0.5);
      const grate = new THREE.Mesh(grateGeo, grateMat);
      grate.position.set(x, 0.02, z);
      this.group.add(grate);
      // Grate lines
      for (let j = -0.4; j <= 0.4; j += 0.15) {
        const lineGeo = new THREE.BoxGeometry(0.03, 0.06, 0.45);
        const line = new THREE.Mesh(lineGeo, grateMat);
        line.position.set(x + j, 0.04, z);
        this.group.add(line);
      }
    });

    // Curb / sidewalk edge around court
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x666660, roughness: 0.8, metalness: 0.05 });
    const curbH = 0.15;
    // Front + back curbs
    [-hd - 1.2, hd + 1.2].forEach(z => {
      const cGeo = new THREE.BoxGeometry(CONFIG.COURT_WIDTH + 4, curbH, 0.6);
      const c = new THREE.Mesh(cGeo, curbMat);
      c.position.set(0, curbH / 2, z);
      c.castShadow = true;
      this.group.add(c);
    });
    // Side curbs
    [-hw - 1.5, hw + 1.5].forEach(x => {
      const cGeo = new THREE.BoxGeometry(0.6, curbH, CONFIG.COURT_DEPTH + 4.8);
      const c = new THREE.Mesh(cGeo, curbMat);
      c.position.set(x, curbH / 2, 0);
      c.castShadow = true;
      this.group.add(c);
    });
  }

  // ─── Street: Court lines (spray-painted style) ────────────────────
  buildStreetCourtLines() {
    // More rough / grunge look — slightly transparent, thicker lines
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;

    // Center line
    const cGeo = new THREE.PlaneGeometry(0.14, CONFIG.COURT_DEPTH);
    const center = new THREE.Mesh(cGeo, lineMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.025;
    this.group.add(center);

    // Boundary rectangle
    [[-hw, 0], [hw, 0]].forEach(([x]) => {
      const sGeo = new THREE.PlaneGeometry(0.12, CONFIG.COURT_DEPTH);
      const s = new THREE.Mesh(sGeo, lineMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.025, 0);
      this.group.add(s);
    });
    [[-hd, 0], [hd, 0]].forEach(([z]) => {
      const bGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH, 0.12);
      const b = new THREE.Mesh(bGeo, lineMat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(0, 0.025, z);
      this.group.add(b);
    });

    // Center circle — spray-painted ring
    const ringGeo = new THREE.RingGeometry(2.1, 2.35, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.group.add(ring);

    // Attack zone dashes — orange spray paint
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.4 });
    [-7, 7].forEach(x => {
      for (let z = -hd + 0.5; z < hd; z += 1.0) {
        const dGeo = new THREE.PlaneGeometry(0.1, 0.45);
        const d = new THREE.Mesh(dGeo, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.025, z);
        this.group.add(d);
      }
    });
  }

  // ─── Street: Brick walls with detail ────────────────────
  buildStreetWalls() {
    const hw = CONFIG.COURT_WIDTH / 2 + 5;
    const hd = CONFIG.COURT_DEPTH / 2 + 5;
    const wallH = 8;

    // Brick material
    const brickMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.88,
      metalness: 0.02,
    });
    const brickDarkMat = new THREE.MeshStandardMaterial({
      color: 0x5c2e0e,
      roughness: 0.9,
      metalness: 0.02,
    });
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x6e6e66,
      roughness: 0.85,
      metalness: 0.05,
    });

    // Back wall (main view) — tall brick
    const backGeo = new THREE.BoxGeometry(hw * 2, wallH, 0.6);
    const backWall = new THREE.Mesh(backGeo, brickMat);
    backWall.position.set(0, wallH / 2, -hd);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    this.group.add(backWall);

    // Brick pattern overlay on back wall (rows of fake bricks)
    const rowMat = new THREE.MeshBasicMaterial({ color: 0x3a1a0a, transparent: true, opacity: 0.15 });
    for (let y = 0.3; y < wallH; y += 0.35) {
      const rGeo = new THREE.PlaneGeometry(hw * 2, 0.03);
      const r = new THREE.Mesh(rGeo, rowMat);
      r.position.set(0, y, -hd + 0.32);
      this.group.add(r);
    }
    // Vertical mortar lines (offset every other row)
    for (let y = 0; y < wallH; y += 0.7) {
      const offset = (Math.floor(y / 0.35) % 2 === 0) ? 0 : 0.5;
      for (let x = -hw + offset; x < hw; x += 1.0) {
        const vGeo = new THREE.PlaneGeometry(0.025, 0.34);
        const v = new THREE.Mesh(vGeo, rowMat);
        v.position.set(x, y + 0.17, -hd + 0.32);
        this.group.add(v);
      }
    }

    // Wall cap / concrete ledge
    const capGeo = new THREE.BoxGeometry(hw * 2 + 0.2, 0.25, 0.8);
    const cap = new THREE.Mesh(capGeo, concreteMat);
    cap.position.set(0, wallH + 0.12, -hd);
    cap.castShadow = true;
    this.group.add(cap);

    // Side walls — shorter, mixed brick
    [-hw, hw].forEach(x => {
      const sideH = 6;
      const sideGeo = new THREE.BoxGeometry(0.6, sideH, hd * 2);
      const side = new THREE.Mesh(sideGeo, x < 0 ? brickMat : brickDarkMat);
      side.position.set(x, sideH / 2, 0);
      side.receiveShadow = true;
      side.castShadow = true;
      this.group.add(side);

      // Side wall cap
      const sCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.2, hd * 2 + 0.2),
        concreteMat
      );
      sCap.position.set(x, sideH + 0.1, 0);
      this.group.add(sCap);
    });

    // Front wall (behind camera) — lower
    const frontH = 4;
    const frontGeo = new THREE.BoxGeometry(hw * 2, frontH, 0.6);
    const frontMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const frontWall = new THREE.Mesh(frontGeo, frontMat);
    frontWall.position.set(0, frontH / 2, hd);
    this.group.add(frontWall);
  }

  // ─── Street: Chain-link fences ────────────────────
  buildChainLinkFences() {
    const hw = CONFIG.COURT_WIDTH / 2 + 1.5;
    const hd = CONFIG.COURT_DEPTH / 2 + 1.2;
    const fenceH = 3.2;

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.4,
      metalness: 0.8,
    });
    const meshMat = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    // Top rail
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.35,
      metalness: 0.75,
    });

    // Create fence on both sides of court
    [-hw, hw].forEach(x => {
      // Mesh panel
      const panelGeo = new THREE.PlaneGeometry(0.05, fenceH);
      // Use many short panels for depth
      for (let z = -hd; z <= hd; z += 0.5) {
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(0.5, fenceH),
          meshMat
        );
        panel.position.set(x, fenceH / 2, z);
        panel.rotation.y = Math.PI / 2;
        this.group.add(panel);
      }

      // Fence posts
      for (let z = -hd; z <= hd; z += 3) {
        const postGeo = new THREE.CylinderGeometry(0.04, 0.04, fenceH + 0.3, 8);
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, (fenceH + 0.3) / 2, z);
        post.castShadow = true;
        this.group.add(post);
      }

      // Top rail
      const railGeo = new THREE.CylinderGeometry(0.03, 0.03, hd * 2, 8);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, fenceH + 0.1, 0);
      this.group.add(rail);
    });
  }

  // ─── Street: Street lights ────────────────────
  buildStreetLights() {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.7,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffeecc,
      emissive: 0xffdd88,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.4,
      metalness: 0.8,
    });

    const positions = [
      [-18, -10], [18, -10],
      [-18, 10], [18, 10],
    ];

    positions.forEach(([x, z]) => {
      // Pole
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 9, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 4.5, z);
      pole.castShadow = true;
      this.group.add(pole);

      // Arm that extends toward court
      const armDir = x > 0 ? -1 : 1;
      const armGeo = new THREE.BoxGeometry(3, 0.1, 0.1);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(x + armDir * 1.5, 9, z);
      this.group.add(arm);

      // Lamp housing
      const housingGeo = new THREE.BoxGeometry(1.2, 0.3, 0.8);
      const housing = new THREE.Mesh(housingGeo, fixtureMat);
      housing.position.set(x + armDir * 2.5, 8.85, z);
      this.group.add(housing);

      // Lamp bulb glow
      const bulbGeo = new THREE.PlaneGeometry(1.0, 0.6);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.rotation.x = -Math.PI / 2;
      bulb.position.set(x + armDir * 2.5, 8.69, z);
      this.group.add(bulb);

      // Volume light cone (subtle)
      const coneGeo = new THREE.ConeGeometry(3, 6, 16, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffdd88,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(x + armDir * 2.5, 5.5, z);
      this.group.add(cone);
    });
  }

  // ─── Street: Background buildings / skyline ────────────────────
  buildBuildings() {
    const hw = CONFIG.COURT_WIDTH / 2 + 5;
    const hd = CONFIG.COURT_DEPTH / 2 + 5;

    const buildingConfigs = [
      // Behind back wall — taller buildings
      { x: -16, z: -hd - 5, w: 8, h: 22, d: 6, color: 0x2a2a35 },
      { x: -6, z: -hd - 7, w: 10, h: 30, d: 8, color: 0x252530 },
      { x: 5, z: -hd - 4, w: 7, h: 18, d: 5, color: 0x30303a },
      { x: 14, z: -hd - 6, w: 9, h: 26, d: 7, color: 0x222230 },
      { x: 23, z: -hd - 8, w: 7, h: 20, d: 5, color: 0x282838 },
      // Side buildings
      { x: -hw - 8, z: -4, w: 6, h: 14, d: 10, color: 0x353540 },
      { x: -hw - 7, z: 8, w: 5, h: 10, d: 6, color: 0x2d2d38 },
      { x: hw + 8, z: -3, w: 7, h: 16, d: 8, color: 0x2e2e3a },
      { x: hw + 7, z: 7, w: 5, h: 12, d: 7, color: 0x333340 },
      // Behind camera
      { x: -10, z: hd + 6, w: 8, h: 12, d: 5, color: 0x303038 },
      { x: 4, z: hd + 8, w: 10, h: 15, d: 6, color: 0x282835 },
    ];

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xffeeaa,
      emissive: 0xffcc44,
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });
    const windowOffMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2a,
      roughness: 0.5,
      metalness: 0.3,
    });

    buildingConfigs.forEach(({ x, z, w, h, d, color }) => {
      const bMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.85,
        metalness: 0.1,
      });

      // Main structure
      const bGeo = new THREE.BoxGeometry(w, h, d);
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.set(x, h / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.group.add(building);

      // Rooftop ledge
      const ledge = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3),
        new THREE.MeshStandardMaterial({ color: 0x444450, roughness: 0.7, metalness: 0.2 })
      );
      ledge.position.set(x, h + 0.15, z);
      this.group.add(ledge);

      // Windows on the face closest to the court
      const faceZ = z > 0 ? z - d / 2 - 0.01 : z + d / 2 + 0.01;
      const cols = Math.max(1, Math.floor(w / 1.8));
      const rows = Math.max(1, Math.floor(h / 2.5));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const wx = x - (cols - 1) * 0.8 + col * 1.6;
          const wy = 2 + row * 2.2;
          if (wy > h - 1) continue;
          const lit = Math.random() > 0.4;
          const wGeo = new THREE.PlaneGeometry(0.9, 1.3);
          const wMesh = new THREE.Mesh(wGeo, lit ? windowMat : windowOffMat);
          wMesh.position.set(wx, wy, faceZ);
          if (z > 0) wMesh.rotation.y = Math.PI;
          this.group.add(wMesh);
        }
      }

      // Some buildings get AC units
      if (Math.random() > 0.5) {
        const acMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 });
        const acGeo = new THREE.BoxGeometry(0.8, 0.6, 0.5);
        const ac = new THREE.Mesh(acGeo, acMat);
        const acZ2 = z > 0 ? z - d / 2 - 0.25 : z + d / 2 + 0.25;
        ac.position.set(x + (Math.random() - 0.5) * w * 0.5, 3 + Math.random() * (h - 5), acZ2);
        this.group.add(ac);
      }
    });

    // Water tower on tallest building
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, metalness: 0.1 });
    const towerGeo = new THREE.CylinderGeometry(1.5, 1.5, 3, 12);
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-6, 33, -(hd + 7));
    this.group.add(tower);
    // Tower cap
    const capGeo = new THREE.ConeGeometry(1.8, 1, 12);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 });
    const towerCap = new THREE.Mesh(capGeo, capMat);
    towerCap.position.set(-6, 35, -(hd + 7));
    this.group.add(towerCap);
    // Tower legs
    for (let a = 0; a < 4; a++) {
      const angle = (a / 4) * Math.PI * 2;
      const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 2, 6);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.4 });
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(-6 + Math.cos(angle) * 1.2, 30.5, -(hd + 7) + Math.sin(angle) * 1.2);
      this.group.add(leg);
    }
  }

  // ─── Street: Props — dumpsters, barrels, trash, cones ────────────────────
  buildStreetProps() {
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;

    // Dumpster
    const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2e6b2e, roughness: 0.7, metalness: 0.3 });
    const dumpGeo = new THREE.BoxGeometry(2.5, 1.6, 1.5);
    const dump = new THREE.Mesh(dumpGeo, dumpMat);
    dump.position.set(-hw - 3.5, 0.8, -hd + 1);
    dump.rotation.y = 0.15;
    dump.castShadow = true;
    this.group.add(dump);
    // Dumpster lid
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x1a5a1a, roughness: 0.65, metalness: 0.3 });
    const lidGeo = new THREE.BoxGeometry(2.5, 0.1, 0.8);
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.set(-hw - 3.5, 1.65, -hd + 0.6);
    lid.rotation.x = -0.3;
    lid.rotation.y = 0.15;
    this.group.add(lid);

    // Barrels (stacked)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.5 });
    const barrelMat2 = new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.65, metalness: 0.3 });
    [
      { x: hw + 3, z: -3, mat: barrelMat },
      { x: hw + 3.8, z: -2.2, mat: barrelMat2 },
      { x: hw + 3.3, z: -2.6, y: 1.2, mat: barrelMat },
    ].forEach(({ x, z, y, mat }) => {
      const bGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16);
      const barrel = new THREE.Mesh(bGeo, mat);
      barrel.position.set(x, (y || 0) + 0.55, z);
      barrel.castShadow = true;
      this.group.add(barrel);
      // Barrel rim
      const rimGeo = new THREE.TorusGeometry(0.45, 0.03, 8, 24);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, (y || 0) + 1.1, z);
      this.group.add(rim);
    });

    // Traffic cones (near court edges)
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.5, metalness: 0.1 });
    const coneWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
    [
      { x: -hw - 1, z: hd + 2 },
      { x: hw + 1, z: hd + 2 },
      { x: hw + 1.5, z: 5 },
    ].forEach(({ x, z }) => {
      const cGeo = new THREE.ConeGeometry(0.2, 0.65, 12);
      const cone = new THREE.Mesh(cGeo, coneMat);
      cone.position.set(x, 0.33, z);
      cone.castShadow = true;
      this.group.add(cone);
      // White stripe
      const sGeo = new THREE.TorusGeometry(0.13, 0.025, 6, 16);
      const stripe = new THREE.Mesh(sGeo, coneWhite);
      stripe.rotation.x = Math.PI / 2;
      stripe.position.set(x, 0.45, z);
      this.group.add(stripe);
      // Base
      const baseGeo = new THREE.BoxGeometry(0.45, 0.05, 0.45);
      const base = new THREE.Mesh(baseGeo, coneMat);
      base.position.set(x, 0.025, z);
      this.group.add(base);
    });

    // Bench
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7, metalness: 0.05 });
    const benchLegMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.7 });
    const benchX = -hw - 3;
    const benchZ = 4;
    // Seat
    const seatGeo = new THREE.BoxGeometry(2.5, 0.12, 0.5);
    const seat = new THREE.Mesh(seatGeo, benchMat);
    seat.position.set(benchX, 0.5, benchZ);
    seat.castShadow = true;
    this.group.add(seat);
    // Back
    const backGeo = new THREE.BoxGeometry(2.5, 0.7, 0.08);
    const back = new THREE.Mesh(backGeo, benchMat);
    back.position.set(benchX, 0.9, benchZ - 0.22);
    this.group.add(back);
    // Legs
    [-1, 1].forEach(s => {
      const legGeo = new THREE.BoxGeometry(0.08, 0.5, 0.45);
      const leg = new THREE.Mesh(legGeo, benchLegMat);
      leg.position.set(benchX + s * 1, 0.25, benchZ);
      this.group.add(leg);
    });

    // Basketball hoop (non-functional — just a prop)
    const hoopPoleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.7 });
    const backboardMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.6 });
    const hoopX = hw + 4.5;
    const hoopZ = -hd + 2;
    // Pole
    const hpGeo = new THREE.CylinderGeometry(0.1, 0.12, 5, 8);
    const hp = new THREE.Mesh(hpGeo, hoopPoleMat);
    hp.position.set(hoopX, 2.5, hoopZ);
    hp.castShadow = true;
    this.group.add(hp);
    // Backboard
    const bbGeo = new THREE.BoxGeometry(1.5, 1.0, 0.05);
    const bb = new THREE.Mesh(bbGeo, backboardMat);
    bb.position.set(hoopX - 0.5, 4.6, hoopZ);
    this.group.add(bb);
    // Rim
    const rimGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 24);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.4, metalness: 0.6 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(hoopX - 0.5, 4.2, hoopZ + 0.3);
    this.group.add(rim);
  }

  // ─── Street: Graffiti ────────────────────
  buildGraffiti() {
    const hw = CONFIG.COURT_WIDTH / 2 + 5;
    const hd = CONFIG.COURT_DEPTH / 2 + 5;

    // Graffiti — colored rectangles on walls to suggest spray paint
    const graffitiConfigs = [
      { x: -8, y: 3.5, z: -hd + 0.32, w: 3.5, h: 2.0, color: 0xff2255, opacity: 0.4 },
      { x: 3, y: 4.2, z: -hd + 0.32, w: 4.0, h: 1.5, color: 0x22ccff, opacity: 0.35 },
      { x: 10, y: 2.8, z: -hd + 0.32, w: 2.5, h: 2.5, color: 0xffcc00, opacity: 0.3 },
      { x: -4, y: 5.5, z: -hd + 0.32, w: 5.0, h: 1.2, color: 0x44ff44, opacity: 0.25 },
      { x: 8, y: 5.8, z: -hd + 0.32, w: 3.0, h: 1.0, color: 0xff8800, opacity: 0.35 },
    ];

    graffitiConfigs.forEach(({ x, y, z, w, h, color, opacity }) => {
      const gMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
      });
      const gGeo = new THREE.PlaneGeometry(w, h);
      const graffiti = new THREE.Mesh(gGeo, gMat);
      graffiti.position.set(x, y, z);
      this.group.add(graffiti);

      // Spray drip lines below
      for (let i = 0; i < 3; i++) {
        const dripGeo = new THREE.PlaneGeometry(0.06, 0.3 + Math.random() * 0.8);
        const dripMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.6 });
        const drip = new THREE.Mesh(dripGeo, dripMat);
        drip.position.set(x + (Math.random() - 0.5) * w * 0.8, y - h / 2 - 0.2 - Math.random() * 0.5, z);
        this.group.add(drip);
      }
    });

    // "STREET DODGEBALL" text placeholder — large colored block
    const titleMat = new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.5 });
    const titleGeo = new THREE.PlaneGeometry(8, 1.5);
    const title = new THREE.Mesh(titleGeo, titleMat);
    title.position.set(0, 6.5, -hd + 0.33);
    this.group.add(title);

    // Side wall graffiti
    const sideGrafConfigs = [
      { x: -hw + 0.32, y: 3, z: -2, w: 3, h: 2, color: 0xee44ff, opacity: 0.3, rotY: Math.PI / 2 },
      { x: hw - 0.32, y: 2.5, z: 3, w: 2.5, h: 1.8, color: 0x44ddff, opacity: 0.25, rotY: -Math.PI / 2 },
    ];
    sideGrafConfigs.forEach(({ x, y, z, w, h, color, opacity, rotY }) => {
      const gMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
      const gGeo = new THREE.PlaneGeometry(w, h);
      const g = new THREE.Mesh(gGeo, gMat);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      this.group.add(g);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  COLOSSEUM — Ancient Roman arena
  // ═══════════════════════════════════════════════════════
  buildColosseum() {
    this.buildColosseumSky();
    this.buildColosseumFloor();
    this.buildColosseumCourtLines();
    this.buildColosseumWalls();
    this.buildColosseumArches();
    this.buildColosseumColumns();
    this.buildColosseumTorches();
    this.buildColosseumProps();
    this.buildColosseumSeating();
  }

  // ─── Colosseum: Dramatic sunset sky dome ────────────────────
  buildColosseumSky() {
    const skyGeo = new THREE.SphereGeometry(85, 32, 24);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 512;
    const ctx = skyCanvas.getContext('2d');

    // Dramatic Roman sunset — deep purple → blood red → molten gold
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0e0820');
    grad.addColorStop(0.15, '#1a0e3a');
    grad.addColorStop(0.3, '#3a1545');
    grad.addColorStop(0.45, '#6b1a30');
    grad.addColorStop(0.58, '#a83020');
    grad.addColorStop(0.7, '#d4602a');
    grad.addColorStop(0.82, '#e8a030');
    grad.addColorStop(0.92, '#ffcc55');
    grad.addColorStop(1, '#ffe8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Wispy clouds
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 14; i++) {
      const cx = Math.random() * 512;
      const cy = 140 + Math.random() * 200;
      ctx.fillStyle = '#ffccaa';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 50 + Math.random() * 90, 6 + Math.random() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.group.add(sky);

    // Sun glow
    const sunGeo = new THREE.SphereGeometry(5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.8, fog: false });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(-30, 15, -60);
    this.group.add(sun);

    const glowGeo = new THREE.SphereGeometry(10, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.15, fog: false });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    this.group.add(glow);
  }

  // ─── Colosseum: Sand arena floor ────────────────────
  buildColosseumFloor() {
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    const pad = 25;

    // Outer area — packed earth / stone
    const outerGeo = new THREE.PlaneGeometry(hw * 2 + pad * 2, hd * 2 + pad * 2, 24, 24);
    const outerPosAttr = outerGeo.attributes.position;
    for (let i = 0; i < outerPosAttr.count; i++) {
      const x = outerPosAttr.getX(i);
      const y = outerPosAttr.getY(i);
      if (Math.abs(x) > hw + 2 || Math.abs(y) > hd + 2) {
        outerPosAttr.setZ(i, (Math.random() - 0.5) * 0.1);
      }
    }
    outerGeo.computeVertexNormals();
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 0.95, metalness: 0.0 });
    const outer = new THREE.Mesh(outerGeo, earthMat);
    outer.rotation.x = -Math.PI / 2;
    outer.receiveShadow = true;
    this.group.add(outer);

    // Arena sand surface — golden sand with subtle texture variation
    const sandGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH + 2, CONFIG.COURT_DEPTH + 2, 20, 20);
    const sandPosAttr = sandGeo.attributes.position;
    for (let i = 0; i < sandPosAttr.count; i++) {
      sandPosAttr.setZ(i, (Math.random() - 0.5) * 0.04);
    }
    sandGeo.computeVertexNormals();
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xc9a04a, roughness: 0.88, metalness: 0.0 });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = 0.01;
    sand.receiveShadow = true;
    this.group.add(sand);

    // Darker sand streaks (scuff marks / drag lines)
    const streakMat = new THREE.MeshBasicMaterial({ color: 0xa08030, transparent: true, opacity: 0.2 });
    for (let i = 0; i < 8; i++) {
      const sGeo = new THREE.PlaneGeometry(0.3 + Math.random() * 3, 0.1 + Math.random() * 0.3);
      const s = new THREE.Mesh(sGeo, streakMat);
      s.rotation.x = -Math.PI / 2;
      s.rotation.z = Math.random() * Math.PI;
      s.position.set((Math.random() - 0.5) * CONFIG.COURT_WIDTH * 0.8, 0.02, (Math.random() - 0.5) * CONFIG.COURT_DEPTH * 0.8);
      this.group.add(s);
    }

    // Stone border around arena edge
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.05 });
    const borderH = 0.3;
    // Front + back
    [-hd - 1.2, hd + 1.2].forEach(z => {
      const bGeo = new THREE.BoxGeometry(CONFIG.COURT_WIDTH + 4, borderH, 0.8);
      const b = new THREE.Mesh(bGeo, borderMat);
      b.position.set(0, borderH / 2, z);
      b.castShadow = true;
      this.group.add(b);
    });
    // Sides
    [-hw - 1.5, hw + 1.5].forEach(x => {
      const bGeo = new THREE.BoxGeometry(0.8, borderH, CONFIG.COURT_DEPTH + 4.8);
      const b = new THREE.Mesh(bGeo, borderMat);
      b.position.set(x, borderH / 2, 0);
      b.castShadow = true;
      this.group.add(b);
    });
  }

  // ─── Colosseum: Court lines (painted in sand/lime) ────────────────────
  buildColosseumCourtLines() {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.55 });
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;

    // Center line
    const cGeo = new THREE.PlaneGeometry(0.12, CONFIG.COURT_DEPTH);
    const center = new THREE.Mesh(cGeo, lineMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.025;
    this.group.add(center);

    // Boundary
    [[-hw, 0], [hw, 0]].forEach(([x]) => {
      const sGeo = new THREE.PlaneGeometry(0.1, CONFIG.COURT_DEPTH);
      const s = new THREE.Mesh(sGeo, lineMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.025, 0);
      this.group.add(s);
    });
    [[-hd, 0], [hd, 0]].forEach(([z]) => {
      const bGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH, 0.1);
      const b = new THREE.Mesh(bGeo, lineMat);
      b.rotation.x = -Math.PI / 2;
      b.position.set(0, 0.025, z);
      this.group.add(b);
    });

    // Center circle — gladiator ring
    const ringGeo = new THREE.RingGeometry(2.2, 2.45, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xdd8833, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    this.group.add(ring);

    // Roman numeral zone markers — dashed attack lines
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xcc7722, transparent: true, opacity: 0.35 });
    [-7, 7].forEach(x => {
      for (let z = -hd + 0.5; z < hd; z += 1.0) {
        const dGeo = new THREE.PlaneGeometry(0.1, 0.4);
        const d = new THREE.Mesh(dGeo, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.025, z);
        this.group.add(d);
      }
    });
  }

  // ─── Colosseum: Massive curved stone walls ────────────────────
  buildColosseumWalls() {
    const hw = CONFIG.COURT_WIDTH / 2 + 6;
    const hd = CONFIG.COURT_DEPTH / 2 + 6;

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9c8b6e, roughness: 0.85, metalness: 0.02 });
    const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x7a6b50, roughness: 0.9, metalness: 0.02 });
    const stoneCapMat = new THREE.MeshStandardMaterial({ color: 0xb09a78, roughness: 0.75, metalness: 0.05 });

    const wallH = 12;
    const wallH2 = 8; // Second tier, shorter

    // Back wall — main colosseum face (3 tiers)
    const backGeo = new THREE.BoxGeometry(hw * 2 + 2, wallH, 1.5);
    const backWall = new THREE.Mesh(backGeo, stoneMat);
    backWall.position.set(0, wallH / 2, -hd);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    this.group.add(backWall);

    // Second tier (taller, behind first)
    const tier2Geo = new THREE.BoxGeometry(hw * 2 + 4, wallH2, 1.2);
    const tier2 = new THREE.Mesh(tier2Geo, stoneDarkMat);
    tier2.position.set(0, wallH + wallH2 / 2, -hd - 2);
    tier2.castShadow = true;
    this.group.add(tier2);

    // Top cornice
    const corniceGeo = new THREE.BoxGeometry(hw * 2 + 5, 0.5, 2.0);
    const cornice = new THREE.Mesh(corniceGeo, stoneCapMat);
    cornice.position.set(0, wallH + wallH2 + 0.25, -hd - 2);
    this.group.add(cornice);

    // Stone block pattern on back wall
    const blockMat = new THREE.MeshBasicMaterial({ color: 0x5a4a35, transparent: true, opacity: 0.1 });
    for (let y = 0.5; y < wallH; y += 1.2) {
      for (let x = -hw; x < hw; x += 2.5) {
        const offset = (Math.floor(y / 1.2) % 2 === 0) ? 0 : 1.25;
        const bGeo = new THREE.PlaneGeometry(2.4, 1.1);
        const b = new THREE.Mesh(bGeo, blockMat);
        b.position.set(x + offset, y + 0.55, -hd + 0.77);
        this.group.add(b);
      }
    }

    // Side walls
    [-hw, hw].forEach(x => {
      const sideGeo = new THREE.BoxGeometry(1.5, wallH, hd * 2 + 2);
      const side = new THREE.Mesh(sideGeo, x < 0 ? stoneMat : stoneDarkMat);
      side.position.set(x, wallH / 2, 0);
      side.receiveShadow = true;
      side.castShadow = true;
      this.group.add(side);

      // Side wall second tier
      const sTier2 = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, wallH2 * 0.7, hd * 2 + 3),
        stoneDarkMat
      );
      sTier2.position.set(x + (x < 0 ? -1.5 : 1.5), wallH + wallH2 * 0.35, 0);
      this.group.add(sTier2);

      // Side cornice
      const sCap = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.4, hd * 2 + 4),
        stoneCapMat
      );
      sCap.position.set(x + (x < 0 ? -1.5 : 1.5), wallH + wallH2 * 0.7 + 0.2, 0);
      this.group.add(sCap);
    });

    // Front wall (behind camera) — lower
    const frontH = 5;
    const frontGeo = new THREE.BoxGeometry(hw * 2 + 2, frontH, 1.5);
    const frontWall = new THREE.Mesh(frontGeo, new THREE.MeshStandardMaterial({
      color: 0x9c8b6e, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide,
    }));
    frontWall.position.set(0, frontH / 2, hd);
    this.group.add(frontWall);
  }

  // ─── Colosseum: Arched openings ────────────────────
  buildColosseumArches() {
    const hw = CONFIG.COURT_WIDTH / 2 + 6;
    const hd = CONFIG.COURT_DEPTH / 2 + 6;

    const archDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9, metalness: 0.0 });
    const keystoneMat = new THREE.MeshStandardMaterial({ color: 0xb09a78, roughness: 0.75, metalness: 0.05 });

    // Back wall arches — lower tier
    const archSpacing = 4.0;
    const archCount = Math.floor((hw * 2) / archSpacing);
    const archStartX = -(archCount / 2) * archSpacing + archSpacing / 2;

    for (let i = 0; i < archCount; i++) {
      const ax = archStartX + i * archSpacing;

      // Dark arch void (recessed opening)
      const voidGeo = new THREE.PlaneGeometry(2.2, 4.5);
      const archVoid = new THREE.Mesh(voidGeo, archDarkMat);
      archVoid.position.set(ax, 3.5, -hd + 0.78);
      this.group.add(archVoid);

      // Arch top (semicircle)
      const archTopGeo = new THREE.CircleGeometry(1.1, 16, 0, Math.PI);
      const archTop = new THREE.Mesh(archTopGeo, archDarkMat);
      archTop.position.set(ax, 5.75, -hd + 0.79);
      this.group.add(archTop);

      // Keystone at top of arch
      const ksGeo = new THREE.BoxGeometry(0.35, 0.5, 0.15);
      const ks = new THREE.Mesh(ksGeo, keystoneMat);
      ks.position.set(ax, 6.65, -hd + 0.8);
      this.group.add(ks);
    }

    // Upper tier arches (smaller)
    const wallH = 12;
    for (let i = 0; i < archCount + 1; i++) {
      const ax = archStartX - archSpacing / 2 + i * archSpacing;
      if (Math.abs(ax) > hw + 1) continue;

      const voidGeo = new THREE.PlaneGeometry(1.6, 3.0);
      const archVoid = new THREE.Mesh(voidGeo, archDarkMat);
      archVoid.position.set(ax, wallH + 2.5, -hd - 1.38);
      this.group.add(archVoid);

      const archTopGeo = new THREE.CircleGeometry(0.8, 12, 0, Math.PI);
      const archTop = new THREE.Mesh(archTopGeo, archDarkMat);
      archTop.position.set(ax, wallH + 4.0, -hd - 1.37);
      this.group.add(archTop);
    }

    // Side wall arches
    [-hw, hw].forEach(x => {
      const faceDir = x < 0 ? 1 : -1;
      const faceX = x + faceDir * 0.77;
      for (let z = -hd + 4; z < hd - 2; z += 4.5) {
        const voidGeo = new THREE.PlaneGeometry(4.0, 2.0);
        const archVoid = new THREE.Mesh(voidGeo, archDarkMat);
        archVoid.rotation.y = faceDir > 0 ? 0 : Math.PI;
        archVoid.position.set(faceX, 3.2, z);
        this.group.add(archVoid);

        const archTopGeo = new THREE.CircleGeometry(1.0, 12, 0, Math.PI);
        const archTop = new THREE.Mesh(archTopGeo, archDarkMat);
        archTop.rotation.y = faceDir > 0 ? 0 : Math.PI;
        archTop.position.set(faceX, 4.2, z);
        this.group.add(archTop);
      }
    });
  }

  // ─── Colosseum: Stone columns/pilasters ────────────────────
  buildColosseumColumns() {
    const hw = CONFIG.COURT_WIDTH / 2 + 6;
    const hd = CONFIG.COURT_DEPTH / 2 + 6;
    const wallH = 12;

    const colMat = new THREE.MeshStandardMaterial({ color: 0xbaa882, roughness: 0.7, metalness: 0.05 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xccb88e, roughness: 0.6, metalness: 0.1 });

    // Back wall columns (between arches)
    const archSpacing = 4.0;
    const archCount = Math.floor((hw * 2) / archSpacing);
    const startX = -(archCount / 2) * archSpacing;

    for (let i = 0; i <= archCount; i++) {
      const cx = startX + i * archSpacing;
      if (Math.abs(cx) > hw + 2) continue;

      // Column shaft
      const colGeo = new THREE.CylinderGeometry(0.25, 0.3, wallH - 0.5, 12);
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(cx, wallH / 2 - 0.25, -hd + 0.9);
      col.castShadow = true;
      this.group.add(col);

      // Capital (top decorative piece)
      const capitalGeo = new THREE.BoxGeometry(0.8, 0.4, 0.5);
      const capital = new THREE.Mesh(capitalGeo, capMat);
      capital.position.set(cx, wallH - 0.3, -hd + 0.9);
      this.group.add(capital);

      // Base
      const baseGeo = new THREE.BoxGeometry(0.7, 0.25, 0.5);
      const base = new THREE.Mesh(baseGeo, capMat);
      base.position.set(cx, 0.12, -hd + 0.9);
      this.group.add(base);
    }

    // Upper tier columns (thinner)
    for (let i = 0; i <= archCount; i++) {
      const cx = startX + i * archSpacing + archSpacing / 2;
      if (Math.abs(cx) > hw + 2) continue;

      const colGeo = new THREE.CylinderGeometry(0.18, 0.22, 5.0, 10);
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(cx, wallH + 3.0, -hd - 1.4);
      this.group.add(col);

      const capitalGeo = new THREE.BoxGeometry(0.6, 0.3, 0.4);
      const capital = new THREE.Mesh(capitalGeo, capMat);
      capital.position.set(cx, wallH + 5.3, -hd - 1.4);
      this.group.add(capital);
    }

    // Side wall pilasters
    [-hw, hw].forEach(x => {
      const faceDir = x < 0 ? 1 : -1;
      for (let z = -hd + 2; z <= hd - 2; z += 4.5) {
        const pilGeo = new THREE.BoxGeometry(0.4, wallH - 1, 0.4);
        const pil = new THREE.Mesh(pilGeo, colMat);
        pil.position.set(x + faceDir * 0.9, wallH / 2 - 0.5, z);
        pil.castShadow = true;
        this.group.add(pil);

        const capGeoP = new THREE.BoxGeometry(0.6, 0.3, 0.6);
        const capP = new THREE.Mesh(capGeoP, capMat);
        capP.position.set(x + faceDir * 0.9, wallH - 0.85, z);
        this.group.add(capP);
      }
    });
  }

  // ─── Colosseum: Flaming torches / braziers ────────────────────
  buildColosseumTorches() {
    const hw = CONFIG.COURT_WIDTH / 2 + 6;
    const hd = CONFIG.COURT_DEPTH / 2 + 6;
    const wallH = 12;

    const ironMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.8 });

    // Brazier positions — along the top of the walls
    const brazierPositions = [];

    // Back wall braziers
    for (let x = -hw + 2; x <= hw - 2; x += 6) {
      brazierPositions.push({ x, y: wallH + 0.2, z: -hd + 0.5 });
    }
    // Side wall braziers
    [-hw, hw].forEach(sx => {
      const dir = sx < 0 ? 1 : -1;
      for (let z = -hd + 4; z <= hd - 3; z += 6) {
        brazierPositions.push({ x: sx + dir * 0.5, y: wallH + 0.2, z });
      }
    });
    // Front wall braziers
    for (let x = -hw + 4; x <= hw - 4; x += 8) {
      brazierPositions.push({ x, y: 5.2, z: hd - 0.5 });
    }
    // Arena floor corner braziers (large standing ones)
    const cornerBraziers = [
      { x: -hw + 3, y: 0, z: -hd + 3 },
      { x: hw - 3, y: 0, z: -hd + 3 },
      { x: -hw + 3, y: 0, z: hd - 3 },
      { x: hw - 3, y: 0, z: hd - 3 },
    ];

    brazierPositions.forEach(({ x, y, z }) => {
      // Bowl
      const bowlGeo = new THREE.CylinderGeometry(0.35, 0.2, 0.4, 12);
      const bowl = new THREE.Mesh(bowlGeo, ironMat);
      bowl.position.set(x, y + 0.2, z);
      this.group.add(bowl);

      // Fire — multiple flame particles
      this.buildFlameCluster(x, y + 0.5, z, 0.3);
    });

    // Standing braziers at corners of arena
    cornerBraziers.forEach(({ x, y, z }) => {
      // Tall iron stand
      const standGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8);
      const stand = new THREE.Mesh(standGeo, ironMat);
      stand.position.set(x, y + 1.1, z);
      stand.castShadow = true;
      this.group.add(stand);

      // Tripod legs
      for (let a = 0; a < 3; a++) {
        const angle = (a / 3) * Math.PI * 2;
        const legGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.8, 6);
        const leg = new THREE.Mesh(legGeo, ironMat);
        leg.position.set(x + Math.cos(angle) * 0.2, y + 0.2, z + Math.sin(angle) * 0.2);
        leg.rotation.z = (Math.cos(angle)) * 0.3;
        leg.rotation.x = (Math.sin(angle)) * 0.3;
        this.group.add(leg);
      }

      // Large bowl
      const bowlGeo = new THREE.CylinderGeometry(0.5, 0.3, 0.5, 12);
      const bowl = new THREE.Mesh(bowlGeo, ironMat);
      bowl.position.set(x, y + 2.35, z);
      this.group.add(bowl);

      // Large fire cluster
      this.buildFlameCluster(x, y + 2.7, z, 0.5);
    });
  }

  // Helper: cluster of flame-like meshes
  buildFlameCluster(x, y, z, scale) {
    const fireColors = [0xff4400, 0xff6600, 0xffaa00, 0xffcc44];
    for (let f = 0; f < 5; f++) {
      const fSize = (0.08 + Math.random() * 0.12) * scale * 3;
      const fGeo = new THREE.SphereGeometry(fSize, 6, 6);
      const fMat = new THREE.MeshBasicMaterial({
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        transparent: true,
        opacity: 0.7 + Math.random() * 0.3,
      });
      const flame = new THREE.Mesh(fGeo, fMat);
      flame.position.set(
        x + (Math.random() - 0.5) * scale * 0.5,
        y + Math.random() * scale * 0.8,
        z + (Math.random() - 0.5) * scale * 0.5
      );
      this.group.add(flame);
    }

    // Glow light halo around fire
    const glowGeo = new THREE.SphereGeometry(scale * 1.5, 8, 8);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.08,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.position.set(x, y + scale * 0.3, z);
    this.group.add(glowMesh);
  }

  // ─── Colosseum: Arena props (shields, weapons, statues) ────────────────────
  buildColosseumProps() {
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    const wallHd = hd + 6;

    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, roughness: 0.4, metalness: 0.7 });
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.3, metalness: 0.05 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8, metalness: 0.0 });

    // Roman eagle emblems on back wall
    [-8, 0, 8].forEach(x => {
      // Shield / medallion shape
      const shieldGeo = new THREE.CircleGeometry(0.8, 24);
      const shield = new THREE.Mesh(shieldGeo, bronzeMat);
      shield.position.set(x, 9, -wallHd + 0.8);
      this.group.add(shield);

      // Inner circle
      const innerGeo = new THREE.RingGeometry(0.35, 0.5, 24);
      const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({
        color: 0xaa6622, roughness: 0.5, metalness: 0.6,
      }));
      inner.position.set(x, 9, -wallHd + 0.82);
      this.group.add(inner);
    });

    // Marble statue pedestals at the sides of the arena entrance
    [-hw - 3, hw + 3].forEach(x => {
      // Pedestal
      const pedGeo = new THREE.BoxGeometry(1.2, 2.0, 1.2);
      const ped = new THREE.Mesh(pedGeo, marbleMat);
      ped.position.set(x, 1.0, -wallHd + 2);
      ped.castShadow = true;
      this.group.add(ped);

      // Simple statue form (abstract figure)
      const bodyGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 10);
      const body = new THREE.Mesh(bodyGeo, marbleMat);
      body.position.set(x, 3.3, -wallHd + 2);
      body.castShadow = true;
      this.group.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.25, 10, 10);
      const head = new THREE.Mesh(headGeo, marbleMat);
      head.position.set(x, 4.7, -wallHd + 2);
      this.group.add(head);
    });

    // Weapon racks along side walls (decorative)
    [-hw - 2, hw + 2].forEach(x => {
      // Wooden rack
      const rackGeo = new THREE.BoxGeometry(0.15, 2.0, 1.5);
      const rack = new THREE.Mesh(rackGeo, woodMat);
      rack.position.set(x, 1.0, 0);
      this.group.add(rack);

      // Spears leaning against wall
      for (let s = -0.5; s <= 0.5; s += 0.5) {
        const spearGeo = new THREE.CylinderGeometry(0.025, 0.025, 3.0, 6);
        const spear = new THREE.Mesh(spearGeo, woodMat);
        spear.position.set(x + (x < 0 ? 0.3 : -0.3), 1.5, s);
        spear.rotation.z = (x < 0 ? 0.15 : -0.15);
        this.group.add(spear);

        // Spear tip
        const tipGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
        const tip = new THREE.Mesh(tipGeo, bronzeMat);
        tip.position.set(
          x + (x < 0 ? 0.3 : -0.3) + (x < 0 ? 0.22 : -0.22),
          3.05, s
        );
        this.group.add(tip);
      }
    });
  }

  // ─── Colosseum: Stone seating tiers ────────────────────
  buildColosseumSeating() {
    const hd = CONFIG.COURT_DEPTH / 2 + 6;
    const wallH = 12;

    const seatMat = new THREE.MeshStandardMaterial({ color: 0x9c8b6e, roughness: 0.8, metalness: 0.02 });
    const seatLightMat = new THREE.MeshStandardMaterial({ color: 0xb8a580, roughness: 0.75, metalness: 0.02 });

    // Tiered seating steps on the back wall (inside the arches area)
    const rowDepth = 0.8;
    const rowRise = 0.7;
    const seatWidth = CONFIG.COURT_WIDTH + 6;
    const baseY = 0.5;
    const frontRowZ = -(hd - 0.5);

    for (let row = 0; row < 5; row++) {
      const seatZ = frontRowZ - row * rowDepth;
      const seatY = baseY + row * rowRise;
      const mat = row % 2 === 0 ? seatMat : seatLightMat;

      const seatGeo = new THREE.BoxGeometry(seatWidth, 0.15, rowDepth - 0.05);
      const seat = new THREE.Mesh(seatGeo, mat);
      seat.position.set(0, seatY, seatZ);
      seat.castShadow = true;
      seat.receiveShadow = true;
      this.group.add(seat);

      // Riser face
      const riserGeo = new THREE.BoxGeometry(seatWidth, rowRise, 0.08);
      const riser = new THREE.Mesh(riserGeo, seatMat);
      riser.position.set(0, seatY - rowRise / 2 + 0.07, seatZ + rowDepth / 2);
      this.group.add(riser);
    }

    // VIP box / emperor's balcony — center of back wall
    const balconyMat = new THREE.MeshStandardMaterial({ color: 0xdcc8a0, roughness: 0.5, metalness: 0.1 });
    const balconyGeo = new THREE.BoxGeometry(6, 0.3, 2.0);
    const balcony = new THREE.Mesh(balconyGeo, balconyMat);
    balcony.position.set(0, wallH - 1, -hd + 0.5);
    this.group.add(balcony);

    // Balcony railing
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, roughness: 0.4, metalness: 0.7 });
    const railGeo = new THREE.BoxGeometry(6, 0.6, 0.08);
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, wallH - 0.55, -hd + 1.45);
    this.group.add(rail);

    // Balcony posts
    for (let x = -2.5; x <= 2.5; x += 1.0) {
      const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(x, wallH - 0.55, -hd + 1.45);
      this.group.add(post);
    }

    // Red drapes on the VIP balcony
    const drapeMat = new THREE.MeshStandardMaterial({
      color: 0x8b1a1a, roughness: 0.6, metalness: 0.0,
      side: THREE.DoubleSide,
    });
    [-2.5, 2.5].forEach(x => {
      const drapeGeo = new THREE.PlaneGeometry(0.8, 2.5);
      const drape = new THREE.Mesh(drapeGeo, drapeMat);
      drape.position.set(x, wallH - 0.2, -hd + 0.8);
      this.group.add(drape);
    });

    // Large banner behind VIP
    const bannerGeo = new THREE.PlaneGeometry(4.5, 2.0);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x6b0000, roughness: 0.55, side: THREE.DoubleSide,
      emissive: 0x6b0000, emissiveIntensity: 0.1,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, wallH + 1, -hd + 0.8);
    this.group.add(banner);

    // Gold trim on banner
    const trimGeo = new THREE.PlaneGeometry(4.6, 0.12);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.7 });
    [wallH + 2.0, wallH + 0.0].forEach(y => {
      const trim = new THREE.Mesh(trimGeo, trimMat);
      trim.position.set(0, y, -hd + 0.82);
      this.group.add(trim);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  CLASSIC GYM — original build methods
  // ═══════════════════════════════════════════════════════

  buildGymFloor() {
    const floorTex = this.loader.load(CONFIG.FLOOR_TEXTURE);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(1, 1);
    floorTex.colorSpace = THREE.SRGBColorSpace;

    const floorGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH + 10, CONFIG.COURT_DEPTH + 10);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.25,
      metalness: 0.05,
      color: 0xeebb77,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Reflective overlay
    const reflGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH + 10, CONFIG.COURT_DEPTH + 10);
    const reflMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.0,
      metalness: 0.9,
    });
    const reflection = new THREE.Mesh(reflGeo, reflMat);
    reflection.rotation.x = -Math.PI / 2;
    reflection.position.y = 0.01;
    this.group.add(reflection);
  }

  buildCourtLines(lineColor = 0xffffff, lineOpacity = 0.85, zoneColor = 0xffff00, zoneOpacity = 0.25) {
    const lineMat = new THREE.MeshBasicMaterial({ color: lineColor, transparent: true, opacity: lineOpacity });
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;

    // Center line
    const centerGeo = new THREE.PlaneGeometry(0.1, CONFIG.COURT_DEPTH);
    const centerLine = new THREE.Mesh(centerGeo, lineMat);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    this.group.add(centerLine);

    // Side boundary lines
    [-hw, hw].forEach(x => {
      const sideGeo = new THREE.PlaneGeometry(0.08, CONFIG.COURT_DEPTH);
      const side = new THREE.Mesh(sideGeo, lineMat);
      side.rotation.x = -Math.PI / 2;
      side.position.set(x, 0.02, 0);
      this.group.add(side);
    });

    // Baselines
    [-hd, hd].forEach(z => {
      const lineGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH, 0.08);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.02, z);
      this.group.add(line);
    });

    // Center circle
    const circleGeo = new THREE.RingGeometry(2.2, 2.35, 48);
    const circle = new THREE.Mesh(circleGeo, lineMat);
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.02;
    this.group.add(circle);

    // Attack zone dashes
    const zoneMat = new THREE.MeshBasicMaterial({ color: zoneColor, transparent: true, opacity: zoneOpacity });
    [-7, 7].forEach(x => {
      for (let z = -hd + 0.5; z < hd; z += 1.0) {
        const dashGeo = new THREE.PlaneGeometry(0.06, 0.4);
        const dash = new THREE.Mesh(dashGeo, zoneMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.02, z);
        this.group.add(dash);
      }
    });
  }

  buildBackWall() {
    const wallTex = this.loader.load(CONFIG.WALL_TEXTURE);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 1.5);
    wallTex.colorSpace = THREE.SRGBColorSpace;

    const wallHeight = 12;
    const hw = CONFIG.COURT_WIDTH / 2 + 4;
    const wallZ = -(CONFIG.COURT_DEPTH / 2 + 4);

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.0, color: 0xb8cce0 });
    const backGeo = new THREE.BoxGeometry(hw * 2, wallHeight, 0.5);
    const backWall = new THREE.Mesh(backGeo, wallMat);
    backWall.position.set(0, wallHeight / 2, wallZ);
    backWall.receiveShadow = true;
    this.group.add(backWall);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.4 });
    const padHeight = 1.8;
    const padGeo = new THREE.BoxGeometry(hw * 2 + 0.1, padHeight, 0.2);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, padHeight / 2, wallZ + 0.35);
    this.group.add(pad);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.3, metalness: 0.4 });
    const trimGeo = new THREE.BoxGeometry(hw * 2 + 0.2, 0.12, 0.15);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, padHeight + 0.06, wallZ + 0.35);
    this.group.add(trim);
  }

  buildSideWalls() {
    const wallTex = this.loader.load(CONFIG.WALL_TEXTURE);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(2, 1.5);
    wallTex.colorSpace = THREE.SRGBColorSpace;

    const wallHeight = 12;
    const hw = CONFIG.COURT_WIDTH / 2 + 4;
    const hd = CONFIG.COURT_DEPTH / 2 + 4;

    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, color: 0xb0c4de });
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.4 });
    const padHeight = 1.8;

    [-hw, hw].forEach(x => {
      const sideGeo = new THREE.BoxGeometry(0.5, wallHeight, hd * 2);
      const sideWall = new THREE.Mesh(sideGeo, wallMat);
      sideWall.position.set(x, wallHeight / 2, 0);
      sideWall.receiveShadow = true;
      this.group.add(sideWall);

      const padGeo = new THREE.BoxGeometry(0.2, padHeight, hd * 2 - 0.2);
      const padSide = new THREE.Mesh(padGeo, padMat);
      padSide.position.set(x + (x > 0 ? -0.35 : 0.35), padHeight / 2, 0);
      this.group.add(padSide);
    });
  }

  buildFrontWall() {
    const wallTex = this.loader.load(CONFIG.WALL_TEXTURE);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 1.5);
    wallTex.colorSpace = THREE.SRGBColorSpace;

    const wallHeight = 12;
    const hw = CONFIG.COURT_WIDTH / 2 + 4;
    const wallZ = CONFIG.COURT_DEPTH / 2 + 4;

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex, roughness: 0.7, metalness: 0.0, color: 0xb8cce0, side: THREE.BackSide,
    });
    const frontGeo = new THREE.BoxGeometry(hw * 2, wallHeight, 0.5);
    const frontWall = new THREE.Mesh(frontGeo, wallMat);
    frontWall.position.set(0, wallHeight / 2, wallZ);
    frontWall.receiveShadow = true;
    this.group.add(frontWall);

    const padMat = new THREE.MeshStandardMaterial({ color: 0x1a237e, roughness: 0.4 });
    const padHeight = 1.8;
    const padGeo = new THREE.BoxGeometry(hw * 2 + 0.1, padHeight, 0.2);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, padHeight / 2, wallZ - 0.35);
    this.group.add(pad);

    const trimMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.3, metalness: 0.4 });
    const trimGeo = new THREE.BoxGeometry(hw * 2 + 0.2, 0.12, 0.15);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, padHeight + 0.06, wallZ - 0.35);
    this.group.add(trim);
  }

  buildBleachers() {
    const bleachMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.55, metalness: 0.1 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.4, metalness: 0.5 });
    const hd = CONFIG.COURT_DEPTH / 2;
    const frontRowZ = -(hd + 1.2);
    const rowDepth = 0.55;
    const rowStep = 0.55;
    const rowRise = 0.55;
    const baseY = 1.4;

    for (let row = 0; row < 4; row++) {
      const seatZ = frontRowZ - row * rowStep;
      const seatY = baseY + row * rowRise;
      const seatGeo = new THREE.BoxGeometry(CONFIG.COURT_WIDTH - 2, 0.12, rowDepth);
      const seat = new THREE.Mesh(seatGeo, bleachMat);
      seat.position.set(0, seatY, seatZ);
      seat.castShadow = true;
      seat.receiveShadow = true;
      this.group.add(seat);

      const riserGeo = new THREE.BoxGeometry(CONFIG.COURT_WIDTH - 2, rowRise, 0.06);
      const riser = new THREE.Mesh(riserGeo, frameMat);
      riser.position.set(0, seatY - rowRise / 2 + 0.06, seatZ + rowDepth / 2 + 0.03);
      this.group.add(riser);
    }

    const backPanelZ = frontRowZ - 3 * rowStep - rowDepth / 2 - 0.03;
    const backPanelH = baseY + 3 * rowRise;
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(CONFIG.COURT_WIDTH - 2, backPanelH, 0.06), frameMat);
    backPanel.position.set(0, backPanelH / 2, backPanelZ);
    this.group.add(backPanel);

    const bleachDepth = 4 * rowStep;
    const supportCenterZ = frontRowZ - bleachDepth / 2 + rowStep / 2;
    for (let x = -11; x <= 11; x += 5.5) {
      const supportGeo = new THREE.BoxGeometry(0.10, backPanelH + 0.3, bleachDepth);
      const support = new THREE.Mesh(supportGeo, frameMat);
      support.position.set(x, backPanelH / 2, supportCenterZ);
      this.group.add(support);
    }
  }

  buildWindows() {
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x87ceeb, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45, emissive: 0x87ceeb, emissiveIntensity: 0.5,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, roughness: 0.35, metalness: 0.5 });
    const wallZ = -(CONFIG.COURT_DEPTH / 2 + 4);

    for (let i = -2; i <= 2; i++) {
      const winWidth = 4.0;
      const winHeight = 2.2;
      const winGeo = new THREE.PlaneGeometry(winWidth, winHeight);
      const win = new THREE.Mesh(winGeo, windowMat);
      win.position.set(i * 5.5, 6.5, wallZ + 0.3);
      this.group.add(win);

      const frameGeo = new THREE.BoxGeometry(winWidth + 0.3, winHeight + 0.3, 0.08);
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(i * 5.5, 6.5, wallZ + 0.32);
      this.group.add(frame);

      const vDiv = new THREE.BoxGeometry(0.08, winHeight, 0.1);
      const vd = new THREE.Mesh(vDiv, frameMat);
      vd.position.set(i * 5.5, 6.5, wallZ + 0.33);
      this.group.add(vd);

      const hDiv = new THREE.BoxGeometry(winWidth, 0.08, 0.1);
      const hd2 = new THREE.Mesh(hDiv, frameMat);
      hd2.position.set(i * 5.5, 6.5, wallZ + 0.33);
      this.group.add(hd2);
    }

    const skyGeo = new THREE.PlaneGeometry(30, 3);
    const skyMat = new THREE.MeshBasicMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.15 });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.set(0, 8.5, wallZ + 0.28);
    this.group.add(sky);
  }

  buildCeilingStructure() {
    const ceilHeight = 14;
    const ceilGeo = new THREE.PlaneGeometry(CONFIG.COURT_WIDTH + 10, CONFIG.COURT_DEPTH + 10);
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ceilHeight;
    this.group.add(ceiling);

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.5, metalness: 0.6 });
    for (let x = -12; x <= 12; x += 8) {
      const beamGeo = new THREE.BoxGeometry(0.25, 0.6, CONFIG.COURT_DEPTH + 10);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, ceilHeight - 0.3, 0);
      this.group.add(beam);
    }
    for (let z = -8; z <= 8; z += 8) {
      const crossGeo = new THREE.BoxGeometry(CONFIG.COURT_WIDTH + 10, 0.25, 0.25);
      const cross = new THREE.Mesh(crossGeo, beamMat);
      cross.position.set(0, ceilHeight - 0.6, z);
      this.group.add(cross);
    }
  }

  buildGymLighting() {
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.4, metalness: 0.5 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff8e1, emissiveIntensity: 2.5, roughness: 0.1,
    });

    for (let x = -10; x <= 10; x += 5) {
      for (let z = -5; z <= 5; z += 5) {
        const fixtureGeo = new THREE.BoxGeometry(0.4, 0.12, 1.8);
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
        fixture.position.set(x, 10, z);
        this.group.add(fixture);

        const bulbGeo = new THREE.BoxGeometry(0.25, 0.06, 1.6);
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(x, 9.93, z);
        this.group.add(bulb);

        const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, 4, 4);
        const wire = new THREE.Mesh(wireGeo, fixtureMat);
        wire.position.set(x, 12, z);
        this.group.add(wire);
      }
    }
  }

  buildBanners() {
    const hw = CONFIG.COURT_WIDTH / 2 + 4;
    const bannerData = [
      { x: -hw + 0.3, color: 0x1565c0 },
      { x: hw - 0.3, color: 0xc62828 },
    ];

    bannerData.forEach(({ x, color }) => {
      const bannerGeo = new THREE.PlaneGeometry(1.5, 3.5);
      const bannerMat = new THREE.MeshStandardMaterial({
        color, roughness: 0.55, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.12,
      });

      for (let z = -6; z <= 6; z += 4) {
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(x, 5.5, z);
        banner.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.group.add(banner);

        const poleMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.6, roughness: 0.3 });
        const poleGeo = new THREE.CylinderGeometry(0.02, 0.02, 3.8, 6);
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 5.5, z);
        pole.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.group.add(pole);
      }
    });
  }

  buildScoreboard() {
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.5 });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x111111, emissive: 0x222244, emissiveIntensity: 0.3, roughness: 0.2,
    });

    const boardGeo = new THREE.BoxGeometry(4, 1.2, 1.5);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.set(0, 9, 0);
    this.group.add(board);

    const faceGeo = new THREE.PlaneGeometry(3.6, 0.9);
    const face = new THREE.Mesh(faceGeo, screenMat);
    face.position.set(0, 9, 0.76);
    this.group.add(face);

    const wireMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.3 });
    [-1, 1].forEach(side => {
      const wireGeo = new THREE.CylinderGeometry(0.02, 0.02, 4.5, 4);
      const wire = new THREE.Mesh(wireGeo, wireMat);
      wire.position.set(side * 1.5, 11.25, 0);
      this.group.add(wire);
    });
  }
}