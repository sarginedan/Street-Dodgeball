import * as THREE from 'three';
import { CONFIG } from './config.js';

export class BananaPeel {
  constructor(scene, team, position) {
    this.scene = scene;
    this.team = team; // Team that placed it (victims are opposite team)
    this.active = true;
    this.lifetime = 0;
    this.maxLifetime = 12; // Disappears after 12 seconds
    this.triggered = false;
    this.triggerRadius = 1.4; // How close player needs to be to slip (bigger peel = bigger zone)
    
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.05; // Just above ground
    scene.add(this.mesh);
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    // ── Materials ──
    const peelOuterMat = new THREE.MeshStandardMaterial({
      color: 0xf5d623,
      emissive: 0xd4a800,
      emissiveIntensity: 0.2,
      metalness: 0.05,
      roughness: 0.55,
    });
    const peelInnerMat = new THREE.MeshStandardMaterial({
      color: 0xfff8c4,
      emissive: 0xeedd66,
      emissiveIntensity: 0.1,
      metalness: 0.0,
      roughness: 0.8,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x8b6914,
      roughness: 0.9,
      metalness: 0.0,
    });
    const spotMat = new THREE.MeshStandardMaterial({
      color: 0x7a5c00,
      roughness: 0.7,
      metalness: 0.0,
    });
    
    // ── Central nub (where peels fan out from) ──
    const nubGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const nub = new THREE.Mesh(nubGeo, stemMat);
    nub.position.set(0, 0.06, 0);
    nub.scale.set(1, 0.6, 1);
    group.add(nub);
    
    // ── Build a single peel strip using a curved path ──
    function createPeelStrip(angleY) {
      const strip = new THREE.Group();
      
      // Outer peel (yellow curved strip)
      // Use a lathe-like approach: a curved box stretched along a path
      const outerShape = new THREE.Shape();
      outerShape.moveTo(-0.08, 0);
      outerShape.lineTo(0.08, 0);
      outerShape.lineTo(0.06, 0.02);
      outerShape.lineTo(-0.06, 0.02);
      outerShape.closePath();
      
      // Create curve path for the peel to follow
      const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(0, 0.06, 0),        // starts at center nub
        new THREE.Vector3(0, 0.04, 0.12),      // curves outward
        new THREE.Vector3(0, -0.02, 0.25),     // dips down
        new THREE.Vector3(0, 0.08, 0.35),      // tip curls up
      );
      
      const extrudeSettings = {
        steps: 12,
        extrudePath: curve,
      };
      
      const outerGeo = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
      const outer = new THREE.Mesh(outerGeo, peelOuterMat);
      strip.add(outer);
      
      // Inner peel (lighter cream side)
      const innerShape = new THREE.Shape();
      innerShape.moveTo(-0.06, 0.02);
      innerShape.lineTo(0.06, 0.02);
      innerShape.lineTo(0.05, 0.035);
      innerShape.lineTo(-0.05, 0.035);
      innerShape.closePath();
      
      const innerGeo = new THREE.ExtrudeGeometry(innerShape, extrudeSettings);
      const inner = new THREE.Mesh(innerGeo, peelInnerMat);
      strip.add(inner);
      
      // Brown spots on outer peel
      for (let i = 0; i < 2; i++) {
        const spotGeo = new THREE.SphereGeometry(0.015, 4, 4);
        const spot = new THREE.Mesh(spotGeo, spotMat);
        const t = 0.3 + i * 0.3;
        const pt = curve.getPoint(t);
        spot.position.copy(pt);
        spot.position.y -= 0.01;
        spot.scale.set(1.5, 0.5, 1);
        strip.add(spot);
      }
      
      // Rotate the whole strip to fan out
      strip.rotation.y = angleY;
      
      return strip;
    }
    
    // ── Create 4 peel strips fanning out at 90° intervals ──
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const strip = createPeelStrip(angle);
      group.add(strip);
    }
    
    // ── Small brown stem sticking up from center ──
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.025, 0.08, 6);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0, 0.1, 0);
    group.add(stem);
    
    // ── Subtle warning glow ring on ground ──
    const glowGeo = new THREE.RingGeometry(0.5, 0.6, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffeb3b,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.005;
    group.add(glow);
    this.glow = glow;
    
    // Scale up 2x for high court visibility — big menacing peel
    group.scale.setScalar(2.6);
    
    group.castShadow = true;
    group.receiveShadow = true;
    
    return group;
  }
  
  update(dt, players, sound, effects) {
    if (!this.active) return;
    
    this.lifetime += dt;
    
    // Fade out when near end of life
    if (this.lifetime > this.maxLifetime) {
      this.destroy();
      return;
    } else if (this.lifetime > this.maxLifetime - 1) {
      const fade = 1 - (this.lifetime - (this.maxLifetime - 1));
      this.mesh.traverse(child => {
        if (child.material) {
          child.material.opacity = fade;
          child.material.transparent = true;
        }
      });
    }
    
    // Glow pulse
    if (this.glow) {
      const pulse = 0.2 + Math.sin(this.lifetime * 4) * 0.1;
      this.glow.material.opacity = pulse;
    }
    
    // Check for player collisions
    if (!this.triggered) {
      players.forEach(player => {
        if (!player.alive) return;
        if (player.team === this.team) return; // Can't slip on your own peel
        if (player.slipping) return; // Already slipping
        
        const dist = new THREE.Vector2(
          this.mesh.position.x - player.mesh.position.x,
          this.mesh.position.z - player.mesh.position.z
        ).length();
        
        if (dist < this.triggerRadius) {
          // Player stepped on banana peel!
          this.triggerSlip(player, sound, effects);
        }
      });
    }
  }
  
  triggerSlip(player, sound, effects) {
    this.triggered = true;
    
    // Apply slip effect to player
    player.slipping = true;
    player.slipDuration = 2.0; // 2 seconds on ground
    player.slipRecovery = 0.5; // 0.5s getting back up
    player.slipAnimPhase = 0;  // Track animation phase for enhanced slip anim
    
    // Comedic multi-layered slip sound (whoosh → squeak → thud)
    if (sound && sound.playSlip) {
      sound.playSlip();
    }
    
    // Spawn comedic effect particles (yellow sparks burst)
    if (effects && effects.spawnHitSparks) {
      effects.spawnHitSparks(this.mesh.position, 0xffeb3b, 16);
    }
    
    // Spawn banana chunk particles flying outward
    this.spawnBananaChunks(player.mesh.position);
    
    // Screen shake on impact
    if (effects && effects.triggerShake) {
      effects.triggerShake(0.15);
    }
    
    // Remove the peel after triggering
    setTimeout(() => this.destroy(), 100);
  }
  
  spawnBananaChunks(position) {
    // Spawn yellow banana chunk particles that fly outward comedically
    for (let i = 0; i < 8; i++) {
      const chunkGeo = new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 4, 4);
      const chunkMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xf5d623 : 0xfff8c4,
        transparent: true,
        opacity: 1,
      });
      const chunk = new THREE.Mesh(chunkGeo, chunkMat);
      chunk.position.copy(position);
      chunk.position.y += 0.3;
      
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      chunk.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        3 + Math.random() * 3,
        Math.sin(angle) * speed
      );
      chunk.userData.lifetime = 0;
      chunk.userData.maxLife = 0.7 + Math.random() * 0.3;
      chunk.userData.spin = (Math.random() - 0.5) * 15;
      
      this.scene.add(chunk);
      
      const animateChunk = () => {
        chunk.userData.lifetime += 0.016;
        const t = chunk.userData.lifetime / chunk.userData.maxLife;
        
        if (t >= 1) {
          this.scene.remove(chunk);
          chunk.geometry.dispose();
          chunk.material.dispose();
          return;
        }
        
        chunk.userData.velocity.y -= 12 * 0.016; // gravity
        chunk.position.add(chunk.userData.velocity.clone().multiplyScalar(0.016));
        chunk.rotation.x += chunk.userData.spin * 0.016;
        chunk.rotation.z += chunk.userData.spin * 0.8 * 0.016;
        chunk.material.opacity = 1 - t;
        chunk.scale.setScalar(1 - t * 0.5);
        
        requestAnimationFrame(animateChunk);
      };
      animateChunk();
    }
  }
  
  destroy() {
    this.active = false;
    if (this.mesh && this.mesh.parent) {
      this.scene.remove(this.mesh);
    }
    // Cleanup geometry and materials
    this.mesh.traverse(child => {
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
