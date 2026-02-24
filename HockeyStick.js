import * as THREE from 'three';
import { CONFIG } from './config.js';

export class HockeyStick {
  constructor(scene, target, onComplete) {
    this.scene = scene;
    this.target = target; // Player getting hit
    this.onComplete = onComplete; // Callback when animation finishes
    this.active = true;
    this.phase = 0; // 0 = windup, 1 = swing, 2 = follow-through, 3 = fadeout
    this.time = 0;
    this.totalLifetime = 0; // Failsafe: total time alive
    this.maxLifetime = 5.0; // Failsafe: force destroy after 5 seconds no matter what
    
    // Timing for each phase
    this.windupDuration = 0.4;
    this.swingDuration = 0.15;
    this.followThroughDuration = 0.3;
    this.fadeoutDuration = 0.3;
    
    this.stick = this.createStick();
    this.positionStick();
    
    // Ensure stick is fully visible and renders above most other objects
    this.stick.renderOrder = 100;
    this.stick.traverse(child => {
      if (child.material) {
        child.material.fog = false; // Immune to fog
        child.material.depthTest = true;
        child.material.depthWrite = true;
      }
      child.renderOrder = 100;
    });
    
    scene.add(this.stick);
    
    // Initial rotation for windup (stick pulled back)
    this.windupAngle = -Math.PI * 0.6;
    this.swingAngle = Math.PI * 0.4;
    this.stick.rotation.z = this.windupAngle;
  }
  
  createStick() {
    const group = new THREE.Group();
    
    // ═══ SHAFT (long handle) ═══
    // ALL materials use MeshBasicMaterial for guaranteed visibility (no lighting dependency)
    const shaftLength = 5.0;
    const shaftRadius = 0.08;
    
    // Main shaft body - slight taper from grip to blade
    const shaftGeo = new THREE.CylinderGeometry(
      shaftRadius * 0.95,
      shaftRadius * 1.05,
      shaftLength,
      12
    );
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0x2a2a2a,
      side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    group.add(shaft);
    
    // Grip tape texture (segmented rubber bands)
    const gripHeight = 1.2;
    const numGripBands = 8;
    for (let i = 0; i < numGripBands; i++) {
      const bandGeo = new THREE.CylinderGeometry(
        shaftRadius * 1.12,
        shaftRadius * 1.12,
        gripHeight / numGripBands * 0.7,
        12
      );
      const bandMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x3a3a3a : 0x151515,
      });
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.position.y = shaftLength / 2 - gripHeight / 2 + (i / numGripBands) * gripHeight;
      group.add(band);
    }
    
    // Color accent stripes on shaft
    const stripePositions = [-0.8, -0.4, 0.0, 0.4, 0.8];
    stripePositions.forEach((offset, idx) => {
      const stripeGeo = new THREE.CylinderGeometry(
        shaftRadius * 1.08,
        shaftRadius * 1.08,
        0.15,
        12
      );
      const stripeColor = idx % 2 === 0 ? 0xff2222 : 0xeeeeee;
      const stripeMat = new THREE.MeshBasicMaterial({
        color: stripeColor,
      });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.y = offset;
      group.add(stripe);
    });
    
    // ═══ BLADE ═══
    const bladeWidth = 0.8;
    const bladeHeight = 0.3;
    const bladeDepth = 0.08;
    const bladeYOffset = -shaftLength / 2 - bladeHeight / 2;
    
    // Main blade body
    const bladeGeo = new THREE.BoxGeometry(bladeWidth, bladeHeight, bladeDepth);
    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0x222222,
      side: THREE.DoubleSide,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = bladeYOffset;
    blade.position.z = bladeDepth * 1.5;
    blade.rotation.x = -0.15;
    group.add(blade);
    
    // Blade edge reinforcement (bright accent — always visible)
    const edgeGeo = new THREE.BoxGeometry(bladeWidth * 1.02, 0.05, bladeDepth * 1.1);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: 0xffcc00,
    });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = bladeYOffset - bladeHeight / 2 + 0.025;
    edge.position.z = bladeDepth * 1.5;
    edge.rotation.x = -0.15;
    group.add(edge);
    
    // Blade side decals
    const decalGeo = new THREE.PlaneGeometry(0.4, 0.15);
    const decalMat = new THREE.MeshBasicMaterial({
      color: 0xff2222,
      side: THREE.DoubleSide,
    });
    const decalLeft = new THREE.Mesh(decalGeo, decalMat);
    decalLeft.position.set(-bladeWidth / 3, bladeYOffset, bladeDepth * 2.2);
    decalLeft.rotation.x = -0.15;
    group.add(decalLeft);
    
    const decalRight = new THREE.Mesh(decalGeo, decalMat.clone());
    decalRight.position.set(bladeWidth / 3, bladeYOffset, bladeDepth * 2.2);
    decalRight.rotation.x = -0.15;
    group.add(decalRight);
    
    // ═══ BUTT END CAP (top of stick) ═══
    const capGeo = new THREE.CylinderGeometry(
      shaftRadius * 1.5,
      shaftRadius * 1.2,
      0.15,
      12
    );
    const capMat = new THREE.MeshBasicMaterial({
      color: 0x444444,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = shaftLength / 2 + 0.075;
    group.add(cap);
    
    // Scale up the entire stick to be massive (intimidating power-up size)
    // (Removed blue glow - stick colors already make it visible)
    group.scale.setScalar(2.5);
    
    return group;
  }
  
  positionStick() {
    // Position stick next to target, angled for dramatic swing
    const targetPos = this.target.mesh.position;
    this.stick.position.set(
      targetPos.x + 8,
      targetPos.y + 3,
      targetPos.z
    );
  }
  
  update(dt) {
    if (!this.active) return;
    
    this.time += dt;
    this.totalLifetime += dt;
    
    // Failsafe: force destroy if stuck for too long
    if (this.totalLifetime >= this.maxLifetime) {
      console.warn('HockeyStick failsafe: force destroying after', this.maxLifetime, 'seconds');
      this.destroy();
      if (this.onComplete) this.onComplete();
      return;
    }
    
    try {
      // ── PHASE 0: Windup ──
      if (this.phase === 0) {
        if (this.time >= this.windupDuration) {
          this.phase = 1;
          this.time = 0;
        }
      }
      
      // ── PHASE 1: Swing (rapid rotation, hit player at peak) ──
      else if (this.phase === 1) {
        const t = this.time / this.swingDuration;
        const swingT = this.easeInOutCubic(Math.min(t, 1));
        
        // Rotate stick from windup to follow-through
        this.stick.rotation.z = THREE.MathUtils.lerp(
          this.windupAngle,
          this.swingAngle,
          swingT
        );
        
        // Check if stick blade hits target (around 50-60% through swing)
        if (t >= 0.5 && !this.hasHit) {
          this.hasHit = true;
          this.hitPlayer();
        }
        
        if (this.time >= this.swingDuration) {
          this.phase = 2;
          this.time = 0;
        }
      }
      
      // ── PHASE 2: Follow-through (stick continues arc) ──
      else if (this.phase === 2) {
        if (this.time >= this.followThroughDuration) {
          this.phase = 3;
          this.time = 0;
        }
      }
      
      // ── PHASE 3: Fadeout ──
      else if (this.phase === 3) {
        const fade = Math.max(0, 1 - (this.time / this.fadeoutDuration));
        this.stick.traverse(child => {
          if (child.material) {
            child.material.opacity = fade;
            child.material.transparent = true;
          }
        });
        
        if (this.time >= this.fadeoutDuration) {
          this.destroy();
          if (this.onComplete) this.onComplete();
        }
      }
    } catch (err) {
      // If any error occurs during animation, force destroy to prevent stuck models
      console.error('HockeyStick update error, force destroying:', err);
      this.destroy();
      if (this.onComplete) this.onComplete();
    }
  }
  
  hitPlayer() {
    // Guard: skip if target is invalid or already dead/launched
    if (!this.target || !this.target.mesh || !this.target.alive) return;
    
    // Calculate launch direction — away from stick origin with upward arc
    const stickSide = this.stick.position.x > this.target.mesh.position.x ? -1 : 1;
    const randomZ = (Math.random() - 0.5) * 15;
    
    // Set launch velocity components directly on player (read by Player.update)
    this.target._launchVelX = stickSide * 35; // Horizontal launch away from stick
    this.target._launchVelY = 25;              // Upward arc
    this.target._launchVelZ = randomZ;         // Random lateral spread
    
    // Set flag so player enters launched state
    this.target.launchedOffMap = true;
    this.target.respawnTimer = 5.0;
    
    // Drop any held ball (use dropBall() which is the single source of truth)
    if (this.target.dropBall) {
      this.target.dropBall();
    }
    
    // Damage (1 ball hit = normal throw damage)
    this.target.hp -= CONFIG.NORMAL_THROW_DAMAGE;
    if (this.target.hp <= 0) {
      this.target.hp = 0;
    }
  }
  
  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  
  destroy() {
    this.active = false;
    this.scene.remove(this.stick);
    
    // Cleanup geometry and materials
    this.stick.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
