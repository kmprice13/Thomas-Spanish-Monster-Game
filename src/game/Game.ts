/**
 * Game — top-level orchestrator.
 *
 * Core loop:
 *   [NEW WORD] Lumi introduces → glow + voice → quest command
 *   [KNOWN WORD] Quest command directly
 *   Child taps/walks into correct object → reward → next quest
 *
 * Phases:
 *   start       — title screen, world animates behind
 *   introducing — Lumi shows off the target (Option A)
 *   speaking    — quest command playing, player can move
 *   playing     — active quest, full input enabled
 *   celebrating — brief praise pause after correct
 *   hatching    — creature egg hatch sequence
 *
 * Update order (per gameplay-workflows.md):
 *   input → gameplay systems → animation/VFX → camera → UI bridge → render
 */
import * as THREE from 'three';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { createMeadow, createSky, type Biome } from '../assets/Biome';
import { buildMonster, buildEgg, buildContactShadow } from '../assets/ModelFactory';
import { AudioSystem } from '../systems/AudioSystem';
import { AudioClips } from '../systems/AudioClips';
import { CameraRig } from '../systems/CameraRig';
import { Confetti } from '../systems/Confetti';
import { GameUI } from '../systems/GameUI';
import { ProgressStore } from '../systems/ProgressStore';
import { QuestDirector } from '../systems/QuestDirector';
import { SpanishVoice } from '../systems/SpanishVoice';
import { WorldObject } from '../entities/WorldObject';
import { praise, nudge } from '../content/quests';
import { MEADOW_VOCAB } from '../content/vocabulary';
import { disposeObject3D } from '../utils/dispose';

const PLAY_RADIUS = 9.5;
const PLAYER_SPEED = 6.2;
const PLAYER_ACCEL = 14;
const NPC_POSITION = new THREE.Vector3(0, 0, -PLAY_RADIUS + 1.8);
const CAMERA_OFFSET = new THREE.Vector3(0, 12, 12);

type Phase = 'start' | 'introducing' | 'speaking' | 'playing' | 'celebrating' | 'hatching';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  private readonly input: InputController;
  private readonly loop: Loop;

  private readonly sfx = new AudioSystem();
  private readonly voice = new SpanishVoice();
  private readonly clips: AudioClips;
  private readonly progress = new ProgressStore();
  private readonly questDir: QuestDirector;
  private readonly cameraRig = new CameraRig(this.camera, CAMERA_OFFSET);
  private readonly confetti: Confetti;
  private readonly ui: GameUI;
  private readonly biome: Biome;

  // Scene objects
  private readonly playerGroup = new THREE.Group();
  private playerVelocity = new THREE.Vector3();
  private readonly playerMove = new THREE.Vector2();
  private readonly npcGroup: THREE.Group;
  private readonly npcBody: THREE.Group;

  private worldObjects: WorldObject[] = [];

  // Raycast
  private readonly raycaster = new THREE.Raycaster();
  private pendingTap: THREE.Vector2 | null = null;

  // State
  private phase: Phase = 'start';
  private frame = 0;
  private praiseIndex = 0;
  private nudgeIndex = 0;
  private wrongCount = 0;
  private celebrateTimer = 0;
  private hatchTimer = 0;
  private npcBounceT = 0;
  private npcTargetRotY = 0;  // for "Lumi faces the target" during intro
  private pendingCreature: string | null = null;
  private questStartTime = 0; // for response-time measurement

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);

    // Wire up input — scaffold expects stick/knob/dash elements
    const stick = document.querySelector<HTMLElement>('#touch-stick')!;
    const knob  = document.querySelector<HTMLElement>('#touch-knob')!;
    const fakeDash = document.createElement('div');
    this.input = new InputController(stick, knob, fakeDash);

    this.clips = new AudioClips(this.voice);

    this.questDir = new QuestDirector({
      npcName: 'Lumi',
      alreadyCollected: this.progress.creatures,
    });

    this.ui = new GameUI({
      onPlay: () => void this.startGame(),
      onReplay: () => {
        this.sfx.play('tap');
        const quest = this.questDir.quest;
        if (quest) {
          const kind = quest.kind === 'find' ? 'find' : quest.kind === 'touch' ? 'touch' : 'find';
          this.clips.speak(`${kind}-${quest.target.id}`, quest.line.text);
        }
      },
      onMuteChange: (muted) => {
        this.sfx.setMuted(muted);
        this.clips.setMuted(muted);
        this.progress.setSettings({ muted });
      },
      onSlowChange: (slow) => {
        this.voice.setBaseRate(slow ? 0.72 : 0.95);
        this.progress.setSettings({ slowSpeech: slow });
      },
      onCalmChange: (calm) => {
        this.progress.setSettings({ reducedMotion: calm });
      },
    });

    this.confetti = new Confetti(180);
    this.scene.add(this.confetti.mesh);

    // Sky + world
    this.scene.add(createSky());
    this.biome = createMeadow(PLAY_RADIUS);
    this.scene.add(this.biome.group);

    // Lighting — key/fill/rim for bright toy palette
    this.scene.add(new THREE.AmbientLight(0xfff5e0, 0.9));
    const sun = new THREE.DirectionalLight(0xffeaa0, 2.8);
    sun.position.set(-5, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 40;
    sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
    sun.shadow.camera.top  =  14; sun.shadow.camera.bottom = -14;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    this.scene.add(Object.assign(new THREE.DirectionalLight(0xb0e0ff, 0.7), { position: new THREE.Vector3(6, 5, -6) }));

    // Player monster (Thomas's avatar — warm orange + cream belly + purple horn)
    const playerModel = buildMonster({ body: 0xff8c42, belly: 0xfff3d6, accent: 0xb06cff, scale: 1 });
    this.playerGroup.add(playerModel);
    this.playerGroup.add(buildContactShadow(0.52));
    this.playerGroup.position.set(0, 0, 1.5);
    this.playerGroup.traverse(o => { (o as THREE.Mesh).castShadow = true; });
    this.scene.add(this.playerGroup);

    // NPC Lumi (teal + white belly + yellow antenna)
    this.npcBody = buildMonster({ body: 0x2ec5c1, belly: 0xfff9e8, accent: 0xffd23f, scale: 1.1 });
    this.npcGroup = new THREE.Group();
    this.npcGroup.add(this.npcBody);
    this.npcGroup.add(buildContactShadow(0.56));
    this.npcGroup.position.copy(NPC_POSITION);
    this.npcGroup.traverse(o => { (o as THREE.Mesh).castShadow = true; });
    this.scene.add(this.npcGroup);

    // Camera snap
    this.cameraRig.snapTo(this.playerGroup.position);
    resizeRenderer(this.renderer, this.camera, 2);

    // Input events
    this.canvas.addEventListener('click', this.onCanvasClick);
    this.canvas.addEventListener('touchend', this.onCanvasTouch, { passive: false });

    // Pal book — speak word when tapped
    document.addEventListener('pal-speak', (e) => {
      const id = (e as CustomEvent<string>).detail;
      const v = MEADOW_VOCAB.find(w => w.id === id);
      if (v) this.clips.speak(`word-${v.id}`, v.say);
    });

    // Apply saved settings
    const { reducedMotion, muted, slowSpeech } = this.progress.settings;
    this.sfx.setMuted(muted);
    this.clips.setMuted(muted);
    if (slowSpeech) this.voice.setBaseRate(0.72);
    this.ui.applySettings(muted, slowSpeech, reducedMotion);

    // Voice quality note on start screen
    if (!this.voice.supported) {
      this.ui.setVoiceNote('⚠️ Audio not available in this browser.');
    }

    this.loop = new Loop(
      (delta, elapsed) => this.update(delta, elapsed),
      () => this.renderer.render(this.scene, this.camera),
    );
    this.loop.start();
  }

  // ─── Game start ──────────────────────────────────────────────────────────

  private async startGame(): Promise<void> {
    await this.clips.init(); // load manifest

    this.ui.enterPlay('');
    this.ui.setPalCount(this.progress.creatures.length);
    this.ui.updatePalBook(this.progress.creatures, MEADOW_VOCAB);

    // Play Lumi greeting
    await this.clips.speakAsync('lumi-hello', '¡Hola! Soy Lumi.');
    await this.clips.speakAsync('lumi-ready', '¿Listo? ¡Vamos!');

    const quest = this.questDir.start();
    this.spawnRound();

    if (this.progress.needsIntro(quest.target.id)) {
      await this.runIntro();
    } else {
      this.speakQuestCommand();
    }
  }

  // ─── Option A: Lumi intro sequence ───────────────────────────────────────

  /**
   * Lumi faces the target, it sparkles, voice says "¡Mira! ¡La manzana!",
   * then transitions to the quest command. The child always knows what to find
   * before being asked — comprehensible input without any lesson feeling.
   */
  private async runIntro(): Promise<void> {
    const quest = this.questDir.quest;
    this.phase = 'introducing';
    this.progress.markIntroduced(quest.target.id);

    // Find the target world object
    const targetWO = this.worldObjects.find(wo => wo.vocab.id === quest.target.id && wo.active);

    // Point Lumi toward the target
    if (targetWO) {
      const dir = targetWO.group.position.clone().sub(this.npcGroup.position);
      this.npcTargetRotY = Math.atan2(dir.x, dir.z);
    }

    // Spotlight the target — glow ring on
    if (targetWO) targetWO.setIntroSpotlight(true);

    this.npcBounceT = 0.8;

    // "¡Mira! ¡La manzana!"
    this.ui.setQuest(quest.kind, true);
    await this.clips.speakAsync(`intro-${quest.target.id}`, `¡Mira! ¡${quest.target.say}!`);

    // Brief pause so the image settles
    await delay(600);

    // Turn off spotlight, speak the command
    if (targetWO) targetWO.setIntroSpotlight(false);
    this.ui.setQuest(quest.kind, false);

    this.speakQuestCommand();
  }

  private speakQuestCommand(): void {
    const quest = this.questDir.quest;
    const kind  = quest.kind === 'touch' ? 'touch' : quest.kind === 'give' ? 'give' : 'find';
    const clipId = `${kind}-${quest.target.id}`;

    this.phase = 'speaking';
    this.ui.setQuest(quest.kind, true);
    this.npcBounceT = 0.6;

    this.clips.speak(clipId, quest.line.text, {
      onEnd: () => {
        if (this.phase === 'speaking') {
          this.phase = 'playing';
          this.questStartTime = performance.now();
        }
        this.ui.setQuest(quest.kind, false);
      },
    });
  }

  // ─── World object spawning ────────────────────────────────────────────────

  private spawnRound(): void {
    for (const wo of this.worldObjects) { this.scene.remove(wo.group); wo.dispose(); }
    this.worldObjects = [];

    const quest = this.questDir.quest;
    const specs  = this.questDir.buildSpawnSet(7);
    const placed = new Set<string>();

    specs.forEach((spec, i) => {
      let pos: THREE.Vector3;
      let tries = 0;
      do {
        const a = (i / specs.length) * Math.PI * 2 + (Math.random() - 0.5) * 1.4;
        const r = PLAY_RADIUS * (0.32 + Math.random() * 0.48);
        pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
        tries++;
      } while (
        tries < 30 &&
        (pos.distanceTo(this.playerGroup.position) < 1.8 ||
         pos.distanceTo(NPC_POSITION) < 2.2 ||
         [...placed].some(k => {
           const [x, z] = k.split(',').map(Number);
           return new THREE.Vector3(x, 0, z).distanceTo(pos) < 1.9;
         }))
      );
      placed.add(`${pos.x},${pos.z}`);

      // Keep known confusion pairs far apart in the spawn layout
      if (!spec.colorId && quest.target && this.progress.areConfused(spec.vocab.id, quest.target.id)) {
        // Re-attempt with a greater minimum distance from target world objects
        const targetWOs = this.worldObjects.filter(w => w.vocab.id === quest.target.id);
        for (const twin of targetWOs) {
          if (pos.distanceTo(twin.group.position) < 3.5) {
            const a2 = Math.random() * Math.PI * 2;
            pos = new THREE.Vector3(Math.cos(a2) * PLAY_RADIUS * 0.7, 0, Math.sin(a2) * PLAY_RADIUS * 0.7);
          }
        }
      }

      const wo = new WorldObject(i, spec.vocab, pos, spec.colorId, spec.colorOverride);
      this.worldObjects.push(wo);
      this.scene.add(wo.group);
    });

    this.wrongCount = 0;
  }

  // ─── Update loop ─────────────────────────────────────────────────────────

  private update(delta: number, elapsed: number): void {
    this.frame++;
    resizeRenderer(this.renderer, this.camera, 2);
    this.biome.update(delta, elapsed);

    if (this.phase === 'start') {
      this.npcGroup.rotation.y = Math.sin(elapsed * 1.4) * 0.25;
      this.cameraRig.update(delta, this.playerGroup.position, 0.12);
      this.publishDiagnostics();
      return;
    }

    // ── Player movement (playing / speaking phases) ──
    const canMove = this.phase === 'playing' || this.phase === 'speaking';
    if (canMove) {
      this.input.readMovement(this.playerMove);
      const target = new THREE.Vector3(this.playerMove.x, 0, this.playerMove.y).multiplyScalar(PLAYER_SPEED);
      this.playerVelocity.lerp(target, 1 - Math.exp(-PLAYER_ACCEL * delta));
      this.playerGroup.position.addScaledVector(this.playerVelocity, delta);

      const flat = new THREE.Vector2(this.playerGroup.position.x, this.playerGroup.position.z);
      if (flat.length() > PLAY_RADIUS - 0.8) {
        flat.setLength(PLAY_RADIUS - 0.8);
        this.playerGroup.position.x = flat.x;
        this.playerGroup.position.z = flat.y;
      }

      if (this.playerVelocity.lengthSq() > 0.01) {
        this.playerGroup.rotation.y = Math.atan2(this.playerVelocity.x, -this.playerVelocity.z);
      }
      this.playerGroup.position.y = Math.sin(elapsed * 9) * Math.min(this.playerVelocity.length() / 36, 0.07);
    }

    // ── Quest interactions (playing phase only) ──
    if (this.phase === 'playing') {
      // Proximity auto-collect
      for (const wo of this.worldObjects) {
        if (!wo.active) continue;
        if (this.playerGroup.position.distanceTo(wo.group.position) < 1.0) {
          this.evaluateObject(wo);
          break;
        }
      }

      // Give quest delivery
      if (this.questDir.quest.kind === 'give' && this.questDir.quest.carrying) {
        if (this.playerGroup.position.distanceTo(NPC_POSITION) < 2.0) this.onDelivery();
      }

      // Hint ring after 3 misses
      const hintId = this.questDir.quest.target.id;
      for (const wo of this.worldObjects) {
        wo.setHighlight(this.wrongCount >= 3 && wo.vocab.id === hintId && wo.active && !wo.isIntroSpotlit);
      }

      // Tap
      if (this.pendingTap) { this.processTap(this.pendingTap); this.pendingTap = null; }
    }

    // ── World objects ──
    for (const wo of this.worldObjects) wo.update(delta, elapsed);

    // ── NPC Lumi animation ──
    const targetRotY = this.phase === 'introducing' ? this.npcTargetRotY : Math.sin(elapsed * 1.4) * 0.22;
    this.npcGroup.rotation.y += (targetRotY - this.npcGroup.rotation.y) * Math.min(1, delta * 6);
    if (this.npcBounceT > 0) {
      this.npcBounceT = Math.max(0, this.npcBounceT - delta);
      this.npcBody.position.y = Math.sin(this.npcBounceT * 18) * 0.14 * this.npcBounceT;
    }

    // ── Celebrate / hatch timers ──
    if (this.phase === 'celebrating') {
      this.celebrateTimer -= delta;
      if (this.celebrateTimer <= 0) {
        if (this.pendingCreature) { this.startHatch(this.pendingCreature); this.pendingCreature = null; }
        else void this.advanceQuest();
      }
    }
    if (this.phase === 'hatching') {
      this.hatchTimer -= delta;
      if (this.hatchTimer <= 0) void this.advanceQuest();
    }

    this.confetti.update(delta);
    this.cameraRig.update(delta, this.playerGroup.position, 0.14);
    this.progress.addSeconds(delta);
    this.publishDiagnostics();
  }

  // ─── Tap / click ─────────────────────────────────────────────────────────

  private readonly onCanvasClick = (e: MouseEvent) => {
    this.pendingTap = new THREE.Vector2(
      (e.clientX / window.innerWidth)  * 2 - 1,
      -((e.clientY / window.innerHeight) * 2 - 1),
    );
  };

  private readonly onCanvasTouch = (e: TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (!t) return;
    this.pendingTap = new THREE.Vector2(
      (t.clientX / window.innerWidth)  * 2 - 1,
      -((t.clientY / window.innerHeight) * 2 - 1),
    );
  };

  private processTap(ndc: THREE.Vector2): void {
    if (this.phase !== 'playing') return;
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const wo of this.worldObjects) if (wo.active) wo.group.traverse(o => meshes.push(o));
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;
    const wo = this.worldObjects.find(w => w.owns(hits[0].object));
    if (wo) this.evaluateObject(wo);
  }

  // ─── Quest evaluation ─────────────────────────────────────────────────────

  private evaluateObject(wo: WorldObject): void {
    if (this.phase !== 'playing' || !wo.active) return;

    const responseMs = performance.now() - this.questStartTime;
    const result = this.questDir.evaluateSelection(wo.descriptor);
    const correct = result.outcome !== 'wrong';

    // Record with confusion info
    const confusedWith = !correct ? wo.vocab.id : undefined;
    this.progress.recordAttempt(this.questDir.quest.target.id, correct, responseMs, confusedWith);

    if (!correct) {
      this.sfx.play('wrong');
      this.nudgeIndex++;
      this.wrongCount++;
      this.clips.speak(`nudge-${this.nudgeIndex % 3}`, nudge(this.nudgeIndex));
      // Replay quest command after the nudge
      const quest = this.questDir.quest;
      const kind  = quest.kind === 'touch' ? 'touch' : quest.kind === 'give' ? 'give' : 'find';
      setTimeout(() => this.clips.speak(`${kind}-${quest.target.id}`, quest.line.text), 1600);
      return;
    }

    // Correct or progress
    wo.startCollect();
    this.sfx.play(result.outcome === 'progress' ? 'collect' : 'correct');

    const burstPos = wo.group.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this.confetti.burst(burstPos, this.progress.settings.reducedMotion ? 20 : 60);

    if (result.outcome === 'pickup') {
      this.clips.speak(`carrying-${wo.vocab.id}`, `¡Sí! Dale ${wo.vocab.say} a Lumi.`);
      return;
    }

    if (result.questComplete) this.onQuestComplete();
  }

  private onDelivery(): void {
    if (this.phase !== 'playing' || !this.questDir.deliver()) return;
    this.sfx.play('correct');
    this.confetti.burst(NPC_POSITION.clone().add(new THREE.Vector3(0, 1, 0)), 60);
    this.onQuestComplete();
  }

  private onQuestComplete(): void {
    const praiseIdx = this.praiseIndex++;
    const praiseLine = praise(praiseIdx);
    this.ui.showBanner(praiseLine);
    this.clips.speak(`praise-${praiseIdx % 6}`, praiseLine);
    this.phase = 'celebrating';
    this.celebrateTimer = 1.4;
    this.npcBounceT = 1.0;
  }

  private async advanceQuest(): Promise<void> {
    const { quest, event } = this.questDir.next();

    if (event.unlockedWord) {
      this.ui.showToast('🆕', `Nueva palabra: ${event.unlockedWord.es}!`);
      await this.clips.speakAsync('new-word', '¡Nueva palabra!');
    }

    if (event.awardCreature) {
      this.pendingCreature = event.awardCreature.id;
    }

    this.spawnRound();

    if (this.pendingCreature) return; // hatch will call advanceQuest after

    // Intro new words; replay command for known ones.
    // Phase and questStartTime are set by speakQuestCommand()'s onEnd callback.
    if (this.progress.needsIntro(quest.target.id)) {
      await this.runIntro();
    } else {
      this.speakQuestCommand();
    }
  }

  // ─── Creature hatch ───────────────────────────────────────────────────────

  private startHatch(vocabId: string): void {
    const added = this.progress.addCreature(vocabId);
    if (!added) { void this.advanceQuest(); return; }

    const vocab = MEADOW_VOCAB.find(v => v.id === vocabId)!;
    this.ui.showToast('🎉', `¡Nuevo amigo! ${vocab.es}`);
    this.sfx.play('hatch');
    void this.clips.speakAsync('new-friend', '¡Nuevo amigo!');

    this.phase = 'hatching';
    this.hatchTimer = 2.2;

    const egg = buildEgg(vocab.color);
    egg.position.copy(this.playerGroup.position).add(new THREE.Vector3(0, 1.5, 0));
    this.scene.add(egg);
    this.confetti.burst(egg.position, this.progress.settings.reducedMotion ? 30 : 100);

    setTimeout(() => {
      this.scene.remove(egg);
      disposeObject3D(egg);
      const pal = buildMonster({ body: vocab.color, belly: 0xfff9e8, scale: 0.62 });
      pal.position.copy(this.playerGroup.position).add(new THREE.Vector3(0.9, 0, 0));
      this.scene.add(pal);
      setTimeout(() => { this.scene.remove(pal); disposeObject3D(pal); }, 1600);
    }, 700);

    this.ui.setPalCount(this.progress.creatures.length);
    this.ui.updatePalBook(this.progress.creatures, MEADOW_VOCAB);
  }

  // ─── Diagnostics ─────────────────────────────────────────────────────────

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      phase: this.phase,
      quest: this.questDir.quest
        ? { kind: this.questDir.quest.kind, target: this.questDir.quest.target.id, collected: this.questDir.quest.collected }
        : null,
      completedQuests: this.questDir.completedCount,
      creatures: this.progress.creatures.length,
      worldObjects: this.worldObjects.filter(w => w.active).length,
      player: {
        position: { x: +this.playerGroup.position.x.toFixed(2), y: +this.playerGroup.position.y.toFixed(2), z: +this.playerGroup.position.z.toFixed(2) },
        speed: +this.playerVelocity.length().toFixed(2),
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: window.devicePixelRatio,
      },
    };
  }

  dispose(): void {
    this.loop.stop();
    this.canvas.removeEventListener('click', this.onCanvasClick);
    this.canvas.removeEventListener('touchend', this.onCanvasTouch);
    this.input.dispose();
    this.sfx.dispose();
    this.clips.dispose();
    this.ui.dispose();
    this.confetti.dispose();
    for (const wo of this.worldObjects) wo.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
