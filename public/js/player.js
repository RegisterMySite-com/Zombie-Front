import * as THREE from 'three';

export class Player {
  constructor(camera, scene, audioEngine) {
    this.camera = camera;
    this.scene = scene;
    this.audio = audioEngine;
    this.position = new THREE.Vector3(0, 1.8, 0);
    this.velocity = new THREE.Vector3();
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.maxHealth = 100;
    this.health = 100;
    this.maxArmor = 100;
    this.armor = 0;
    this.isDead = false;
    this.walkSpeed = 6.0;
    this.sprintSpeed = 9.5;
    this.crouchSpeed = 3.5;
    this.jumpForce = 7.0;
    this.stamina = 100;
    this.maxStamina = 100;
    this.isSprinting = false;
    this.isCrouching = false;
    this.isGrounded = true;
    this.isThirdPerson = false;
    this.powerups = { doubleDamage: 0, instaKill: 0, speedBoost: 0 };
    this.triggerNuke = false;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.upgradePoints = 0;
    this.upgrades = { damageTier: 0, healthTier: 0, reloadTier: 0, ammoTier: 0, hasArmor: false };
    this.bobTime = 0;
    this.hitCooldown = 0;
    this.hurtFlash = 0;
  }

  reset(full = true) {
    this.position.set(0, 1.8, 0);
    this.velocity.set(0, 0, 0);
    this.stamina = this.maxStamina;
    this.isDead = false;
    this.score = 0;
    this.kills = 0;
    this.headshots = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.upgradePoints = 0;
    this.triggerNuke = false;
    this.powerups.doubleDamage = 0;
    this.powerups.instaKill = 0;
    this.powerups.speedBoost = 0;
    if (full) {
      this.maxHealth = 100;
      this.upgrades = { damageTier: 0, healthTier: 0, reloadTier: 0, ammoTier: 0, hasArmor: false };
    }
    this.health = this.maxHealth;
    this.armor = this.upgrades.hasArmor ? 50 : 0;
    this.hitCooldown = 0;
    this.hurtFlash = 0;
  }

  damageMultiplier() {
    let mult = 1.0 + this.upgrades.damageTier * 0.15;
    if (this.powerups.doubleDamage > 0) mult *= 2;
    if (this.powerups.instaKill > 0) mult *= 25;
    return mult;
  }

  takeDamage(amount) {
    if (this.isDead) return false;
    const dmg = Number(amount);
    if (!Number.isFinite(dmg) || dmg <= 0) return false;
    if (this.hitCooldown > 0) return false;
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.hitCooldown = 0.45;
    this.hurtFlash = 0.35;
    let remainingDmg = dmg;
    if (this.armor > 0) {
      const armorAbsorb = Math.min(this.armor, remainingDmg * 0.7);
      this.armor -= armorAbsorb;
      remainingDmg -= armorAbsorb;
    }
    this.health = Math.max(0, this.health - remainingDmg);
    this.audio.playPlayerDamage();
    if (this.health <= 0) this.isDead = true;
    return true;
  }

  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }
  addArmor(amount) { this.armor = Math.min(this.maxArmor, this.armor + amount); }
  activatePowerup(type, duration) { if (this.powerups.hasOwnProperty(type)) this.powerups[type] = duration; }

  addKill(isHeadshot, points) {
    this.kills++;
    if (isHeadshot) this.headshots++;
    this.comboCount++;
    this.comboMultiplier = Math.min(5.0, 1.0 + (Math.floor(this.comboCount / 3) * 0.5));
    const finalPts = Math.floor(points * this.comboMultiplier * (this.powerups.doubleDamage > 0 ? 2.0 : 1.0));
    this.score += finalPts;
    this.upgradePoints += finalPts;
  }

  update(delta, inputKeys, mouseDelta) {
    if (this.isDead) return;
    if (this.hitCooldown > 0) this.hitCooldown = Math.max(0, this.hitCooldown - delta);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - delta);
    Object.keys(this.powerups).forEach(key => {
      if (this.powerups[key] > 0) this.powerups[key] = Math.max(0, this.powerups[key] - delta);
    });
    if (mouseDelta) {
      this.rotation.y -= mouseDelta.x * 0.0022;
      this.rotation.x -= mouseDelta.y * 0.0022;
      this.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotation.x));
    }
    let currentSpeed = this.walkSpeed;
    if (this.powerups.speedBoost > 0) currentSpeed *= 1.4;
    this.isSprinting = inputKeys.sprint && inputKeys.forward && this.stamina > 5;
    this.isCrouching = inputKeys.crouch;
    if (this.isSprinting) {
      currentSpeed = this.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - delta * 25);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + delta * 15);
    }
    if (this.isCrouching) currentSpeed = this.crouchSpeed;
    const moveDir = new THREE.Vector3();
    if (inputKeys.forward) moveDir.z -= 1;
    if (inputKeys.backward) moveDir.z += 1;
    if (inputKeys.left) moveDir.x -= 1;
    if (inputKeys.right) moveDir.x += 1;
    moveDir.normalize();
    moveDir.applyEuler(new THREE.Euler(0, this.rotation.y, 0, 'YXZ'));
    this.velocity.x = moveDir.x * currentSpeed;
    this.velocity.z = moveDir.z * currentSpeed;
    if (this.isGrounded) {
      if (inputKeys.jump) { this.velocity.y = this.jumpForce; this.isGrounded = false; }
      else this.velocity.y = 0;
    } else {
      this.velocity.y -= 20.0 * delta;
    }
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;
    const targetY = this.isCrouching ? 1.0 : 1.8;
    if (this.position.y <= targetY) {
      this.position.y = targetY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }
    this.position.x = Math.max(-38, Math.min(38, this.position.x));
    this.position.z = Math.max(-38, Math.min(38, this.position.z));
    const isMoving = (inputKeys.forward || inputKeys.backward || inputKeys.left || inputKeys.right) && this.isGrounded;
    if (isMoving) {
      this.bobTime += delta * (this.isSprinting ? 14 : 9);
      const bobY = Math.sin(this.bobTime) * (this.isSprinting ? 0.08 : 0.04);
      this.camera.position.set(this.position.x, this.position.y + bobY, this.position.z);
    } else {
      this.camera.position.copy(this.position);
    }
    if (this.isThirdPerson) {
      const backVector = new THREE.Vector3(0, 0, 3.5).applyEuler(this.rotation);
      this.camera.position.add(backVector);
      this.camera.position.y += 0.5;
    }
    this.camera.rotation.copy(this.rotation);
    return isMoving;
  }
}
