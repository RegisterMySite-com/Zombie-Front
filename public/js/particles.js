import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  createBloodSplatter(position, count = 12) {
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions.push(position.x, position.y, position.z);
      velocities.push((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaa0000, size: 0.35, transparent: true, opacity: 0.9, depthWrite: false });
    const pMesh = new THREE.Points(geom, mat);
    this.scene.add(pMesh);
    this.particles.push({ mesh: pMesh, velocities, life: 0, maxLife: 0.4 + Math.random() * 0.2, type: 'blood' });
  }

  createMuzzleFlash(position) {
    const light = new THREE.PointLight(0xffaa22, 5, 8);
    light.position.copy(position);
    this.scene.add(light);
    const sparkGeom = new THREE.BufferGeometry();
    const pos = [];
    for (let i = 0; i < 8; i++) {
      pos.push(position.x + (Math.random() - 0.5) * 0.2, position.y + (Math.random() - 0.5) * 0.2, position.z + (Math.random() - 0.5) * 0.2);
    }
    sparkGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffdd66, size: 0.25, transparent: true, opacity: 1 });
    const pMesh = new THREE.Points(sparkGeom, sparkMat);
    this.scene.add(pMesh);
    setTimeout(() => {
      this.scene.remove(light);
      this.scene.remove(pMesh);
      sparkGeom.dispose();
      sparkMat.dispose();
    }, 40);
  }

  createTracer(startPos, endPos) {
    const geom = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geom, mat);
    this.scene.add(line);
    this.particles.push({ mesh: line, life: 0, maxLife: 0.1, type: 'tracer' });
  }

  createExplosion(position) {
    const flash = new THREE.PointLight(0xff5500, 10, 20);
    flash.position.copy(position);
    this.scene.add(flash);
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions.push(position.x, position.y, position.z);
      velocities.push((Math.random() - 0.5) * 12, Math.random() * 10 + 2, (Math.random() - 0.5) * 12);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xff3300, size: 0.6, transparent: true, opacity: 1.0 });
    const pMesh = new THREE.Points(geom, mat);
    this.scene.add(pMesh);
    this.particles.push({ mesh: pMesh, velocities, life: 0, maxLife: 0.8, light: flash, type: 'explosion' });
  }

  createAcidSpit(startPos, targetPos) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x33ff33 }));
    mesh.position.copy(startPos);
    this.scene.add(mesh);
    const dir = targetPos.clone().sub(startPos).normalize().multiplyScalar(15);
    this.particles.push({ mesh, velocities: [dir.x, dir.y + 2, dir.z], life: 0, maxLife: 1.5, type: 'acid' });
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        if (p.light) this.scene.remove(p.light);
        this.scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      if (p.velocities && p.mesh.geometry && p.mesh.geometry.attributes.position) {
        const arr = p.mesh.geometry.attributes.position.array;
        for (let j = 0; j < arr.length / 3; j++) {
          arr[j * 3] += p.velocities[j * 3] * delta;
          arr[j * 3 + 1] += p.velocities[j * 3 + 1] * delta;
          arr[j * 3 + 2] += p.velocities[j * 3 + 2] * delta;
          if (p.type === 'blood' || p.type === 'explosion') p.velocities[j * 3 + 1] -= 9.8 * delta;
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
      }
      if (p.type === 'acid') {
        p.mesh.position.x += p.velocities[0] * delta;
        p.mesh.position.y += p.velocities[1] * delta;
        p.mesh.position.z += p.velocities[2] * delta;
      }
      if (p.mesh.material) p.mesh.material.opacity = Math.max(0, 1 - p.life / p.maxLife);
    }
  }
}
