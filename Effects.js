import * as THREE from 'three';
import { CONFIG } from './config.js';

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.flashTimers = { hit: 0, catch: 0 };
    
    // Charge aura system
    this.chargeAura = null;
    this.chargeRings = [];
    this.chargeParticles = [];
    this.chargeLevel = 0;
    this.chargeTime = 0;
    this.prevChargeTier = -1;
    
    // Camera shake
    this.shakeIntensity = 0;
    this.shakeDecay = 6;
    
    this.initChargeAura();
  }
  
  // ─── Charge Aura System ──────────────────────────────────
  initChargeAura() {
    this.chargeAuraGroup = new THREE.Group();
    this.chargeAuraGroup.visible = false;
    this.scene.add(this.chargeAuraGroup);
    
    // Inner ring — fast spinning, tight orbit
    const innerRingGeo = new THREE.TorusGeometry(0.7, 0.04, 8, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xe040fb,
      transparent: true,
      opacity: 0,
    });
    this.chargeInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.chargeInnerRing.rotation.x = Math.PI / 2;
    this.chargeAuraGroup.add(this.chargeInnerRing);
    
    // Outer ring — slower, wider
    const outerRingGeo = new THREE.TorusGeometry(1.1, 0.03, 8, 40);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x7c4dff,
      transparent: true,
      opacity: 0,
    });
    this.chargeOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.chargeOuterRing.rotation.x = Math.PI / 2;
    this.chargeAuraGroup.add(this.chargeOuterRing);
    
    // Ground glow disc
    const glowGeo = new THREE.CircleGeometry(1.2, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xe040fb,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.chargeGroundGlow = new THREE.Mesh(glowGeo, glowMat);
    this.chargeGroundGlow.rotation.x = -Math.PI / 2;
    this.chargeGroundGlow.position.y = 0.03;
    this.chargeAuraGroup.add(this.chargeGroundGlow);
    
    // Vertical energy column (cylinder wireframe)
    const columnGeo = new THREE.CylinderGeometry(0.5, 0.8, 3, 12, 1, true);
    const columnMat = new THREE.MeshBasicMaterial({
      color: 0xe040fb,
      transparent: true,
      opacity: 0,
      wireframe: true,
      side: THREE.DoubleSide,
    });
    this.chargeColumn = new THREE.Mesh(columnGeo, columnMat);
    this.chargeColumn.position.y = 1.5;
    this.chargeAuraGroup.add(this.chargeColumn);
  }
  
  getChargeTier(charge) {
    if (charge >= CONFIG.TRICKS.METEOR.charge) return 4;
    if (charge >= CONFIG.TRICKS.LIGHTNING.charge) return 3;
    if (charge >= CONFIG.TRICKS.FIREBALL.charge) return 2;
    if (charge >= CONFIG.TRICKS.CURVE.charge) return 1;
    return 0;
  }
  
  getChargeColor(tier) {
    switch (tier) {
      case 1: return { primary: 0x00ff88, secondary: 0x00cc66, name: 'CURVEBALL' };
      case 2: return { primary: 0xff6600, secondary: 0xffcc00, name: 'FIREBALL' };
      case 3: return { primary: 0x00ccff, secondary: 0x0088ff, name: 'LIGHTNING' };
      case 4: return { primary: 0xff0044, secondary: 0xff6600, name: 'METEOR' };
      default: return { primary: 0xe040fb, secondary: 0x7c4dff, name: '' };
    }
  }
  
  updateChargeAura(playerPos, charge, dt) {
    this.chargeTime += dt;
    this.chargeLevel = charge;
    const tier = this.getChargeTier(charge);
    const colors = this.getChargeColor(tier);
    const chargeT = charge / 100;
    
    if (charge < 5) {
      this.chargeAuraGroup.visible = false;
      this.prevChargeTier = -1;
      // Update vignette
      this.updateChargeVignette(0, 0);
      return;
    }
    
    this.chargeAuraGroup.visible = true;
    this.chargeAuraGroup.position.copy(playerPos);
    
    // Tier-up flash effect
    if (tier > this.prevChargeTier && this.prevChargeTier >= 0) {
      this.spawnTierUpEffect(playerPos, colors);
    }
    this.prevChargeTier = tier;
    
    const t = this.chargeTime;
    const pulse = 0.8 + Math.sin(t * 4) * 0.2;
    
    // Inner ring — spins fast, scales with charge
    this.chargeInnerRing.rotation.z = t * 4;
    this.chargeInnerRing.scale.setScalar(0.8 + chargeT * 0.4);
    this.chargeInnerRing.material.opacity = chargeT * 0.6 * pulse;
    this.chargeInnerRing.material.color.setHex(colors.primary);
    this.chargeInnerRing.position.y = 0.1 + Math.sin(t * 3) * 0.1;
    
    // Outer ring — counter-rotates, wobbles
    this.chargeOuterRing.rotation.z = -t * 2.5;
    this.chargeOuterRing.rotation.x = Math.PI / 2 + Math.sin(t * 1.5) * 0.15 * chargeT;
    this.chargeOuterRing.scale.setScalar(0.9 + chargeT * 0.5);
    this.chargeOuterRing.material.opacity = chargeT * 0.45 * pulse;
    this.chargeOuterRing.material.color.setHex(colors.secondary);
    this.chargeOuterRing.position.y = 0.15 + Math.sin(t * 2 + 1) * 0.1;
    
    // Ground glow — pulses and grows
    this.chargeGroundGlow.material.opacity = chargeT * 0.25 * pulse;
    this.chargeGroundGlow.material.color.setHex(colors.primary);
    this.chargeGroundGlow.scale.setScalar(0.8 + chargeT * 0.8 + Math.sin(t * 5) * 0.05);
    this.chargeGroundGlow.rotation.z = t * 0.5;
    
    // Energy column — only appears at higher charges
    if (chargeT > 0.3) {
      const columnT = (chargeT - 0.3) / 0.7;
      this.chargeColumn.material.opacity = columnT * 0.2 * pulse;
      this.chargeColumn.material.color.setHex(colors.primary);
      this.chargeColumn.rotation.y = t * 2;
      this.chargeColumn.scale.set(1, 0.5 + columnT * 0.5, 1);
    } else {
      this.chargeColumn.material.opacity = 0;
    }
    
    // Spawn rising charge particles
    const particleRate = 1 + chargeT * 8;
    if (Math.random() < particleRate * dt) {
      this.spawnChargeParticle(playerPos, colors, chargeT);
    }
    
    // At high charge, spawn energy sparks around the body
    if (chargeT > 0.5 && Math.random() < chargeT * 4 * dt) {
      this.spawnChargeSpark(playerPos, colors, chargeT);
    }
    
    // Update vignette
    this.updateChargeVignette(chargeT, tier);
  }
  
  spawnChargeParticle(position, colors, chargeT) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.4 + Math.random() * 0.8;
    const size = 0.03 + Math.random() * 0.05 + chargeT * 0.04;
    
    const geo = new THREE.SphereGeometry(size, 4, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.4 ? colors.primary : colors.secondary,
      transparent: true,
      opacity: 0.8,
    });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(
      position.x + Math.cos(angle) * radius,
      position.y + 0.1,
      position.z + Math.sin(angle) * radius
    );
    
    p.userData = {
      vel: new THREE.Vector3(
        Math.cos(angle) * 0.3,
        2 + Math.random() * 3 + chargeT * 2,
        Math.sin(angle) * 0.3
      ),
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.4 + Math.random() * 0.4,
      gravity: -1,
      type: 'chargeParticle',
      spiralAngle: angle,
      spiralSpeed: 3 + Math.random() * 3,
      spiralRadius: radius * 0.5,
    };
    
    this.scene.add(p);
    this.particles.push(p);
  }
  
  spawnChargeSpark(position, colors, chargeT) {
    const points = [];
    let x = position.x + (Math.random() - 0.5) * 1.2;
    let y = position.y + 0.5 + Math.random() * 1.5;
    let z = position.z + (Math.random() - 0.5) * 1.2;
    
    for (let j = 0; j < 4; j++) {
      points.push(new THREE.Vector3(x, y, z));
      x += (Math.random() - 0.5) * 0.4;
      y += (Math.random() - 0.5) * 0.3;
      z += (Math.random() - 0.5) * 0.4;
    }
    
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: colors.primary,
      transparent: true,
      opacity: 0.9,
    });
    const line = new THREE.Line(geo, mat);
    line.userData = {
      life: 0.08 + Math.random() * 0.08,
      maxLife: 0.08 + Math.random() * 0.08,
      type: 'line',
    };
    this.scene.add(line);
    this.particles.push(line);
  }
  
  spawnTierUpEffect(position, colors) {
    // Burst ring on tier upgrade
    const ringGeo = new THREE.RingGeometry(0.2, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: colors.primary,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.position.y = 1.0;
    ring.rotation.x = -Math.PI / 2;
    ring.userData = {
      life: 0.5,
      maxLife: 0.5,
      type: 'tierUpRing',
    };
    this.scene.add(ring);
    this.particles.push(ring);
    
    // Burst particles
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 4;
      const size = 0.04 + Math.random() * 0.06;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? colors.primary : colors.secondary,
        transparent: true,
        opacity: 1,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      p.position.y = 1.0;
      p.userData = {
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          1 + Math.random() * 3,
          Math.sin(angle) * speed
        ),
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.3 + Math.random() * 0.2,
        gravity: -8,
      };
      this.scene.add(p);
      this.particles.push(p);
    }
    
    // Flash vignette briefly
    const el = document.getElementById('charge-flash');
    if (el) {
      const colorStr = '#' + colors.primary.toString(16).padStart(6, '0');
      el.style.background = `radial-gradient(ellipse at center, ${colorStr}44, transparent 70%)`;
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 200);
    }
  }
  
  updateChargeVignette(chargeT, tier) {
    const el = document.getElementById('charge-vignette');
    if (!el) return;
    
    if (chargeT < 0.05) {
      el.style.opacity = '0';
      return;
    }
    
    const colors = this.getChargeColor(tier);
    const colorStr = '#' + colors.primary.toString(16).padStart(6, '0');
    const intensity = chargeT * 0.4;
    const pulse = 0.7 + Math.sin(this.chargeTime * 3) * 0.3;
    
    el.style.background = `radial-gradient(ellipse at center, transparent 40%, ${colorStr}${Math.round(intensity * pulse * 99).toString(16).padStart(2, '0')} 100%)`;
    el.style.opacity = '1';
  }
  
  // ─── Trick Throw Release Explosion ──────────────────────
  spawnTrickReleaseEffect(position, trickType) {
    if (!trickType) return;
    
    const color = trickType.color;
    const tier = this.getChargeTier(trickType.charge);
    
    // Big central flash
    const flashGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const flashMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    flash.position.y = 1.2;
    flash.userData = {
      life: 0.25,
      maxLife: 0.25,
      type: 'trickFlash',
    };
    this.scene.add(flash);
    this.particles.push(flash);
    
    // Expanding shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.position.y = 1.0;
    ring.rotation.x = -Math.PI / 2;
    ring.userData = {
      life: 0.4,
      maxLife: 0.4,
      type: 'trickShockwave',
    };
    this.scene.add(ring);
    this.particles.push(ring);
    
    // Directional burst particles
    const burstCount = 15 + tier * 10;
    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI / 2.5;
      const speed = 4 + Math.random() * 8;
      const size = 0.04 + Math.random() * 0.07;
      
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const colorVar = Math.random() > 0.6 ? 0xffffff : color;
      const mat = new THREE.MeshBasicMaterial({
        color: colorVar,
        transparent: true,
        opacity: 1,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      p.position.y = 1.2;
      
      p.userData = {
        vel: new THREE.Vector3(
          Math.cos(angle) * Math.cos(upAngle) * speed,
          Math.sin(upAngle) * speed + 1,
          Math.sin(angle) * Math.cos(upAngle) * speed
        ),
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.3 + Math.random() * 0.3,
        gravity: -10,
      };
      
      this.scene.add(p);
      this.particles.push(p);
    }
    
    // Lightning arcs for Lightning+ tier
    if (tier >= 3) {
      for (let i = 0; i < 6; i++) {
        this.spawnChargeSpark(position, { primary: color, secondary: 0xffffff }, 1.0);
      }
    }
    
    // Camera shake based on tier
    this.triggerShake(0.02 + tier * 0.015);
  }
  
  // ─── Power Burst Effect (for high-power non-trick throws) ──────────────
  spawnPowerBurst(position) {
    const color = 0xff3300; // Red-orange for power
    
    // Central flash
    const flashGeo = new THREE.SphereGeometry(0.4, 12, 12);
    const flashMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    flash.userData = { life: 0.25, maxLife: 0.25, type: 'powerFlash' };
    this.scene.add(flash);
    this.particles.push(flash);
    
    // Expanding ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.lookAt(position.x, position.y + 1, position.z);
    ring.userData = { life: 0.35, maxLife: 0.35, type: 'powerRing', expandSpeed: 8 };
    this.scene.add(ring);
    this.particles.push(ring);
    
    // Radial sparks (fewer than trick throws)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = 3 + Math.random() * 2;
      const sparkGeo = new THREE.SphereGeometry(0.08, 4, 4);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8,
      });
      const spark = new THREE.Mesh(sparkGeo, sparkMat);
      spark.position.copy(position);
      spark.userData = {
        life: 0.3,
        maxLife: 0.3,
        type: 'powerSpark',
        vx: Math.cos(angle) * speed,
        vy: (Math.random() - 0.3) * 2,
        vz: Math.sin(angle) * speed,
      };
      this.scene.add(spark);
      this.particles.push(spark);
    }
  }
  
  // ─── Camera Shake ────────────────────────────────────────
  triggerShake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }
  
  getShakeOffset() {
    if (this.shakeIntensity < 0.001) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * this.shakeIntensity * 2,
      y: (Math.random() - 0.5) * this.shakeIntensity * 2,
    };
  }
  
  // ─── Ball Charge Glow ────────────────────────────────────
  updateBallChargeGlow(ball, charge) {
    if (!ball || !ball.mesh) return;
    const tier = this.getChargeTier(charge);
    const chargeT = charge / 100;
    
    if (charge < 5) {
      ball.glowMat.opacity = 0;
      // Reset ball material emission
      if (ball.mesh.material && ball.mesh.material.emissive) {
        ball.mesh.material.emissiveIntensity = 0;
      }
      return;
    }
    
    const colors = this.getChargeColor(tier);
    const pulse = 0.6 + Math.sin(this.chargeTime * 6) * 0.4;
    
    ball.glowMat.color.setHex(colors.primary);
    ball.glowMat.opacity = chargeT * 0.8 * pulse;
    ball.glow.rotation.z = this.chargeTime * 5;
    ball.glow.scale.setScalar(1 + chargeT * 0.5);
    
    // Make ball mesh glow with emissive
    if (ball.mesh.material && ball.mesh.material.emissive) {
      ball.mesh.material.emissive.setHex(colors.primary);
      ball.mesh.material.emissiveIntensity = chargeT * 0.5 * pulse;
    }
  }
  
  // ─── Landing Impact Effect ─────────────────────────────────
  // Dust cloud + ground shockwave + radial debris on throw flip landing
  spawnLandingImpact(position, peakHeight) {
    // Normalize intensity: peakHeight typically 1.5–2.5, map to 0.3–1.0
    const intensity = Math.min(1, Math.max(0.2, (peakHeight - 0.5) / 2.0));
    
    // ── Ground shockwave ring ──
    const ringGeo = new THREE.RingGeometry(0.15, 0.4, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd180,
      transparent: true,
      opacity: 0.7 * intensity,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(position.x, 0.04, position.z);
    ring.rotation.x = -Math.PI / 2;
    ring.userData = {
      life: 0.4 + intensity * 0.2,
      maxLife: 0.4 + intensity * 0.2,
      type: 'landingShockwave',
      expandSpeed: 4 + intensity * 6,
    };
    this.scene.add(ring);
    this.particles.push(ring);
    
    // ── Secondary darker ring (slight delay feel) ──
    const ring2Geo = new THREE.RingGeometry(0.1, 0.25, 24);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xffab40,
      transparent: true,
      opacity: 0.5 * intensity,
      side: THREE.DoubleSide,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.set(position.x, 0.035, position.z);
    ring2.rotation.x = -Math.PI / 2;
    ring2.userData = {
      life: 0.35 + intensity * 0.15,
      maxLife: 0.35 + intensity * 0.15,
      type: 'landingShockwave',
      expandSpeed: 3 + intensity * 4,
    };
    this.scene.add(ring2);
    this.particles.push(ring2);
    
    // ── Ground dust glow (flash disc) ──
    const glowGeo = new THREE.CircleGeometry(0.6, 20);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffe0b2,
      transparent: true,
      opacity: 0.5 * intensity,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(position.x, 0.03, position.z);
    glow.rotation.x = -Math.PI / 2;
    glow.userData = {
      life: 0.25,
      maxLife: 0.25,
      type: 'landingGlow',
    };
    this.scene.add(glow);
    this.particles.push(glow);
    
    // ── Dust cloud particles (billow outward) ──
    const dustCount = Math.floor(8 + intensity * 16);
    for (let i = 0; i < dustCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1.5 + Math.random() * 3) * intensity;
      const size = 0.06 + Math.random() * 0.1 + intensity * 0.05;
      
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const dustColor = Math.random() > 0.5 ? 0xd4a056 : 0xbcaaa4;
      const mat = new THREE.MeshBasicMaterial({
        color: dustColor,
        transparent: true,
        opacity: 0.5 + Math.random() * 0.3,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        position.x + Math.cos(angle) * 0.2,
        0.05 + Math.random() * 0.15,
        position.z + Math.sin(angle) * 0.2
      );
      
      p.userData = {
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          0.5 + Math.random() * 1.5 * intensity,
          Math.sin(angle) * speed
        ),
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.3 + Math.random() * 0.35,
        gravity: -3,
        type: 'dust',
      };
      
      this.scene.add(p);
      this.particles.push(p);
    }
    
    // ── Floor crack lines (radial debris — only at high intensity) ──
    if (intensity > 0.5) {
      const lineCount = Math.floor(4 + intensity * 6);
      for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const len = 0.4 + Math.random() * 0.8 * intensity;
        const points = [
          new THREE.Vector3(position.x, 0.04, position.z),
          new THREE.Vector3(
            position.x + Math.cos(angle) * len * 0.5,
            0.04,
            position.z + Math.sin(angle) * len * 0.5
          ),
          new THREE.Vector3(
            position.x + Math.cos(angle + (Math.random() - 0.5) * 0.3) * len,
            0.04,
            position.z + Math.sin(angle + (Math.random() - 0.5) * 0.3) * len
          ),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: 0xffcc80,
          transparent: true,
          opacity: 0.7 * intensity,
        });
        const line = new THREE.Line(geo, mat);
        line.userData = {
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.3 + Math.random() * 0.2,
          type: 'line',
        };
        this.scene.add(line);
        this.particles.push(line);
      }
    }
    
    // Camera shake proportional to flip height
    const shakeAmount = CONFIG.FLIP_LANDING_SHAKE_MIN + 
      intensity * (CONFIG.FLIP_LANDING_SHAKE_MAX - CONFIG.FLIP_LANDING_SHAKE_MIN);
    this.triggerShake(shakeAmount);
  }
  
  spawnHitSparks(position, color = 0xff8800, count = 15) {
    for (let i = 0; i < count; i++) {
      const size = 0.04 + Math.random() * 0.08;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      
      const angle = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI / 3;
      const speed = 3 + Math.random() * 6;
      
      p.userData = {
        vel: new THREE.Vector3(
          Math.cos(angle) * Math.cos(upAngle) * speed,
          Math.sin(upAngle) * speed + 2,
          Math.sin(angle) * Math.cos(upAngle) * speed
        ),
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.3 + Math.random() * 0.3,
        gravity: -15,
      };
      
      this.scene.add(p);
      this.particles.push(p);
    }
  }
  
  spawnCatchShield(position) {
    // Shield hexagon
    const shieldGeo = new THREE.CircleGeometry(1.2, 6);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.copy(position);
    shield.position.y = 1;
    shield.lookAt(new THREE.Vector3(0, shield.position.y, shield.position.z > 0 ? shield.position.z + 1 : shield.position.z - 1));
    
    shield.userData = {
      life: 0.4,
      maxLife: 0.4,
      type: 'shield',
    };
    
    this.scene.add(shield);
    this.particles.push(shield);
    
    // Shield ring
    const ringGeo = new THREE.RingGeometry(0.8, 1.3, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(shield.position);
    ring.quaternion.copy(shield.quaternion);
    ring.userData = {
      life: 0.4,
      maxLife: 0.4,
      type: 'shieldRing',
    };
    this.scene.add(ring);
    this.particles.push(ring);
  }
  
  spawnFireTrail(position) {
    for (let i = 0; i < 5; i++) {
      const size = 0.1 + Math.random() * 0.15;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0xff6600 : 0xffcc00,
        transparent: true,
        opacity: 0.8,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      p.position.x += (Math.random() - 0.5) * 0.2;
      p.position.z += (Math.random() - 0.5) * 0.2;
      
      p.userData = {
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2),
        life: 0.15 + Math.random() * 0.2,
        maxLife: 0.15 + Math.random() * 0.2,
        gravity: -5,
      };
      
      this.scene.add(p);
      this.particles.push(p);
    }
  }
  
  spawnLightning(position) {
    for (let i = 0; i < 3; i++) {
      const points = [];
      let x = position.x, y = position.y, z = position.z;
      for (let j = 0; j < 5; j++) {
        points.push(new THREE.Vector3(x, y, z));
        x += (Math.random() - 0.5) * 0.8;
        y += (Math.random() - 0.5) * 0.5;
        z += (Math.random() - 0.5) * 0.8;
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: 0x00ccff,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.Line(geo, mat);
      line.userData = {
        life: 0.1 + Math.random() * 0.1,
        maxLife: 0.1 + Math.random() * 0.1,
        type: 'line',
      };
      this.scene.add(line);
      this.particles.push(line);
    }
  }
  
  // ─── Dodge Afterimage Trail ─────────────────────────────────
  // Cyan/purple ghost silhouettes that linger along the dodge path
  spawnDodgeTrail(position, style, progress) {
    // Afterimage ghost orb
    const size = 0.15 + Math.random() * 0.12;
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const color = Math.random() > 0.5 ? 0x00e5ff : 0x7c4dff;
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.55,
    });
    const ghost = new THREE.Mesh(geo, mat);
    ghost.position.set(
      position.x + (Math.random() - 0.5) * 0.5,
      position.y + 0.5 + Math.random() * 1.2,
      position.z + (Math.random() - 0.5) * 0.5
    );
    ghost.userData = {
      life: 0.25 + Math.random() * 0.15,
      maxLife: 0.25 + Math.random() * 0.15,
      type: 'dodgeGhost',
    };
    this.scene.add(ghost);
    this.particles.push(ghost);
    
    // Speed lines (motion blur streaks)
    if (Math.random() < 0.5) {
      const lineLen = 0.5 + Math.random() * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const points = [
        new THREE.Vector3(position.x, position.y + 0.3 + Math.random() * 1.4, position.z),
        new THREE.Vector3(
          position.x + Math.cos(angle) * lineLen,
          position.y + 0.3 + Math.random() * 1.4,
          position.z + Math.sin(angle) * lineLen
        ),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.6,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.userData = {
        life: 0.12 + Math.random() * 0.08,
        maxLife: 0.12 + Math.random() * 0.08,
        type: 'line',
      };
      this.scene.add(line);
      this.particles.push(line);
    }
  }
  
  // Dodge launch burst (initial explosion of particles)
  spawnDodgeBurst(position) {
    // Expanding ring at feet
    const ringGeo = new THREE.RingGeometry(0.2, 0.5, 20);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(position.x, 0.05, position.z);
    ring.rotation.x = -Math.PI / 2;
    ring.userData = {
      life: 0.35,
      maxLife: 0.35,
      type: 'shockwave',
    };
    this.scene.add(ring);
    this.particles.push(ring);
    
    // Burst particles
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      const size = 0.04 + Math.random() * 0.06;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.4 ? 0x00e5ff : 0x7c4dff,
        transparent: true,
        opacity: 0.9,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(position.x, 0.2, position.z);
      p.userData = {
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          1.5 + Math.random() * 2,
          Math.sin(angle) * speed
        ),
        life: 0.25 + Math.random() * 0.15,
        maxLife: 0.25 + Math.random() * 0.15,
        gravity: -8,
      };
      this.scene.add(p);
      this.particles.push(p);
    }
    
    this.triggerShake(0.04);
  }
  
  spawnKOEffect(position) {
    // Big explosion
    this.spawnHitSparks(position, 0xff4444, 30);
    this.spawnHitSparks(position, 0xffcc00, 20);
    
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;
    ring.userData = {
      life: 0.5,
      maxLife: 0.5,
      type: 'shockwave',
    };
    this.scene.add(ring);
    this.particles.push(ring);
  }
  
  flashHit() {
    this.flashTimers.hit = 0.15;
    const el = document.getElementById('hit-flash');
    if (el) {
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 150);
    }
  }
  
  flashCatch() {
    this.flashTimers.catch = 0.15;
    const el = document.getElementById('catch-flash');
    if (el) {
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 150);
    }
  }
  
  // ─── Deflect Effects ────────────────────────────────────
  spawnDeflectBurst(impactPos, playerCenter) {
    // Orange/gold spark explosion at impact point
    const burstDir = impactPos.clone().sub(playerCenter).normalize();
    
    for (let i = 0; i < 18; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const colors = [0xffab00, 0xff6d00, 0xffd600, 0xffffff];
      const mat = new THREE.MeshBasicMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        transparent: true,
        opacity: 1,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(impactPos);
      
      // Sparks spray outward from impact, biased in deflect direction
      const angle = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI / 3;
      const speed = 4 + Math.random() * 8;
      
      p.userData = {
        vel: new THREE.Vector3(
          burstDir.x * speed * 0.5 + Math.cos(angle) * Math.cos(upAngle) * speed * 0.7,
          Math.sin(upAngle) * speed * 0.6 + 3,
          burstDir.z * speed * 0.5 + Math.sin(angle) * Math.cos(upAngle) * speed * 0.7
        ),
        life: 0.25 + Math.random() * 0.3,
        maxLife: 0.25 + Math.random() * 0.3,
        gravity: -18,
      };
      
      this.scene.add(p);
      this.particles.push(p);
    }
    
    // Expanding shockwave ring at impact
    const ringGeo = new THREE.RingGeometry(0.2, 0.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffab00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(impactPos);
    ring.lookAt(playerCenter);
    ring.userData = {
      life: 0.35,
      maxLife: 0.35,
      type: 'deflectRing',
    };
    this.scene.add(ring);
    this.particles.push(ring);
  }
  
  flashDeflect() {
    const el = document.getElementById('deflect-flash');
    if (el) {
      el.style.opacity = '1';
      setTimeout(() => { el.style.opacity = '0'; }, 180);
    }
  }
  
  showKOPopup() {
    const popup = document.createElement('div');
    popup.className = 'ko-popup';
    popup.textContent = 'K.O.!';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 900);
  }
  
  update(dt) {
    // Decay camera shake
    this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      const t = p.userData.life / p.userData.maxLife;
      
      if (p.userData.type === 'shield') {
        p.material.opacity = t * 0.5;
        p.scale.setScalar(1 + (1 - t) * 0.3);
      } else if (p.userData.type === 'shieldRing') {
        p.material.opacity = t * 0.6;
        p.scale.setScalar(1 + (1 - t) * 0.5);
        p.rotation.z += dt * 3;
      } else if (p.userData.type === 'deflectRing') {
        p.scale.setScalar(1 + (1 - t) * 4);
        p.material.opacity = t * 0.8;
        p.rotation.z += dt * 6;
      } else if (p.userData.type === 'shockwave') {
        p.scale.setScalar(1 + (1 - t) * 8);
        p.material.opacity = t * 0.8;
      } else if (p.userData.type === 'tierUpRing') {
        p.scale.setScalar(1 + (1 - t) * 5);
        p.material.opacity = t * 0.9;
      } else if (p.userData.type === 'trickFlash') {
        p.scale.setScalar(1 + (1 - t) * 3);
        p.material.opacity = t * 0.9;
      } else if (p.userData.type === 'trickShockwave') {
        p.scale.setScalar(1 + (1 - t) * 6);
        p.material.opacity = t * 0.8;
      } else if (p.userData.type === 'powerFlash') {
        p.scale.setScalar(1 + (1 - t) * 2.5);
        p.material.opacity = t * 0.9;
      } else if (p.userData.type === 'powerRing') {
        const expandSpeed = p.userData.expandSpeed || 8;
        p.scale.setScalar(1 + (1 - t) * expandSpeed);
        p.material.opacity = t * 0.7;
        p.rotation.z += dt * 5;
      } else if (p.userData.type === 'powerSpark') {
        if (p.userData.vx !== undefined) {
          p.position.x += p.userData.vx * dt;
          p.position.y += p.userData.vy * dt;
          p.position.z += p.userData.vz * dt;
          p.userData.vy -= 12 * dt; // gravity
        }
        p.material.opacity = t * 0.8;
        p.scale.setScalar(t);
      } else if (p.userData.type === 'landingShockwave') {
        const expandSpeed = p.userData.expandSpeed || 5;
        p.scale.setScalar(1 + (1 - t) * expandSpeed);
        p.material.opacity = t * t * 0.7; // quadratic fade for quick vanish
      } else if (p.userData.type === 'landingGlow') {
        p.scale.setScalar(1 + (1 - t) * 2.5);
        p.material.opacity = t * t * 0.5;
      } else if (p.userData.type === 'dust') {
        p.userData.vel.y += (p.userData.gravity || -3) * dt;
        p.userData.vel.x *= 0.97; // drag
        p.userData.vel.z *= 0.97;
        p.position.add(p.userData.vel.clone().multiplyScalar(dt));
        // Keep dust above ground
        if (p.position.y < 0.02) {
          p.position.y = 0.02;
          p.userData.vel.y = 0;
          p.userData.vel.x *= 0.85;
          p.userData.vel.z *= 0.85;
        }
        p.material.opacity = t * 0.6;
        p.scale.setScalar(0.8 + (1 - t) * 0.8); // dust expands as it fades
      } else if (p.userData.type === 'dodgeGhost') {
        // Afterimage fades and scales down
        p.material.opacity = t * t * 0.55;
        p.scale.setScalar(0.6 + t * 0.5);
        // Slight upward drift
        p.position.y += 0.5 * dt;
      } else if (p.userData.type === 'chargeParticle') {
        // Spiral upward motion
        if (p.userData.spiralAngle !== undefined) {
          p.userData.spiralAngle += p.userData.spiralSpeed * dt;
          const spiralR = p.userData.spiralRadius * t;
        }
        p.userData.vel.y += (p.userData.gravity || -1) * dt;
        p.position.add(p.userData.vel.clone().multiplyScalar(dt));
        p.material.opacity = t * 0.9;
        p.scale.setScalar(0.5 + t * 0.5);
      } else if (p.userData.type === 'line') {
        p.material.opacity = t * 0.8;
      } else if (p.userData.vel) {
        p.userData.vel.y += (p.userData.gravity || -15) * dt;
        p.position.add(p.userData.vel.clone().multiplyScalar(dt));
        p.material.opacity = t;
        p.scale.setScalar(t);
      }
      
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        if (p.geometry) p.geometry.dispose();
        if (p.material) p.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}
