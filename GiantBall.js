import * as THREE from 'three';
import { CONFIG } from './config.js';

export class GiantBall {
  constructor(scene, team) {
    this.scene = scene;
    this.team = team; // Which team activated it (we damage the opposite team)
    this.active = true;
    // Ball rolls from the activating team's side toward the enemy side
    // Blue team is on -X side, Red team is on +X side
    this.direction = team === CONFIG.TEAM_BLUE ? 1 : -1;
    this.speed = 18; // Faster speed for more impact
    this.hitPlayers = new Set(); // Track which players we've already hit
    
    this.totalLifetime = 0; // Failsafe timer
    this.maxLifetime = 10.0; // Force destroy after 10 seconds
    
    this.mesh = this.createMesh();
    
    // Start off the activating team's edge of court
    const startX = team === CONFIG.TEAM_BLUE
      ? -CONFIG.COURT_WIDTH / 2 - 3   // Blue: start off left edge, roll right
      :  CONFIG.COURT_WIDTH / 2 + 3;   // Red: start off right edge, roll left
    
    // Center the ball in the activating team's half of the court (Z position)
    const startZ = team === CONFIG.TEAM_BLUE 
      ? -CONFIG.COURT_DEPTH / 4  // Blue team: center of blue half
      : CONFIG.COURT_DEPTH / 4;   // Red team: center of red half
    
    this.mesh.position.set(startX, this.getRadius(), startZ);
    scene.add(this.mesh);
    
    // Trail particles
    this.trailGroup = new THREE.Group();
    scene.add(this.trailGroup);
    this.trail = [];
    
    // Rumble effect
    this.rumblePhase = 0;
  }
  
  getRadius() {
    // Make ball fill entire court DEPTH - massive!
    // Court depth is 16, so radius should be ~8 to fill it
    return CONFIG.COURT_DEPTH / 2;
  }
  
  createMesh() {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(CONFIG.BALL_TEXTURE);
    tex.colorSpace = THREE.SRGBColorSpace;
    
    // MASSIVE ball - fills entire court width!
    const radius = this.getRadius();
    const geo = new THREE.SphereGeometry(radius, 48, 36);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.2,
      color: 0xff3333,
      emissive: 0xff4400,
      emissiveIntensity: 0.4,
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // Add massive fiery glow aura
    const glowGeo = new THREE.SphereGeometry(radius * 1.15, 24, 18);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(glow);
    this.glow = glow;
    
    return mesh;
  }
  
  update(dt, players, sound, effects) {
    if (!this.active) return;
    
    this.totalLifetime += dt;
    
    // Failsafe: force destroy if stuck for too long
    if (this.totalLifetime >= this.maxLifetime) {
      console.warn('GiantBall failsafe: force destroying after', this.maxLifetime, 'seconds');
      this.destroy();
      return;
    }
    
    // Move left to right (along X-axis)
    this.mesh.position.x += this.direction * this.speed * dt;
    
    // Rotate like it's rolling (Z-axis rotation for left-right movement)
    this.mesh.rotation.z -= this.direction * this.speed * dt * 0.5;
    
    // Rumble effect (pulsing scale)
    this.rumblePhase += dt * 8;
    const rumble = 1 + Math.sin(this.rumblePhase) * 0.03;
    this.mesh.scale.setScalar(rumble);
    
    // Glow pulse
    this.glow.material.opacity = 0.25 + Math.sin(this.rumblePhase * 2) * 0.15;
    
    // Continuous screen shake while active
    if (effects && effects.triggerShake) {
      effects.triggerShake(0.08);
    }
    
    // Spawn massive trail particles
    if (Math.random() < 0.5) {
      const radius = this.getRadius();
      const trailGeo = new THREE.SphereGeometry(1.5, 8, 8);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.6,
      });
      const particle = new THREE.Mesh(trailGeo, trailMat);
      particle.position.copy(this.mesh.position);
      // Spread particles along Z-axis (depth) and Y-axis (height)
      particle.position.z += (Math.random() - 0.5) * radius * 1.5;
      particle.position.y += (Math.random() - 0.5) * radius * 1.5;
      particle.userData.life = 0.8;
      this.trailGroup.add(particle);
      this.trail.push(particle);
    }
    
    // Update trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.userData.life -= dt;
      p.material.opacity = (p.userData.life / 0.8) * 0.6;
      p.scale.setScalar(p.userData.life / 0.8);
      
      if (p.userData.life <= 0) {
        this.trailGroup.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.trail.splice(i, 1);
      }
    }
    
    // Check collision with players
    const radius = this.getRadius();
    players.forEach(player => {
      if (!player.alive || this.hitPlayers.has(player)) return;
      
      // Only damage opposite team (team that DIDN'T activate the power-up)
      if (player.team === this.team) return;
      
      // Check 2D distance (X-Z plane only, ignore Y since ball is elevated)
      const dx = this.mesh.position.x - player.mesh.position.x;
      const dz = this.mesh.position.z - player.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      
      if (dist < radius + player.radius) {
        // HIT!
        this.hitPlayers.add(player);
        
        // Play impact sound
        if (sound && sound.playHit) {
          sound.playHit();
        }
        
        // Play scream sound for giant ball hit
        if (sound && sound.playGiantBallScream) {
          sound.playGiantBallScream();
        }
        
        // Spawn impact effect
        if (effects && effects.spawnHitEffect) {
          effects.spawnHitEffect(player.mesh.position, 0xff6600);
        }
        if (effects && effects.spawnHitSparks) {
          effects.spawnHitSparks(player.mesh.position, 0xff6600, 20);
        }
        
        // Calculate launch direction - away from ball with massive force
        const knockDir = player.mesh.position.clone().sub(this.mesh.position);
        knockDir.y = 0; // Keep horizontal
        knockDir.normalize();
        
        // LAUNCH PLAYER OFF MAP (like slap shot)
        // Set launch velocity components directly on player
        player._launchVelX = knockDir.x * 40; // Massive horizontal launch
        player._launchVelY = 30;              // High upward arc
        player._launchVelZ = knockDir.z * 40; // Z-axis launch
        
        // Set launched state
        player.launchedOffMap = true;
        player.respawnTimer = 1.5; // 1.5 second respawn (fast since whole team gets hit)
        
        // Drop any held ball (use dropBall() which is the single source of truth)
        if (player.dropBall) {
          player.dropBall();
        }
        
        // Deal damage (1 ball hit worth = 25 HP)
        player.hp -= CONFIG.NORMAL_THROW_DAMAGE;
        if (player.hp <= 0) {
          player.hp = 0;
        }
        
        // Trigger massive screen shake
        if (effects && effects.triggerShake) {
          effects.triggerShake(0.5);
        }
        
        // Fire KO callback if player died (for XP/achievements)
        if (player.hp <= 0 && this.onKO) {
          this.onKO(player);
        }
      }
    });
    
    // Remove when off-screen (past the far edge of court in either direction)
    const edge = CONFIG.COURT_WIDTH / 2 + 5;
    if (Math.abs(this.mesh.position.x) > edge) {
      this.destroy();
    }
  }
  
  destroy() {
    this.active = false;
    this.scene.remove(this.mesh);
    this.scene.remove(this.trailGroup);
    
    // Cleanup
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    if (this.glow) {
      this.glow.geometry.dispose();
      this.glow.material.dispose();
    }
    
    this.trail.forEach(p => {
      p.geometry.dispose();
      p.material.dispose();
    });
  }
}
