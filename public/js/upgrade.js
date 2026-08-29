export class UpgradeShop {
  constructor(player, weaponManager, hud, onContinueCallback) {
    this.player = player;
    this.weapons = weaponManager;
    this.hud = hud;
    this.onContinue = onContinueCallback;

    this.menuEl = document.getElementById('upgrade-menu');
    this.pointsValEl = document.getElementById('upgrade-points-val');

    this.lvlDamage = document.getElementById('up-lvl-damage');
    this.lvlHealth = document.getElementById('up-lvl-health');
    this.lvlReload = document.getElementById('up-lvl-reload');
    this.lvlAmmo = document.getElementById('up-lvl-ammo');
    this.lvlArmor = document.getElementById('up-lvl-armor');
    this.lvlWeapon = document.getElementById('up-lvl-weapon');

    this.btnDamage = document.getElementById('btn-up-damage');
    this.btnHealth = document.getElementById('btn-up-health');
    this.btnReload = document.getElementById('btn-up-reload');
    this.btnAmmo = document.getElementById('btn-up-ammo');
    this.btnArmor = document.getElementById('btn-up-armor');
    this.btnWeapon = document.getElementById('btn-up-weapon');
    this.btnContinue = document.getElementById('btn-upgrade-continue');

    this.bindEvents();
  }

  bindEvents() {
    this.btnDamage.addEventListener('click', () => this.buyDamage());
    this.btnHealth.addEventListener('click', () => this.buyHealth());
    this.btnReload.addEventListener('click', () => this.buyReload());
    this.btnAmmo.addEventListener('click', () => this.buyAmmo());
    this.btnArmor.addEventListener('click', () => this.buyArmor());
    this.btnWeapon.addEventListener('click', () => this.buyWeapon());

    this.btnContinue.addEventListener('click', () => {
      this.hide();
      if (this.onContinue) this.onContinue();
    });
  }

  show() {
    this.updateUI();
    this.menuEl.classList.remove('hidden');
  }

  hide() {
    this.menuEl.classList.add('hidden');
  }

  updateUI() {
    this.pointsValEl.textContent = this.player.upgradePoints;

    this.lvlDamage.textContent = this.player.upgrades.damageTier;
    this.lvlHealth.textContent = this.player.upgrades.healthTier;
    this.lvlReload.textContent = this.player.upgrades.reloadTier;
    this.lvlAmmo.textContent = this.player.upgrades.ammoTier;
    this.lvlArmor.textContent = this.player.upgrades.hasArmor ? "EQUIPPED" : "NOT BOUGHT";

    if (!this.weapons.weapons.mp40.isUnlocked) {
      this.lvlWeapon.textContent = "NEXT: MP40 (1000 PTS)";
    } else if (!this.weapons.weapons.shotgun.isUnlocked) {
      this.lvlWeapon.textContent = "NEXT: SHOTGUN (1500 PTS)";
    } else if (!this.weapons.weapons.kar98k.isUnlocked) {
      this.lvlWeapon.textContent = "NEXT: KAR98K SNIPER (2000 PTS)";
    } else {
      this.lvlWeapon.textContent = "ALL WEAPONS UNLOCKED";
    }
  }

  buyDamage() {
    const cost = 500 + this.player.upgrades.damageTier * 300;
    if (this.player.upgradePoints >= cost && this.player.upgrades.damageTier < 5) {
      this.player.upgradePoints -= cost;
      this.player.upgrades.damageTier++;
      this.updateUI();
    }
  }

  buyHealth() {
    const cost = 400 + this.player.upgrades.healthTier * 250;
    if (this.player.upgradePoints >= cost && this.player.upgrades.healthTier < 5) {
      this.player.upgradePoints -= cost;
      this.player.upgrades.healthTier++;
      this.player.maxHealth += 25;
      this.player.heal(25);
      this.updateUI();
    }
  }

  buyReload() {
    const cost = 600 + this.player.upgrades.reloadTier * 400;
    if (this.player.upgradePoints >= cost && this.player.upgrades.reloadTier < 3) {
      this.player.upgradePoints -= cost;
      this.player.upgrades.reloadTier++;
      Object.values(this.weapons.weapons).forEach(w => w.reloadTime *= 0.8);
      this.updateUI();
    }
  }

  buyAmmo() {
    const cost = 300 + this.player.upgrades.ammoTier * 200;
    if (this.player.upgradePoints >= cost && this.player.upgrades.ammoTier < 3) {
      this.player.upgradePoints -= cost;
      this.player.upgrades.ammoTier++;
      Object.values(this.weapons.weapons).forEach(w => w.maxReserve = Math.floor(w.maxReserve * 1.5));
      this.updateUI();
    }
  }

  buyArmor() {
    const cost = 750;
    if (this.player.upgradePoints >= cost && !this.player.upgrades.hasArmor) {
      this.player.upgradePoints -= cost;
      this.player.upgrades.hasArmor = true;
      this.player.addArmor(50);
      this.updateUI();
    }
  }

  buyWeapon() {
    if (!this.weapons.weapons.mp40.isUnlocked && this.player.upgradePoints >= 1000) {
      this.player.upgradePoints -= 1000;
      this.weapons.unlockWeapon('mp40');
      this.updateUI();
    } else if (!this.weapons.weapons.shotgun.isUnlocked && this.player.upgradePoints >= 1500) {
      this.player.upgradePoints -= 1500;
      this.weapons.unlockWeapon('shotgun');
      this.updateUI();
    } else if (!this.weapons.weapons.kar98k.isUnlocked && this.player.upgradePoints >= 2000) {
      this.player.upgradePoints -= 2000;
      this.weapons.unlockWeapon('kar98k');
      this.updateUI();
    }
  }
}
