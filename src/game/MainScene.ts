import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import { AudioClips } from '../systems/AudioClips';
import { GameUI } from '../systems/GameUI';
import { ProgressStore } from '../systems/ProgressStore';
import { QuestDirector } from '../systems/QuestDirector';
import { SpanishVoice } from '../systems/SpanishVoice';
import { praise, nudge } from '../content/quests';
import { MEADOW_VOCAB } from '../content/vocabulary';
import type { VocabItem } from '../content/vocabulary';
import { drawIsland } from '../drawing/drawIsland';
import { drawCharacter } from '../drawing/drawCharacter';
import { drawItem, drawBadge } from '../drawing/drawItem';

// ── Layout (800×600 logical canvas) ──────────────────────────────────────────
const ISLAND_CX      = 400;
const ISLAND_CY      = 310;
const PLAY_SA        = 205;   // play area ellipse semi-axis X
const PLAY_SB        = 130;   // play area ellipse semi-axis Y
const LUMI_X         = 400;
const LUMI_Y         = 175;
const PLAYER_START_X = 400;
const PLAYER_START_Y = 295;
const PLAYER_SPEED   = 160;   // px/s
const COLLECT_RADIUS = 38;    // px proximity to collect
const DELIVERY_RADIUS = 48;   // px proximity to Lumi for give quests
const ITEM_ARC_CX    = 400;
const ITEM_ARC_CY    = 348;
const ITEM_ARC_R     = 88;
const ITEM_ARC_SPAN  = Math.PI * 0.85; // ~153°

type Phase = 'start' | 'introducing' | 'speaking' | 'playing' | 'celebrating' | 'hatching';

interface WorldObj {
  x: number;
  y: number;
  vocab: VocabItem;
  colorId?: string;
  active: boolean;
  container: Phaser.GameObjects.Container;
  spotGfx: Phaser.GameObjects.Graphics;
  hintGfx: Phaser.GameObjects.Graphics;
  spotlit: boolean;
  highlighted: boolean;
}

export class MainScene extends Phaser.Scene {
  // ── Systems ──────────────────────────────────────────────────────────────
  private sfx!: AudioSystem;
  private voice!: SpanishVoice;
  private clips!: AudioClips;
  private progress!: ProgressStore;
  private questDir!: QuestDirector;
  private ui!: GameUI;

  // ── Scene objects ─────────────────────────────────────────────────────────
  private playerContainer!: Phaser.GameObjects.Container;
  private lumiContainer!: Phaser.GameObjects.Container;
  private speechBubbleGfx!: Phaser.GameObjects.Graphics;
  private speechBubbleText!: Phaser.GameObjects.Text;
  private worldObjects: WorldObj[] = [];

  // ── Player physics ────────────────────────────────────────────────────────
  private playerX = PLAYER_START_X;
  private playerY = PLAYER_START_Y;
  private velX = 0;
  private velY = 0;

  // ── Input ─────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private touchActiveId = -1;
  private touchStartX   = 0;
  private touchStartY   = 0;
  private touchDx       = 0;
  private touchDy       = 0;

  // ── Game state ────────────────────────────────────────────────────────────
  private phase: Phase = 'start';
  private praiseIndex  = 0;
  private nudgeIndex   = 0;
  private wrongCount   = 0;
  private celebrateTimer = 0;
  private hatchTimer     = 0;
  private npcBounceTimer = 0;
  private pendingCreature: string | null = null;
  private questStartTime = 0;
  private evalCooldown   = 0;
  private replayTimeout: ReturnType<typeof setTimeout> | null = null;
  private elapsed = 0;

  constructor() { super({ key: 'MainScene' }); }

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  create(): void {
    // Systems
    this.sfx      = new AudioSystem();
    this.voice    = new SpanishVoice();
    this.clips    = new AudioClips(this.voice);
    this.progress = new ProgressStore();
    this.questDir = new QuestDirector({
      npcName: 'Lumi',
      alreadyCollected: this.progress.creatures,
    });

    this.ui = new GameUI({
      onPlay:       () => void this.startGame(),
      onReplay:     () => {
        this.sfx.play('tap');
        const q = this.questDir.quest;
        if (q) {
          const kind = q.kind === 'touch' ? 'touch' : q.kind === 'give' ? 'give' : 'find';
          this.clips.speak(`${kind}-${q.target.id}`, q.line.text);
        }
      },
      onMuteChange: (m) => {
        this.sfx.setMuted(m);
        this.clips.setMuted(m);
        this.progress.setSettings({ muted: m });
      },
      onSlowChange: (s) => {
        this.voice.setBaseRate(s ? 0.72 : 0.95);
        this.progress.setSettings({ slowSpeech: s });
      },
      onCalmChange: (c) => { this.progress.setSettings({ reducedMotion: c }); },
    });

    const { muted, slowSpeech, reducedMotion } = this.progress.settings;
    this.sfx.setMuted(muted);
    this.clips.setMuted(muted);
    if (slowSpeech) this.voice.setBaseRate(0.72);
    this.ui.applySettings(muted, slowSpeech, reducedMotion);

    // Ocean gradient background
    const bgGfx = this.add.graphics();
    bgGfx.fillGradientStyle(0x70d5f5, 0x70d5f5, 0x0e5fa0, 0x0e5fa0, 1, 1, 1, 1);
    bgGfx.fillRect(0, 0, 800, 600);
    bgGfx.setDepth(-1);

    // Island background (drawn once, static)
    const islandGfx = this.add.graphics();
    drawIsland(islandGfx, ISLAND_CX, ISLAND_CY);
    islandGfx.setDepth(0);

    // Lumi
    const lumiGfx = this.add.graphics();
    drawCharacter(lumiGfx, 'lumi');
    this.lumiContainer = this.add.container(LUMI_X, LUMI_Y, [lumiGfx]);
    this.lumiContainer.setDepth(10);

    // Speech bubble (child of lumiContainer — bobs with Lumi)
    this.speechBubbleGfx = this.add.graphics();
    this.speechBubbleText = this.add.text(0, -88, '', {
      fontSize: '20px',
      fontFamily: '"Nunito", "Quicksand", "Arial Rounded MT Bold", system-ui, sans-serif',
      color: '#3a2e4a',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.lumiContainer.add([this.speechBubbleGfx, this.speechBubbleText]);
    this.speechBubbleGfx.setVisible(false);
    this.speechBubbleText.setVisible(false);

    // Thomas (player)
    const playerGfx = this.add.graphics();
    drawCharacter(playerGfx, 'thomas');
    this.playerContainer = this.add.container(PLAYER_START_X, PLAYER_START_Y, [playerGfx]);
    this.playerContainer.setDepth(15);

    // Keyboard
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
    }) as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    // Touch joystick: left half of screen = move, tap anywhere = collect
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.x < 400 && this.touchActiveId === -1) {
        this.touchActiveId = ptr.id;
        this.touchStartX   = ptr.x;
        this.touchStartY   = ptr.y;
        this.touchDx = 0;
        this.touchDy = 0;
      }
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id !== this.touchActiveId) return;
      const dx  = ptr.x - this.touchStartX;
      const dy  = ptr.y - this.touchStartY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 5) {
        this.touchDx = dx / Math.max(len, 40);
        this.touchDy = dy / Math.max(len, 40);
      }
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.id === this.touchActiveId) {
        this.touchActiveId = -1;
        this.touchDx = 0;
        this.touchDy = 0;
      }
      // Tap to collect
      if (this.phase === 'playing') {
        for (const wo of this.worldObjects) {
          if (!wo.active) continue;
          const dx = ptr.x - wo.x;
          const dy = ptr.y - wo.y;
          if (Math.sqrt(dx * dx + dy * dy) < COLLECT_RADIUS + 10) {
            this.evaluateObject(wo);
            break;
          }
        }
      }
    });

    // Pal book speak events
    document.addEventListener('pal-speak', (e) => {
      const id = (e as CustomEvent<string>).detail;
      const v  = MEADOW_VOCAB.find(w => w.id === id);
      if (v) this.clips.speak(`word-${v.id}`, v.say);
    });

    if (!this.voice.supported) this.ui.setVoiceNote('⚠️ Audio not available in this browser.');
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;

    // Lumi idle bob
    this.lumiContainer.y = LUMI_Y + Math.sin(this.elapsed * 1.4) * 3;
    if (this.npcBounceTimer > 0) {
      this.npcBounceTimer = Math.max(0, this.npcBounceTimer - dt);
      this.lumiContainer.scaleY = 1 + Math.sin(this.npcBounceTimer * 18) * 0.08 * this.npcBounceTimer;
    } else {
      this.lumiContainer.scaleY = 1;
    }

    if (this.phase === 'start') return;

    // ── Player movement ──────────────────────────────────────────────────
    const canMove = this.phase === 'playing' || this.phase === 'speaking';
    if (canMove) {
      let ix = 0, iy = 0;
      if (this.cursors.left.isDown  || this.wasd.A.isDown) ix -= 1;
      if (this.cursors.right.isDown || this.wasd.D.isDown) ix += 1;
      if (this.cursors.up.isDown    || this.wasd.W.isDown) iy -= 1;
      if (this.cursors.down.isDown  || this.wasd.S.isDown) iy += 1;
      if (this.touchActiveId !== -1) { ix += this.touchDx; iy += this.touchDy; }

      const ilen = Math.sqrt(ix * ix + iy * iy);
      if (ilen > 1) { ix /= ilen; iy /= ilen; }

      const accel = 1 - Math.exp(-14 * dt);
      this.velX += (ix * PLAYER_SPEED - this.velX) * accel;
      this.velY += (iy * PLAYER_SPEED - this.velY) * accel;
      this.playerX += this.velX * dt;
      this.playerY += this.velY * dt;

      // Clamp to island ellipse
      const edx = this.playerX - ISLAND_CX;
      const edy = this.playerY - ISLAND_CY;
      const d2  = (edx / PLAY_SA) ** 2 + (edy / PLAY_SB) ** 2;
      if (d2 > 1) {
        const d = Math.sqrt(d2);
        this.playerX = ISLAND_CX + (edx / d) * PLAY_SA;
        this.playerY = ISLAND_CY + (edy / d) * PLAY_SB;
      }

      const speed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
      this.playerContainer.x = this.playerX;
      this.playerContainer.y = this.playerY + Math.sin(this.elapsed * 9) * Math.min(speed / 320, 4);
    }

    // ── Quest interaction (playing phase) ────────────────────────────────
    if (this.phase === 'playing') {
      this.evalCooldown = Math.max(0, this.evalCooldown - dt);

      // Proximity collect
      for (const wo of this.worldObjects) {
        if (!wo.active) continue;
        const dx = this.playerX - wo.x;
        const dy = this.playerY - wo.y;
        if (Math.sqrt(dx * dx + dy * dy) < COLLECT_RADIUS && this.evalCooldown <= 0) {
          this.evaluateObject(wo);
          break;
        }
      }

      // Give-quest delivery
      if (this.questDir.quest.kind === 'give' && this.questDir.quest.carrying) {
        const dx = this.playerX - LUMI_X;
        const dy = this.playerY - LUMI_Y;
        if (Math.sqrt(dx * dx + dy * dy) < DELIVERY_RADIUS) this.onDelivery();
      }

      // Hint rings after 3 wrong answers
      const hintId = this.questDir.quest.target.id;
      for (const wo of this.worldObjects) {
        const shouldHint = this.wrongCount >= 3 && wo.vocab.id === hintId && wo.active && !wo.spotlit;
        if (wo.highlighted !== shouldHint) { wo.highlighted = shouldHint; this.redrawRings(wo); }
      }
    }

    // ── Phase timers ──────────────────────────────────────────────────────
    if (this.phase === 'celebrating') {
      this.celebrateTimer -= dt;
      if (this.celebrateTimer <= 0) {
        if (this.pendingCreature) {
          this.startHatch(this.pendingCreature);
          this.pendingCreature = null;
        } else {
          void this.advanceQuest();
        }
      }
    }
    if (this.phase === 'hatching') {
      this.hatchTimer -= dt;
      if (this.hatchTimer <= 0) void this.advanceQuest();
    }

    // Animate spotlight / hint rings
    for (const wo of this.worldObjects) {
      if (wo.spotlit) {
        wo.spotGfx.clear();
        wo.spotGfx.lineStyle(3, 0x2ec5c1, 0.75 + Math.sin(this.elapsed * 3) * 0.2);
        wo.spotGfx.strokeCircle(0, 0, 30 + Math.sin(this.elapsed * 3) * 3);
      }
      if (wo.highlighted) {
        wo.hintGfx.clear();
        wo.hintGfx.lineStyle(3, 0xffe66d, 0.55 + Math.sin(this.elapsed * 5) * 0.2);
        wo.hintGfx.strokeCircle(0, 0, 34 + Math.sin(this.elapsed * 5) * 3);
      }
    }

    this.progress.addSeconds(dt);
  }

  // ── Game start ────────────────────────────────────────────────────────────

  private async startGame(): Promise<void> {
    await this.clips.init();
    this.ui.enterPlay('');
    this.ui.setPalCount(this.progress.creatures.length);
    this.ui.updatePalBook(this.progress.creatures, MEADOW_VOCAB);

    await this.clips.speakAsync('lumi-hello', '¡Hola! Soy Lumi.');
    await this.clips.speakAsync('lumi-ready', '¿Listo? ¡Vamos!');

    const quest = this.questDir.start();
    this.spawnRound();

    if (this.progress.needsIntro(quest.target.id)) await this.runIntro();
    else this.speakQuestCommand();
  }

  // ── Intro sequence ────────────────────────────────────────────────────────

  private async runIntro(): Promise<void> {
    const quest = this.questDir.quest;
    this.phase = 'introducing';
    this.progress.markIntroduced(quest.target.id);

    const targetWO = this.worldObjects.find(wo => wo.vocab.id === quest.target.id && wo.active);
    if (targetWO) { targetWO.spotlit = true; this.redrawRings(targetWO); }
    this.npcBounceTimer = 0.8;
    this.ui.setQuest(quest.kind, true);

    this.showSpeechBubble(quest.target.say);
    await this.clips.speakAsync(`intro-${quest.target.id}`, `¡Mira! ¡${quest.target.say}!`);
    await delay(600);

    if (targetWO) { targetWO.spotlit = false; this.redrawRings(targetWO); }
    this.ui.setQuest(quest.kind, false);
    this.speakQuestCommand();
  }

  private speakQuestCommand(): void {
    const quest = this.questDir.quest;
    const kind  = quest.kind === 'touch' ? 'touch' : quest.kind === 'give' ? 'give' : 'find';
    this.phase = 'speaking';
    this.ui.setQuest(quest.kind, true);
    this.npcBounceTimer = 0.6;
    this.showSpeechBubble(quest.target.say);
    this.clips.speak(`${kind}-${quest.target.id}`, quest.line.text, {
      onEnd: () => {
        if (this.phase === 'speaking') {
          this.phase = 'playing';
          this.questStartTime = performance.now();
        }
        this.ui.setQuest(quest.kind, false);
      },
    });
  }

  // ── World object spawning ─────────────────────────────────────────────────

  private spawnRound(): void {
    for (const wo of this.worldObjects) wo.container.destroy();
    this.worldObjects = [];

    const specs = this.questDir.buildSpawnSet(7);
    const n = specs.length;

    specs.forEach((spec, i) => {
      const t     = n > 1 ? i / (n - 1) : 0.5;
      const angle = (t - 0.5) * ITEM_ARC_SPAN;
      const wx    = ITEM_ARC_CX + Math.sin(angle) * ITEM_ARC_R;
      const wy    = ITEM_ARC_CY + Math.cos(angle) * ITEM_ARC_R;

      const badgeGfx = this.add.graphics();
      drawBadge(badgeGfx);

      const itemGfx = this.add.graphics();
      drawItem(itemGfx, spec.vocab.model, spec.colorOverride ?? spec.vocab.color, spec.vocab.accent);

      const spotGfx = this.add.graphics();
      const hintGfx = this.add.graphics();

      // Order: badge behind hint/spot rings, item on top
      const container = this.add.container(wx, wy, [badgeGfx, hintGfx, spotGfx, itemGfx]);
      container.setDepth(5 + i * 0.1);

      this.worldObjects.push({
        x: wx, y: wy,
        vocab: spec.vocab, colorId: spec.colorId,
        active: true, container,
        spotGfx, hintGfx,
        spotlit: false, highlighted: false,
      });
    });

    this.wrongCount = 0;
  }

  private redrawRings(wo: WorldObj): void {
    wo.spotGfx.clear();
    if (wo.spotlit) {
      wo.spotGfx.lineStyle(3, 0x2ec5c1, 0.8);
      wo.spotGfx.strokeCircle(0, 0, 30);
    }
    wo.hintGfx.clear();
    if (wo.highlighted) {
      wo.hintGfx.lineStyle(3, 0xffe66d, 0.7);
      wo.hintGfx.strokeCircle(0, 0, 34);
    }
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  private evaluateObject(wo: WorldObj): void {
    if (this.phase !== 'playing' || !wo.active) return;

    const responseMs = performance.now() - this.questStartTime;
    const result     = this.questDir.evaluateSelection({ vocabId: wo.vocab.id, colorId: wo.colorId });
    const correct    = result.outcome !== 'wrong';

    this.progress.recordAttempt(
      this.questDir.quest.target.id, correct, responseMs,
      !correct ? wo.vocab.id : undefined,
    );

    if (!correct) {
      this.sfx.play('wrong');
      this.evalCooldown = 0.9;
      this.nudgeIndex++;
      this.wrongCount++;
      this.clips.speak(`nudge-${this.nudgeIndex % 3}`, nudge(this.nudgeIndex));
      const q    = this.questDir.quest;
      const kind = q.kind === 'touch' ? 'touch' : q.kind === 'give' ? 'give' : 'find';
      clearTimeout(this.replayTimeout ?? undefined);
      this.replayTimeout = setTimeout(() => this.clips.speak(`${kind}-${q.target.id}`, q.line.text), 1600);
      return;
    }

    this.evalCooldown = 0;
    wo.active = false;
    this.sfx.play(result.outcome === 'progress' ? 'collect' : 'correct');
    this.burstConfetti(wo.x, wo.y);

    this.tweens.add({
      targets: wo.container,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 300, ease: 'Back.in',
      onComplete: () => wo.container.setVisible(false),
    });

    if (result.outcome === 'pickup') {
      this.clips.speak(`carrying-${wo.vocab.id}`, `¡Sí! Dale ${wo.vocab.say} a Lumi.`);
      return;
    }
    if (result.questComplete) this.onQuestComplete();
  }

  private onDelivery(): void {
    if (this.phase !== 'playing' || !this.questDir.deliver()) return;
    this.sfx.play('correct');
    this.burstConfetti(LUMI_X, LUMI_Y);
    this.onQuestComplete();
  }

  private onQuestComplete(): void {
    this.hideSpeechBubble();
    const idx  = this.praiseIndex++;
    const line = praise(idx);
    this.ui.showBanner(line);
    this.clips.speak(`praise-${idx % 6}`, line);
    this.phase = 'celebrating';
    this.celebrateTimer = 1.4;
    this.npcBounceTimer = 1.0;
  }

  private async advanceQuest(): Promise<void> {
    this.clips.cancel();
    const { quest, event } = this.questDir.next();

    if (event.unlockedWord) {
      this.ui.showToast('🆕', `Nueva palabra: ${event.unlockedWord.es}!`);
      await this.clips.speakAsync('new-word', '¡Nueva palabra!');
    }
    if (event.awardCreature) this.pendingCreature = event.awardCreature.id;

    this.spawnRound();
    if (this.pendingCreature) return;

    if (this.progress.needsIntro(quest.target.id)) await this.runIntro();
    else this.speakQuestCommand();
  }

  // ── Creature hatch ────────────────────────────────────────────────────────

  private startHatch(vocabId: string): void {
    const added = this.progress.addCreature(vocabId);
    if (!added) { void this.advanceQuest(); return; }

    const vocab = MEADOW_VOCAB.find(v => v.id === vocabId)!;
    this.ui.showToast('🎉', `¡Nuevo amigo! ${vocab.es}`);
    this.sfx.play('hatch');
    this.clips.cancel();
    void this.clips.speakAsync('new-friend', '¡Nuevo amigo!');

    this.phase = 'hatching';
    this.hatchTimer = 2.2;

    // Egg pop animation
    const eggGfx = this.add.graphics();
    eggGfx.fillStyle(vocab.color, 1);
    eggGfx.lineStyle(4, 0x120d1a, 1);
    eggGfx.fillEllipse(0, 0, 38, 48);
    eggGfx.strokeEllipse(0, 0, 38, 48);
    const egg = this.add.container(this.playerX, this.playerY - 30, [eggGfx]);
    egg.setDepth(25);
    this.tweens.add({
      targets: egg,
      y: this.playerY - 90,
      scaleX: 1.3, scaleY: 1.3,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.out',
      onComplete: () => egg.destroy(),
    });

    this.burstConfetti(this.playerX, this.playerY, 80);
    this.ui.setPalCount(this.progress.creatures.length);
    this.ui.updatePalBook(this.progress.creatures, MEADOW_VOCAB);
  }

  // ── Speech bubble ────────────────────────────────────────────────────────

  private showSpeechBubble(word: string): void {
    this.speechBubbleText.setText(word);
    const tw  = Math.max(this.speechBubbleText.width + 32, 80);
    const th  = Math.max(this.speechBubbleText.height + 20, 44);
    const cy  = -88; // center Y in lumiContainer local space

    this.speechBubbleGfx.clear();

    // Shadow
    this.speechBubbleGfx.fillStyle(0x2a1846, 1);
    this.speechBubbleGfx.fillRoundedRect(-tw / 2 + 3, cy - th / 2 + 5, tw, th, 13);

    // Bubble fill
    this.speechBubbleGfx.fillStyle(0xfffef0, 1);
    this.speechBubbleGfx.fillRoundedRect(-tw / 2, cy - th / 2, tw, th, 13);

    // Tail fill (covers bubble bottom stroke at junction)
    const tailY = cy + th / 2;
    this.speechBubbleGfx.fillStyle(0xfffef0, 1);
    this.speechBubbleGfx.fillTriangle(-9, tailY, 9, tailY, 0, tailY + 14);

    // Bubble stroke
    this.speechBubbleGfx.lineStyle(4, 0x120d1a, 1);
    this.speechBubbleGfx.strokeRoundedRect(-tw / 2, cy - th / 2, tw, th, 13);

    // Tail diagonal lines only (skip the horizontal top of the triangle)
    this.speechBubbleGfx.beginPath();
    this.speechBubbleGfx.moveTo(-9, tailY);
    this.speechBubbleGfx.lineTo(0, tailY + 14);
    this.speechBubbleGfx.strokePath();
    this.speechBubbleGfx.beginPath();
    this.speechBubbleGfx.moveTo(9, tailY);
    this.speechBubbleGfx.lineTo(0, tailY + 14);
    this.speechBubbleGfx.strokePath();

    this.speechBubbleGfx.setVisible(true);
    this.speechBubbleText.setVisible(true);
  }

  private hideSpeechBubble(): void {
    this.speechBubbleGfx.setVisible(false);
    this.speechBubbleText.setVisible(false);
  }

  // ── Confetti ──────────────────────────────────────────────────────────────

  private burstConfetti(x: number, y: number, count = 40): void {
    if (this.progress.settings.reducedMotion) count = Math.floor(count / 3);
    const colors = [0xff6b6b, 0xffd23f, 0x6ec840, 0x3aa0e2, 0xb06cff, 0xff8c42, 0x2ec5c1];
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics();
      g.fillStyle(colors[i % colors.length], 1);
      g.fillRect(-4, -4, 8, 8);
      g.x = x;
      g.y = y;
      g.setDepth(30);
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 140;
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 60,
        alpha: 0,
        angle: Math.random() * 720 - 360,
        duration: 600 + Math.random() * 400,
        ease: 'Cubic.out',
        onComplete: () => g.destroy(),
      });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
