import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import { AudioClips } from '../systems/AudioClips';
import { GameUI } from '../systems/GameUI';
import { ProgressStore } from '../systems/ProgressStore';
import { QuestDirector } from '../systems/QuestDirector';
import { SpanishVoice } from '../systems/SpanishVoice';
import { praise, nudge } from '../content/quests';
import { MEADOW_VOCAB } from '../content/vocabulary';
import { ACTIVE_COMMANDS, type CommandWord, type CommandAction } from '../content/commands';
import type { VocabItem } from '../content/vocabulary';
import { drawIsland } from '../drawing/drawIsland';
import { drawRocksAndFlowers, drawForeground } from '../drawing/drawDecorations';
import { drawBadge, ITEM_KEY } from '../drawing/drawItem';

// ── Island growth milestones — one decoration per Chispa collected ────────────
// Positions are kept in the UPPER island (y < 360) or FAR EDGES (x < 210 or x > 590)
// so they don't compete visually with vocab items that spawn in the center-lower zone.
const ISLAND_MILESTONES = [
  // Small flowers — upper grass zone, safely above item spawns
  { key: 'isle_yellow_flowers', chispaCount:  1, x: 260, y: 352, w:  64, h:  60, depth: 1 },
  { key: 'isle_pink_flowers',   chispaCount:  2, x: 527, y: 350, w:  64, h:  60, depth: 1 },
  { key: 'isle_purple_flowers', chispaCount:  3, x: 204, y: 430, w:  58, h:  54, depth: 1 },
  // Rocks — far edges so they read as island boundary, not game objects
  { key: 'isle_rock_small',     chispaCount:  4, x: 597, y: 432, w:  58, h:  44, depth: 1 },
  { key: 'isle_rock_large',     chispaCount:  5, x: 206, y: 396, w:  84, h:  64, depth: 1 },
  // Bush — upper right, snug under the right palm
  { key: 'isle_bush',           chispaCount:  6, x: 522, y: 307, w:  84, h:  65, depth: 1 },
  // Pond — upper center-left, centrepiece that doesn't block play
  { key: 'isle_pond',           chispaCount:  7, x: 308, y: 314, w: 128, h:  93, depth: 1 },
  // Sign — far left edge near sand, reads as decoration not an item
  { key: 'isle_sign',           chispaCount:  8, x: 213, y: 454, w:  68, h:  95, depth: 2 },
  // Bridge + dock — far right water edge, clearly part of the scenery
  { key: 'isle_bridge',         chispaCount:  9, x: 593, y: 452, w: 144, h:  98, depth: 1 },
  { key: 'isle_dock',           chispaCount: 10, x: 610, y: 480, w: 144, h: 106, depth: 1 },
  // Chest — upper island near the mound (feels hidden / discovered)
  { key: 'isle_chest',          chispaCount: 11, x: 330, y: 294, w:  76, h:  70, depth: 2 },
] as const;

// ── Layout (800×600 logical canvas) ──────────────────────────────────────────
const ISLAND_CX      = 400;
const ISLAND_CY      = 375;   // shifted down 65px to sit in ocean (not sky)
const PLAY_SA        = 205;   // play area ellipse semi-axis X
const PLAY_SB        = 130;   // play area ellipse semi-axis Y
const LUMI_X         = 400;
const LUMI_Y         = 240;   // ISLAND_CY - 135
const PLAYER_START_X = 400;
const PLAYER_START_Y = 360;   // ISLAND_CY - 15
const PLAYER_SPEED   = 160;   // px/s
const COLLECT_RADIUS = 38;    // px proximity to collect
const DELIVERY_RADIUS = 48;   // px proximity to Lumi for give quests
// Natural scatter positions — offset by +65 from original to match ISLAND_CY=375
// Four positions form a semicircle (rx=185, ry=75) centred at (400,383):
// top-left (180°), lower-left (240°), lower-right (300°), top-right (360°)
const ITEM_SCATTER: ReadonlyArray<{ x: number; y: number }> = [
  { x: 215, y: 383 },  // top-left
  { x: 308, y: 448 },  // lower-left
  { x: 493, y: 448 },  // lower-right
  { x: 585, y: 383 },  // top-right
  { x: 400, y: 505 },  // bottom center (overflow)
  { x: 338, y: 485 },  // inner left (overflow)
  { x: 462, y: 485 },  // inner right (overflow)
];

type Phase = 'start' | 'introducing' | 'speaking' | 'playing' | 'celebrating' | 'hatching' | 'simon';

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
  private lumiContainer!: Phaser.GameObjects.Container;
  private speechBubbleGfx!: Phaser.GameObjects.Graphics;
  private speechBubbleText!: Phaser.GameObjects.Text;
  private worldObjects: WorldObj[] = [];
  private carryIcon!: Phaser.GameObjects.Image;   // item floating above Thomas while carrying
  private lumiPulseRing!: Phaser.GameObjects.Graphics; // pulsing ring under Lumi during give quest
  private deliveryArrow!: Phaser.GameObjects.Graphics; // bouncing directional arrow → Lumi during carry
  private playerImg!: Phaser.GameObjects.Image;
  private playerNatScaleX = 1; // natural scaleX set by setDisplaySize(120,130) — captured once
  private playerNatScaleY = 1;
  private playerShadow!: Phaser.GameObjects.Graphics;
  private coinPending = 0; // fractional coin accumulator for progressive earn rate
  private islandDecos: (Phaser.GameObjects.Image | null)[] = [];

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
  private touchStickEl: HTMLElement | null = null;
  private touchKnobEl:  HTMLElement | null = null;

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
  private simonCounter   = 0;
  private simonResolve: (() => void) | null = null;
  private simonTarget: CommandAction | null = null;

  constructor() { super({ key: 'MainScene' }); }

  private static readonly ALL_SKIN_IDS = [
    // Free
    'menta', 'morado', 'azul', 'naranja',
    // Earned
    'alien', 'baby', 'cloud', 'hada', 'ghost', 'brillante', 'island',
    'origami', 'paint', 'pastel', 'pharaon', 'pirate', 'plushie',
    'prehistoric', 'princess', 'pumpkin', 'arcoiris', 'shark', 'sprite', 'stealth',
  ] as const;

  // ── Phaser lifecycle ──────────────────────────────────────────────────────

  preload(): void {
    (['apple','banana','strawberry','flower','star','ball',
      'fish','frog','bird','butterfly','mushroom','bone',
      'pencil','crayon','paper','book','backpack','scissors',
      'glue','eraser','notebook','ruler',
      'bucket','coral','crab','dolphin','jellyfish','sandcastle',
      'seagull','seashell','turtle','wave'] as const)
      .forEach(k => this.load.image(`vocab_${k}`, `assets/vocab_${k}.png`));
    // Palm tree — white bg removed by process-palm-tree.mjs
    this.load.image('palm', 'assets/palm_tree_alpha.png');
    // Scene background
    this.load.image('bg', 'assets/bg.png');
    // Chispa collectible creatures — one per vocab word
    MEADOW_VOCAB.forEach(v => this.load.image(`chispa_${v.id}`, `assets/chispa_${v.id}.png`));
    // Thomas — one hand-crafted skin per choice (free + all earned)
    MainScene.ALL_SKIN_IDS.forEach(id => this.load.image(`thomas_${id}`, `assets/thomas_${id}.png`));
    // Lumi — colored NPC sprite + portrait for start screen
    this.load.image('lumi', 'assets/lumi_base.png');
    this.load.image('lumi-portrait', 'assets/lumi_portrait.png');
    // Island growth decorations (processed by scripts/process-island-elements.mjs)
    ISLAND_MILESTONES.forEach(m => this.load.image(m.key, `assets/${m.key}.png`));
  }

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
      onColorPreview: (id) => {
        if (this.playerImg) this.playerImg.setTexture(`thomas_${id}`).setDisplaySize(120, 130);
      },
      onColorChange: (id) => {
        this.progress.setSettings({ playerColorId: id });
        if (this.playerImg) this.playerImg.setTexture(`thomas_${id}`).setDisplaySize(120, 130);
        this.ui.updateCustomizerSelection(id);
      },
      onParentDashboardOpen: () => {
        this.ui.updateDashboard(this.progress.parentSummary());
      },
      onColorUnlock: (id, cost) => {
        if (!this.progress.spendCoins(cost)) return;
        const isFirst = this.progress.unlockedColors.length === 0;
        this.progress.unlockColor(id);
        this.progress.setSettings({ playerColorId: id });
        if (this.playerImg) this.playerImg.setTexture(`thomas_${id}`).setDisplaySize(120, 130);
        this.ui.buildCustomizer(this.progress.unlockedColors, id, this.progress.coins);
        this.ui.updateCoins(this.progress.coins);
        { const nsx = this.playerNatScaleX, nsy = this.playerNatScaleY;
          if (isFirst) {
            this.burstConfetti(this.playerX, this.playerY, 80);
            this.tweens.add({ targets: this.playerImg, scaleX: nsx * 1.28, scaleY: nsy * 1.28, duration: 220, ease: 'Back.out', yoyo: true, onComplete: () => { this.playerImg.scaleX = nsx; this.playerImg.scaleY = nsy; } });
            this.ui.showToast('✨', '¡Nuevo look!');
          } else {
            this.burstConfetti(this.playerX, this.playerY, 28);
            this.tweens.add({ targets: this.playerImg, scaleX: nsx * 1.14, scaleY: nsy * 1.14, duration: 180, ease: 'Back.out', yoyo: true, onComplete: () => { this.playerImg.scaleX = nsx; this.playerImg.scaleY = nsy; } });
          } }
      },
    });

    const { muted, slowSpeech, reducedMotion } = this.progress.settings;
    this.sfx.setMuted(muted);
    this.clips.setMuted(muted);
    if (slowSpeech) this.voice.setBaseRate(0.72);
    this.ui.applySettings(muted, slowSpeech, reducedMotion, this.progress.settings.playerColorId);
    this.ui.buildCustomizer(this.progress.unlockedColors, this.progress.settings.playerColorId, this.progress.coins);
    this.ui.updateCoins(this.progress.coins);

    // Disable camera culling — the scene fits entirely in the 800×600 viewport so
    // culling has no benefit, and Phaser's cull incorrectly excludes edge-position
    // sprites when displaySize (120px) diverges from texture size (1254px) (issue #20).
    this.cameras.main.skipCull = true;

    // ── Scene background image (depth -1) ────────────────────────────────
    // 1448×1086 source → exact 4:3 match for 800×600 canvas
    this.add.image(400, 300, 'bg').setDisplaySize(800, 600).setDepth(-1);

    // ── Animated water ripple rings around island ──────────────────────────
    for (let i = 0; i < 4; i++) {
      const ringGfx = this.add.graphics();
      ringGfx.x = ISLAND_CX;
      ringGfx.y = ISLAND_CY;
      ringGfx.lineStyle(3 - i * 0.4, 0xb8e8ff, 1);
      ringGfx.strokeEllipse(0, 0, 548 + i * 22, 352 + i * 14);
      ringGfx.setDepth(-0.5);
      this.tweens.add({
        targets: ringGfx,
        alpha:  { from: 0.55, to: 0 },
        scaleX: { from: 1.0,  to: 1.10 },
        scaleY: { from: 1.0,  to: 1.10 },
        duration: 2200,
        repeat: -1,
        delay: i * 550,
        ease: 'Sine.easeIn',
      });
    }

    // ── Island terrain (depth 0) ───────────────────────────────────────────
    const islandGfx = this.add.graphics();
    drawIsland(islandGfx, ISLAND_CX, ISLAND_CY);
    islandGfx.setDepth(0);

    // ── Rocks, flowers, bushes, foam (depth 3) ────────────────────────────
    const decoGfx = this.add.graphics();
    drawRocksAndFlowers(decoGfx, ISLAND_CX, ISLAND_CY);
    decoGfx.setDepth(3);

    // ── Palm trees with sway animation (depth 2) ──────────────────────────
    const palmPositions = [
      { x: 298, y: 265 },
      { x: 502, y: 265 },
      { x: 400, y: 243 },
    ];
    palmPositions.forEach(({ x, y }, i) => {
      const palm = this.add.image(x, y, 'palm').setDisplaySize(85, 77).setDepth(2);
      // Shadow under each tree
      const palmShadow = this.add.graphics();
      palmShadow.fillStyle(0x000000, 0.12);
      palmShadow.fillEllipse(x + 5, y + 40, 70, 18);
      palmShadow.setDepth(1);
      // Sway tween
      this.tweens.add({
        targets: palm,
        angle: { from: -3, to: 3 },
        yoyo: true,
        repeat: -1,
        duration: 1900 + i * 380,
        ease: 'Sine.easeInOut',
        delay: i * 550,
      });
    });

    // ── Lumi (NPC) ────────────────────────────────────────────────────────
    const lumiShadow = this.add.graphics();
    lumiShadow.fillStyle(0x000000, 0.15);
    lumiShadow.fillEllipse(0, 62, 80, 18);
    this.textures.get('lumi').setFilter(Phaser.Textures.FilterMode.NEAREST);
    const lumiImg = this.add.image(0, 0, 'lumi').setScale(130 / 1024);
    this.lumiContainer = this.add.container(LUMI_X, LUMI_Y, [lumiShadow, lumiImg]);
    this.lumiContainer.setDepth(10);

    // Speech bubble (child of lumiContainer — bobs with Lumi)
    this.speechBubbleGfx = this.add.graphics();
    this.speechBubbleText = this.add.text(0, -98, '', {
      fontSize: '22px',
      fontFamily: '"Fredoka", system-ui, sans-serif',
      color: '#5a3200',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.lumiContainer.add([this.speechBubbleGfx, this.speechBubbleText]);
    this.speechBubbleGfx.setVisible(false);
    this.speechBubbleText.setVisible(false);

    // ── Thomas (player) ───────────────────────────────────────────────────────
    // Shadow is a standalone object (not a container child) so the container's
    // bounds are derived purely from the Image, giving Phaser reliable culling (#20)
    this.playerShadow = this.add.graphics().setDepth(21);
    this.playerShadow.fillStyle(0x000000, 0.15);
    this.playerShadow.fillEllipse(0, 0, 80, 18);
    // Apply NEAREST filter to every Thomas skin so runtime swaps stay crisp
    MainScene.ALL_SKIN_IDS.forEach(id => {
      this.textures.get(`thomas_${id}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    });
    const skinId = this.progress.settings.playerColorId;
    // Plain Image — no Container wrapper — gives Phaser unambiguous displayWidth/Height for culling (#20)
    this.playerImg = this.add.image(PLAYER_START_X, PLAYER_START_Y, `thomas_${skinId}`)
      .setDisplaySize(120, 130)
      .setDepth(22);
    this.playerNatScaleX = this.playerImg.scaleX;
    this.playerNatScaleY = this.playerImg.scaleY;

    // Carry icon — floats above Thomas during give quests, hidden otherwise
    this.carryIcon = this.add.image(PLAYER_START_X, PLAYER_START_Y - 90, 'vocab_apple')
      .setDisplaySize(44, 39).setDepth(23).setVisible(false);

    // Pulse ring under Lumi — visible during give quest carry phase
    this.lumiPulseRing = this.add.graphics().setDepth(9);
    this.lumiPulseRing.setVisible(false);
    this.deliveryArrow = this.add.graphics().setDepth(24).setVisible(false);

    // ── Foreground grass tufts + flowers (depth 20 — in front of chars) ───
    const fgGfx = this.add.graphics();
    drawForeground(fgGfx, ISLAND_CX, ISLAND_CY);
    fgGfx.setDepth(20);
    this.tweens.add({
      targets: fgGfx,
      y: '+=3',
      yoyo: true,
      repeat: -1,
      duration: 2600,
      ease: 'Sine.easeInOut',
    });

    // Ambient decoration bob (rocks/flowers layer very slightly pulses)
    this.tweens.add({
      targets: decoGfx,
      y: '+=1',
      yoyo: true,
      repeat: -1,
      duration: 3800,
      ease: 'Sine.easeInOut',
    });

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

    // Touch joystick — floating: appears where thumb lands, knob follows the drag
    this.touchStickEl = document.getElementById('touch-stick');
    this.touchKnobEl  = document.getElementById('touch-knob');
    const joystickHint = document.getElementById('joystick-hint');

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.x < 480 && this.touchActiveId === -1) {
        this.touchActiveId = ptr.id;
        this.touchStartX   = ptr.x;
        this.touchStartY   = ptr.y;
        this.touchDx = 0;
        this.touchDy = 0;
        // Hide the static hint ring once the player has found the joystick zone
        if (joystickHint) joystickHint.style.display = 'none';
        // Position the stick circle at the thumb's landing point
        if (this.touchStickEl) {
          const cvs  = this.sys.game.canvas;
          const rect = cvs.getBoundingClientRect();
          const sx   = rect.left + (ptr.x / 800) * rect.width;
          const sy   = rect.top  + (ptr.y / 600) * rect.height;
          const r    = this.touchStickEl.offsetWidth / 2 || 70;
          this.touchStickEl.style.position = 'fixed';
          this.touchStickEl.style.left     = `${sx - r}px`;
          this.touchStickEl.style.top      = `${sy - r}px`;
          this.touchStickEl.style.display  = 'block';
        }
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
      // Move knob to match thumb offset (clamped to stick edge)
      if (this.touchKnobEl && this.touchStickEl) {
        const cvs    = this.sys.game.canvas;
        const rect   = cvs.getBoundingClientRect();
        const pxDx   = dx * (rect.width  / 800);
        const pxDy   = dy * (rect.height / 600);
        const maxR   = (this.touchStickEl.offsetWidth  / 2) -
                       (this.touchKnobEl.offsetWidth   / 2);
        const pxLen  = Math.sqrt(pxDx * pxDx + pxDy * pxDy);
        const cx     = pxLen > maxR ? (pxDx / pxLen) * maxR : pxDx;
        const cy     = pxLen > maxR ? (pxDy / pxLen) * maxR : pxDy;
        this.touchKnobEl.style.transform =
          `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`;
      }
    });

    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const wasJoystick = ptr.id === this.touchActiveId;
      if (wasJoystick) {
        this.touchActiveId = -1;
        this.touchDx = 0;
        this.touchDy = 0;
        if (this.touchStickEl) this.touchStickEl.style.display = 'none';
        if (this.touchKnobEl)  this.touchKnobEl.style.transform = 'translate(-50%, -50%)';
      }
      // Tap-to-collect only fires from a DIFFERENT finger than the joystick,
      // so two-thumb play (move + tap) works correctly on iPad
      if (!wasJoystick && this.phase === 'playing') {
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

    // Safety: if a finger leaves the canvas without firing pointerup, reset joystick
    this.input.on('gameout', () => {
      this.touchActiveId = -1;
      this.touchDx = 0;
      this.touchDy = 0;
      if (this.touchStickEl) this.touchStickEl.style.display = 'none';
      if (this.touchKnobEl)  this.touchKnobEl.style.transform = 'translate(-50%, -50%)';
    });

    // Pal book speak events
    document.addEventListener('pal-speak', (e) => {
      const id = (e as CustomEvent<string>).detail;
      const v  = MEADOW_VOCAB.find(w => w.id === id);
      if (v) this.clips.speak(`word-${v.id}`, v.say);
    });

    if (!this.voice.supported) this.ui.setVoiceNote('⚠️ Audio not available in this browser.');

    // Place any island decorations already earned from previous sessions
    this.placeIslandDecos(false);
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;

    // Lumi idle bob — more eager during give quest carry phase (#12)
    let lumiEager = false;
    if (this.phase !== 'start') {
      const q = this.questDir.quest;
      if (q && q.kind === 'give') lumiEager = q.carrying;
    }
    this.lumiContainer.y = LUMI_Y + Math.sin(this.elapsed * (lumiEager ? 2.8 : 1.4)) * (lumiEager ? 5 : 3);
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
        // Remove the outward velocity component so Thomas doesn't stick/jitter at the wall
        const nx = (edx / d) / PLAY_SA;
        const ny = (edy / d) / PLAY_SB;
        const dot = this.velX * nx + this.velY * ny;
        if (dot > 0) { this.velX -= dot * nx; this.velY -= dot * ny; }
      }

      const speed = Math.sqrt(this.velX ** 2 + this.velY ** 2);
      const moveBob = Math.sin(this.elapsed * 9) * Math.min(speed / 320, 4);
      const idleBob = Math.sin(this.elapsed * 1.6) * (1 - Math.min(speed / 60, 1)) * 2.5;
      const bobY = this.playerY + moveBob + idleBob;
      this.playerImg.x = this.playerX;
      this.playerImg.y = bobY;
      if (!this.playerImg.visible) this.playerImg.setVisible(true);
      this.playerShadow.setPosition(this.playerX, bobY + 65);
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

      // Give-quest delivery + carry indicator
      const isCarrying = this.questDir.quest.kind === 'give' && this.questDir.quest.carrying;
      if (isCarrying) {
        const dx = this.playerX - LUMI_X;
        const dy = this.playerY - LUMI_Y;
        if (Math.sqrt(dx * dx + dy * dy) < DELIVERY_RADIUS) this.onDelivery();
      }
      // Keep carry icon above Thomas and pulse ring under Lumi in sync
      this.carryIcon.setVisible(isCarrying);
      if (isCarrying) {
        this.carryIcon.setPosition(this.playerX, this.playerY - 88 + Math.sin(this.elapsed * 4) * 4);
      }
      this.lumiPulseRing.setVisible(isCarrying);
      if (isCarrying) {
        this.lumiPulseRing.clear();
        const pulse = 0.55 + Math.sin(this.elapsed * 5) * 0.35;
        this.lumiPulseRing.lineStyle(4, 0xffe66d, pulse);
        this.lumiPulseRing.strokeCircle(LUMI_X, LUMI_Y + 20, 52);
      }
      // Directional arrow above the carry icon → points toward Lumi with a bouncing nudge (#12)
      this.deliveryArrow.setVisible(isCarrying);
      if (isCarrying) {
        const dx = LUMI_X - this.playerX;
        const dy = LUMI_Y - this.playerY;
        const angle = Math.atan2(dy, dx);
        const bounce = Math.sin(this.elapsed * 6) * 3;
        const ax = this.playerX + Math.cos(angle) * bounce;
        const ay = this.playerY - 114 + Math.sin(angle) * bounce;
        const r = 11;
        this.deliveryArrow.clear();
        this.deliveryArrow.fillStyle(0xffe66d, 0.95);
        this.deliveryArrow.lineStyle(2, 0x7a4e2a, 1);
        this.deliveryArrow.fillTriangle(
          ax + Math.cos(angle) * r,               ay + Math.sin(angle) * r,
          ax + Math.cos(angle + 2.3) * r * 0.55,  ay + Math.sin(angle + 2.3) * r * 0.55,
          ax + Math.cos(angle - 2.3) * r * 0.55,  ay + Math.sin(angle - 2.3) * r * 0.55,
        );
        this.deliveryArrow.strokeTriangle(
          ax + Math.cos(angle) * r,               ay + Math.sin(angle) * r,
          ax + Math.cos(angle + 2.3) * r * 0.55,  ay + Math.sin(angle + 2.3) * r * 0.55,
          ax + Math.cos(angle - 2.3) * r * 0.55,  ay + Math.sin(angle - 2.3) * r * 0.55,
        );
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
        wo.spotGfx.lineStyle(3.5, 0x2ec5c1, 0.75 + Math.sin(this.elapsed * 3) * 0.2);
        wo.spotGfx.strokeCircle(0, 0, 36 + Math.sin(this.elapsed * 3) * 3);
      }
      if (wo.highlighted) {
        wo.hintGfx.clear();
        wo.hintGfx.lineStyle(3.5, 0xffe66d, 0.55 + Math.sin(this.elapsed * 5) * 0.2);
        wo.hintGfx.strokeCircle(0, 0, 42 + Math.sin(this.elapsed * 5) * 3);
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

    this.showSpeechBubble('¡Hola! Soy Lumi.');
    await this.clips.speakAsync('lumi-hello', '¡Hola! Soy Lumi.');
    this.showSpeechBubble('¿Listo? ¡Vamos!');
    await this.clips.speakAsync('lumi-ready', '¿Listo? ¡Vamos!');
    this.hideSpeechBubble();

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
    const bubbleText = quest.kind === 'color' && quest.color
      ? `${quest.target.say} ${quest.target.article === 'la' ? quest.color.esFem : quest.color.es}`
      : quest.target.say;
    this.showSpeechBubble(bubbleText);
    const onEnd = () => {
      if (this.phase === 'speaking') {
        this.phase = 'playing';
        this.questStartTime = performance.now();
      }
      this.ui.setQuest(quest.kind, false);
    };
    this.clips.speak(`${kind}-${quest.target.id}`, quest.line.text, { onEnd });
    // Safety: if Web Speech API onend never fires (known browser bug), unblock after 4s
    setTimeout(() => { if (this.phase === 'speaking') onEnd(); }, 4000);
  }

  // ── World object spawning ─────────────────────────────────────────────────

  private spawnRound(): void {
    for (const wo of this.worldObjects) wo.container.destroy();
    this.worldObjects = [];

    const specs = this.questDir.buildSpawnSet(4);

    specs.forEach((spec, i) => {
      const pos = ITEM_SCATTER[i] ?? ITEM_SCATTER[ITEM_SCATTER.length - 1];
      const wx  = pos.x;
      const wy  = pos.y;

      const badgeGfx = this.add.graphics();
      drawBadge(badgeGfx);

      const itemImg  = this.add.image(0, 0, ITEM_KEY[spec.vocab.model]).setDisplaySize(66, 58);
      if (spec.colorOverride !== undefined) itemImg.setTint(spec.colorOverride);

      const spotGfx = this.add.graphics();
      const hintGfx = this.add.graphics();

      const container = this.add.container(wx, wy, [badgeGfx, hintGfx, spotGfx, itemImg]);
      container.setDepth(5 + i * 0.1);

      // Entrance pop animation
      container.setScale(0.1);
      this.tweens.add({
        targets: container,
        scaleX: 1, scaleY: 1,
        duration: 380,
        delay: i * 80,
        ease: 'Back.out',
      });

      // Gentle float (each item at a slightly different phase)
      this.tweens.add({
        targets: container,
        y: `+=${3 + (i % 3)}`,
        yoyo: true,
        repeat: -1,
        duration: 1600 + i * 200,
        ease: 'Sine.easeInOut',
        delay: i * 120,
      });

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
      wo.spotGfx.lineStyle(3.5, 0x2ec5c1, 0.85);
      wo.spotGfx.strokeCircle(0, 0, 36);
    }
    wo.hintGfx.clear();
    if (wo.highlighted) {
      wo.hintGfx.lineStyle(3.5, 0xffe66d, 0.75);
      wo.hintGfx.strokeCircle(0, 0, 42);
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
      const nsx = this.playerNatScaleX;
      this.tweens.killTweensOf(this.playerImg);
      this.tweens.add({
        targets: this.playerImg,
        props: { scaleX: { value: nsx * 0.72, duration: 45, ease: 'Sine.Out', yoyo: true, repeat: 3 } },
        onComplete: () => { this.playerImg.scaleX = nsx; },
      });
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

    this.evalCooldown = 0.8;
    wo.active = false;
    this.sfx.play(result.outcome === 'progress' ? 'collect' : 'correct');
    // Wiggle Thomas on correct
    { const nsx = this.playerNatScaleX;
      this.tweens.killTweensOf(this.playerImg);
      this.tweens.add({
        targets: this.playerImg,
        props: { scaleX: { value: nsx * 1.18, duration: 80, ease: 'Sine.Out', yoyo: true, repeat: 2 } },
        onComplete: () => { this.playerImg.scaleX = nsx; },
      }); }
    this.burstConfetti(wo.x, wo.y);

    this.tweens.add({
      targets: wo.container,
      scaleX: 0, scaleY: 0, alpha: 0,
      duration: 300, ease: 'Back.in',
      onComplete: () => wo.container.setVisible(false),
    });

    if (result.outcome === 'pickup') {
      this.carryIcon.setTexture(ITEM_KEY[wo.vocab.model]);
      this.clips.speak(`carrying-${wo.vocab.id}`, `¡Sí! Dale ${wo.vocab.say} a Lumi.`);
      return;
    }
    if (result.questComplete) this.onQuestComplete();
  }

  private onDelivery(): void {
    if (this.phase !== 'playing' || !this.questDir.deliver()) return;
    this.carryIcon.setVisible(false);
    this.lumiPulseRing.setVisible(false);
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
    this.awardCoin();
    this.velX = 0;
    this.velY = 0;
    this.tweens.add({
      targets: this,
      playerX: PLAYER_START_X,
      playerY: PLAYER_START_Y,
      duration: 600,
      ease: 'Quad.Out',
    });
  }

  private coinRate(): number {
    const n = this.progress.unlockedColors.length;
    if (n < 3)  return 1.0;
    if (n < 8)  return 0.5;
    if (n < 14) return 1 / 3;
    return 0.25;
  }

  private awardCoin(): void {
    this.coinPending += this.coinRate();
    const whole = Math.floor(this.coinPending);
    if (whole < 1) return; // still accumulating — no visual this time
    this.coinPending -= whole;
    this.progress.earnCoins(whole);
    this.ui.updateCoins(this.progress.coins);
    const txt = this.add.text(this.playerX, this.playerY - 80, `+${whole} 🪙`, {
      fontSize: '26px',
      fontFamily: '"Fredoka", system-ui, sans-serif',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#3a1800',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(50);
    this.tweens.add({
      targets: txt,
      y: txt.y - 70,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.Out',
      onComplete: () => txt.destroy(),
    });
  }

  private async advanceQuest(): Promise<void> {
    this.clips.cancel();

    // Every 4 vocab quests, run a Lumi Says interlude (2 commands)
    this.simonCounter++;
    if (this.simonCounter % 4 === 0) {
      await this.runSimonInterlude();
    }

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

    this.placeIslandDecos(true); // animate in any newly unlocked island element

    const vocab = MEADOW_VOCAB.find(v => v.id === vocabId)!;
    this.ui.showToast('✨', `¡Nueva Chispa! ${vocab.es}`);
    this.sfx.play('hatch');
    this.clips.cancel();
    void this.clips.speakAsync('new-chispa', '¡Nueva Chispa!');

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
    const tw  = Math.max(this.speechBubbleText.width + 44, 90);
    const th  = Math.max(this.speechBubbleText.height + 26, 52);
    const bcy = -98;

    this.speechBubbleGfx.clear();

    // Warm drop shadow
    this.speechBubbleGfx.fillStyle(0x3a1800, 0.32);
    this.speechBubbleGfx.fillRoundedRect(-tw / 2 + 5, bcy - th / 2 + 7, tw, th, 18);

    // Bubble fill — warm cream
    this.speechBubbleGfx.fillStyle(0xfff8e8, 1);
    this.speechBubbleGfx.fillRoundedRect(-tw / 2, bcy - th / 2, tw, th, 18);

    // Inner brightness (top-left shine)
    this.speechBubbleGfx.fillStyle(0xffffff, 0.42);
    this.speechBubbleGfx.fillRoundedRect(-tw / 2 + 7, bcy - th / 2 + 6, tw * 0.62, th * 0.38, 10);

    // Tail fill
    const tailY = bcy + th / 2;
    this.speechBubbleGfx.fillStyle(0xfff8e8, 1);
    this.speechBubbleGfx.fillTriangle(-13, tailY, 13, tailY, 1, tailY + 18);

    // Warm brown border
    this.speechBubbleGfx.lineStyle(3.5, 0x7a4e2a, 1);
    this.speechBubbleGfx.strokeRoundedRect(-tw / 2, bcy - th / 2, tw, th, 18);

    // Tail sides only
    this.speechBubbleGfx.beginPath();
    this.speechBubbleGfx.moveTo(-13, tailY);
    this.speechBubbleGfx.lineTo(1, tailY + 18);
    this.speechBubbleGfx.strokePath();
    this.speechBubbleGfx.beginPath();
    this.speechBubbleGfx.moveTo(13, tailY);
    this.speechBubbleGfx.lineTo(1, tailY + 18);
    this.speechBubbleGfx.strokePath();

    this.speechBubbleGfx.setVisible(true);
    this.speechBubbleText.setVisible(true);

    // Bounce-in animation
    this.speechBubbleGfx.setScale(0.85);
    this.speechBubbleText.setScale(0.85);
    this.tweens.add({
      targets: [this.speechBubbleGfx, this.speechBubbleText],
      scaleX: 1, scaleY: 1,
      duration: 280,
      ease: 'Back.out',
    });
  }

  private hideSpeechBubble(): void {
    this.speechBubbleGfx.setVisible(false);
    this.speechBubbleText.setVisible(false);
  }

  // ── Confetti ──────────────────────────────────────────────────────────────

  private burstConfetti(x: number, y: number, count = 48): void {
    if (this.progress.settings.reducedMotion) count = Math.floor(count / 3);
    const colors = [0xff5f5f, 0xffd23f, 0x6ec840, 0x38b8ff, 0xb06cff, 0xff8c42, 0x2ec5c1, 0xff8fc8];
    // Star shape points
    function starPts(r: number): Phaser.Types.Math.Vector2Like[] {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = j % 2 === 0 ? r : r * 0.45;
        pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
      }
      return pts;
    }
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics();
      const color = colors[i % colors.length];
      g.fillStyle(color, 1);
      const shape = i % 3;
      if (shape === 0) g.fillRect(-4, -4, 8, 8);
      else if (shape === 1) g.fillCircle(0, 0, 4.5);
      else g.fillPoints(starPts(5), true);
      g.x = x; g.y = y;
      g.setDepth(30);
      const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.4;
      const speed = 90 + (i % 7) * 22;
      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 65,
        alpha: 0,
        angle: (i % 2 === 0 ? 1 : -1) * (300 + i * 40),
        duration: 550 + (i % 5) * 100,
        ease: 'Cubic.out',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ── Island growth (#5 / #29) ─────────────────────────────────────────────

  private placeIslandDecos(animate: boolean): void {
    const count = this.progress.creatures.length;
    ISLAND_MILESTONES.forEach((m, i) => {
      if (m.chispaCount > count || this.islandDecos[i]) return;
      const img = this.add.image(m.x, m.y, m.key).setDisplaySize(m.w, m.h).setDepth(m.depth);
      this.islandDecos[i] = img;
      if (animate) {
        img.setScale(0);
        this.tweens.add({ targets: img, scaleX: 1, scaleY: 1, duration: 600, delay: 1200, ease: 'Back.out' });
      }
    });
  }

  // ── Lumi Says (Simon) ─────────────────────────────────────────────────────

  private async runSimonInterlude(): Promise<void> {
    this.phase = 'simon';
    this.hideSpeechBubble();

    // Pick 2 random commands from the active batch
    const shuffled = [...ACTIVE_COMMANDS].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, 2);

    this.showSpeechBubble('¡Lumi dice!');
    await delay(900);

    for (const cmd of picks) {
      await this.runSimonCommand(cmd);
      await delay(400);
    }

    this.hideSpeechBubble();
    this.hideSimonTiles();
  }

  private async runSimonCommand(cmd: CommandWord): Promise<void> {
    // 1. Lumi announces the command
    this.showSpeechBubble(cmd.es);
    this.sfx.play('tap');
    this.npcBounceTimer = 0.6;
    await this.clips.speakAsync(`simon-${cmd.id}`, cmd.es);

    // 2. Lumi models the action
    this.performAction('lumi', cmd.action);
    await delay(1200);

    // 3. Show tiles — wait for correct tap
    this.showSimonTiles(cmd);
    await this.waitForSimonAnswer();

    // 4. Thomas mirrors it + praise
    this.performAction('thomas', cmd.action);
    this.sfx.play('correct');
    await delay(700);

    const line = praise(this.praiseIndex++);
    this.ui.showBanner(line);
    this.clips.speak(`praise-${this.praiseIndex % 6}`, line);
    this.awardCoin();
    await delay(900);

    this.hideSimonTiles();
  }

  private showSimonTiles(target: CommandWord): void {
    this.simonTarget = target.action;

    const overlay = document.getElementById('simon-overlay')!;
    const prompt  = document.getElementById('simon-prompt')!;
    prompt.textContent = target.es;
    overlay.classList.remove('hidden');

    ACTIVE_COMMANDS.forEach((cmd, i) => {
      const tile  = document.getElementById(`simon-tile-${i}`)!;
      const icon  = tile.querySelector('.simon-tile__icon')!;
      const label = tile.querySelector('.simon-tile__label')!;
      icon.textContent  = cmd.icon;
      label.textContent = cmd.es;

      tile.classList.remove('correct', 'wrong', 'pressed');
      tile.onclick = () => this.onSimonTap(tile, cmd.action);
    });
  }

  private onSimonTap(tile: HTMLElement, action: CommandAction): void {
    if (action === this.simonTarget) {
      tile.classList.add('correct');
      this.simonResolve?.();
      this.simonResolve = null;
    } else {
      tile.classList.add('wrong');
      setTimeout(() => tile.classList.remove('wrong'), 380);
      this.sfx.play('wrong');
      this.performAction('lumi', this.simonTarget!);
    }
  }

  private waitForSimonAnswer(): Promise<void> {
    return new Promise(resolve => { this.simonResolve = resolve; });
  }

  private hideSimonTiles(): void {
    document.getElementById('simon-overlay')!.classList.add('hidden');
    this.simonTarget  = null;
    this.simonResolve = null;
  }

  private performAction(who: 'lumi' | 'thomas', action: CommandAction): void {
    const container = who === 'lumi' ? this.lumiContainer : this.playerImg;
    const baseX = who === 'lumi' ? LUMI_X : this.playerX;
    const baseY = who === 'lumi' ? LUMI_Y : this.playerY;
    // Lumi (Container) has natural scale 1.0; Thomas (Image) has setDisplaySize-driven scale
    const sx = who === 'lumi' ? 1 : this.playerNatScaleX;
    const sy = who === 'lumi' ? 1 : this.playerNatScaleY;
    this.tweens.killTweensOf(container);

    switch (action) {
      case 'sit':
        this.tweens.add({
          targets: container,
          scaleY: sy * 0.62, y: baseY + 18,
          duration: 280, ease: 'Back.out',
          onComplete: () => this.tweens.add({
            targets: container, scaleY: sy, y: baseY,
            duration: 260, delay: 900, ease: 'Back.out',
            onComplete: () => { (container as Phaser.GameObjects.Image).scaleY = sy; },
          }),
        });
        break;
      case 'stand':
        this.tweens.add({
          targets: container,
          y: baseY - 22,
          duration: 200, ease: 'Sine.out', yoyo: true,
          onComplete: () => { (container as Phaser.GameObjects.Image).y = baseY; },
        });
        break;
      case 'listen':
        this.tweens.add({
          targets: container,
          angle: 14,
          duration: 280, ease: 'Sine.inOut', yoyo: true, repeat: 2,
          onComplete: () => { container.angle = 0; },
        });
        break;
      case 'look':
        this.tweens.add({
          targets: container,
          scaleX: sx * 1.12, scaleY: sy * 1.12,
          duration: 200, ease: 'Sine.out', yoyo: true, repeat: 1,
          onComplete: () => { (container as Phaser.GameObjects.Image).scaleX = sx; (container as Phaser.GameObjects.Image).scaleY = sy; },
        });
        break;
      case 'write':
        this.tweens.add({
          targets: container,
          props: { x: { value: baseX + 5, duration: 60, ease: 'Sine.inOut', yoyo: true, repeat: 5 } },
          onComplete: () => { container.x = baseX; },
        });
        break;
      case 'draw':
        this.tweens.add({
          targets: container,
          props: {
            x: { value: baseX + 6, duration: 120, ease: 'Sine.inOut', yoyo: true, repeat: 3 },
            y: { value: baseY - 4, duration: 120, ease: 'Sine.inOut', yoyo: true, repeat: 3 },
          },
          onComplete: () => { container.x = baseX; container.y = baseY; },
        });
        break;
      case 'walk':
        this.tweens.add({
          targets: container,
          x: baseX + 28,
          duration: 260, ease: 'Sine.inOut', yoyo: true, repeat: 2,
          onComplete: () => { container.x = baseX; },
        });
        break;
      case 'stop':
        this.tweens.add({
          targets: container,
          scaleX: sx * 1.22, scaleY: sy * 1.22,
          duration: 120, ease: 'Sine.out', yoyo: true,
          onComplete: () => { (container as Phaser.GameObjects.Image).scaleX = sx; (container as Phaser.GameObjects.Image).scaleY = sy; },
        });
        break;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
