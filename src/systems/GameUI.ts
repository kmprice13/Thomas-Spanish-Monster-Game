/**
 * GameUI — owns all DOM/CSS state outside the canvas.
 *
 * Translates game events into DOM updates and user intent into callbacks.
 * No game logic lives here: this is a thin view layer that reads from a
 * single state object passed in each frame.
 */
import type { VocabItem } from '../content/vocabulary';
import type { QuestKind } from '../content/quests';
import { QUEST_ICON } from '../content/quests';
import type { ParentSummary } from './ProgressStore';

const chispaImg = (id: string) => `assets/chispa_${id}.png`;

// ── Color / skin definitions — single source of truth for the customizer ──────
const FREE_COLORS = [
  { id: 'menta',   label: 'Menta',   css: '#44d9a0' },
  { id: 'morado',  label: 'Morado',  css: '#b06cff' },
  { id: 'azul',    label: 'Azul',    css: '#4d8cff' },
  { id: 'naranja', label: 'Naranja', css: '#ff6b35' },
] as const;

const EARNED_COLORS = [
  { id: 'alien',       label: 'Alienígena',    css: '#00ff88', cost: 10 },
  { id: 'baby',        label: 'Baby',          css: '#9de8ff', cost: 10 },
  { id: 'cloud',       label: 'Nube',          css: '#d8eeff', cost: 10 },
  { id: 'hada',        label: 'Hada',          css: '#ffb8e0', cost: 10 },
  { id: 'ghost',       label: 'Fantasma',      css: '#c8d8f0', cost: 10 },
  { id: 'brillante',   label: 'Brillante',     css: '#ffd700', cost: 10 },
  { id: 'island',      label: 'Isla',          css: '#00c9a7', cost: 10 },
  { id: 'origami',     label: 'Origami',       css: '#ff6b6b', cost: 10 },
  { id: 'paint',       label: 'Pintura',       css: '#e040fb', cost: 10 },
  { id: 'pastel',      label: 'Pastel',        css: '#ffb5c8', cost: 10 },
  { id: 'pharaon',     label: 'Faraón',        css: '#c8a24c', cost: 10 },
  { id: 'pirate',      label: 'Pirata',        css: '#2a3a6a', cost: 10 },
  { id: 'plushie',     label: 'Peluche',       css: '#f0c090', cost: 10 },
  { id: 'prehistoric', label: 'Prehistórico',  css: '#8b7a14', cost: 10 },
  { id: 'princess',    label: 'Princesa',      css: '#d070c0', cost: 10 },
  { id: 'pumpkin',     label: 'Calabaza',      css: '#ff7043', cost: 10 },
  { id: 'arcoiris',    label: 'Arcoíris',      css: '#ff6ef7', cost: 10 },
  { id: 'shark',       label: 'Tiburón',       css: '#607d8b', cost: 10 },
  { id: 'sprite',      label: 'Duende',        css: '#4caf50', cost: 10 },
  { id: 'stealth',     label: 'Sigilo',        css: '#37474f', cost: 10 },
] as const;

export interface UICallbacks {
  onPlay: () => void;
  onReplay: () => void;
  onMuteChange: (muted: boolean) => void;
  onSlowChange: (slow: boolean) => void;
  onCalmChange: (calm: boolean) => void;
  onColorChange: (id: string) => void;
  onColorPreview: (id: string) => void; // swap Thomas texture for try-on without saving
  onColorUnlock: (id: string, cost: number) => void;
  onParentDashboardOpen: () => void;
}

export class GameUI {
  private readonly hud = this.q('#hud');
  private readonly startScreen = this.q('#start-screen');
  private readonly palGrid = this.q('#pal-grid');
  private readonly palCount = this.q('#pal-count');
  private readonly palButton = this.q('#pal-button');
  private readonly settingsButton = this.q('#settings-button');
  private readonly grownupsButton = this.q('#grownups-button');
  private readonly banner = this.q('#banner');
  private readonly toast = this.q('#toast');
  private readonly questCard = this.q('#quest-card');
  private readonly questIcon = this.q('#quest-icon');
  private readonly replayButton = this.q('#replay-button');
  private readonly voiceNote = this.q('#voice-note');
  private readonly setSound = this.q('#set-sound') as HTMLInputElement;
  private readonly setSlow = this.q('#set-slow') as HTMLInputElement;
  private readonly setCalm = this.q('#set-calm') as HTMLInputElement;

  private bannerTimer = 0;
  private toastTimer = 0;
  private gateAnswer = 0;
  private onColorChange!: (id: string) => void;
  private onColorPreview!: (id: string) => void;
  private onColorUnlock!: (id: string, cost: number) => void;
  private onParentDashboardOpen!: () => void;
  // Try-on state
  private savedSkinId = 'azul';
  private previewId: string | null = null;
  private previewCost = 0;

  constructor(cbs: UICallbacks) {
    this.q('#play-button').addEventListener('click', () => cbs.onPlay());
    this.replayButton.addEventListener('click', () => cbs.onReplay());

    this.palButton.addEventListener('click', () => this.toggle('pal-book'));
    this.settingsButton.addEventListener('click', () => this.toggle('settings-panel'));

    this.setSound.addEventListener('change', () => cbs.onMuteChange(!this.setSound.checked));
    this.setSlow.addEventListener('change', () => cbs.onSlowChange(this.setSlow.checked));
    this.setCalm.addEventListener('change', () => {
      document.body.classList.toggle('calm', this.setCalm.checked);
      cbs.onCalmChange(this.setCalm.checked);
    });

    this.grownupsButton.addEventListener('click', () => this.openParentGate());
    this.q('#customizer-settings-button').addEventListener('click', () => {
      this.close('settings-panel');
      this.open('customizer');
    });

    // Customizer portal
    this.q('#customizer-button').addEventListener('click', () => this.open('customizer'));
    this.q('#customizer-close').addEventListener('click', () => {
      this.cancelPreview();
      this.close('customizer');
    });

    // Generic data-close buttons (close button on each panel)
    document.querySelectorAll<HTMLElement>('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.close;
        if (target) this.close(target);
      });
    });

    // Store callbacks for use in buildCustomizer
    this.onColorChange = cbs.onColorChange;
    this.onColorPreview = cbs.onColorPreview;
    this.onColorUnlock = cbs.onColorUnlock;
    this.onParentDashboardOpen = cbs.onParentDashboardOpen;

    // Coin chip opens customizer
    this.q('#coin-chip').addEventListener('click', () => this.open('customizer'));

    // Confirm / cancel bar
    this.q('#customizer-buy-btn').addEventListener('click', () => {
      if (this.previewId === null) return;
      this.onColorUnlock(this.previewId, this.previewCost);
      this.hideConfirmBar();
      this.previewId = null;
    });
    this.q('#customizer-cancel-btn').addEventListener('click', () => this.cancelPreview());

  }

  /** Show the HUD, hide the start screen. */
  enterPlay(voiceNote: string): void {
    this.startScreen.classList.add('hidden');
    this.hud.classList.remove('hidden');
    if (voiceNote) this.voiceNote.textContent = voiceNote;
  }

  setVoiceNote(text: string): void {
    this.voiceNote.textContent = text;
  }

  setQuest(kind: QuestKind, speaking: boolean): void {
    this.questIcon.textContent = QUEST_ICON[kind];
    this.questCard.classList.toggle('speaking', speaking);
  }

  setPalCount(n: number): void {
    this.palCount.textContent = String(n);
    this.palButton.querySelector('.hud-chip__icon')!.textContent = n > 0 ? '✨' : '🥚';
  }

  applySettings(muted: boolean, slow: boolean, calm: boolean, playerColorId?: string): void {
    this.setSound.checked = !muted;
    this.setSlow.checked = slow;
    this.setCalm.checked = calm;
    document.body.classList.toggle('calm', calm);
    if (playerColorId !== undefined) this.updateCustomizerSelection(playerColorId);
  }

  /** Build the customizer orb grid. Call after progress loads or after an unlock. */
  buildCustomizer(unlockedColors: readonly string[], selectedId: string, coins: number): void {
    this.savedSkinId = selectedId;
    this.previewId = null;
    this.hideConfirmBar();

    const freeContainer   = this.q('#customizer-free');
    const earnedContainer = this.q('#customizer-earned');

    const balanceEl = document.getElementById('customizer-coins');
    if (balanceEl) balanceEl.textContent = String(coins);

    const makeUnlockedOrb = (id: string, label: string, css: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-orb';
      btn.dataset.colorid = id;
      btn.setAttribute('aria-label', label);
      btn.innerHTML = `
        <div class="color-orb__circle" style="background:${css}"></div>
        <span class="color-orb__label">${label}</span>
      `;
      btn.addEventListener('click', () => {
        this.cancelPreview();
        this.onColorChange(id);
        this.savedSkinId = id;
        this.updateCustomizerSelection(id);
      });
      return btn;
    };

    const makeLockedOrb = (id: string, label: string, css: string, cost: number, coins: number) => {
      const affordable = coins >= cost;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `color-orb locked${affordable ? ' affordable' : ''}`;
      btn.dataset.colorid = id;
      btn.dataset.cost = String(cost);
      btn.setAttribute('aria-label', `${label} — ${cost} monedas`);
      btn.innerHTML = `
        <div class="color-orb__circle" style="background:${css}"></div>
        <span class="color-orb__label">${label}</span>
        <span class="color-orb__hint">${affordable ? 'Probar' : ''} ${cost} 🪙</span>
      `;
      if (affordable) {
        btn.addEventListener('click', () => {
          this.previewId = id;
          this.previewCost = cost;
          this.onColorPreview(id);
          this.updateCustomizerSelection(id);
          this.showConfirmBar(cost);
        });
      }
      return btn;
    };

    freeContainer.innerHTML = '';
    FREE_COLORS.forEach(({ id, label, css }) =>
      freeContainer.appendChild(makeUnlockedOrb(id, label, css)));

    earnedContainer.innerHTML = '';
    EARNED_COLORS.forEach(({ id, label, css, cost }) => {
      earnedContainer.appendChild(
        unlockedColors.includes(id)
          ? makeUnlockedOrb(id, label, css)
          : makeLockedOrb(id, label, css, cost, coins),
      );
    });

    this.updateCustomizerSelection(selectedId);
  }

  private cancelPreview(): void {
    if (this.previewId === null) return;
    this.previewId = null;
    this.onColorPreview(this.savedSkinId);
    this.hideConfirmBar();
    this.updateCustomizerSelection(this.savedSkinId);
  }

  private showConfirmBar(cost: number): void {
    const bar = document.getElementById('customizer-confirm');
    const costEl = document.getElementById('customizer-buy-cost');
    if (bar) bar.classList.remove('hidden');
    if (costEl) costEl.textContent = String(cost);
  }

  private hideConfirmBar(): void {
    document.getElementById('customizer-confirm')?.classList.add('hidden');
  }

  /** Update coin chip in HUD and balance in customizer. */
  updateCoins(coins: number): void {
    const chip = document.getElementById('coin-count');
    if (chip) chip.textContent = String(coins);
    const balance = document.getElementById('customizer-coins');
    if (balance) balance.textContent = String(coins);
    // Refresh affordability on locked orbs without a full rebuild
    document.querySelectorAll<HTMLElement>('.color-orb.locked').forEach(orb => {
      const cost = Number(orb.dataset.cost ?? 0);
      orb.classList.toggle('affordable', coins >= cost);
    });
  }

  /** Highlight the active orb and update the Thomas preview image. */
  updateCustomizerSelection(id: string): void {
    document.querySelectorAll<HTMLElement>('.color-orb').forEach(orb => {
      orb.classList.toggle('active', orb.dataset.colorid === id);
    });
    const preview = document.getElementById('customizer-thomas') as HTMLImageElement | null;
    if (preview) preview.src = `assets/thomas_${id}.png`;
  }

  /** Pop the celebration banner (¡Sí! ¡Muy bien! etc.). Clears after 1s. */
  showBanner(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove('hidden');
    this.banner.classList.remove('show');
    // force reflow so animation restarts
    void (this.banner as HTMLElement).offsetWidth;
    this.banner.classList.add('show');
    this.bannerTimer = window.setTimeout(() => {
      this.banner.classList.add('hidden');
    }, 1000);
  }

  /** Slide-up toast for unlocks/hatches. */
  showToast(emoji: string, text: string): void {
    clearTimeout(this.toastTimer);
    this.toast.innerHTML = `<span class="toast-emoji">${emoji}</span>${text}`;
    this.toast.classList.remove('hidden', 'show');
    void (this.toast as HTMLElement).offsetWidth;
    this.toast.classList.add('show');
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('hidden'), 2700);
  }

  /** Refresh the Mis Chispas grid. */
  updatePalBook(collectedIds: readonly string[], allVocab: readonly VocabItem[]): void {
    this.palGrid.innerHTML = '';
    for (const v of allVocab) {
      const collected = collectedIds.includes(v.id);
      const cell = document.createElement('button');
      cell.className = `pal-cell${collected ? '' : ' locked'}`;
      cell.type = 'button';
      cell.innerHTML = `
        <div class="chispa-card">
          <img src="${chispaImg(v.id)}" class="chispa-img" alt="" />
          <span class="chispa-belly">${collected ? v.es : '?'}</span>
        </div>`;
      if (collected) {
        cell.setAttribute('aria-label', `${v.es} — tap to hear`);
        cell.dataset.vocabId = v.id;
      } else {
        cell.setAttribute('aria-label', 'Not yet collected');
        cell.disabled = true;
      }
      this.palGrid.appendChild(cell);
    }
    this.palGrid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pal-cell');
      if (!btn?.dataset.vocabId) return;
      btn.dispatchEvent(new CustomEvent('pal-speak', { bubbles: true, detail: btn.dataset.vocabId }));
    });
  }

  /** Render the parent dashboard from a summary object. */
  updateDashboard(summary: ParentSummary): void {
    const body = this.q('#dash-body');

    const stat = (icon: string, big: string | number, label: string) =>
      `<div class="dash-stat"><div class="dash-big">${big}</div><div class="dash-label">${icon} ${label}</div></div>`;

    const wordPills = (items: { es: string; en: string }[], cls = '') =>
      items.map(w => `<span class="dash-pill ${cls}" title="${w.en}">${w.es}</span>`).join('');

    const reviewDays = summary.nextReviews.length
      ? summary.nextReviews.slice(0, 3).map(r => `${r.es} (${r.daysUntil === 0 ? 'today' : r.daysUntil + 'd'})`).join(' · ')
      : null;

    const confPairs = summary.confusionPairs.length
      ? summary.confusionPairs.slice(0, 3).map(p => `${p.wordA} / ${p.wordB}`).join(', ')
      : null;

    const speedLabel = summary.avgResponseMs === 0 ? '—'
      : summary.avgResponseMs < 2500 ? '⚡ fast (fluent!)'
      : summary.avgResponseMs < 6000 ? '👍 normal'
      : '🐢 slow (still learning)';

    body.innerHTML = `
      <div class="dash-stats-row">
        ${stat('🐲', summary.creaturesCollected, 'pals collected')}
        ${stat('⏱️', summary.minutesPlayed, 'minutes played')}
        ${stat('📚', summary.wordsTotal - summary.wordsUnseen, `/ ${summary.wordsTotal} words met`)}
      </div>

      ${summary.wordsFluent.length ? `
        <div class="dash-section">
          <div class="dash-section-title">✅ Fluent (${summary.wordsFluent.length})</div>
          <div class="dash-pills">${wordPills(summary.wordsFluent, 'fluent')}</div>
        </div>` : ''}

      ${summary.wordsLearning.length ? `
        <div class="dash-section">
          <div class="dash-section-title">📈 Building (${summary.wordsLearning.length})</div>
          <div class="dash-pills">${wordPills(summary.wordsLearning, 'learning')}</div>
        </div>` : ''}

      ${summary.wordsStruggling.length ? `
        <div class="dash-section">
          <div class="dash-section-title">🔁 Needs more practice (${summary.wordsStruggling.length})</div>
          <div class="dash-pills">${wordPills(summary.wordsStruggling, 'struggling')}</div>
        </div>` : ''}

      ${confPairs ? `
        <div class="dash-section">
          <div class="dash-section-title">🔀 Sometimes confuses</div>
          <p class="dash-hint">${confPairs}</p>
        </div>` : ''}

      ${summary.reviewDue.length ? `
        <div class="dash-section">
          <div class="dash-section-title">📅 Due for review today</div>
          <p class="dash-hint">${summary.reviewDue.join(' · ')}</p>
        </div>` : ''}

      ${reviewDays ? `
        <div class="dash-section">
          <div class="dash-section-title">⏭️ Coming up</div>
          <p class="dash-hint">${reviewDays}</p>
        </div>` : ''}

      <div class="dash-section">
        <div class="dash-section-title">🕐 Response speed (fluent words)</div>
        <p class="dash-hint">${speedLabel}</p>
        <p class="dash-hint small">Response speed shows how confident he is. Under 2.5s = the word is solid. Over 6s = still thinking.</p>
      </div>

      <div class="dash-reco">💡 ${summary.recommendation}</div>
      <p class="dash-foot">Everything here is inferred from play patterns — no tests, no grades. 🌟</p>
    `;
  }

  /** Simple arithmetic gate before the parent dashboard — keeps kids out. */
  private openParentGate(): void {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    this.gateAnswer = a + b;

    const wrong1 = this.gateAnswer + 1 + Math.floor(Math.random() * 3);
    const wrong2 = this.gateAnswer - 1 - Math.floor(Math.random() * 3);

    const opts = [this.gateAnswer, wrong1, Math.max(1, wrong2)]
      .sort(() => Math.random() - 0.5);

    this.q('#gate-question').textContent = `What is ${a} + ${b}?`;
    const answers = this.q('#gate-answers');
    answers.innerHTML = '';
    for (const n of opts) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(n);
      btn.addEventListener('click', () => {
        if (Number(btn.textContent) === this.gateAnswer) {
          this.close('parent-gate');
          this.open('parent-dashboard');
          this.onParentDashboardOpen();
        } else {
          btn.style.background = '#ffe1e6';
          setTimeout(() => { btn.style.background = ''; }, 600);
        }
      });
      answers.appendChild(btn);
    }
    this.open('parent-gate');
  }

  private toggle(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.contains('hidden') ? this.open(id) : this.close(id);
  }

  private open(id: string): void {
    document.getElementById(id)?.classList.remove('hidden');
  }

  private close(id: string): void {
    document.getElementById(id)?.classList.add('hidden');
  }

  private q(selector: string): HTMLElement {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) throw new Error(`UI element not found: ${selector}`);
    return el;
  }

  dispose(): void {
    clearTimeout(this.bannerTimer);
    clearTimeout(this.toastTimer);
  }
}
