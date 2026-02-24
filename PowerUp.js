import * as THREE from 'three';
import { CONFIG } from './config.js';

// ─── Power-Up Types ─────────────────────────────────────────
export const POWERUP_TYPES = {
  GIANT_BALL: {
    name: 'GIANT BALL',
    color: 0xff6b00,
    emissive: 0xff3300,
    icon: '⚫',
    description: 'Giant dodgeball rolls across court!',
    spawnChance: 0.25,
  },
  FREEZE_TWO: {
    name: 'FREEZE x2',
    color: 0x00d4ff,
    emissive: 0x0088ff,
    icon: '❄️',
    description: 'Freeze 2 random opponents!',
    spawnChance: 0.25,
  },
  LIGHTNING: {
    name: 'LIGHTNING STRIKE',
    color: 0xffff00,
    emissive: 0xffaa00,
    icon: '⚡',
    description: 'Stun all enemies!',
    spawnChance: 0.20,
  },
  LASER_BALL: {
    name: 'LASER BALL',
    color: 0xff00ff,
    emissive: 0xaa00ff,
    icon: '🔮',
    description: 'Next throw is unstoppable!',
    spawnChance: 0.25,
  },
  FIREBALL: {
    name: 'FIREBALL',
    color: 0xff4400,
    emissive: 0xff2200,
    icon: '🔥',
    description: 'Next throw inflicts burn damage!',
    spawnChance: 0.20,
  },
  BANANA_PEEL: {
    name: 'BANANA PEEL',
    color: 0xffeb3b,
    emissive: 0xffd700,
    icon: '🍌',
    description: 'Drop a banana peel on enemy side!',
    spawnChance: 0.30,
  },
  SUPER_SPEED: {
    name: 'SUPER SPEED',
    color: 0x00ff88,
    emissive: 0x00ffaa,
    icon: '👟',
    description: 'Move 2.5x faster for 10 seconds!',
    spawnChance: 0.25,
  },
  SLAP_SHOT: {
    name: 'SLAP SHOT',
    color: 0xff9900, // Orange/amber - distinct from cyan freeze
    emissive: 0xff6600,
    icon: '🏒',
    description: 'Hockey stick launches enemy off map!',
    spawnChance: 0.25,
  },
  TRAP_DOOR: {
    name: 'TRAP DOOR',
    color: 0x8b4513, // Brown/wooden color
    emissive: 0x654321,
    icon: '🚪',
    description: 'Drop a random enemy through the floor!',
    spawnChance: 0.20,
  },
};

export class PowerUp {
  constructor(scene, type, position) {
    this.scene = scene;
    this.type = type;
    this.active = true;
    this.lifetime = 0;
    this.maxLifetime = 15;
    this.spawnGrace = 1.5; // seconds of immunity — can't be picked up immediately
    this.bobPhase = Math.random() * Math.PI * 2;
    this._allMeshes = []; // track every mesh for cleanup

    const baseX = position.x;
    const baseZ = position.z;

    // Use a bright, high-contrast color — mix type color with white for guaranteed visibility
    const baseCol = new THREE.Color(type.color);
    const brightCol = baseCol.clone().lerp(new THREE.Color(0xffffff), 0.2);

    // Helper: create fog-immune material (fog: false ensures visibility at any distance/scene)
    const makeMat = (opts) => new THREE.MeshBasicMaterial({ fog: false, ...opts });

    // 1) GROUND DISC — flat colored circle on the floor
    const discGeo = new THREE.CircleGeometry(1.4, 32);
    const discMat = makeMat({
      color: brightCol, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    });
    this._disc = new THREE.Mesh(discGeo, discMat);
    this._disc.rotation.x = -Math.PI / 2;
    this._disc.position.set(baseX, 0.05, baseZ);
    this._disc.renderOrder = 1;
    scene.add(this._disc);
    this._allMeshes.push(this._disc);

    // 2) VERTICAL BEAM — tall pillar of light (wider & brighter)
    const beamGeo = new THREE.BoxGeometry(0.2, 5.0, 0.2);
    const beamMat = makeMat({
      color: brightCol, transparent: true, opacity: 0.4, depthWrite: false,
    });
    this._beam = new THREE.Mesh(beamGeo, beamMat);
    this._beam.position.set(baseX, 2.5, baseZ);
    this._beam.renderOrder = 2;
    scene.add(this._beam);
    this._allMeshes.push(this._beam);

    // 3) MAIN CRYSTAL — spinning octahedron (bigger for visibility)
    const crystalGeo = new THREE.OctahedronGeometry(0.6, 0);
    const crystalMat = makeMat({
      color: brightCol, transparent: false,
    });
    this._crystal = new THREE.Mesh(crystalGeo, crystalMat);
    this._crystal.position.set(baseX, 1.5, baseZ);
    this._crystal.renderOrder = 5;
    scene.add(this._crystal);
    this._allMeshes.push(this._crystal);

    // 4) GLOW SPHERE — soft halo around crystal (bigger)
    const glowGeo = new THREE.SphereGeometry(0.9, 12, 12);
    const glowMat = makeMat({
      color: brightCol, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
    });
    this._glow = new THREE.Mesh(glowGeo, glowMat);
    this._glow.position.set(baseX, 1.5, baseZ);
    this._glow.renderOrder = 3;
    scene.add(this._glow);
    this._allMeshes.push(this._glow);

    // 5) RING — spinning torus (bigger)
    const ringGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 24);
    const ringMat = makeMat({
      color: brightCol, transparent: true, opacity: 0.7, depthWrite: false,
    });
    this._ring = new THREE.Mesh(ringGeo, ringMat);
    this._ring.position.set(baseX, 1.5, baseZ);
    this._ring.rotation.x = Math.PI / 2;
    this._ring.renderOrder = 4;
    scene.add(this._ring);
    this._allMeshes.push(this._ring);

    // 6) SECOND RING — perpendicular for more visibility
    const ring2Geo = new THREE.TorusGeometry(0.8, 0.06, 8, 24);
    const ring2Mat = makeMat({
      color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false,
    });
    this._ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    this._ring2.position.set(baseX, 1.5, baseZ);
    this._ring2.rotation.z = Math.PI / 2;
    this._ring2.renderOrder = 4;
    scene.add(this._ring2);
    this._allMeshes.push(this._ring2);

    // 7) ORBITING DOTS
    this._dots = [];
    for (let i = 0; i < 6; i++) {
      const dotGeo = new THREE.SphereGeometry(0.1, 6, 6);
      const dotMat = makeMat({ color: 0xffffff });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(baseX, 1.5, baseZ);
      dot.userData._angle = (i / 6) * Math.PI * 2;
      dot.userData._speed = 2.5 + Math.random() * 1.5;
      scene.add(dot);
      this._allMeshes.push(dot);
      this._dots.push(dot);
    }

    // Position tracking dummy (used by pickup distance check)
    this.mesh = { position: new THREE.Vector3(baseX, 0, baseZ) };

    this._baseX = baseX;
    this._baseZ = baseZ;
  }

  get collectable() {
    return this.spawnGrace <= 0;
  }

  update(dt) {
    if (!this.active) return;

    this.lifetime += dt;
    if (this.spawnGrace > 0) this.spawnGrace -= dt;

    // Timeout
    if (this.lifetime > this.maxLifetime) {
      this.destroy();
      return;
    }

    const inGrace = this.spawnGrace > 0;
    const GRACE_DURATION = 1.5;

    // Blink warning in last 3 seconds
    const timeLeft = this.maxLifetime - this.lifetime;
    if (timeLeft < 3) {
      const vis = Math.floor(this.lifetime * 8) % 2 === 0;
      for (const m of this._allMeshes) m.visible = vis;
    } else {
      for (const m of this._allMeshes) m.visible = true;
    }

    const t = this.lifetime;

    // Grace period scale multiplier (grows from 30% → 100% during grace)
    const graceScale = inGrace ? (0.3 + (1.0 - this.spawnGrace / GRACE_DURATION) * 0.7) : 1.0;

    // Bob Y
    this.bobPhase += dt * 2.5;
    const bobY = 1.5 + Math.sin(this.bobPhase) * 0.25;

    // Crystal spin + bob
    this._crystal.position.y = bobY;
    this._crystal.rotation.y += dt * 2.5;
    this._crystal.rotation.x += dt * 0.8;
    this._crystal.scale.setScalar(graceScale);

    // Glow pulse + bob
    this._glow.position.y = bobY;
    this._glow.material.opacity = (0.3 + Math.sin(t * 4) * 0.12) * graceScale;
    const glowScale = (1.0 + Math.sin(t * 3) * 0.12) * graceScale;
    this._glow.scale.set(glowScale, glowScale, glowScale);

    // Ring spin + bob
    this._ring.position.y = bobY;
    this._ring.rotation.z += dt * 3;
    this._ring.scale.setScalar(graceScale);

    // Second ring spin + bob (perpendicular axis)
    this._ring2.position.y = bobY;
    this._ring2.rotation.x += dt * 2;
    this._ring2.scale.setScalar(graceScale);

    // Beam pulse (flash rapidly during grace to signal "incoming")
    if (inGrace) {
      this._beam.material.opacity = 0.2 + Math.sin(t * 20) * 0.2;
    } else {
      this._beam.material.opacity = 0.3 + Math.sin(t * 5) * 0.12;
    }

    // Ground disc pulse
    this._disc.material.opacity = (0.5 + Math.sin(t * 3.5) * 0.15) * graceScale;
    const discScale = (1.0 + Math.sin(t * 2.5) * 0.1) * graceScale;
    this._disc.scale.set(discScale, discScale, 1);

    // Orbiting dots
    for (const dot of this._dots) {
      dot.userData._angle += dt * dot.userData._speed;
      const r = 1.0 * graceScale;
      dot.position.x = this._baseX + Math.cos(dot.userData._angle) * r;
      dot.position.z = this._baseZ + Math.sin(dot.userData._angle) * r;
      dot.position.y = bobY + Math.sin(dot.userData._angle * 2) * 0.3;
      dot.scale.setScalar(graceScale);
    }
  }

  destroy() {
    this.active = false;
    
    // Remove all meshes from scene with proper cleanup
    for (const m of this._allMeshes) {
      if (m && m.parent) {
        m.parent.remove(m);
      }
      if (m.geometry) {
        m.geometry.dispose();
      }
      if (m.material) {
        if (Array.isArray(m.material)) {
          m.material.forEach(mat => mat.dispose());
        } else {
          m.material.dispose();
        }
      }
    }
    
    // Clear references
    this._allMeshes.length = 0;
    this._dots.length = 0;
    this._disc = null;
    this._beam = null;
    this._crystal = null;
    this._glow = null;
    this._ring = null;
    this._ring2 = null;
  }

  collect() {
    this._spawnBurst();
    this.destroy();
  }

  _spawnBurst() {
    const bx = this._baseX;
    const bz = this._baseZ;

    for (let i = 0; i < 12; i++) {
      const geo = new THREE.SphereGeometry(0.12, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: this.type.color, transparent: true, opacity: 1, fog: false,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(bx, 1.5, bz);
      this.scene.add(p);

      const angle = (i / 12) * Math.PI * 2;
      const speed = 3 + Math.random() * 2;
      let vx = Math.cos(angle) * speed;
      let vy = 2 + Math.random() * 2;
      let vz = Math.sin(angle) * speed;

      let life = 0;
      const maxLife = 0.5;
      const scene = this.scene;
      let animationId = null;
      
      const tick = () => {
        life += 0.016;
        if (life >= maxLife) {
          // Proper cleanup
          if (p.parent) {
            p.parent.remove(p);
          }
          if (geo) geo.dispose();
          if (mat) mat.dispose();
          if (animationId) cancelAnimationFrame(animationId);
          return;
        }
        vy -= 9.8 * 0.016;
        p.position.x += vx * 0.016;
        p.position.y += vy * 0.016;
        p.position.z += vz * 0.016;
        mat.opacity = 1 - life / maxLife;
        animationId = requestAnimationFrame(tick);
      };
      tick();
    }
  }
}
