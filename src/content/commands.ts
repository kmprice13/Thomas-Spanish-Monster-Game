/**
 * Classroom command vocabulary for the Lumi Says mechanic.
 * These are the high-frequency instructions Thomas will hear every day in
 * his dual-language classroom — learning them before school starts is the
 * single highest-leverage preparation we can give him.
 */

export type CommandAction =
  | 'sit' | 'stand' | 'listen' | 'look'
  | 'write' | 'draw' | 'walk' | 'stop';

export interface CommandWord {
  id: string;
  es: string;          // spoken Spanish command (what Lumi says)
  en: string;          // English gloss (parent dashboard only — never shown to Thomas)
  icon: string;        // emoji for the action tile
  action: CommandAction;
}

export const CLASSROOM_COMMANDS: CommandWord[] = [
  // Batch 1 — introduce first (most common classroom commands)
  { id: 'sientate',  es: 'Siéntate',  en: 'Sit down', icon: '🪑', action: 'sit'    },
  { id: 'levantate', es: 'Levántate', en: 'Stand up',  icon: '⬆️', action: 'stand'  },
  { id: 'escucha',   es: 'Escucha',   en: 'Listen',    icon: '👂', action: 'listen' },
  { id: 'mira',      es: 'Mira',      en: 'Look',      icon: '👀', action: 'look'   },
  // Batch 2
  { id: 'escribe',   es: 'Escribe',   en: 'Write',     icon: '✏️', action: 'write'  },
  { id: 'dibuja',    es: 'Dibuja',    en: 'Draw',      icon: '🎨', action: 'draw'   },
  { id: 'camina',    es: 'Camina',    en: 'Walk',      icon: '🚶', action: 'walk'   },
  { id: 'para',      es: '¡Para!',    en: 'Stop',      icon: '✋', action: 'stop'   },
];

// Active teaching batch — first 4 commands.
// Expand to CLASSROOM_COMMANDS.slice(0, 8) once batch 1 is solid.
export const ACTIVE_COMMANDS = CLASSROOM_COMMANDS.slice(0, 4);
