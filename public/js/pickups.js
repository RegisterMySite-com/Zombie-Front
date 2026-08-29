import * as THREE from 'three';

export class PickupManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audio = audioEngine;
    this.pickups = [];
  }

  spawnDrop(position) {
    if (Math.random() > 0.4) return;
    const rand = Math.random();
    let type = 'ammo';
    if (rand < 0.45) type = 'ammo';
    else if (rand < 0.75) type = 'health';
    else if (rand < 0.88) type = 'armor';
    else {
      const pRand = Math.random();
      if (pRand < 0.35) type = 'doubleDamage';
      else if (pRand < 0.7) type = 'instaKill';
      else if (pRand < 0.9) type = 'speedBoost';
      else type = 'nuke';
    }
    this.createPickup(type, position);
  }

  createPickup(type, position) {
    const group = new THREE.Group();
    let color = 0xffee66;
    let geom = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    switch (type) {
      case 'health': color = 0xff3333; geom = new THREE.BoxGeometry(0.5, 0.5, 0.5); break;
      case 'armor': color = 0x339af0; geom = new THREE.BoxGeometry(0.6, 0.6, 0.15); break;
      case 'doubleDamage': color = 0xff922b; geom = new THREE.OctahedronGeometry(0.4); break;
      case 'instaKill': color = 0xf03e3e; geom = new THREE.OctahedronGeometry(0.4); break;
      case 'speedBoost': color = 0x51cf66; geom = new THREE.OctahedronGeometry(0.4); break;
      case 'nuke': color = 0xffd43b; geom = new THREE.DodecahedronGeometry(0.45); break;
    }
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.2 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    group.add(mesh);
    const light = new THREE.PointLight(color, 2, 4);
    group.add(light);
    group.position.copy(position);
    group.position.y = 0.6;
    this.scene.add(group);
    this.pickups.push({ type, group, light, life: 0, maxLife: 25.0 });
  }

  update(delta, playerPos, player, weaponManager) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life += delta;
      if (p.life >= p.maxLife) { this.removePickup(i); continue; }
      p.group.rotation.y += delta * 2.0;
      p.group.position.y = 0.6 + Math.sin(p.life * 4.0) * 0.15;
      const dist = p.group.position.distanceTo(playerPos);
      if (dist < 4.0) {
        const dir = playerPos.clone().sub(p.group.position).normalize();
        p.group.position.add(dir.multiplyScalar(delta * 6.0));
      }
      if (dist <= 1.4) {
        this.applyPickup(p.type, player, weaponManager);
        this.audio.playPickup();
        this.removePickup(i);
      }
    }
  }

  applyPickup(type, player, weaponManager) {
    let msg = '';
    switch (type) {
      case 'ammo': weaponManager.addAmmo(40); msg = 'AMMO CRATE COLLECTED! (+40 AMMO)'; break;
      case 'health': player.heal(35); msg = 'MEDKIT USED! (+35 HEALTH)'; break;
      case 'armor': player.addArmor(50); msg = 'BODY ARMOR EQUIPPED! (+50 ARMOR)'; break;
      case 'doubleDamage': player.activatePowerup('doubleDamage', 20); msg = 'DOUBLE DAMAGE ACTIVATED (20s)!'; break;
      case 'instaKill': player.activatePowerup('instaKill', 15); msg = 'INSTA-KILL ACTIVATED (15s)!'; break;
      case 'speedBoost': player.activatePowerup('speedBoost', 15); msg = 'SPEED DEMON ACTIVATED (15s)!'; break;
      case 'nuke': player.triggerNuke = true; msg = 'NUKE CLEARED THE SECTOR!'; break;
    }
    if (window.hud) window.hud.showNotification(msg);
  }

  removePickup(index) {
    const p = this.pickups[index];
    if (p && p.group) this.scene.remove(p.group);
    this.pickups.splice(index, 1);
  }

  clearAll() {
    this.pickups.forEach(p => this.scene.remove(p.group));
    this.pickups = [];
  }
}
