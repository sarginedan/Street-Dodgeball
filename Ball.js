import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Ball {
  constructor(scene, index) {
    this.scene = scene;
    this.index = index;
    this.active = false;
    this.held = false;
    this.holder = null;
    this.team = null;
    this.thrower = null;
    this.velocity = new THREE.Vector3();
    this.damage = CONFIG.NORMAL_THROW_DAMAGE;
    this.trickType = null;
    this.curve = 0;
    this.caught = false;
    this.lifetime = 0;
    this.trail = [];
    this.idleTime = 0;  // Tracks how long ball has been sitting idle
    this.isLaserBall = false; // Laser ball power-up flag
    this.isFireball = false;  // Fireball power-up flag
    this.hasHitGround = false; // Flag to disable damage after first ground contact
    
    this.mesh = this.createMesh();
    this.setupPosition(index);
    scene.add(this.mesh);
    
    // Trail particles
    this.trailGroup = new THREE.Group();
    scene.add(this.trailGroup);
    
    // Laser beam visual (created when needed)
    this.laserBeam = null;
    
    // Speed lines for max power throws
    this.speedLines = null;
  }
  
  createMesh() {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(CONFIG.BALL_TEXTURE);
    tex.colorSpace = THREE.SRGBColorSpace;
    
    const geo = new THREE.SphereGeometry(CONFIG.BALL_RADIUS, 16, 12);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.4,
      metalness: 0.1,
      color: 0xff3333,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    
    // Glow ring
    const glowGeo = new THREE.RingGeometry(0.2, 0.35, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    mesh.add(glow);
    this.glow = glow;
    this.glowMat = glowMat;
    
    return mesh;
  }
  
  setupPosition(index) {
    // Balls start on center line
    const spacing = CONFIG.COURT_DEPTH / (CONFIG.BALL_COUNT + 1);
    this.mesh.position.set(0, CONFIG.BALL_RADIUS, -CONFIG.COURT_DEPTH / 2 + spacing * (index + 1));
    this.restPos = this.mesh.position.clone();
  }
  
  update(dt) {
    // CRITICAL GLOBAL SAFETY: Force minimum Y position EVERY FRAME regardless of state
    // This prevents balls from ever getting stuck below the floor
    if (!this.held) {
      const currentY = this.mesh.position.y;
      
      // If ball is significantly below floor, it's completely stuck - force respawn immediately
      if (currentY < CONFIG.BALL_RADIUS - 0.15) {
        console.warn(`Ball ${this.index} stuck below floor (y=${currentY.toFixed(2)}), force respawn`);
        this.respawnToCenter();
        return;
      }
      
      // If ball is below proper position, clamp it
      if (currentY < CONFIG.BALL_RADIUS) {
        this.mesh.position.y = CONFIG.BALL_RADIUS;
        if (this.velocity.y < 0) {
          this.velocity.y = 0;
        }
      }
    }
    
    // FAILSAFE: If ball thinks it's held but holder is dead, missing, or invalid — force release
    if (this.held) {
      if (!this.holder || !this.holder.alive || !this.holder.hasBall) {
        console.warn(`Ball ${this.index} held by invalid holder, force releasing`);
        this.held = false;
        this.holder = null;
        this.active = false;
        this.team = null;
        this.thrower = null;
        this.velocity.set(0, 0, 0);
        this.mesh.position.y = CONFIG.BALL_RADIUS;
        this.idleTime = 0;
        this.hasHitGround = false;
        this._stuckCheckTimer = 0;
        this.mesh.scale.setScalar(1.0);
        this.glowMat.opacity = 0;
        this.glow.scale.setScalar(1);
        this.mesh.material.emissive.setHex(0x000000);
        this.mesh.material.emissiveIntensity = 0;
        return;
      }
    }
    
    if (this.held && this.holder) {
      // Reset idle timer when ball is held
      this.idleTime = 0;
      
      // Follow holder's right hand world position
      // The hand is deep in the arm hierarchy: mesh → rightArm (pivot) → rightForearm (pivot) → hand parts
      // We get the world position of the forearm pivot's hand area
      const holder = this.holder;
      if (holder.rightForearm) {
        // Force world matrix update so localToWorld gives current-frame positions
        holder.mesh.updateMatrixWorld(true);
        // Get world position of the hand center (in forearm-pivot local space)
        const handLocal = new THREE.Vector3(0, -0.28, 0.02);
        const worldPos = handLocal.clone();
        holder.rightForearm.localToWorld(worldPos);
        this.mesh.position.copy(worldPos);
      } else {
        // Fallback: static offset (shouldn't happen but safety net)
        const offset = holder.team === CONFIG.TEAM_BLUE ? 0.5 : -0.5;
        this.mesh.position.set(
          holder.mesh.position.x + offset,
          holder.mesh.position.y + 1.4,
          holder.mesh.position.z
        );
      }
      this.glowMat.opacity = 0;
      this.clearTrail();
      return;
    }
    
    if (this.active) {
      this.lifetime += dt;
      // Reset idle timer when ball is active (flying)
      this.idleTime = 0;
      
      // CRITICAL: Detect stuck active balls (active but not moving)
      // If ball is "active" but has been sitting still for more than 0.5 seconds, force deactivate
      const speed = this.velocity.length();
      if (speed < 0.5 && this.mesh.position.y <= CONFIG.BALL_RADIUS + 0.1) {
        if (!this._stuckCheckTimer) {
          this._stuckCheckTimer = 0;
        }
        this._stuckCheckTimer += dt;
        
        if (this._stuckCheckTimer > 0.5) {
          console.warn('Ball stuck in active state with no movement, forcing deactivate');
          this.deactivate();
          return;
        }
      } else {
        this._stuckCheckTimer = 0;
      }
      
      // Apply gravity
      this.velocity.y += CONFIG.BALL_GRAVITY * dt;
      
      // Apply curve
      if (this.curve !== 0) {
        this.velocity.z += this.curve * dt;
      }
      
      // Move
      this.mesh.position.add(this.velocity.clone().multiplyScalar(dt));
      
      // Rotation
      this.mesh.rotation.x += this.velocity.x * dt * 3;
      this.mesh.rotation.z += this.velocity.z * dt * 3;
      
      // Glow effects
      const power = this.throwPower !== undefined ? this.throwPower : 1.0;
      
      if (this.isLaserBall) {
        // LASER BALL — intense magenta/cyan glow
        this.glowMat.color.setHex(0xff00ff);
        this.glowMat.opacity = 1.0;
        this.glow.rotation.z = this.lifetime * 15;
        this.mesh.material.emissive.setHex(0xff00ff);
        this.mesh.material.emissiveIntensity = 0.8 + Math.sin(this.lifetime * 20) * 0.2;
        
        // Create/update laser beam trail
        this.updateLaserBeam();
      } else if (this.isFireball) {
        // FIREBALL — intense orange/red glow with flickering
        const flicker = 0.7 + Math.sin(this.lifetime * 25) * 0.15 + Math.sin(this.lifetime * 37) * 0.15;
        this.glowMat.color.setHex(0xff4400);
        this.glowMat.opacity = flicker;
        this.glow.rotation.z = this.lifetime * 8;
        this.glow.scale.setScalar(1.3 + Math.sin(this.lifetime * 15) * 0.3);
        this.mesh.material.emissive.setHex(0xff4400);
        this.mesh.material.emissiveIntensity = 0.6 + Math.sin(this.lifetime * 18) * 0.2;
      } else if (this.trickType) {
        this.glowMat.color.setHex(this.trickType.color);
        this.glowMat.opacity = 0.6 + Math.sin(this.lifetime * 10) * 0.3;
        this.glow.rotation.z = this.lifetime * 5;
      } else {
        // POWER-BASED GLOW for normal throws with EXTREME variation
        // Low power (0-0.4): subtle orange glow, minimal effects
        // Medium power (0.4-0.75): brighter orange, slight red tint
        // High power (0.75-0.9): intense red-orange with emissive, larger glow ring
        // MAX power (0.9-1.0): EXPLOSIVE effects with distortion, huge glow, intense pulsing
        if (power < 0.4) {
          // Weak throw — barely glowing, slow rotation
          this.glowMat.opacity = 0.15 + power * 0.2;
          this.glowMat.color.setHex(0xff9955);
          this.glow.scale.setScalar(0.8);
          this.mesh.material.emissive.setHex(0x000000);
          this.mesh.material.emissiveIntensity = 0;
          // Slow rotation for low power
          this.glow.rotation.z = this.lifetime * 2;
          this.mesh.scale.setScalar(1.0); // Normal size
        } else if (power < 0.75) {
          // Medium throw — decent glow, normal rotation
          this.glowMat.opacity = 0.35 + power * 0.25;
          this.glowMat.color.setHex(0xff6622);
          this.glow.scale.setScalar(1.0 + (power - 0.4) * 0.4);
          this.mesh.material.emissive.setHex(0x331100);
          this.mesh.material.emissiveIntensity = (power - 0.4) * 0.4;
          this.glow.rotation.z = this.lifetime * 4;
          this.mesh.scale.setScalar(1.0); // Normal size
        } else if (power < 0.9) {
          // High power throw — intense glow with pulsing
          const pulse = Math.sin(this.lifetime * 18) * 0.2;
          this.glowMat.opacity = 0.75 + pulse + (power - 0.75) * 0.25;
          this.glowMat.color.setHex(0xff3300);
          this.glow.scale.setScalar(1.4 + pulse + (power - 0.75) * 0.6);
          this.glow.rotation.z = this.lifetime * 8;
          this.mesh.material.emissive.setHex(0xff2200);
          this.mesh.material.emissiveIntensity = 0.5 + pulse * 0.3 + (power - 0.75) * 0.5;
          this.mesh.scale.setScalar(1.0 + (power - 0.75) * 0.3); // Slight size boost for high power
        } else {
          // MAX POWER (0.9-1.0) — EXPLOSIVE visual effects
          const fastPulse = Math.sin(this.lifetime * 25) * 0.25;
          const slowPulse = Math.sin(this.lifetime * 8) * 0.15;
          const combinedPulse = fastPulse + slowPulse;
          
          // Massive glow that pulses dramatically
          this.glowMat.opacity = 0.95 + combinedPulse;
          this.glowMat.color.setHex(0xff1100); // Bright red
          this.glow.scale.setScalar(2.0 + combinedPulse * 0.8);
          this.glow.rotation.z = this.lifetime * 12; // Fast spin
          
          // Intense emissive glow on ball itself
          this.mesh.material.emissive.setHex(0xff3300);
          this.mesh.material.emissiveIntensity = 0.9 + combinedPulse * 0.4;
          
          // Ball physically grows larger at max power with pulsing
          const scaleBoost = 1.15 + combinedPulse * 0.1; // 1.15-1.25x size
          this.mesh.scale.setScalar(scaleBoost);
          
          // Extra speed-based rotation blur effect
          this.mesh.rotation.x += this.velocity.x * dt * 6;
          this.mesh.rotation.z += this.velocity.z * dt * 6;
          
          // Speed lines effect for max power
          this.updateSpeedLines();
        }
      }
      
      // Trail particles
      this.updateTrail(dt);
      
      // Bounce off floor (with safety clamp to prevent falling through)
      if (this.mesh.position.y <= CONFIG.BALL_RADIUS) {
        this.mesh.position.y = CONFIG.BALL_RADIUS;
        this.velocity.y = Math.abs(this.velocity.y) * 0.5;
        this.velocity.x *= 0.7;
        this.velocity.z *= 0.7;
        
        // Mark that ball has hit ground - disable damage from rolling balls
        this.hasHitGround = true;
        
        // Deactivate if slow enough
        if (Math.abs(this.velocity.y) < 0.5 && this.velocity.length() < 1) {
          this.deactivate();
        }
      }
      
      // AGGRESSIVE floor clamp: never let ball fall below floor
      // Check multiple times per frame to catch fast-moving balls
      if (this.mesh.position.y < CONFIG.BALL_RADIUS) {
        this.mesh.position.y = CONFIG.BALL_RADIUS;
        this.velocity.y = Math.max(0, this.velocity.y); // Only allow upward velocity
      }
      
      // Extra safety: if ball is way below floor, force respawn
      if (this.mesh.position.y < -0.5) {
        console.warn('Ball fell through floor, force respawn');
        this.respawnToCenter();
      }
      
      // Bounce off walls — keep balls inside the playable court area
      const hw = CONFIG.COURT_WIDTH / 2 + 1;
      const hd = CONFIG.COURT_DEPTH / 2 + 0.5;
      if (Math.abs(this.mesh.position.x) > hw) {
        this.velocity.x *= -0.5;
        this.mesh.position.x = Math.sign(this.mesh.position.x) * hw;
      }
      if (Math.abs(this.mesh.position.z) > hd) {
        this.velocity.z *= -0.5;
        this.mesh.position.z = Math.sign(this.mesh.position.z) * hd;
      }
      
      // Deactivate if too old
      if (this.lifetime > 5) {
        this.deactivate();
      }
    } else if (!this.held) {
      // Idle ball on ground - gentle bob (only positive values to prevent floor clipping)
      const bobAmount = Math.abs(Math.sin(Date.now() * 0.003 + this.index)) * 0.02;
      this.mesh.position.y = CONFIG.BALL_RADIUS + bobAmount;
      this.glowMat.opacity = 0;
      
      // Track idle time
      this.idleTime += dt;
      
      // Auto-respawn to center after 4 seconds of being idle
      // Faster respawn prevents stuck balls from staying out of play too long
      if (this.idleTime > 4) {
        this.respawnToCenter();
        this.idleTime = 0;
      }
      
      // Safety: if idle ball is out of bounds, respawn to center immediately
      if (this.isOutOfBounds()) {
        this.respawnToCenter();
        this.idleTime = 0;
      }
      
      // CRITICAL: Reset any residual state that could prevent pickup
      // Sometimes balls get stuck with non-zero velocity while idle
      if (this.velocity.length() > 0.01) {
        this.velocity.set(0, 0, 0);
      }
      
      // Reset scale if somehow corrupted
      if (this.mesh.scale.x !== 1.0 || this.mesh.scale.y !== 1.0 || this.mesh.scale.z !== 1.0) {
        this.mesh.scale.setScalar(1.0);
      }
      
      // Clear any residual team assignment for idle balls
      if (this.team !== null) {
        this.team = null;
      }
      if (this.thrower !== null) {
        this.thrower = null;
      }
    }
  }
  
  updateSpeedLines() {
    // Create speed lines if they don't exist
    if (!this.speedLines) {
      const lineGroup = new THREE.Group();
      
      // Create 8 speed lines radiating from the ball
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const lineGeo = new THREE.PlaneGeometry(0.08, 1.5);
        const lineMat = new THREE.MeshBasicMaterial({
          color: 0xff2200,
          transparent: true,
          opacity: 0.6,
          side: THREE.DoubleSide,
        });
        const line = new THREE.Mesh(lineGeo, lineMat);
        
        // Position lines around the ball
        const radius = 0.4;
        line.position.set(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        line.rotation.y = angle;
        
        lineGroup.add(line);
      }
      
      this.speedLines = lineGroup;
      this.mesh.add(this.speedLines);
    }
    
    // Animate speed lines - rotate and pulse
    this.speedLines.rotation.z = this.lifetime * 15;
    const pulse = Math.sin(this.lifetime * 20) * 0.2 + 0.8;
    
    this.speedLines.children.forEach((line, i) => {
      line.material.opacity = 0.5 + pulse * 0.3;
      line.scale.y = 1.0 + pulse * 0.4;
    });
  }
  
  updateTrail(dt) {
    // Add trail particle
    if (this.active && this.velocity.length() > 2) {
      // Trail density and appearance based on power level
      const power = this.throwPower !== undefined ? this.throwPower : 1.0;
      
      // Laser ball and fireball get enhanced trail particles
      const isEnhanced = this.isLaserBall || this.isFireball;
      
      // Size and spawn frequency scale with power
      let size, spawnChance, lifetime, opacity;
      if (isEnhanced) {
        size = 0.18;
        spawnChance = 1.0;
        lifetime = 0.6;
        opacity = 0.9;
      } else if (power >= 0.9) {
        // MAX power — huge, frequent, long-lasting particles
        size = 0.16 + Math.random() * 0.06; // Variable size
        spawnChance = 1.0; // Every frame
        lifetime = 0.5;
        opacity = 0.85;
      } else if (power >= 0.75) {
        // High power — larger, more frequent
        size = 0.12;
        spawnChance = 0.8;
        lifetime = 0.4;
        opacity = 0.7;
      } else if (power >= 0.4) {
        // Medium power — standard trail
        size = 0.08;
        spawnChance = 0.5;
        lifetime = 0.3;
        opacity = 0.6;
      } else {
        // Low power — minimal trail
        size = 0.05;
        spawnChance = 0.25;
        lifetime = 0.2;
        opacity = 0.4;
      }
      
      // Randomly spawn particles based on power level
      if (Math.random() < spawnChance) {
        const trailGeo = new THREE.SphereGeometry(size, 4, 4);
        let color;
        if (this.isLaserBall) {
          color = 0xff00ff;
        } else if (this.isFireball) {
          color = Math.random() > 0.5 ? 0xff4400 : 0xffcc00;
        } else if (this.trickType) {
          color = this.trickType.color;
        } else {
          // Power-based color gradient
          if (power >= 0.9) {
            color = 0xff1100; // Bright red for max power
          } else if (power >= 0.75) {
            color = 0xff3300; // Red-orange for high power
          } else if (power >= 0.4) {
            color = 0xff6622; // Orange for medium
          } else {
            color = 0xff9955; // Light orange for low
          }
        }
        
        const trailMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: opacity,
        });
        const particle = new THREE.Mesh(trailGeo, trailMat);
        particle.position.copy(this.mesh.position);
        particle.userData.life = lifetime;
        particle.userData.maxLife = particle.userData.life;
        particle.userData.isLaser = this.isLaserBall;
        particle.userData.isFireball = this.isFireball;
        particle.userData.isMaxPower = power >= 0.9;
        this.trailGroup.add(particle);
        this.trail.push(particle);
      }
    }
    
    // Update trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.userData.life -= dt;
      const t = p.userData.life / p.userData.maxLife;
      const isSpecial = p.userData.isLaser || p.userData.isFireball;
      p.material.opacity = t * (isSpecial ? 0.9 : 0.5);
      p.scale.setScalar(t * (isSpecial ? 1.5 : 1));
      
      // Laser particles glow and spin
      if (p.userData.isLaser) {
        p.rotation.x += dt * 10;
        p.rotation.y += dt * 15;
      }
      
      // Fireball trail particles rise and expand (like embers)
      if (p.userData.isFireball) {
        p.position.y += dt * 1.5; // embers rise
        p.scale.setScalar(t * 1.8); // expand as they fade
      }
      
      // Max power particles get extra swirl effect
      if (p.userData.isMaxPower) {
        p.rotation.z += dt * 8;
        p.scale.setScalar(t * 1.3); // Larger expansion
      }
      
      if (p.userData.life <= 0) {
        this.trailGroup.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        this.trail.splice(i, 1);
      }
    }
  }
  
  updateLaserBeam() {
    // Create laser beam if it doesn't exist
    if (!this.laserBeam) {
      const beamGeo = new THREE.CylinderGeometry(0.4, 0.4, 200, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });
      this.laserBeam = new THREE.Mesh(beamGeo, beamMat);
      this.scene.add(this.laserBeam);
    }
    
    // Position beam along velocity direction
    const dir = this.velocity.clone().normalize();
    const length = 200;
    
    // Position at ball center, extend backward along trajectory
    this.laserBeam.position.copy(this.mesh.position);
    this.laserBeam.position.add(dir.clone().multiplyScalar(-length / 2));
    
    // Rotate to align with velocity
    const angle = Math.atan2(dir.x, dir.z);
    const tilt = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
    this.laserBeam.rotation.y = angle;
    this.laserBeam.rotation.x = Math.PI / 2 - tilt;
    
    // Pulse opacity
    this.laserBeam.material.opacity = 0.15 + Math.sin(this.lifetime * 30) * 0.1;
  }
  
  clearTrail() {
    this.trail.forEach(p => {
      this.trailGroup.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    });
    this.trail = [];
  }
  
  clearSpeedLines() {
    if (this.speedLines) {
      this.speedLines.children.forEach(line => {
        line.geometry.dispose();
        line.material.dispose();
      });
      this.mesh.remove(this.speedLines);
      this.speedLines = null;
    }
  }
  
  deactivate() {
    this.active = false;
    this.team = null;
    this.thrower = null;
    this.trickType = null;
    this.curve = 0;
    this.lifetime = 0;
    this.hasHitGround = false; // Reset ground hit flag
    this.velocity.set(0, 0, 0);
    this.glowMat.opacity = 0;
    this.mesh.scale.setScalar(1.0); // Reset size
    this._stuckCheckTimer = 0; // Reset stuck detection timer
    this.clearTrail();
    this.clearSpeedLines();
    
    // Clean up laser beam
    if (this.laserBeam) {
      this.scene.remove(this.laserBeam);
      this.laserBeam.geometry.dispose();
      this.laserBeam.material.dispose();
      this.laserBeam = null;
    }
    
    // Reset laser ball flag
    this.isLaserBall = false;
    
    // Reset fireball flag
    this.isFireball = false;
    
    // Reset glow scale
    this.glow.scale.setScalar(1);
    
    // Reset material emissive
    this.mesh.material.emissive.setHex(0x000000);
    this.mesh.material.emissiveIntensity = 0;
    
    // If landing position is out of bounds, respawn to center
    if (this.isOutOfBounds()) {
      this.respawnToCenter();
    } else {
      this.mesh.position.y = CONFIG.BALL_RADIUS;
    }
  }
  
  isOutOfBounds() {
    const hw = CONFIG.COURT_WIDTH / 2;
    const hd = CONFIG.COURT_DEPTH / 2;
    const pos = this.mesh.position;
    return (
      Math.abs(pos.x) > hw + 0.5 ||
      Math.abs(pos.z) > hd + 0.5 ||
      pos.y < -0.3 || // Catch balls below floor earlier
      pos.y > 15
    );
  }
  
  respawnToCenter() {
    // Place on center line with slight random Z offset so balls don't stack
    const spread = CONFIG.COURT_DEPTH * 0.6;
    const z = (Math.random() - 0.5) * spread;
    this.mesh.position.set(0, CONFIG.BALL_RADIUS, z);
    this.velocity.set(0, 0, 0);
    this.active = false;
    this.held = false;
    this.holder = null;
    this.team = null;
    this.thrower = null;
    this.trickType = null;
    this.curve = 0;
    this.lifetime = 0;
    this.idleTime = 0;
    this.hasHitGround = false; // Reset ground hit flag
    this._stuckCheckTimer = 0; // Reset stuck detection timer
    this.glowMat.opacity = 0;
    this.mesh.scale.setScalar(1.0); // Reset scale
    this.clearTrail();
    
    // Clean up laser beam
    if (this.laserBeam) {
      this.scene.remove(this.laserBeam);
      this.laserBeam.geometry.dispose();
      this.laserBeam.material.dispose();
      this.laserBeam = null;
    }
    
    // Reset laser ball flag
    this.isLaserBall = false;
    
    // Reset fireball flag
    this.isFireball = false;
    
    // Reset glow scale
    this.glow.scale.setScalar(1);
    
    // Reset material emissive
    this.mesh.material.emissive.setHex(0x000000);
    this.mesh.material.emissiveIntensity = 0;
  }
}
