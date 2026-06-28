/**
 * Procedural model factory.
 *
 * No external art assets are available (Tripo/Gemini keys are MISSING), so
 * every model is authored from Three.js primitives. The target look is bright,
 * flat-shaded low-poly with expressive faces — readable at a glance to a
 * 5-year-old and cohesive across the whole cast (vocab objects, the player
 * monster, the guide, collectible creatures, eggs).
 *
 * All builders return a plain THREE.Group; callers dispose via disposeObject3D.
 */
import * as THREE from 'three';
import type { ModelKey, VocabItem } from '../content/vocabulary';

/** Flat-shaded toy material — the signature of the art direction. */
function toy(color: number, opts: { rough?: number; emissive?: number; metal?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.rough ?? 0.62,
    metalness: opts.metal ?? 0.0,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.45 : 0,
    flatShading: true,
  });
}

const WHITE = 0xfdf9f0;
const EYE = 0x21202a;

/** Adds cartoon eyes (+ optional smile) facing -Z, the "front" of the model. */
function addFace(group: THREE.Group, opts: { y: number; spread: number; size?: number; z?: number; smile?: boolean }): void {
  const r = opts.size ?? 0.12;
  const z = opts.z ?? -1;
  const whiteMat = toy(WHITE, { rough: 0.4 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.3, flatShading: true });
  const eyeGeo = new THREE.SphereGeometry(r, 10, 10);
  const pupilGeo = new THREE.SphereGeometry(r * 0.52, 8, 8);

  for (const side of [-1, 1]) {
    const white = new THREE.Mesh(eyeGeo, whiteMat);
    white.position.set(side * opts.spread, opts.y, z * r * 1.4);
    white.scale.z = 0.7;
    group.add(white);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(side * opts.spread, opts.y, z * r * 1.9);
    group.add(pupil);
  }

  if (opts.smile) {
    const smile = new THREE.Mesh(
      new THREE.TorusGeometry(r * 1.4, r * 0.28, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: EYE, roughness: 0.4, flatShading: true }),
    );
    smile.position.set(0, opts.y - r * 1.8, z * r * 1.6);
    smile.rotation.set(Math.PI, 0, 0);
    group.add(smile);
  }
}

/* ----------------------------- Vocab objects ----------------------------- */

function buildApple(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 16), toy(item.color, { rough: 0.42 }));
  body.scale.set(1, 0.92, 1);
  body.castShadow = true;
  g.add(body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.28, 6), toy(0x6b4423));
  stem.position.y = 0.55;
  stem.rotation.z = 0.2;
  g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), toy(item.accent));
  leaf.scale.set(1.6, 0.3, 0.8);
  leaf.position.set(0.18, 0.58, 0);
  g.add(leaf);
  return g;
}

function buildBanana(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.45, -0.15, 0),
    new THREE.Vector3(-0.2, 0.18, 0),
    new THREE.Vector3(0.2, 0.22, 0),
    new THREE.Vector3(0.48, -0.05, 0),
  ]);
  const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.13, 10, false), toy(item.color, { rough: 0.5 }));
  body.castShadow = true;
  g.add(body);
  for (const end of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), toy(item.accent));
    tip.position.set(end * 0.47, end === -1 ? -0.13 : -0.04, 0);
    g.add(tip);
  }
  return g;
}

function buildStrawberry(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 16), toy(item.color, { rough: 0.4 }));
  body.rotation.x = Math.PI;
  body.position.y = 0.05;
  body.castShadow = true;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.2, 7), toy(item.accent));
  cap.position.y = 0.42;
  g.add(cap);
  // seeds: cheap instanced dots
  const seedGeo = new THREE.SphereGeometry(0.022, 5, 5);
  const seedMat = toy(0xfff3b0, { rough: 0.3 });
  const seeds = new THREE.InstancedMesh(seedGeo, seedMat, 18);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const yy = 0.32 - (i / 18) * 0.62;
    const rr = 0.4 * (1 - (0.32 - yy) / 0.62) * 0.9 + 0.06;
    m.setPosition(Math.cos(a) * rr, yy, Math.sin(a) * rr);
    seeds.setMatrixAt(i, m);
  }
  g.add(seeds);
  return g;
}

function buildFlower(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), toy(0x5aa84b));
  stem.position.y = -0.05;
  g.add(stem);
  const petalGeo = new THREE.SphereGeometry(0.17, 8, 8);
  const petalMat = toy(item.color, { rough: 0.45 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(Math.cos(a) * 0.26, 0.35, Math.sin(a) * 0.26);
    petal.scale.set(1, 0.5, 1);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), toy(item.accent, { emissive: item.accent }));
  center.position.y = 0.35;
  center.castShadow = true;
  g.add(center);
  return g;
}

function buildMushroom(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 10), toy(item.accent, { rough: 0.7 }));
  stem.position.y = 0.0;
  stem.castShadow = true;
  g.add(stem);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), toy(item.color, { rough: 0.4 }));
  cap.position.y = 0.2;
  cap.scale.y = 0.8;
  cap.castShadow = true;
  g.add(cap);
  const spotGeo = new THREE.CircleGeometry(0.07, 10);
  const spotMat = toy(WHITE, { rough: 0.4 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spot = new THREE.Mesh(spotGeo, spotMat);
    spot.position.set(Math.cos(a) * 0.24, 0.34, Math.sin(a) * 0.24);
    spot.lookAt(spot.position.clone().multiplyScalar(2).setY(1.2));
    g.add(spot);
  }
  return g;
}

function buildStar(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  const spikes = 5;
  const outer = 0.5;
  const inner = 0.22;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  geo.center();
  const body = new THREE.Mesh(geo, toy(item.color, { emissive: item.accent, rough: 0.3 }));
  body.castShadow = true;
  g.add(body);
  addFace(g, { y: 0.04, spread: 0.13, size: 0.08, z: -1.1, smile: true });
  return g;
}

function buildBall(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 18), toy(item.color, { rough: 0.35 }));
  body.castShadow = true;
  g.add(body);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.06, 8, 28), toy(item.accent, { rough: 0.3 }));
  band.rotation.x = Math.PI / 2;
  g.add(band);
  const band2 = band.clone();
  band2.rotation.x = 0;
  g.add(band2);
  return g;
}

function buildFish(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 14), toy(item.color, { rough: 0.35, metal: 0.15 }));
  body.scale.set(1.3, 0.85, 0.7);
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.4, 4), toy(item.accent));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(0.55, 0, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), toy(item.accent));
  fin.position.set(0, 0.32, 0);
  g.add(fin);
  addFace(g, { y: 0.08, spread: 0.16, size: 0.1, z: -1.2 });
  return g;
}

function buildFrog(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 14), toy(item.color, { rough: 0.5 }));
  body.scale.set(1.1, 0.8, 1);
  body.castShadow = true;
  g.add(body);
  const eyeGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const eyeMat = toy(item.accent);
  const pupilGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const pupilMat = new THREE.MeshStandardMaterial({ color: EYE, flatShading: true });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(side * 0.2, 0.34, -0.12);
    g.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(side * 0.2, 0.36, -0.24);
    g.add(pupil);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: EYE, flatShading: true }));
  smile.position.set(0, 0.04, -0.36);
  smile.rotation.x = Math.PI;
  g.add(smile);
  return g;
}

function buildBird(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 14), toy(item.color, { rough: 0.45 }));
  body.scale.set(1, 1.1, 1);
  body.castShadow = true;
  g.add(body);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), toy(item.color, { rough: 0.45 }));
    wing.scale.set(0.4, 0.7, 1);
    wing.position.set(side * 0.34, 0.05, 0.05);
    g.add(wing);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 5), toy(item.accent));
  beak.rotation.x = -Math.PI / 2;
  beak.position.set(0, 0.05, -0.4);
  g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), toy(item.accent));
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, -0.05, 0.4);
  g.add(tail);
  addFace(g, { y: 0.18, spread: 0.13, size: 0.08, z: -1.4 });
  return g;
}

function buildButterfly(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3a2e4a, flatShading: true }));
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const wingShape = new THREE.Shape();
  wingShape.ellipse(0, 0, 0.28, 0.36, 0, Math.PI * 2, false, 0);
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  const wingMat = toy(item.color, { rough: 0.4 });
  const wingMat2 = toy(item.accent, { rough: 0.4 });
  for (const side of [-1, 1]) {
    const top = new THREE.Mesh(wingGeo, wingMat);
    top.position.set(side * 0.28, 0.18, 0);
    top.rotation.y = side * 0.5;
    g.add(top);
    const bottom = new THREE.Mesh(wingGeo, wingMat2);
    bottom.scale.set(0.7, 0.7, 1);
    bottom.position.set(side * 0.26, -0.18, 0);
    bottom.rotation.y = side * 0.5;
    g.add(bottom);
  }
  for (const side of [-1, 1]) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0x3a2e4a }));
    ant.position.set(side * 0.05, 0.34, -0.05);
    ant.rotation.z = side * 0.4;
    g.add(ant);
  }
  return g;
}

function buildBone(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const mat = toy(item.color, { rough: 0.55 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), mat);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  g.add(shaft);
  const knobGeo = new THREE.SphereGeometry(0.13, 10, 10);
  for (const ex of [-1, 1]) {
    for (const ey of [-1, 1]) {
      const knob = new THREE.Mesh(knobGeo, mat);
      knob.position.set(ex * 0.32, ey * 0.12, 0);
      g.add(knob);
    }
  }
  return g;
}

function buildGem(item: VocabItem): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.46, 0),
    new THREE.MeshStandardMaterial({ color: item.color, roughness: 0.12, metalness: 0.3, flatShading: true, emissive: item.color, emissiveIntensity: 0.25 }),
  );
  body.scale.y = 1.3;
  body.castShadow = true;
  g.add(body);
  return g;
}

const BUILDERS: Record<ModelKey, (item: VocabItem) => THREE.Group> = {
  apple: buildApple,
  banana: buildBanana,
  strawberry: buildStrawberry,
  flower: buildFlower,
  mushroom: buildMushroom,
  star: buildStar,
  ball: buildBall,
  fish: buildFish,
  frog: buildFrog,
  bird: buildBird,
  butterfly: buildButterfly,
  bone: buildBone,
  gem: buildGem,
};

/** Build the model for a vocab item, optionally recolored (for color rounds). */
export function buildVocabModel(item: VocabItem, colorOverride?: number): THREE.Group {
  const g = BUILDERS[item.model](colorOverride !== undefined ? { ...item, color: colorOverride } : item);
  g.name = `vocab:${item.id}`;
  return g;
}

/* --------------------------- Monsters & creatures -------------------------- */

export interface MonsterOptions {
  body: number;
  belly: number;
  /** Optional little horn/antenna accent color. */
  accent?: number;
  /** Scale multiplier. */
  scale?: number;
}

/**
 * The signature cast member: a round, friendly blob monster with big eyes,
 * stubby feet, and a soft belly. Used for the player avatar, the guide Lumi,
 * and every collectible "pal" (recolored).
 */
export function buildMonster(opts: MonsterOptions): THREE.Group {
  const g = new THREE.Group();
  const s = opts.scale ?? 1;

  const bodyMat = toy(opts.body, { rough: 0.55 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 18), bodyMat);
  body.scale.set(1, 1.15, 1);
  body.position.y = 0.62;
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'monsterBody';
  g.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 14), toy(opts.belly, { rough: 0.5 }));
  belly.scale.set(1, 1.05, 0.5);
  belly.position.set(0, 0.5, -0.34);
  g.add(belly);

  // feet
  const footGeo = new THREE.SphereGeometry(0.16, 10, 10);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeo, bodyMat);
    foot.scale.set(1, 0.6, 1.2);
    foot.position.set(side * 0.24, 0.1, -0.05);
    foot.castShadow = true;
    g.add(foot);
  }

  // little arms
  const armGeo = new THREE.SphereGeometry(0.12, 8, 8);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, bodyMat);
    arm.scale.set(0.8, 1.3, 0.8);
    arm.position.set(side * 0.48, 0.6, -0.08);
    g.add(arm);
  }

  // horn/antenna accent
  if (opts.accent !== undefined) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), toy(opts.accent, { emissive: opts.accent }));
    horn.position.set(0, 1.28, 0);
    g.add(horn);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), toy(opts.accent, { emissive: opts.accent }));
    ball.position.set(0, 1.42, 0);
    g.add(ball);
  }

  addFace(g, { y: 0.74, spread: 0.17, size: 0.13, z: -1, smile: true });

  g.scale.setScalar(s);
  return g;
}

/** A glossy collectible egg that hatches into a pal. */
export function buildEgg(color: number): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 18, 16),
    new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1, flatShading: false }),
  );
  shell.scale.set(0.85, 1.15, 0.85);
  shell.position.y = 0.45;
  shell.castShadow = true;
  shell.name = 'eggShell';
  g.add(shell);
  // zigzag band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 20), toy(WHITE, { rough: 0.3 }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.45;
  g.add(band);
  return g;
}

/** A soft contact shadow disc to ground floating/standing objects cheaply. */
export function buildContactShadow(radius = 0.5): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.015;
  mesh.renderOrder = -1;
  return mesh;
}
