/**
 * A vocab object placed in the world.
 *
 * Wraps a procedural model with a contact shadow, idle bob, a no-punishment
 * "highlight" state (a gentle pulsing ring shown only after repeated misses so
 * the child is never dead-ended), and a satisfying collect animation. Selection
 * works by either tapping (raycast) or bumping into it (distance) — both resolve
 * to the same WorldObject via `owns()`.
 */
import * as THREE from 'three';
import { buildContactShadow, buildVocabModel } from '../assets/ModelFactory';
import type { VocabItem } from '../content/vocabulary';
import { disposeObject3D } from '../utils/dispose';

export interface SelectionDescriptor {
  vocabId: string;
  colorId?: string;
}

export class WorldObject {
  readonly group = new THREE.Group();
  readonly radius = 0.7;
  active = true;

  private readonly model: THREE.Group;
  private readonly highlightRing: THREE.Mesh;
  private readonly spotlightRing: THREE.Mesh;
  private highlighted = false;
  private spotlit = false;
  private collecting = false;
  private collectT = 0;

  get isIntroSpotlit(): boolean { return this.spotlit; }

  constructor(
    readonly instanceId: number,
    readonly vocab: VocabItem,
    position: THREE.Vector3,
    /** Optional color variant id (for color-hunt rounds). */
    readonly colorId?: string,
    colorOverride?: number,
  ) {
    this.model = buildVocabModel(vocab, colorOverride);
    this.model.position.y = 0.45;
    this.group.add(this.model);

    this.group.add(buildContactShadow(0.5));

    this.highlightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.92, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.highlightRing.rotation.x = -Math.PI / 2;
    this.highlightRing.position.y = 0.03;
    this.group.add(this.highlightRing);

    // Intro spotlight — dramatic teal ring + overhead sparkle aura
    this.spotlightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.24, 36),
      new THREE.MeshBasicMaterial({ color: 0x2ec5c1, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.spotlightRing.rotation.x = -Math.PI / 2;
    this.spotlightRing.position.y = 0.02;
    this.group.add(this.spotlightRing);

    this.group.position.copy(position);
    // Tag for raycast resolution.
    this.group.traverse((o) => (o.userData.worldObjectId = instanceId));
  }

  get descriptor(): SelectionDescriptor {
    return { vocabId: this.vocab.id, colorId: this.colorId };
  }

  setHighlight(on: boolean): void {
    this.highlighted = on;
  }

  /** Lumi's intro spotlight — bright teal ring + bobbing scale pulse. */
  setIntroSpotlight(on: boolean): void {
    this.spotlit = on;
    if (!on) {
      (this.spotlightRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  /** Returns true if the given raycast-hit object belongs to this world object. */
  owns(object: THREE.Object3D): boolean {
    return object.userData.worldObjectId === this.instanceId;
  }

  startCollect(): void {
    if (this.collecting) return;
    this.collecting = true;
    this.collectT = 0;
    this.active = false;
    this.highlighted = false;
    this.spotlit = false;
    this.highlightRing.visible = false;
    this.spotlightRing.visible = false;
  }

  get isGone(): boolean {
    return this.collecting && this.collectT >= 1;
  }

  update(delta: number, elapsed: number): void {
    if (this.collecting) {
      this.collectT = Math.min(1, this.collectT + delta * 3.2);
      const t = this.collectT;
      // pop up and shrink away
      this.model.position.y = 0.45 + t * 1.2;
      this.model.scale.setScalar(Math.max(0.001, 1 - t));
      this.model.rotation.y += delta * 10;
      this.group.visible = t < 1;
      return;
    }

    // idle bob + slow spin
    this.model.position.y = 0.45 + Math.sin(elapsed * 2 + this.instanceId) * 0.08;
    this.model.rotation.y += delta * 0.5;

    // Hint ring (3+ misses)
    const mat = this.highlightRing.material as THREE.MeshBasicMaterial;
    const targetOpacity = this.highlighted ? 0.55 + Math.sin(elapsed * 6) * 0.25 : 0;
    mat.opacity += (targetOpacity - mat.opacity) * Math.min(1, delta * 8);
    this.highlightRing.scale.setScalar(this.highlighted ? 1 + Math.sin(elapsed * 6) * 0.06 : 1);

    // Intro spotlight (Lumi's "¡Mira!" moment)
    const smat = this.spotlightRing.material as THREE.MeshBasicMaterial;
    const targetSpotOpacity = this.spotlit ? 0.7 + Math.sin(elapsed * 8) * 0.3 : 0;
    smat.opacity += (targetSpotOpacity - smat.opacity) * Math.min(1, delta * 10);
    if (this.spotlit) {
      this.spotlightRing.scale.setScalar(1 + Math.sin(elapsed * 8) * 0.12);
      this.model.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.07);
    }
  }

  dispose(): void {
    disposeObject3D(this.group);
  }
}
