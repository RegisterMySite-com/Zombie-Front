import * as THREE from 'three';
import { audioEngine } from './audio.js';
import { LeaderboardAPI } from './api.js';
import { ParticleSystem } from './particles.js';
import { WeaponManager } from './weapons.js';
import { Player } from './player.js';
import { LevelManager } from './level.js';
import { PickupManager } from './pickups.js';
import { HUD } from './hud.js';
import { UpgradeShop } from './upgrade.js';

class GameApp {
  constructor() {
    this.gameState = 'MENU';
    this.selectedMap = 1;
    this.selectedDifficulty = 'Normal';
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.scoreSubmitted = false;

    this.difficultyConfigs = {
      Easy: { hpMult: 0.7, speedMult: 0.8, spawnMult: 0.7 },
      Normal: { hpMult: 1.0, speedMult: 1.0, spawnMult: 1.0 },
      Hard: { hpMult: 1.5, speedMult: 1.25, spawnMult: 1.4 }
    };

    this.container = document.getElementById('canvas-container');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.particles = new ParticleSystem(this.scene);
    this.player = new Player(this.camera, this.scene, audioEngine);
    this.weapons = new WeaponManager(this.camera, this.scene, audioEngine, this.particles);
    this.level = new LevelManager(this.scene, audioEngine, this.particles);
    this.pickups = new PickupManager(this.scene, audioEngine);
    this.hud = new HUD();
    window.hud = this.hud;

    this.raycaster = new THREE.Raycaster();

    this.shop = new UpgradeShop(this.player, this.weapons, this.hud, () => {
      this.resumeAfterIntermission();
    });

    this.keys = {
      forward: false,
        backward: false,
        left: false,
        right: false,
        sprint: false,
        crouch: false,
        jump: false
    };
    this.mouseDelta = { x: 0, y: 0 };
    this.isPointerLocked = false;
    this.isMouseDown = false;
    this.clock = new THREE.Clock();

    this.prefillNames();
    this.initEventListeners();
    this.initUIEvents();
    this.initTouchControls();
    this.animate();
  }

  prefillNames() {
    const remembered = LeaderboardAPI.rememberName();
    const a = document.getElementById('player-name-input');
    const b = document.getElementById('vic-player-name');
    if (a) a.value = remembered;
    if (b) b.value = remembered;
  }

  initEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.container.addEventListener('click', () => {
      if (this.gameState === 'PLAYING' && !this.isPointerLocked && !this.isTouch) {
        this.container.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.container;
      if (this.isPointerLocked && !locked && this.gameState === 'PLAYING' && !this.isTouch) {
        this.pauseGame();
      }
      this.isPointerLocked = locked;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked && this.gameState === 'PLAYING') {
        this.mouseDelta.x += e.movementX;
        this.mouseDelta.y += e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      audioEngine.init();
      if (this.gameState !== 'PLAYING') return;
      if (e.button === 0) {
        this.isMouseDown = true;
        this.triggerFire();
      } else if (e.button === 2) {
        this.weapons.toggleADS(true);
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      else if (e.button === 2) this.weapons.toggleADS(false);
    });

      document.addEventListener('contextmenu', (e) => e.preventDefault());

      document.addEventListener('wheel', (e) => {
        if (this.gameState !== 'PLAYING') return;
        this.weapons.nextUnlocked(e.deltaY > 0 ? 1 : -1);
      }, { passive: true });

      document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.gameState === 'PLAYING') this.pauseGame();
          else if (this.gameState === 'PAUSED') this.resumeGame();
          return;
        }
        if (this.gameState !== 'PLAYING') return;

        switch (e.code) {
          case 'KeyW': this.keys.forward = true; break;
          case 'KeyS': this.keys.backward = true; break;
          case 'KeyA': this.keys.left = true; break;
          case 'KeyD': this.keys.right = true; break;
          case 'ShiftLeft': this.keys.sprint = true; break;
          case 'KeyC':
          case 'ControlLeft': this.keys.crouch = true; break;
          case 'Space':
            this.keys.jump = true;
            e.preventDefault();
            break;
          case 'KeyR': this.weapons.reload(); break;
          case 'Digit1': this.weapons.switchBySlot(1); break;
          case 'Digit2': this.weapons.switchBySlot(2); break;
          case 'Digit3': this.weapons.switchBySlot(3); break;
          case 'Digit4': this.weapons.switchBySlot(4); break;
          case 'Digit5': this.weapons.switchBySlot(5); break;
          case 'KeyV':
            this.player.isThirdPerson = !this.player.isThirdPerson;
            break;
        }
      });

      document.addEventListener('keyup', (e) => {
        switch (e.code) {
          case 'KeyW': this.keys.forward = false; break;
          case 'KeyS': this.keys.backward = false; break;
          case 'KeyA': this.keys.left = false; break;
          case 'KeyD': this.keys.right = false; break;
          case 'ShiftLeft': this.keys.sprint = false; break;
          case 'KeyC':
          case 'ControlLeft': this.keys.crouch = false; break;
          case 'Space': this.keys.jump = false; break;
        }
      });
  }

  initTouchControls() {
    const root = document.getElementById('touch-controls');
    if (!root) return;
    if (this.isTouch) root.classList.add('enabled');

    const stick = document.getElementById('touch-stick');
    const knob = document.getElementById('touch-stick-knob');
    const lookPad = document.getElementById('look-pad');
    const fireBtn = document.getElementById('touch-fire');
    const adsBtn = document.getElementById('touch-ads');
    const reloadBtn = document.getElementById('touch-reload');
    const jumpBtn = document.getElementById('touch-jump');

    let stickId = null;
    const applyStick = (clientX, clientY) => {
      if (!stick) return;
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = rect.width / 2 - 8;
      const mag = Math.hypot(dx, dy) || 1;
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      if (knob) {
        knob.style.left = `${36 + dx}px`;
        knob.style.top = `${36 + dy}px`;
      }
      this.keys.forward = dy < -18;
      this.keys.backward = dy > 18;
      this.keys.left = dx < -18;
      this.keys.right = dx > 18;
    };

    const resetStick = () => {
      this.keys.forward = this.keys.backward = this.keys.left = this.keys.right = false;
      if (knob) {
        knob.style.left = '36px';
        knob.style.top = '36px';
      }
      stickId = null;
    };

    if (stick) {
      stick.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        stickId = t.identifier;
        applyStick(t.clientX, t.clientY);
      }, { passive: true });
      stick.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === stickId) applyStick(t.clientX, t.clientY);
        }
      }, { passive: true });
      stick.addEventListener('touchend', resetStick, { passive: true });
      stick.addEventListener('touchcancel', resetStick, { passive: true });
    }

    let lookId = null;
    let lastLook = null;
    if (lookPad) {
      lookPad.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        lookId = t.identifier;
        lastLook = { x: t.clientX, y: t.clientY };
      }, { passive: true });
      lookPad.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier !== lookId || !lastLook) continue;
          this.mouseDelta.x += (t.clientX - lastLook.x) * 1.6;
          this.mouseDelta.y += (t.clientY - lastLook.y) * 1.6;
          lastLook = { x: t.clientX, y: t.clientY };
        }
      }, { passive: true });
      lookPad.addEventListener('touchend', () => { lookId = null; lastLook = null; }, { passive: true });
    }

    const hold = (el, on, off) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener('touchend', () => off && off());
      el.addEventListener('touchcancel', () => off && off());
    };

    hold(fireBtn, () => { this.isMouseDown = true; this.triggerFire(); }, () => { this.isMouseDown = false; });
    hold(adsBtn, () => this.weapons.toggleADS(true), () => this.weapons.toggleADS(false));
    hold(reloadBtn, () => this.weapons.reload(), null);
    hold(jumpBtn, () => { this.keys.jump = true; }, () => { this.keys.jump = false; });
  }

  initUIEvents() {
    document.getElementById('btn-play').addEventListener('click', () => {
      this.startGame(this.selectedMap || 1, this.selectedDifficulty);
    });
    document.getElementById('btn-select-level').addEventListener('click', () => this.showScreen('level-select-menu'));
    document.getElementById('btn-leaderboard').addEventListener('click', () => this.loadAndShowLeaderboard());
    document.getElementById('btn-controls').addEventListener('click', () => this.showScreen('controls-menu'));

    document.querySelectorAll('.map-card').forEach((card) => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.map-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMap = parseInt(card.getAttribute('data-map'), 10);
      });
    });

    document.querySelectorAll('.btn-diff').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-diff').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedDifficulty = btn.getAttribute('data-diff');
      });
    });

    document.getElementById('btn-level-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-level-start').addEventListener('click', () => {
      this.startGame(this.selectedMap, this.selectedDifficulty);
    });

    document.querySelectorAll('.lb-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderLeaderboardTable(tab.getAttribute('data-diff'));
      });
    });

    document.getElementById('btn-lb-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-controls-back').addEventListener('click', () => this.showScreen('main-menu'));
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.startGame(this.level.currentLevelNum, this.selectedDifficulty);
    });
    document.getElementById('btn-quit').addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-go-restart').addEventListener('click', () => {
      this.startGame(this.level.currentLevelNum, this.selectedDifficulty);
    });
    document.getElementById('btn-go-leaderboard').addEventListener('click', () => this.loadAndShowLeaderboard());
    document.getElementById('btn-go-menu').addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-submit-score').addEventListener('click', () => {
      this.submitCurrentScore('player-name-input', 'submit-status-msg');
    });
    document.getElementById('btn-vic-submit-score').addEventListener('click', () => {
      this.submitCurrentScore('vic-player-name', 'vic-submit-status');
    });
    document.getElementById('btn-next-level').addEventListener('click', () => {
      if (this.level.currentLevelNum < 4) {
        this.startGame(this.level.currentLevelNum + 1, this.selectedDifficulty);
      } else {
        this.returnToMenu();
      }
    });
    document.getElementById('btn-vic-menu').addEventListener('click', () => this.returnToMenu());
  }

  showScreen(id) {
    document.querySelectorAll('.overlay-screen').forEach((s) => s.classList.add('hidden'));
    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }
    if (id === 'main-menu') {
      this.gameState = 'MENU';
      this.hud.hide();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  returnToMenu() {
    this.gameState = 'MENU';
    this.level.clearLevel();
    this.pickups.clearAll();
    this.hud.hide();
    this.showScreen('main-menu');
  }

  startGame(levelNum, difficulty) {
    audioEngine.init();
    this.gameState = 'PLAYING';
    this.selectedMap = levelNum;
    this.selectedDifficulty = difficulty;
    this.scoreSubmitted = false;

    this.player.reset(true);
    this.weapons.resetLoadout();
    this.level.loadLevel(levelNum);
    this.pickups.clearAll();
    this.hud.show();

    this.showScreen(null);
    if (!this.isTouch) this.container.requestPointerLock();
    this.startNextWave();
  }

  startNextWave() {
    const diffConfig = this.difficultyConfigs[this.selectedDifficulty];
    this.level.startWave(this.level.currentWave, diffConfig);
    const isBoss = this.level.currentWave === this.level.maxWavesPerLevel;
    const title = isBoss ? 'BOSS FIGHT!' : `WAVE ${this.level.currentWave}`;
    const sub = isBoss
    ? this.level.levelConfigs[this.level.currentLevelNum].bossName
    : 'ELIMINATE ALL HOSTILES';
    this.hud.showWaveBanner(title, sub);
  }

  resumeAfterIntermission() {
    this.gameState = 'PLAYING';
    this.showScreen(null);
    this.hud.show();
    this.startNextWave();
    if (!this.isTouch) this.container.requestPointerLock();
  }

  pauseGame() {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.showScreen('pause-menu');
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  resumeGame() {
    if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.showScreen(null);
      if (!this.isTouch) this.container.requestPointerLock();
    }
  }

  applyAcidHits() {
    const list = this.particles.particles || [];
    for (const p of list) {
      if (p.type !== 'acid' || !p.mesh) continue;
      const dx = p.mesh.position.x - this.player.position.x;
      const dy = p.mesh.position.y - this.player.position.y;
      const dz = p.mesh.position.z - this.player.position.z;
      if (Math.hypot(dx, dy, dz) < 1.6) {
        this.player.takeDamage(16);
        p.life = p.maxLife;
      }
    }
  }

  triggerFire() {
    if (this.gameState !== 'PLAYING') return;

    const now = this.clock.getElapsedTime();
    const hits = this.weapons.fire(
      now,
      this.raycaster,
      this.level.getCombatTargets(),
                                   this.player.damageMultiplier()
    );

    if (hits && hits.length > 0) {
      let anyHead = false;
      hits.forEach((hit) => {
        if (hit.isHeadshot) anyHead = true;
        if (hit.zombie.isDead) {
          this.player.addKill(hit.isHeadshot, hit.zombie.scoreValue || 100);
          if (hit.zombie.position) this.pickups.spawnDrop(hit.zombie.position);
        }
      });
      this.hud.triggerHitmarker(anyHead);
    }
  }

  updateGame(delta, now) {
    if (this.gameState !== 'PLAYING') return;

    const diffConfig = this.difficultyConfigs[this.selectedDifficulty];
    const isMoving = this.player.update(delta, this.keys, this.mouseDelta);
    this.level.resolvePlayerCollision(this.player);
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;

    if (this.player.triggerNuke) {
      this.player.triggerNuke = false;
      this.level.nukeClearZombies();
    }

    if (this.isMouseDown && this.weapons.currentWeapon.fireMode === 'FULL-AUTO') {
      this.triggerFire();
    }
    this.weapons.update(delta, isMoving);

    this.level.updateSpawning(delta, diffConfig, now);
    this.level.pruneDeadZombies();

    this.level.zombies.forEach((zombie) => {
      const result = zombie.update(delta, this.player.position, now);
      if (result && (result.attack || result.explode || result.specialAttack)) {
        this.player.takeDamage(result.damage);
      }
    });

    if (this.level.boss) {
      const bossResult = this.level.boss.update(delta, this.player.position, now);
      if (bossResult && (bossResult.attack || bossResult.specialAttack)) {
        this.player.takeDamage(bossResult.damage);
      }
      this.hud.updateBossStatus(this.level.boss);
    } else {
      this.hud.updateBossStatus(null);
    }

    this.pickups.update(delta, this.player.position, this.player, this.weapons);
    this.particles.update(delta);
    this.applyAcidHits();

    if (this.player.isDead) {
      this.triggerGameOver();
      return;
    }

    if (this.level.isWaveCleared()) {
      if (this.level.currentWave < this.level.maxWavesPerLevel) {
        this.level.currentWave++;
        this.gameState = 'INTERMISSION';
        if (document.pointerLockElement) document.exitPointerLock();
        this.shop.show();
      } else {
        this.triggerVictory();
      }
    }

    this.hud.updatePlayerStatus(this.player);
    this.hud.updateWeaponStatus(this.weapons);
    this.hud.updateLevelStatus(
      this.level.levelConfigs[this.level.currentLevelNum].name,
      this.level.currentWave,
      this.level.maxWavesPerLevel
    );
    this.hud.renderMinimap(
      this.player.position,
      this.level.zombies,
      this.level.boss,
      this.pickups.pickups
    );
  }

  triggerGameOver() {
    this.gameState = 'GAMEOVER';
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('go-score').textContent = this.player.score;
    document.getElementById('go-waves').textContent = this.level.currentWave;
    document.getElementById('go-kills').textContent = this.player.kills;
    document.getElementById('go-headshots').textContent = this.player.headshots;
    document.getElementById('submit-status-msg').textContent = '';
    this.prefillNames();
    this.showScreen('gameover-menu');
  }

  triggerVictory() {
    this.gameState = 'VICTORY';
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('vic-score').textContent = this.player.score;
    document.getElementById('vic-kills').textContent = this.player.kills;
    const accuracy = this.player.kills > 0
    ? Math.min(100, Math.floor((this.player.headshots / this.player.kills) * 100))
    : 0;
    document.getElementById('vic-accuracy').textContent = `${accuracy}%`;
    document.getElementById('vic-submit-status').textContent = '';
    this.prefillNames();
    this.showScreen('victory-menu');
  }

  async submitCurrentScore(inputId, msgId) {
    const input = document.getElementById(inputId);
    const msgEl = document.getElementById(msgId);
    const name = (input.value || '').trim() || 'Anonymous Private';

    if (this.scoreSubmitted) {
      msgEl.textContent = 'Score already submitted this run.';
      return;
    }

    msgEl.textContent = 'Submitting score to Durable Object...';

    const res = await LeaderboardAPI.submitScore({
      playerName: name,
      score: this.player.score,
      wave: this.level.currentWave,
      levelName: this.level.levelConfigs[this.level.currentLevelNum].name,
      kills: this.player.kills,
      headshots: this.player.headshots,
      difficulty: this.selectedDifficulty
    });

    if (res.success && !res.isLocalFallback) {
      this.scoreSubmitted = true;
      msgEl.textContent = `Score recorded! Global Rank #${res.rank || 'Top'}`;
    } else if (res.isLocalFallback) {
      msgEl.textContent = res.message || 'Saved locally (leaderboard offline).';
    } else {
      msgEl.textContent = res.error || 'Submission failed.';
    }
  }

  async loadAndShowLeaderboard() {
    this.showScreen('leaderboard-menu');
    const active = document.querySelector('.lb-tab.active');
    this.renderLeaderboardTable(active ? active.getAttribute('data-diff') : 'All');
  }

  async renderLeaderboardTable(difficulty) {
    const tbody = document.getElementById('leaderboard-tbody');
    const sourceEl = document.getElementById('leaderboard-source');
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading high scores from Durable Object...</td></tr>';
    if (sourceEl) sourceEl.textContent = '';

    const result = await LeaderboardAPI.getLeaderboard(difficulty);
    const entries = result.entries || result;

    if (sourceEl) {
      sourceEl.textContent = result.source === 'durable-object'
      ? 'LIVE — Cloudflare Durable Object'
      : 'LOCAL FALLBACK — Durable Object unreachable';
    }

    if (!entries || entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No high scores found yet. Be the first hero!</td></tr>';
      return;
    }

    tbody.innerHTML = entries.map((e, idx) => `
    <tr>
    <td>#${idx + 1}</td>
    <td><strong>${this.escapeHtml(e.playerName)}</strong></td>
    <td class="text-gold"><strong>${e.score}</strong></td>
    <td>${e.wave}</td>
    <td>${this.escapeHtml(e.levelName || 'Village')}</td>
    <td>${e.kills}</td>
    <td>${e.headshots}</td>
    <td>${this.escapeHtml(e.difficulty)}</td>
    </tr>
    `).join('');
  }

  escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const now = this.clock.getElapsedTime();
    this.updateGame(delta, now);
    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});
