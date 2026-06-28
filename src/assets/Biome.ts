/**
 * Meadow biome.
 *
 * A bright grassy island ringed by shallow water (Animal Crossing scale cue),
 * with layered depth: near grass tufts, midground trees/bushes the child plays
 * among, and far rolling hills + drifting clouds. Built once, reused; geometry
 * and materials are shared and small props are instanced to keep draw calls low.
 */
import * as THREE from 'three';

export interface Biome {
  readonly group: THREE.Group;
  /** Animated bits (clouds) updated each frame. */
  update(delta: number, elapsed: number): void;
}

function flat(color: number, rough = 0.75): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
}

export function createMeadow(playRadius: number): Biome {
  const group = new THREE.Group();

  // Water plane (the sea around the island)
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(playRadius * 4, 48),
    new THREE.MeshStandardMaterial({ color: 0x5fc7e8, roughness: 0.3, metalness: 0.1, flatShading: true }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.35;
  water.receiveShadow = true;
  group.add(water);

  // Sandy beach rim
  const sand = new THREE.Mesh(new THREE.CircleGeometry(playRadius + 1.4, 40), flat(0xf3e0a8));
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.08;
  sand.receiveShadow = true;
  group.add(sand);

  // Grass island top
  const grass = new THREE.Mesh(new THREE.CircleGeometry(playRadius, 40), flat(0x7ec850));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0;
  grass.receiveShadow = true;
  group.add(grass);

  // A subtle darker patch ring for depth
  const patch = new THREE.Mesh(new THREE.RingGeometry(playRadius * 0.55, playRadius * 0.85, 40), flat(0x73bd48));
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.005;
  patch.receiveShadow = true;
  group.add(patch);

  // Far rolling hills (background scale)
  const hillMat = flat(0x6fb84a);
  const hillGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const dist = playRadius * 2.4 + (i % 3) * 1.5;
    const hill = new THREE.Mesh(hillGeo, hillMat);
    const sx = 3 + (i % 3) * 1.6;
    hill.scale.set(sx, 1.4 + (i % 2) * 0.8, sx);
    hill.position.set(Math.cos(a) * dist, -0.3, Math.sin(a) * dist);
    group.add(hill);
  }

  // Trees scattered near the island edge (midground)
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1, 7);
  const trunkMat = flat(0x8a5a33);
  const leafGeo = new THREE.IcosahedronGeometry(0.7, 0);
  const leafMatA = flat(0x4fa83a);
  const leafMatB = flat(0x5fb84a);
  const treeSpots: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = playRadius * 0.82;
    treeSpots.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  for (const [x, z] of treeSpots) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.5;
    trunk.castShadow = true;
    tree.add(trunk);
    for (let j = 0; j < 3; j++) {
      const leaf = new THREE.Mesh(leafGeo, j % 2 ? leafMatA : leafMatB);
      leaf.position.set((j - 1) * 0.32, 1.2 + j * 0.42, (j % 2 ? 0.2 : -0.2));
      leaf.scale.setScalar(1 - j * 0.18);
      leaf.castShadow = true;
      tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    tree.rotation.y = x * z;
    group.add(tree);
  }

  // Instanced grass tufts (near-ground detail, cheap)
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.32, 4);
  const tuftMat = flat(0x6bbf3f);
  const TUFTS = 80;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, TUFTS);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < TUFTS; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (playRadius - 0.6);
    pos.set(Math.cos(a) * r, 0.14, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    scl.setScalar(0.7 + rand() * 0.8);
    m.compose(pos, q, scl);
    tufts.setMatrixAt(i, m);
  }
  tufts.castShadow = false;
  group.add(tufts);

  // Drifting clouds (far depth + gentle motion)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set((j - 1.5) * 0.9, Math.sin(j) * 0.2, 0);
      puff.scale.setScalar(0.8 + (j % 2) * 0.5);
      cloud.add(puff);
    }
    const a = (i / 5) * Math.PI * 2;
    cloud.position.set(Math.cos(a) * playRadius * 2, 7 + (i % 2) * 1.5, Math.sin(a) * playRadius * 2);
    cloud.scale.setScalar(1.4 + (i % 2));
    clouds.push(cloud);
    group.add(cloud);
  }

  return {
    group,
    update(_delta: number, elapsed: number) {
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];
        const a = (i / clouds.length) * Math.PI * 2 + elapsed * 0.02;
        const r = playRadius * 2;
        cloud.position.x = Math.cos(a) * r;
        cloud.position.z = Math.sin(a) * r;
      }
    },
  };
}

/** Build a vertical sky gradient as a large inverted sphere (no shaders). */
export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(120, 24, 16);
  const top = new THREE.Color(0x8fd3ff);
  const bottom = new THREE.Color(0xeaf7ff);
  const colors: number[] = [];
  const posAttr = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i).normalize();
    const t = THREE.MathUtils.clamp((v.y + 1) / 2, 0, 1);
    const c = bottom.clone().lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'sky';
  return sky;
}
