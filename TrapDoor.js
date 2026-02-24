import * as THREE from 'three';
import { CONFIG } from './config.js';

export class TrapDoor {
  constructor(scene, team, position, targetPlayer) {
    this.scene = scene;
    this.team = team; // Team that activated it
    this.targetPlayer = targetPlayer; // The victim who will fall through
    this.active = true;
    this.triggered = false;
    this.openProgress = 0; // 0 = closed, 1 = fully open
    this.fallDistance = 0; // How far victim has fallen
    this.maxFallDistance = 15; // Distance to fall before respawn
    this.onComplete = null; // Callback when trap door finishes
    
    // Animation phases
    this.phase = 'opening'; // 'opening' -> 'falling' -> 'done'
    this.phaseTime = 0;
    this.openDuration = 0.5; // Time to open doors
    this.fallDuration = 1.5; // Time for fall animation
    
    this.totalLifetime = 0; // Failsafe timer
    this.maxLifetime = 8.0; // Force cleanup after 8 seconds
    
    this.mesh = this.createMesh();
    this.mesh.position.copy(position);
    this.mesh.position.y = 0.01; // Just above ground
    scene.add(this.mesh);
    
    // Freeze the target player immediately
    if (this.targetPlayer) {
      this.targetPlayer.frozen = true;
      this.targetPlayer.frozenTime = 99; // Keep frozen until trap activates
    }
  }
  
  createMesh() {
    const group = new THREE.Group();
    
    // ── Materials ──
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      metalness: 0.0,
    });
    
    const hingeMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.6,
      roughness: 0.4,
    });
    
    // ── Dark pit/hole beneath (visible when doors open) ──
    const doorWidth = 1.8;
    const doorDepth = 1.8;
    const doorThickness = 0.08;
    
    // Create a deep dark hole that covers the floor completely
    const holeMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.DoubleSide,
    });
    const hole = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth * 1.2, doorDepth * 1.2),
      holeMat
    );
    hole.rotation.x = -Math.PI / 2; // Face upward
    hole.position.y = 0.005; // Just slightly above floor to cover it
    hole.renderOrder = -1; // Render behind doors
    group.add(hole);
    
    // Add depth to the hole with dark walls
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const wallHeight = 2.0;
    
    // Four walls of the pit
    const wallNorth = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth * 1.2, wallHeight),
      wallMat
    );
    wallNorth.position.set(0, -wallHeight/2, -doorDepth/2);
    group.add(wallNorth);
    
    const wallSouth = new THREE.Mesh(
      new THREE.PlaneGeometry(doorWidth * 1.2, wallHeight),
      wallMat
    );
    wallSouth.position.set(0, -wallHeight/2, doorDepth/2);
    wallSouth.rotation.y = Math.PI;
    group.add(wallSouth);
    
    const wallEast = new THREE.Mesh(
      new THREE.PlaneGeometry(doorDepth * 1.2, wallHeight),
      wallMat
    );
    wallEast.position.set(doorWidth/2, -wallHeight/2, 0);
    wallEast.rotation.y = Math.PI/2;
    group.add(wallEast);
    
    const wallWest = new THREE.Mesh(
      new THREE.PlaneGeometry(doorDepth * 1.2, wallHeight),
      wallMat
    );
    wallWest.position.set(-doorWidth/2, -wallHeight/2, 0);
    wallWest.rotation.y = -Math.PI/2;
    group.add(wallWest);
    
    // ── Create two door panels (will rotate open) ──
    // Top door - pivots on front edge (negative Z)
    const topDoorPivot = new THREE.Group();
    topDoorPivot.position.set(0, 0, -doorDepth / 2); // Position at front edge
    const topDoorGeo = new THREE.BoxGeometry(doorWidth, doorThickness, doorDepth / 2);
    const topDoor = new THREE.Mesh(topDoorGeo, woodMat);
    topDoor.position.z = doorDepth / 4; // Offset from pivot so hinge is at edge
    topDoor.castShadow = true;
    topDoorPivot.add(topDoor);
    group.add(topDoorPivot);
    this.topDoorPivot = topDoorPivot;
    
    // Bottom door - pivots on back edge (positive Z)
    const bottomDoorPivot = new THREE.Group();
    bottomDoorPivot.position.set(0, 0, doorDepth / 2); // Position at back edge
    const bottomDoorGeo = new THREE.BoxGeometry(doorWidth, doorThickness, doorDepth / 2);
    const bottomDoor = new THREE.Mesh(bottomDoorGeo, woodMat);
    bottomDoor.position.z = -doorDepth / 4; // Offset from pivot so hinge is at edge
    bottomDoor.castShadow = true;
    bottomDoorPivot.add(bottomDoor);
    group.add(bottomDoorPivot);
    this.bottomDoorPivot = bottomDoorPivot;
    
    // ── Hinges ──
    for (let i = 0; i < 2; i++) {
      const x = i === 0 ? doorWidth / 3 : -doorWidth / 3;
      
      // Top hinges (on front edge)
      const topHinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8),
        hingeMat
      );
      topHinge.position.set(x, 0, -doorDepth / 2);
      topHinge.rotation.z = Math.PI / 2;
      group.add(topHinge);
      
      // Bottom hinges (on back edge)
      const bottomHinge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8),
        hingeMat
      );
      bottomHinge.position.set(x, 0, doorDepth / 2);
      bottomHinge.rotation.z = Math.PI / 2;
      group.add(bottomHinge);
    }
    
    // ── Wood planks detail (attached to doors so they rotate with them) ──
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: 0.95 });
    
    // Top door planks (run horizontally across width) - add to topDoorPivot
    for (let i = 0; i < 2; i++) {
      const zLocal = (i - 0.5) * (doorDepth / 8);
      const topPlank = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth * 0.9, doorThickness + 0.01, doorDepth / 10),
        plankMat
      );
      topPlank.position.set(0, doorThickness / 2 + 0.005, doorDepth / 4 + zLocal);
      topDoorPivot.add(topPlank);
    }
    
    // Bottom door planks (run horizontally across width) - add to bottomDoorPivot
    for (let i = 0; i < 2; i++) {
      const zLocal = (i - 0.5) * (doorDepth / 8);
      const bottomPlank = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth * 0.9, doorThickness + 0.01, doorDepth / 10),
        plankMat
      );
      bottomPlank.position.set(0, doorThickness / 2 + 0.005, -doorDepth / 4 + zLocal);
      bottomDoorPivot.add(bottomPlank);
    }
    
    return group;
  }
  
  update(dt) {
    if (!this.active) return;
    
    this.phaseTime += dt;
    this.totalLifetime += dt;
    
    // Failsafe: force cleanup if stuck
    if (this.totalLifetime >= this.maxLifetime) {
      console.warn('TrapDoor failsafe: force cleanup after', this.maxLifetime, 'seconds');
      // Unfreeze target if still frozen by us
      if (this.targetPlayer && this.targetPlayer.frozen && this.targetPlayer.frozenTime >= 90) {
        this.targetPlayer.frozen = false;
        this.targetPlayer.frozenTime = 0;
      }
      this.cleanup();
      return;
    }
    
    if (this.phase === 'opening') {
      // Open the doors
      this.openProgress = Math.min(1, this.phaseTime / this.openDuration);
      const openAngle = this.openProgress * Math.PI / 2; // 90 degrees
      
      // Rotate door pivots around their hinges (X-axis for downward opening like real trap doors)
      // Top door swings forward (negative X rotation)
      this.topDoorPivot.rotation.x = -openAngle;
      // Bottom door swings backward (positive X rotation)
      this.bottomDoorPivot.rotation.x = openAngle;
      
      if (this.openProgress >= 1) {
        this.phase = 'falling';
        this.phaseTime = 0;
        this.triggered = true;
        
        // Use the same launch system as slap shot/hockey stick
        if (this.targetPlayer) {
          this.targetPlayer.frozen = false;
          this.targetPlayer.frozenTime = 0;
          
          // Set downward launch velocity (straight down, no horizontal movement)
          this.targetPlayer._launchVelX = 0;
          this.targetPlayer._launchVelY = -10; // Start falling down
          this.targetPlayer._launchVelZ = 0;
          
          // Mark as launched so Player.update handles the falling
          this.targetPlayer.launchedOffMap = true;
          this.targetPlayer.respawnTimer = 2.0; // 2 second fall
          
          // Drop any held ball (use dropBall() which is the single source of truth)
          if (this.targetPlayer.dropBall) {
            this.targetPlayer.dropBall();
          }
          
          // Deal damage immediately (one ball hit worth = 25 HP)
          this.targetPlayer.hp -= CONFIG.NORMAL_THROW_DAMAGE;
          if (this.targetPlayer.hp <= 0) {
            this.targetPlayer.hp = 0;
          }
          
          // Call completion callback
          if (this.onComplete) {
            this.onComplete();
          }
          
          console.log('Trap door opened, player launched downward');
        }
        
        // Skip to done phase immediately since Player.update handles the falling
        this.phase = 'done';
      }
    } else if (this.phase === 'done') {
      // Fade out and cleanup after a moment
      if (this.phaseTime > 1.0) {
        this.cleanup();
      }
    }
  }
  
  cleanup() {
    this.active = false;
    if (this.mesh) {
      if (this.mesh.parent) {
        this.scene.remove(this.mesh);
      }
      // Dispose all geometry and materials in the group
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
}
