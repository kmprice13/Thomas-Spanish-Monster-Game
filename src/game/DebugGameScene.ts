import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';
import { ProgressStore, type MistakeDomain } from '../systems/ProgressStore';
import { drawItem } from '../drawing/drawItem';
import { generateRound, ACTIVE_MISTAKE_DOMAINS, DOMAIN_PROMPT, type RoundContent } from '../content/mistakeRound';

// ── Layout (800×600 logical canvas, matches MainScene) ─────────────────────
const TRACK_X0 = 150;
const TRACK_X1 = 650;
const TRACK_Y = 130;
const ITEM_HIT_SIZE = 64;
const TEXT_ITEM_W = 300;
const TEXT_ITEM_H = 50;

/** How long the round-result banner stays up before the next round starts. */
const BANNER_MS = 1800;

/** Shape/category domains: a row (or two) of icon-sized items. */
function layoutPositions(count: number): Array<{ x: number; y: number }> {
  const rows = count <= 6 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)];
  const rowYs = rows.length === 1 ? [370] : [335, 420];
  const positions: Array<{ x: number; y: number }> = [];
  rows.forEach((n, rowIdx) => {
    const spacing = 600 / (n + 1);
    const startX = 400 - (spacing * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      positions.push({ x: startX + spacing * i, y: rowYs[rowIdx] });
    }
  });
  return positions;
}

/** Math domain: equations read better stacked vertically than crammed into a row. */
function layoutPositionsVertical(count: number): Array<{ x: number; y: number }> {
  const startY = 380 - ((count - 1) * 55) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: 400, y: startY + i * 55 }));
}

/**
 * The "Find the Mistake" companion game — spot the mistake in a group.
 * English-only by design (see project-companion-games-plan memory): this
 * teaches a concept, it doesn't teach Spanish vocabulary, so it stays
 * decoupled from the Spanish game.
 *
 * Four content domains exist (see content/mistakeRound.ts): color-odd-one-out,
 * pattern-break, math-fact-error, and general odd-one-out. Only 'color' is
 * active for now (ACTIVE_MISTAKE_DOMAINS) — math is too hard for Thomas at
 * his current level and pattern isn't reading clearly yet; the other three
 * stay fully implemented and re-enable with a one-line change once ready.
 * Each domain adapts and tracks difficulty independently
 * (ProgressStore.debugDomain) since Thomas may be much faster at one than
 * another. Every domain generator is purely formulaic — no fixed level table
 * to outgrow — see the plateau bug note in project-debugging-game-roadmap
 * memory for why that matters.
 *
 * Reward loop (Chispas collection hookup) is still pending; this just tracks
 * a personal-best time per domain and a soft, non-punishing "rival" pace.
 */
export class DebugGameScene extends Phaser.Scene {
  private sfx!: AudioSystem;
  private progress!: ProgressStore;

  private domain: MistakeDomain = 'color';
  private currentRivalMs = 0;
  private itemContainers: Phaser.GameObjects.Container[] = [];
  private rivalDot!: Phaser.GameObjects.Arc;
  private rivalTween: Phaser.Tweens.Tween | null = null;
  private roundStartMs = 0;
  private roundOver = false;
  private streakText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private bannerGroup!: Phaser.GameObjects.Container;
  private correctContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'DebugGameScene', active: false, visible: false });
  }

  create(): void {
    this.progress = new ProgressStore();
    this.sfx = new AudioSystem();
    this.sfx.setMuted(this.progress.settings.muted);
    this.roundOver = false;

    this.add.rectangle(400, 300, 800, 600, 0x3ab8e8).setDepth(-10);

    this.add.text(400, 44, 'Find the Mistake!', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '34px', color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5).setShadow(0, 3, '#1a5a80', 4);

    this.promptText = this.add.text(400, 84, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5);

    const backBtn = this.add.text(56, 40, '← Home', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px', color: '#ffffff',
      backgroundColor: '#00000055', padding: { x: 12, y: 8 },
    }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.goHome());

    this.streakText = this.add.text(744, 40, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#ffffff',
    }).setOrigin(1, 0);

    this.bestText = this.add.text(744, 64, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px', color: '#eaffff',
    }).setOrigin(1, 0);

    // Rival race track
    const track = this.add.graphics();
    track.fillStyle(0x1a5a80, 0.4);
    track.fillRoundedRect(TRACK_X0, TRACK_Y - 12, TRACK_X1 - TRACK_X0, 24, 12);
    this.add.text(TRACK_X0, TRACK_Y - 34, 'Rival', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px', color: '#ffffff',
    });
    this.rivalDot = this.add.circle(TRACK_X0, TRACK_Y, 14, 0xff6ef7).setStrokeStyle(3, 0xffffff);

    this.bannerGroup = this.add.container(400, 300).setDepth(50).setVisible(false);

    this.startRound(); // picks a domain and calls updateHeader() itself
  }

  private updateHeader(): void {
    const g = this.progress.debugDomain(this.domain);
    this.streakText.setText(`Level ${g.levelIndex + 1}`);
    this.bestText.setText(g.bestTimeMs !== null ? `Best: ${(g.bestTimeMs / 1000).toFixed(1)}s` : 'Best: —');
  }

  private startRound(): void {
    this.roundOver = false;
    this.itemContainers.forEach((c) => c.destroy());
    this.itemContainers = [];
    this.bannerGroup.setVisible(false);
    this.rivalTween?.stop();
    this.rivalDot.setPosition(TRACK_X0, TRACK_Y);

    this.domain = ACTIVE_MISTAKE_DOMAINS[Phaser.Math.Between(0, ACTIVE_MISTAKE_DOMAINS.length - 1)];
    const content = generateRound(this.domain, this.progress.debugDomain(this.domain).levelIndex);
    this.currentRivalMs = content.rivalMs;
    this.correctContainer = null;
    this.promptText.setText(DOMAIN_PROMPT[this.domain]);
    this.updateHeader();

    const isText = content.kind === 'text';
    const positions = isText ? layoutPositionsVertical(content.itemCount) : layoutPositions(content.itemCount);

    positions.forEach((pos, i) => {
      const container = this.add.container(pos.x, pos.y);
      this.renderItem(container, content, i);
      container.setSize(isText ? TEXT_ITEM_W : ITEM_HIT_SIZE, isText ? TEXT_ITEM_H : ITEM_HIT_SIZE);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.handleTap(i === content.oddIndex, container));
      this.itemContainers.push(container);
      if (i === content.oddIndex) this.correctContainer = container;
    });

    this.roundStartMs = this.time.now;
    this.rivalTween = this.tweens.add({
      targets: this.rivalDot,
      x: TRACK_X1,
      duration: content.rivalMs,
      ease: 'Linear',
      onComplete: () => this.handleTimeout(),
    });
  }

  /** Draws one item's visual per the round's content kind (shapes vs. category icons vs. text). */
  private renderItem(container: Phaser.GameObjects.Container, content: RoundContent, index: number): void {
    if (content.kind === 'shape') {
      const g = this.add.graphics();
      drawItem(g, content.model, content.colors[index], content.colors[index]);
      container.add(g);
    } else if (content.kind === 'category') {
      const g = this.add.graphics();
      drawItem(g, content.models[index], content.color, content.color);
      container.add(g);
    } else {
      const label = this.add.text(0, 0, content.labels[index], {
        fontFamily: 'Fredoka, sans-serif', fontSize: '24px', color: '#ffffff', fontStyle: '700',
        backgroundColor: '#1a5a80aa', padding: { x: 14, y: 8 },
      }).setOrigin(0.5);
      container.add(label);
    }
  }

  private handleTap(isOdd: boolean, container: Phaser.GameObjects.Container): void {
    if (this.roundOver) return;
    this.sfx.play('tap');

    if (!isOdd) {
      // Wrong tap — gentle shake, no penalty, round continues (same ethos as
      // Nube Says: wrong taps never end the round or cost anything).
      this.sfx.play('wrong');
      this.tweens.add({
        targets: container, x: container.x - 6, duration: 40, yoyo: true, repeat: 3,
      });
      return;
    }

    this.roundOver = true;
    const elapsedMs = this.time.now - this.roundStartMs;
    const beatRival = elapsedMs < this.currentRivalMs;
    this.rivalTween?.stop();

    const domainProgress = this.progress.debugDomain(this.domain);
    const wasBest = domainProgress.bestTimeMs === null || elapsedMs < domainProgress.bestTimeMs;
    this.progress.recordDebugRound(this.domain, beatRival, elapsedMs, this.currentRivalMs);

    this.itemContainers.forEach((c) => c.disableInteractive());
    this.sfx.play(wasBest ? 'levelup' : 'correct');
    const headline = wasBest ? 'New best time!' : beatRival ? 'You beat the rival!' : 'Found it!';
    this.showBanner(headline, `Your time: ${(elapsedMs / 1000).toFixed(1)}s`, 0x1a5a80);

    this.time.delayedCall(BANNER_MS, () => {
      this.startRound(); // picks the next domain fresh and updates the header itself
    });
  }

  /** Rival reached the finish line first — no penalty, just a friendly nudge onward. */
  private handleTimeout(): void {
    if (this.roundOver) return;
    this.roundOver = true;

    this.itemContainers.forEach((c) => c.disableInteractive());
    this.progress.recordDebugTimeout(this.domain);
    this.sfx.play('wrong');
    this.revealCorrectItem();
    this.showBanner('You ran out of time!', "Here's the one — let's try another!", 0xb3651a);

    this.time.delayedCall(BANNER_MS, () => {
      this.startRound(); // picks the next domain fresh and updates the header itself
    });
  }

  /** Briefly highlights the correct item so a timeout still teaches something. */
  private revealCorrectItem(): void {
    const c = this.correctContainer;
    if (!c) return;
    const ring = this.add.circle(c.x, c.y, 40, 0xffffff, 0.3).setStrokeStyle(3, 0xffffff);
    this.tweens.add({ targets: ring, scale: 1.4, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.tweens.add({ targets: c, scale: 1.15, duration: 200, yoyo: true, repeat: 2 });
  }

  private showBanner(title: string, sub: string, tint: number): void {
    this.bannerGroup.removeAll(true);
    const bg = this.add.rectangle(0, 0, 440, 130, tint, 0.92).setStrokeStyle(4, 0xffffff);
    const titleText = this.add.text(0, -32, title, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '26px', color: '#ffffff', fontStyle: '700',
    }).setOrigin(0.5);
    const subText = this.add.text(0, 10, sub, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '18px', color: '#eaffff',
    }).setOrigin(0.5);
    this.bannerGroup.add([bg, titleText, subText]);
    this.bannerGroup.setVisible(true).setScale(0.8);
    this.tweens.add({ targets: this.bannerGroup, scale: 1, duration: 220, ease: 'Back.Out' });
  }

  private goHome(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    document.getElementById('start-screen')?.classList.remove('hidden');
    this.scene.wake('MainScene');
    this.scene.stop();
  }
}
