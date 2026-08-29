import * as THREE from 'three';

export class Zombie {
  constructor(type, position, difficultyConfig, scene, audio, particles) {
    this.type = type;
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;

    this.position = position.clone();
    this.height = 1.9;
    this.isDead = false;

    // Stat multipliers by difficulty & type
    const diffHpMult = difficultyConfig.hpMult || 1.0;
    const diffSpeedMult = difficultyConfig.speedMult || 1.0;

    switch (type) {
      case 'runner':
        this.maxHealth = 40 * diffHpMult;
        this.speed = 4.8 * diffSpeedMult;
        this.damage = 12;
        this.attackCooldown = 0.8;
        this.scoreValue = 120;
        break;
      case 'armored':
        this.maxHealth = 180 * diffHpMult;
        this.speed = 2.2 * diffSpeedMult;
        this.damage = 25;
        this.attackCooldown = 1.2;
        this.scoreValue = 250;
        this.isArmored = true;
        break;
      case 'exploder':
        this.maxHealth = 50 * diffHpMult;
        this.speed = 4.0 * diffSpeedMult;
        this.damage = 70; // Explosion damage
        this.attackCooldown = 0.1;
        this.scoreValue = 200;
        this.isExplosive = true;
        break;
      case 'spitter':
        this.maxHealth = 70 * diffHpMult;
        this.speed = 2.8 * diffSpeedMult;
        this.damage = 18;
        this.attackCooldown = 2.5;
        this.scoreValue = 180;
        this.isRanged = true;
        break;
      case 'shambler':
      default:
        this.maxHealth = 80 * diffHpMult;
        this.speed = 3.0 * diffSpeedMult;
        this.damage = 15;
        this.attackCooldown = 1.0;
        this.scoreValue = 100;
        break;
    }

    this.health = this.maxHealth;
    this.lastAttackTime = 0;
    this.lastGrowlTime = Math.random() * 5;

    // Build 3D Mesh
    this.mesh = this.buildMesh();
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  buildMesh() {
    const group = new THREE.Group();

    let bodyColor = 0x3d4538; // Tattered German Feldgrau uniform
    let headColor = 0x5a6352;
    if (this.type === 'runner') bodyColor = 0x1f2226;
    if (this.type === 'armored') bodyColor = 0x22252a;
    if (this.type === 'exploder') bodyColor = 0x6e2727;

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.4),
                                 new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.8 })
    );
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeom = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x6e7864, roughness: 0.9 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.name = 'head';
    head.position.y = 1.7;
    head.castShadow = true;
    group.add(head);

    // Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.type === 'exploder' ? 0xff0000 : 0xffee44 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), eyeMat);
    eyeL.position.set(-0.12, 1.75, 0.22);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    group.add(eyeL);
    group.add(eyeR);

    // Helmet for Shambler & Armored
    if (this.type === 'shambler' || this.type === 'armored') {
      const helmet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.32, 0.18, 8),
                                    new THREE.MeshStandardMaterial({ color: this.type === 'armored' ? 0x111315 : 0x2d3328, metalness: 0.7 })
      );
      helmet.position.y = 1.92;
      group.add(helmet);
    }

    // Steel Chestplate for Armored
    if (this.type === 'armored') {
      const armor = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.95, 0.5),
                                   new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.9, roughness: 0.2 })
      );
      armor.position.y = 1.05;
      group.add(armor);
    }

    // Dynamite vest for Exploder
    if (this.type === 'exploder') {
      const dyn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8),
                                 new THREE.MeshStandardMaterial({ color: 0xcc0000 })
      );
      dyn.rotation.z = Math.PI / 2;
      dyn.position.set(0, 1.05, 0.22);
      group.add(dyn);
    }

    // Legs
    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.8, 0.25),
                                new THREE.MeshStandardMaterial({ color: 0x222522 })
    );
    legL.position.set(-0.18, 0.4, 0);
    const legR = legL.clone();
    legR.position.x = 0.18;
    group.add(legL);
    group.add(legR);

    return group;
  }

  takeDamage(amount, isHeadshot, hitPoint) {
    if (this.isDead) return;

    let dmg = amount;
    if (this.isArmored && !isHeadshot) {
      dmg *= 0.5; // Reduced body damage for armored
    }

    this.health -= dmg;

    // Stagger mesh animation
    this.mesh.position.y += 0.05;
    setTimeout(() => { if (this.mesh) this.mesh.position.y = this.position.y; }, 50);

    if (this.health <= 0) {
      this.die(hitPoint);
    }
  }

  die(hitPoint) {
    this.isDead = true;
    this.audio.playZombieDeath();

    if (this.isExplosive) {
      this.particles.createExplosion(this.position);
      this.audio.playExplosion();
    }

    // Ragdoll / sink into ground
    if (this.mesh) {
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0.2;
      setTimeout(() => {
        this.scene.remove(this.mesh);
      }, 1500);
    }
  }

  horizontalDist(playerPos) {
    const dx = this.mesh.position.x - playerPos.x;
    const dz = this.mesh.position.z - playerPos.z;
    return Math.hypot(dx, dz);
  }

  update(delta, playerPos, now) {
    if (this.isDead || !this.mesh) return;

    // Ground-plane distance. 3D distanceTo() never drops below ~1.8 because
    // the player origin sits at eye height and the zombie mesh sits on y=0.
    const dist = this.horizontalDist(playerPos);

    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

    if (dist > 1.35) {
      const dir = new THREE.Vector3(
        playerPos.x - this.mesh.position.x,
        0,
        playerPos.z - this.mesh.position.z
      );
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
        this.position.copy(this.mesh.position);
      }
    }

    // Ambient growls
    if (now - this.lastGrowlTime > 4.0 + Math.random() * 4) {
      this.lastGrowlTime = now;
      if (dist < 25) {
        this.audio.playZombieGrowl(this.type === 'runner' ? 1.4 : 0.9);
      }
    }

    // Ranged attack for spitter
    if (this.isRanged && dist < 18 && dist > 4) {
      if (now - this.lastAttackTime > this.attackCooldown) {
        this.lastAttackTime = now;
        this.particles.createAcidSpit(this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)), playerPos);
      }
    }

    if (this.isExplosive && dist < 2.2) {
      this.die(this.position);
      return { explode: true, damage: this.damage };
    }

    if (dist <= 2.15 && (now - this.lastAttackTime > this.attackCooldown)) {
      this.lastAttackTime = now;
      return { attack: true, damage: this.damage };
    }

    return null;
  }
}

// ================= BOSS CLASS =================
export class BossZombie {
  constructor(levelNum, scene, audio, particles) {
    this.scene = scene;
    this.audio = audio;
    this.particles = particles;
    this.levelNum = levelNum;
    this.isDead = false;
    this.isBoss = true;

    this.phase = 1;
    this.lastAttackTime = 0;
    this.lastSpecialTime = 0;

    this.initBossStats();

    this.height = 3.8;
    this.mesh = this.buildBossMesh();
    this.mesh.position.set(0, 0, -25);
    this.position = this.mesh.position;
    this.scene.add(this.mesh);
  }

  initBossStats() {
    switch (this.levelNum) {
      case 1:
        this.name = "HAUPTMANN KRIEG - TANK COMMANDER";
        this.maxHealth = 800;
        this.speed = 3.2;
        this.damage = 35;
        this.scoreValue = 2000;
        break;
      case 2:
        this.name = "MORTAR GOLIATH";
        this.maxHealth = 1200;
        this.speed = 2.5;
        this.damage = 45;
        this.scoreValue = 3000;
        break;
      case 3:
        this.name = "HERR DOCTOR - MINIGUN OFFICER";
        this.maxHealth = 1600;
        this.speed = 3.0;
        this.damage = 25; // High rate of fire
        this.scoreValue = 4000;
        break;
      case 4:
      default:
        this.name = "GENERAL SHADOW - OCCULT LICH";
        this.maxHealth = 2200;
        this.speed = 3.8;
        this.damage = 50;
        this.scoreValue = 6000;
        break;
    }
    this.health = this.maxHealth;
  }

  buildBossMesh() {
    const group = new THREE.Group();

    // Scale up 2.2x normal size
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.levelNum === 4 ? 0x2a0833 : 0x1f241d,
      roughness: 0.5,
      metalness: 0.6
    });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 1.0), bodyMat);
    torso.position.y = 2.2;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
                                new THREE.MeshStandardMaterial({ color: 0x4d5746 })
    );
    head.name = 'head';
    head.position.y = 3.6;
    group.add(head);

    // Glowing Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), eyeMat);
    eyeL.position.set(-0.25, 3.7, 0.46);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.25;
    group.add(eyeL);
    group.add(eyeR);

    // Boss specific attachments
    if (this.levelNum === 3) {
      // Minigun arm
      const gun = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 1.8, 12),
                                 new THREE.MeshStandardMaterial({ color: 0x111, metalness: 0.9 })
      );
      gun.rotation.x = Math.PI / 2;
      gun.position.set(1.1, 2.0, 0.8);
      group.add(gun);
    }

    return group;
  }

  takeDamage(amount, isHeadshot, hitPoint) {
    if (this.isDead) return;

    const dmg = isHeadshot ? amount * 2.5 : amount;
    this.health -= dmg;

    // Phase checks at 50% HP
    if (this.health <= this.maxHealth * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.speed *= 1.3; // Enrage speed boost
      this.audio.playZombieGrowl(0.5); // Deep roar
    }

    if (this.health <= 0) {
      this.die();
    }
  }

  die() {
    this.isDead = true;
    this.audio.playExplosion();
    this.particles.createExplosion(this.mesh.position);
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
  }

  update(delta, playerPos, now) {
    if (this.isDead || !this.mesh) return;

    const dx = this.mesh.position.x - playerPos.x;
    const dz = this.mesh.position.z - playerPos.z;
    const dist = Math.hypot(dx, dz);
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

    if (dist > 2.2) {
      const dir = new THREE.Vector3(-dx, 0, -dz);
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
      }
    }

    // Special Boss Attack
    if (now - this.lastSpecialTime > 6.0) {
      this.lastSpecialTime = now;
      if (this.levelNum === 2) {
        // Mortar barrage explosion at player
        this.particles.createExplosion(playerPos);
        return { specialAttack: true, damage: 30, text: "MORTAR BARRAGE IMPACT!" };
      }
    }

    if (dist <= 3.0 && (now - this.lastAttackTime > 1.2)) {
      this.lastAttackTime = now;
      return { attack: true, damage: this.damage };
    }

    return null;
  }
}
