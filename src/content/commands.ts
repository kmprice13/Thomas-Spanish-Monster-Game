/**
 * Classroom command vocabulary for the Nube Says mechanic.
 * These are the high-frequency instructions Thomas will hear every day in
 * his dual-language classroom — learning them before school starts is the
 * single highest-leverage preparation we can give him.
 */

export type CommandAction =
  | 'sit' | 'stand' | 'listen' | 'look'
  | 'write' | 'draw' | 'walk' | 'stop';

import type { IconName } from './icons';

export interface CommandWord {
  id: string;
  es: string;          // spoken Spanish command (what Nube says)
  en: string;          // English gloss (parent dashboard only — never shown to Thomas)
  icon: IconName;       // action tile icon
  action: CommandAction;
}

export const CLASSROOM_COMMANDS: CommandWord[] = [
  // Batch 1 — introduce first (most common classroom commands)
  { id: 'sientate',  es: 'Siéntate',  en: 'Sit down', icon: 'armchair',   action: 'sit'    },
  { id: 'levantate', es: 'Levántate', en: 'Stand up',  icon: 'arrowUp',    action: 'stand'  },
  { id: 'escucha',   es: 'Escucha',   en: 'Listen',    icon: 'ear',        action: 'listen' },
  { id: 'mira',      es: 'Mira',      en: 'Look',      icon: 'eyes',       action: 'look'   },
  // Batch 2
  { id: 'escribe',   es: 'Escribe',   en: 'Write',     icon: 'pencil',     action: 'write'  },
  { id: 'dibuja',    es: 'Dibuja',    en: 'Draw',      icon: 'paintBrush', action: 'draw'   },
  { id: 'camina',    es: 'Camina',    en: 'Walk',      icon: 'personWalk', action: 'walk'   },
  { id: 'para',      es: '¡Para!',    en: 'Stop',      icon: 'handPalm',   action: 'stop'   },
];

export const ACTIVE_COMMANDS = CLASSROOM_COMMANDS.slice(0, 8);
