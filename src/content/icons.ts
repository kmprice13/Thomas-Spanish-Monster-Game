/**
 * Phosphor Icons (fill weight, MIT licensed — see src/assets/icons/LICENSE-phosphor.txt),
 * vendored locally as raw SVG so the game stays offline-first. Each SVG uses
 * fill="currentColor", so it tints to match whatever CSS `color` it's placed in.
 *
 * Replaces emoji glyphs, which render inconsistently across devices/OSes and
 * don't match the game's warm cartoon-sticker style.
 */
import egg from '../assets/icons/egg.svg?raw';
import sparkle from '../assets/icons/sparkle.svg?raw';
import coin from '../assets/icons/coin.svg?raw';
import magnifyingGlass from '../assets/icons/magnifying-glass.svg?raw';
import handTap from '../assets/icons/hand-tap.svg?raw';
import gift from '../assets/icons/gift.svg?raw';
import listNumbers from '../assets/icons/list-numbers.svg?raw';
import palette from '../assets/icons/palette.svg?raw';
import speakerHigh from '../assets/icons/speaker-high.svg?raw';
import gear from '../assets/icons/gear.svg?raw';
import lock from '../assets/icons/lock.svg?raw';
import musicNotes from '../assets/icons/music-notes.svg?raw';
import gauge from '../assets/icons/gauge.svg?raw';
import moon from '../assets/icons/moon.svg?raw';
import armchair from '../assets/icons/armchair.svg?raw';
import arrowUp from '../assets/icons/arrow-up.svg?raw';
import ear from '../assets/icons/ear.svg?raw';
import eyes from '../assets/icons/eyes.svg?raw';
import pencil from '../assets/icons/pencil.svg?raw';
import paintBrush from '../assets/icons/paint-brush.svg?raw';
import personWalk from '../assets/icons/person-walk.svg?raw';
import handPalm from '../assets/icons/hand-palm.svg?raw';
import timer from '../assets/icons/timer.svg?raw';
import books from '../assets/icons/books.svg?raw';
import checkCircle from '../assets/icons/check-circle.svg?raw';
import trendUp from '../assets/icons/trend-up.svg?raw';
import arrowsClockwise from '../assets/icons/arrows-clockwise.svg?raw';
import shuffle from '../assets/icons/shuffle.svg?raw';
import calendarCheck from '../assets/icons/calendar-check.svg?raw';
import skipForward from '../assets/icons/skip-forward.svg?raw';
import lightbulb from '../assets/icons/lightbulb.svg?raw';
import star from '../assets/icons/star.svg?raw';
import lightning from '../assets/icons/lightning.svg?raw';
import thumbsUp from '../assets/icons/thumbs-up.svg?raw';
import hourglass from '../assets/icons/hourglass.svg?raw';
import xCircle from '../assets/icons/x-circle.svg?raw';

export const ICONS = {
  egg, sparkle, coin, magnifyingGlass, handTap, gift, listNumbers, palette,
  speakerHigh, gear, lock, musicNotes, gauge, moon, armchair, arrowUp, ear,
  eyes, pencil, paintBrush, personWalk, handPalm,
  timer, books, checkCircle, trendUp, arrowsClockwise, shuffle, calendarCheck,
  skipForward, lightbulb, star, lightning, thumbsUp, hourglass, xCircle,
} as const;

export type IconName = keyof typeof ICONS;

/** Replace every `[data-icon]` placeholder in the DOM with its SVG markup. */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach(el => {
    const name = el.dataset.icon as IconName;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}
