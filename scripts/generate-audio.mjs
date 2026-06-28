/**
 * Generate Spanish audio clips using the macOS Paulina (es_MX) voice.
 * Run once: node scripts/generate-audio.mjs
 * Outputs M4A files to public/audio/ and a manifest.json for the AudioClips loader.
 *
 * When an ElevenLabs key is available, swap the sayAndConvert() call for an API call
 * and delete the generated files — the manifest format stays identical.
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'audio');
mkdirSync(OUT, { recursive: true });

// Best available voice: Paulina = es_MX (Mexican Spanish, warm and clear).
// Fallback: Mónica = es_ES (Castilian Spanish).
const VOICE = 'Paulina';
const RATE = 160; // slightly slower than default for children

/** Vocabulary — mirrors src/content/vocabulary.ts */
const VOCAB = [
  { id: 'manzana', article: 'la', word: 'manzana' },
  { id: 'platano',  article: 'el', word: 'plátano'  },
  { id: 'fresa',    article: 'la', word: 'fresa'    },
  { id: 'flor',     article: 'la', word: 'flor'     },
  { id: 'estrella', article: 'la', word: 'estrella' },
  { id: 'pelota',   article: 'la', word: 'pelota'   },
  { id: 'pez',      article: 'el', word: 'pez'      },
  { id: 'rana',     article: 'la', word: 'rana'     },
  { id: 'pajaro',   article: 'el', word: 'pájaro'   },
  { id: 'mariposa', article: 'la', word: 'mariposa' },
  { id: 'seta',     article: 'la', word: 'seta'     },
  { id: 'hueso',    article: 'el', word: 'hueso'    },
];

const PRAISE = [
  '¡Sí! ¡Muy bien!',
  '¡Perfecto!',
  '¡Genial!',
  '¡Lo lograste!',
  '¡Excelente!',
  '¡Qué bien!',
];

const NUDGE = [
  'Mmm... otra vez.',
  'Casi. Escucha.',
  'Inténtalo.',
];

/** All phrases to generate. */
const PHRASES = [
  // Word pronunciations (pal book tap)
  ...VOCAB.map(v => ({ id: `word-${v.id}`, text: `${v.article} ${v.word}` })),
  // Lumi introductions — enthusiastic, short
  ...VOCAB.map(v => ({ id: `intro-${v.id}`, text: `¡Mira! ¡${v.article} ${v.word}!` })),
  // Find commands
  ...VOCAB.map(v => ({ id: `find-${v.id}`, text: `Busca ${v.article} ${v.word}.` })),
  // Touch commands
  ...VOCAB.map(v => ({ id: `touch-${v.id}`, text: `Toca ${v.article} ${v.word}.` })),
  // Give / deliver commands
  ...VOCAB.map(v => ({ id: `give-${v.id}`, text: `Dale ${v.article} ${v.word} a Lumi.` })),
  // Carrying confirmation (give quest pickup)
  ...VOCAB.map(v => ({ id: `carrying-${v.id}`, text: `¡Sí! Dale ${v.article} ${v.word} a Lumi.` })),
  // Praise
  ...PRAISE.map((text, i) => ({ id: `praise-${i}`, text })),
  // Nudges
  ...NUDGE.map((text, i) => ({ id: `nudge-${i}`, text })),
  // UI / special
  { id: 'lumi-hello',   text: '¡Hola! Soy Lumi.' },
  { id: 'lumi-ready',   text: '¿Listo? ¡Vamos!' },
  { id: 'new-word',     text: '¡Nueva palabra!' },
  { id: 'new-friend',   text: '¡Nuevo amigo!' },
];

function sayAndConvert(text, outBase) {
  const aiff = `${outBase}.aiff`;
  const m4a  = `${outBase}.m4a`;
  if (existsSync(m4a)) return; // skip already generated
  // escape double quotes for shell
  const safe = text.replace(/"/g, '\\"');
  execSync(`say -v "${VOICE}" -r ${RATE} -o "${aiff}" "${safe}"`, { stdio: 'pipe' });
  execSync(`afconvert -f m4af -d aac "${aiff}" "${m4a}"`,         { stdio: 'pipe' });
  execSync(`rm "${aiff}"`);
}

console.log(`Generating ${PHRASES.length} clips with ${VOICE} voice…\n`);
const generated = [];

for (const { id, text } of PHRASES) {
  const base = join(OUT, id);
  try {
    sayAndConvert(text, base);
    generated.push(id);
    process.stdout.write(`  ✓ ${id}\n`);
  } catch (err) {
    process.stderr.write(`  ✗ ${id}: ${err.message}\n`);
  }
}

// Write manifest so AudioClips knows which files exist without probing.
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(generated, null, 2));
console.log(`\nDone. ${generated.length}/${PHRASES.length} clips written to public/audio/`);
console.log('Manifest: public/audio/manifest.json');
