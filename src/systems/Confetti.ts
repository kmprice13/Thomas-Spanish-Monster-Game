/**
 * Pooled confetti burst VFX.
 *
 * A single InstancedMesh of small cubes is reused for every celebration, so a
 * burst costs one draw call and zero per-frame allocation. Bursts are the core
 * "immediate reward" feedback; intensity is reduced (not removed) in
 * reduced-stimulation mode by the caller passing a smaller count.
 */
import * as THREE from 'three';

interface Particle {
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
}

const CONFETTI_COLORS = [0xff5e7e, 0xffd23f, 0x4dd2ff, 0x6bdd6b, 0xb06cff, 0xff9f43];

export class Confetti {
  readonly mesh: THREE.InstancedMesh;
  private readonly particles: Particle[] = [];
  private readonly capacity: number;
  private readonly dummy = new THREE.Object3D();
  private readonly positions: THREE.Vector3[] = [];

  constructor(capacity = 160) {
    this.capacity = capacity;
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.02);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.5, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.name = 'confetti';

    const color = new THREE.Color();
    for (let i = 0; i < capacity; i++) {
      this.particles.push({ active: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, spin: 0 });
      this.positions.push(new THREE.Vector3(0, -1000, 0));
      color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      this.mesh.setColorAt(i, color);
    }
    // park all instances off-screen initially
    this.dummy.position.set(0, -1000, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Fire a burst of `count` particles from a world position. */
  burst(position: THREE.Vector3, count = 60): void {
    let fired = 0;
    for (let i = 0; i < this.capacity && fired < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.maxLife = 0.9 + Math.random() * 0.6;
      p.life = p.maxLife;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = 3.5 + Math.random() * 3;
      p.spin = (Math.random() - 0.5) * 12;
      this.positions[i].copy(position);
      fired++;
    }
  }

  update(delta: number): void {
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= delta;
      if (p.life <= 0) {
        p.active = false;
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }
      p.vy -= 9.8 * delta; // gravity
      const pos = this.positions[i];
      pos.x += p.vx * delta;
      pos.y += p.vy * delta;
      pos.z += p.vz * delta;
      const t = p.life / p.maxLife;
      this.dummy.position.copy(pos);
      this.dummy.rotation.set(p.spin * (1 - t), p.spin * (1 - t) * 0.5, p.spin * (1 - t));
      this.dummy.scale.setScalar(0.6 + t * 0.8);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
