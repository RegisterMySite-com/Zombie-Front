export class HUD {
  constructor() {
    this.container = document.getElementById('hud-container');
    this.levelName = document.getElementById('hud-level-name');
    this.waveNum = document.getElementById('hud-wave-num');
    this.score = document.getElementById('hud-score');
    this.combo = document.getElementById('hud-combo');
    this.hpFill = document.getElementById('health-bar-fill');
    this.hpText = document.getElementById('health-text');
    this.armorFill = document.getElementById('armor-bar-fill');
    this.armorText = document.getElementById('armor-text');
    this.staminaFill = document.getElementById('stamina-bar-fill');
    this.weaponName = document.getElementById('weapon-name');
    this.clipAmmo = document.getElementById('clip-ammo');
    this.reserveAmmo = document.getElementById('reserve-ammo');
    this.fireMode = document.getElementById('fire-mode');
    this.weaponSlots = document.querySelectorAll('.w-slot');
    this.bossContainer = document.getElementById('boss-bar-container');
    this.bossName = document.getElementById('boss-name');
    this.bossHpFill = document.getElementById('boss-hp-fill');
    this.bossBadge = document.getElementById('boss-phase-badge');
    this.crosshair = document.getElementById('crosshair');
    this.hitmarker = document.getElementById('hitmarker');
    this.damageVignette = document.getElementById('damage-vignette');
    this.pickupContainer = document.getElementById('pickup-notification-container');
    this.powerupBadges = document.getElementById('powerup-badges');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.waveBanner = document.getElementById('wave-banner');
    this.waveBannerTitle = document.getElementById('wave-banner-title');
    this.waveBannerSub = document.getElementById('wave-banner-sub');
  }

  show() { this.container.classList.remove('hidden'); }
  hide() { this.container.classList.add('hidden'); }

  updatePlayerStatus(player) {
    const hpPct = Math.max(0, (player.health / player.maxHealth) * 100);
    this.hpFill.style.width = `${hpPct}%`;
    this.hpText.textContent = `${Math.ceil(player.health)} HP`;
    const armorPct = Math.max(0, (player.armor / player.maxArmor) * 100);
    this.armorFill.style.width = `${armorPct}%`;
    this.armorText.textContent = `${Math.ceil(player.armor)} ARMOR`;
    const stamPct = Math.max(0, (player.stamina / player.maxStamina) * 100);
    this.staminaFill.style.width = `${stamPct}%`;
    this.score.textContent = String(player.score).padStart(6, '0');
    this.combo.textContent = `${player.comboMultiplier.toFixed(1)}x`;
    if (player.hurtFlash > 0 || player.health < 30) {
      this.damageVignette.classList.add('active');
      this.damageVignette.style.opacity = player.hurtFlash > 0 ? '0.85' : '0.45';
    } else {
      this.damageVignette.classList.remove('active');
      this.damageVignette.style.opacity = '';
    }
    this.updatePowerupBadges(player.powerups);
  }

  updateWeaponStatus(weaponManager) {
    const w = weaponManager.currentWeapon;
    this.weaponName.textContent = w.name;
    this.clipAmmo.textContent = weaponManager.isReloading ? 'RELOADING...' : w.clipAmmo;
    this.reserveAmmo.textContent = w.reserveAmmo;
    this.fireMode.textContent = w.fireMode;
    if (weaponManager.isADS) this.crosshair.classList.add('ads');
    else this.crosshair.classList.remove('ads');
    this.weaponSlots.forEach(slotEl => {
      const slotNum = parseInt(slotEl.getAttribute('data-slot'));
      if (slotNum === w.slot) slotEl.classList.add('active');
      else slotEl.classList.remove('active');
    });
  }

  updateLevelStatus(levelName, waveNum, maxWaves) {
    this.levelName.textContent = levelName;
    this.waveNum.textContent = `${waveNum} / ${maxWaves}`;
  }

  updateBossStatus(boss) {
    if (!boss || boss.isDead) {
      this.bossContainer.classList.add('hidden');
      return;
    }
    this.bossContainer.classList.remove('hidden');
    this.bossName.textContent = boss.name;
    const hpPct = Math.max(0, (boss.health / boss.maxHealth) * 100);
    this.bossHpFill.style.width = `${hpPct}%`;
    this.bossBadge.textContent = `PHASE ${boss.phase}`;
  }

  triggerHitmarker(isHeadshot) {
    this.hitmarker.className = 'hidden';
    void this.hitmarker.offsetWidth;
    this.hitmarker.className = isHeadshot ? 'headshot' : '';
  }

  showWaveBanner(title, sub) {
    this.waveBannerTitle.textContent = title;
    this.waveBannerSub.textContent = sub;
    this.waveBanner.classList.remove('hidden');
    setTimeout(() => this.waveBanner.classList.add('hidden'), 2800);
  }

  showNotification(text) {
    const el = document.createElement('div');
    el.className = 'pickup-msg';
    el.textContent = text;
    this.pickupContainer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 1200);
  }

  updatePowerupBadges(powerups) {
    this.powerupBadges.innerHTML = '';
    if (powerups.doubleDamage > 0) this.addPowerupBadge('2X DAMAGE', Math.ceil(powerups.doubleDamage));
    if (powerups.instaKill > 0) this.addPowerupBadge('INSTA-KILL', Math.ceil(powerups.instaKill));
    if (powerups.speedBoost > 0) this.addPowerupBadge('SPEED BOOST', Math.ceil(powerups.speedBoost));
  }

  addPowerupBadge(label, duration) {
    const badge = document.createElement('div');
    badge.className = 'pu-badge';
    badge.textContent = `${label} (${duration}s)`;
    this.powerupBadges.appendChild(badge);
  }

  renderMinimap(playerPos, zombies, boss, pickups) {
    if (!this.minimapCtx) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const center = w / 2;
    const scale = 1.8;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(15, 25, 15, 0.9)';
    ctx.beginPath();
    ctx.arc(center, center, center, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.beginPath();
    ctx.arc(center, center, center * 0.5, 0, Math.PI * 2);
    ctx.arc(center, center, center * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff3333';
    zombies.forEach(z => {
      if (z.isDead) return;
      const relX = (z.position.x - playerPos.x) * scale;
      const relZ = (z.position.z - playerPos.z) * scale;
      if (Math.hypot(relX, relZ) < center - 4) {
        ctx.beginPath();
        ctx.arc(center + relX, center + relZ, z.type === 'armored' ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (boss && !boss.isDead) {
      const relX = (boss.mesh.position.x - playerPos.x) * scale;
      const relZ = (boss.mesh.position.z - playerPos.z) * scale;
      if (Math.hypot(relX, relZ) < center - 4) {
        ctx.fillStyle = '#e03131';
        ctx.beginPath();
        ctx.arc(center + relX, center + relZ, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ffd700';
    pickups.forEach(p => {
      const relX = (p.group.position.x - playerPos.x) * scale;
      const relZ = (p.group.position.z - playerPos.z) * scale;
      if (Math.hypot(relX, relZ) < center - 4) {
        ctx.beginPath();
        ctx.arc(center + relX, center + relZ, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.fillStyle = '#51cf66';
    ctx.beginPath();
    ctx.arc(center, center, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
