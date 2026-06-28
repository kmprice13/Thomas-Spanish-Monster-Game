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

const CHISPA_IMG = 'assets/chispa_base.png';

export interface UICallbacks {
  onPlay: () => void;
  onReplay: () => void;
  onMuteChange: (muted: boolean) => void;
  onSlowChange: (slow: boolean) => void;
  onCalmChange: (calm: boolean) => void;
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

    // Close buttons (data-close="panel-id")
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.close!;
        this.close(id);
      });
    });
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

  applySettings(muted: boolean, slow: boolean, calm: boolean): void {
    this.setSound.checked = !muted;
    this.setSlow.checked = slow;
    this.setCalm.checked = calm;
    document.body.classList.toggle('calm', calm);
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
          <img src="${CHISPA_IMG}" class="chispa-img" alt="" />
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
