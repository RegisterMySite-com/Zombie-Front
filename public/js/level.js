import * as THREE from 'three';
import { Zombie, BossZombie } from './enemies.js';
import { WALL_ART } from './wall-art.js';

export class LevelManager {
  constructor(scene, audioEngine, particleSystem) {
    this.scene = scene;
    this.audio = audioEngine;
    this.particles = particleSystem;
    this.currentLevelNum = 1;
    this.currentWave = 1;
    this.maxWavesPerLevel = 5;
    this.levelGroup = new THREE.Group();
    this.scene.add(this.levelGroup);
    this.zombies = [];
    this.boss = null;
    this.spawningActive = false;
    this.zombiesToSpawnInWave = 0;
    this.zombiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.8;
    this.obstacles = [];
    this.textureLoader = new THREE.TextureLoader();
    this.loadedTextures = [];
    this.spawnPoints = [
      new THREE.Vector3(20, 0, 20),
      new THREE.Vector3(-20, 0, 20),
      new THREE.Vector3(20, 0, -20),
      new THREE.Vector3(-20, 0, -20),
      new THREE.Vector3(0, 0, 30),
      new THREE.Vector3(0, 0, -30)
    ];
    this.levelConfigs = {
      1: { name: 'NORMANDY VILLAGE', groundColor: 0x3d352b, fogColor: 0x181a17, fogNear: 15, fogFar: 65, bossName: 'HAUPTMANN KRIEG' },
      2: { name: 'SIEGFRIED TRENCHES', groundColor: 0x242d20, fogColor: 0x0d120a, fogNear: 10, fogFar: 50, bossName: 'MORTAR GOLIATH' },
      3: { name: 'INDUSTRIAL COMPLEX', groundColor: 0x1f2228, fogColor: 0x10141a, fogNear: 12, fogFar: 55, bossName: 'HERR DOCTOR VON EISEN' },
      4: { name: 'OCCULT FORTRESS', groundColor: 0x221321, fogColor: 0x140813, fogNear: 8, fogFar: 45, bossName: 'GENERAL SHADOW' }
    };
  }

  loadLevel(levelNum) {
    this.currentLevelNum = levelNum;
    this.currentWave = 1;
    this.clearLevel();
    const config = this.levelConfigs[levelNum] || this.levelConfigs[1];
    this.scene.fog = new THREE.FogExp2(config.fogColor, 0.025);
    this.scene.background = new THREE.Color(config.fogColor);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: config.groundColor, roughness: 0.9, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.levelGroup.add(ground);
    this.obstacles = [];
    this.buildBoundaryWalls();
    this.buildMapProps(levelNum);
    this.setupLighting();
  }

  artConfig() {
    return WALL_ART[this.currentLevelNum] || WALL_ART.default;
  }

  loadTexture(src, repeatX = 1, repeatY = 1) {
    if (!src) return null;
    const tex = this.textureLoader.load(src, () => {}, undefined, () => {
      console.warn('Wall image failed to load:', src);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
    this.loadedTextures.push(tex);
    return tex;
  }

  makeWallMaterial(art) {
    const repeat = art.wallRepeat || [8, 2];
    const map = this.loadTexture(art.wallTexture, repeat[0], repeat[1]);
    return new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : 0x1a1c1a,
      map,
      roughness: 0.85,
      metalness: 0.08
    });
  }

  buildBoundaryWalls() {
    const art = this.artConfig();
    const wallMat = this.makeWallMaterial(art);
    const wallGeom = new THREE.BoxGeometry(80, 8, 2);
    const wN = new THREE.Mesh(wallGeom, wallMat); wN.position.set(0, 4, -40); this.levelGroup.add(wN);
    const wS = new THREE.Mesh(wallGeom, wallMat); wS.position.set(0, 4, 40); this.levelGroup.add(wS);
    const wE = new THREE.Mesh(wallGeom, wallMat); wE.rotation.y = Math.PI / 2; wE.position.set(40, 4, 0); this.levelGroup.add(wE);
    const wW = new THREE.Mesh(wallGeom, wallMat); wW.rotation.y = Math.PI / 2; wW.position.set(-40, 4, 0); this.levelGroup.add(wW);
    this.hangWallPosters(art);
  }

  hangWallPosters(art) {
    const posters = art.posters || [];
    const inset = 1.12;
    const specs = {
      north: { origin: new THREE.Vector3(0, 0, -40 + inset), along: new THREE.Vector3(1, 0, 0), yaw: 0 },
      south: { origin: new THREE.Vector3(0, 0, 40 - inset), along: new THREE.Vector3(-1, 0, 0), yaw: Math.PI },
      east: { origin: new THREE.Vector3(40 - inset, 0, 0), along: new THREE.Vector3(0, 0, 1), yaw: -Math.PI / 2 },
      west: { origin: new THREE.Vector3(-40 + inset, 0, 0), along: new THREE.Vector3(0, 0, -1), yaw: Math.PI / 2 }
    };
    posters.forEach((poster) => {
      const spec = specs[poster.wall];
      if (!spec || !poster.src) return;
      const map = this.loadTexture(poster.src, 1, 1);
      if (!map) return;
      map.wrapS = THREE.ClampToEdgeWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      const width = poster.width || 3.2;
      const height = poster.height || 3.2;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.7, metalness: 0.05, side: THREE.FrontSide })
      );
      mesh.position.copy(spec.origin);
      mesh.position.addScaledVector(spec.along, Number(poster.along) || 0);
      mesh.position.y = poster.y == null ? 3.1 : poster.y;
      mesh.rotation.y = spec.yaw;
      mesh.castShadow = true;
      this.levelGroup.add(mesh);
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(width + 0.18, height + 0.18),
        new THREE.MeshStandardMaterial({ color: 0x2a2218, roughness: 0.9 })
      );
      frame.position.copy(mesh.position);
      frame.position.addScaledVector(new THREE.Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw)), -0.02);
      frame.rotation.y = spec.yaw;
      this.levelGroup.add(frame);
    });
  }

  buildMapProps(levelNum) {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3421 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x22252a, metalness: 0.8 });
    const brickMat = new THREE.MeshStandardMaterial({ color: 0x5a2d24 });
    if (levelNum === 1) {
      for (let i = 0; i < 8; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), brickMat);
        box.position.set((Math.random() - 0.5) * 50, 1.5, (Math.random() - 0.5) * 50);
        box.castShadow = true;
        this.levelGroup.add(box);
        this.obstacles.push({ x: box.position.x, z: box.position.z, r: 2.6 });
      }
    } else if (levelNum === 2) {
      for (let i = 0; i < 12; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5), woodMat);
        post.position.set((Math.random() - 0.5) * 55, 1.25, (Math.random() - 0.5) * 55);
        this.levelGroup.add(post);
      }
    } else if (levelNum === 3) {
      for (let i = 0; i < 6; i++) {
        const vat = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4, 12), metalMat);
        vat.position.set((Math.random() - 0.5) * 45, 2.0, (Math.random() - 0.5) * 45);
        this.levelGroup.add(vat);
        this.obstacles.push({ x: vat.position.x, z: vat.position.z, r: 2.4 });
      }
    } else if (levelNum === 4) {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x1f1a24 });
      for (let i = 0; i < 8; i++) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), stoneMat);
        pillar.position.set((Math.random() - 0.5) * 50, 3.0, (Math.random() - 0.5) * 50);
        this.levelGroup.add(pillar);
        this.obstacles.push({ x: pillar.position.x, z: pillar.position.z, r: 1.4 });
      }
    }
  }

  setupLighting() {
    this.levelGroup.add(new THREE.AmbientLight(0x404550, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffeedd, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    this.levelGroup.add(dirLight);
    const redLight = new THREE.PointLight(0xff3300, 2, 25);
    redLight.position.set(0, 3, 0);
    this.levelGroup.add(redLight);
  }

  startWave(waveNum, difficultyConfig) {
    this.currentWave = waveNum;
    this.spawningActive = true;
    this.zombiesSpawnedInWave = 0;
    if (this.currentWave === this.maxWavesPerLevel) {
      this.zombiesToSpawnInWave = 0;
      this.spawnBoss();
    } else {
      this.zombiesToSpawnInWave = Math.floor((6 + this.currentWave * 4 + this.currentLevelNum * 3) * (difficultyConfig.spawnMult || 1.0));
    }
    this.spawnInterval = Math.max(0.8, 2.0 - this.currentWave * 0.2);
  }

  spawnBoss() {
    this.boss = new BossZombie(this.currentLevelNum, this.scene, this.audio, this.particles);
  }

  updateSpawning(delta, difficultyConfig) {
    if (!this.spawningActive) return;
    if (this.currentWave === this.maxWavesPerLevel) return;
    if (this.zombiesSpawnedInWave >= this.zombiesToSpawnInWave) return;
    this.spawnTimer += delta;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      const pt = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      const spawnPos = pt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4));
      let type = 'shambler';
      const rand = Math.random();
      if (this.currentWave >= 2 && rand < 0.35) type = 'runner';
      else if (this.currentWave >= 3 && rand < 0.6) type = 'armored';
      else if (this.currentWave >= 4 && rand < 0.75) type = 'exploder';
      else if (this.currentLevelNum >= 2 && rand < 0.9) type = 'spitter';
      this.zombies.push(new Zombie(type, spawnPos, difficultyConfig, this.scene, this.audio, this.particles));
      this.zombiesSpawnedInWave++;
    }
  }

  isWaveCleared() {
    if (this.currentWave === this.maxWavesPerLevel) return this.boss && this.boss.isDead;
    return this.zombiesSpawnedInWave >= this.zombiesToSpawnInWave && this.zombies.every(z => z.isDead);
  }

  resolvePlayerCollision(player) {
    for (const ob of this.obstacles) {
      const dx = player.position.x - ob.x;
      const dz = player.position.z - ob.z;
      const dist = Math.hypot(dx, dz);
      const min = ob.r + 0.6;
      if (dist < min && dist > 0.001) {
        const push = (min - dist) / dist;
        player.position.x += dx * push;
        player.position.z += dz * push;
      }
    }
  }

  pruneDeadZombies() {
    this.zombies = this.zombies.filter(z => !z.isDead || (z.mesh && z.mesh.parent));
  }

  getCombatTargets() {
    const list = this.zombies.filter(z => z && !z.isDead && z.mesh);
    if (this.boss && !this.boss.isDead && this.boss.mesh) list.push(this.boss);
    return list;
  }

  nukeClearZombies() {
    this.zombies.forEach(z => { if (!z.isDead) z.die(z.position); });
  }

  clearLevel() {
    this.zombies.forEach(z => { if (z.mesh) this.scene.remove(z.mesh); });
    this.zombies = [];
    if (this.boss) {
      if (this.boss.mesh) this.scene.remove(this.boss.mesh);
      this.boss = null;
    }
    while (this.levelGroup.children.length > 0) this.levelGroup.remove(this.levelGroup.children[0]);
    this.loadedTextures.forEach(tex => tex.dispose());
    this.loadedTextures = [];
  }
}
