/**
 * Generate Spanish audio clips using ElevenLabs.
 * Run once: node scripts/generate-audio.mjs
 * Outputs MP3 files to public/audio/ and a manifest.json for the AudioClips loader.
 *
 * Requires .env at project root:
 *   ELEVENLABS_API_KEY=your_key_here
 *   ELEVENLABS_VOICE_ID=your_voice_id_here
 *
 * Skips already-generated files — safe to re-run after adding new vocabulary.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'public', 'audio');
mkdirSync(OUT, { recursive: true });

// Load .env manually (no external deps)
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const API_KEY  = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const MODEL    = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';

if (!API_KEY)  { console.error('Missing ELEVENLABS_API_KEY in .env'); process.exit(1); }
if (!VOICE_ID) { console.error('Missing ELEVENLABS_VOICE_ID in .env'); process.exit(1); }

// ── Vocabulary — mirrors src/content/vocabulary.ts ───────────────────────────
const VOCAB = [
  // Meadow biome
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
  // La Mochila — school supplies
  { id: 'lapiz',     article: 'el',  word: 'lápiz'     },
  { id: 'crayon',    article: 'el',  word: 'crayón'    },
  { id: 'papel',     article: 'el',  word: 'papel'     },
  { id: 'libro',     article: 'el',  word: 'libro'     },
  { id: 'mochila',   article: 'la',  word: 'mochila'   },
  { id: 'tijera',    article: 'la',  word: 'tijera'    },
  { id: 'pegamento', article: 'el',  word: 'pegamento' },
  { id: 'borrador',  article: 'el',  word: 'borrador'  },
  { id: 'cuaderno',  article: 'el',  word: 'cuaderno'  },
  { id: 'regla',     article: 'la',  word: 'regla'     },
  // Beach biome
  { id: 'cubeta',   article: 'la',  word: 'cubeta'   },
  { id: 'coral',    article: 'el',  word: 'coral'    },
  { id: 'cangrejo', article: 'el',  word: 'cangrejo' },
  { id: 'delfin',   article: 'el',  word: 'delfín'   },
  { id: 'medusa',   article: 'la',  word: 'medusa'   },
  { id: 'castillo', article: 'el',  word: 'castillo' },
  { id: 'gaviota',  article: 'la',  word: 'gaviota'  },
  { id: 'concha',   article: 'la',  word: 'concha'   },
  { id: 'tortuga',  article: 'la',  word: 'tortuga'  },
  { id: 'ola',      article: 'la',  word: 'ola'      },
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

// Classroom commands for Nube Says — mirrors src/content/commands.ts
const COMMANDS = [
  { id: 'sientate',  es: 'Siéntate'  },
  { id: 'levantate', es: 'Levántate' },
  { id: 'escucha',   es: 'Escucha'   },
  { id: 'mira',      es: 'Mira'      },
  { id: 'escribe',   es: 'Escribe'   },
  { id: 'dibuja',    es: 'Dibuja'    },
  { id: 'camina',    es: 'Camina'    },
  { id: 'para',      es: '¡Para!'    },
];

const PHRASES = [
  ...VOCAB.map(v => ({ id: `word-${v.id}`,     text: `${v.article} ${v.word}` })),
  ...VOCAB.map(v => ({ id: `intro-${v.id}`,    text: `¡Mira! ¡${v.article} ${v.word}!` })),
  ...VOCAB.map(v => ({ id: `find-${v.id}`,     text: `Busca ${v.article} ${v.word}.` })),
  ...VOCAB.map(v => ({ id: `touch-${v.id}`,    text: `Toca ${v.article} ${v.word}.` })),
  ...VOCAB.map(v => ({ id: `give-${v.id}`,     text: `Dale ${v.article} ${v.word} a Nube.` })),
  ...VOCAB.map(v => ({ id: `carrying-${v.id}`, text: `¡Sí! Dale ${v.article} ${v.word} a Nube.` })),
  ...COMMANDS.map(c => ({ id: `simon-${c.id}`, text: c.es })),
  ...PRAISE.map((text, i) => ({ id: `praise-${i}`, text })),
  ...NUDGE.map((text,  i) => ({ id: `nudge-${i}`,  text })),
  { id: 'nube-hello',  text: '¡Hola! Soy Nube.' },
  { id: 'nube-ready',  text: '¿Listo? ¡Vamos!' },
  { id: 'nube-dice',   text: '¡Nube dice!' },
  { id: 'new-word',    text: '¡Nueva palabra!' },
  { id: 'new-friend',  text: '¡Nuevo amigo!' },
  { id: 'new-chispa',  text: '¡Nueva Chispa!' },
];

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────

async function generateClip(text, outPath) {
  if (existsSync(outPath)) return false; // already generated

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.80,
        style: 0.20,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HTTP ${res.status}: ${err}`);
  }

  const buf = await res.arrayBuffer();
  writeFileSync(outPath, Buffer.from(buf));
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`Generating ${PHRASES.length} clips  voice=${VOICE_ID}  model=${MODEL}\n`);

const generated = [];
let newCount = 0;

for (const { id, text } of PHRASES) {
  const outPath = join(OUT, `${id}.mp3`);
  try {
    const wasNew = await generateClip(text, outPath);
    generated.push(id);
    process.stdout.write(wasNew ? `  ✓ ${id}\n` : `  – ${id} (cached)\n`);
    if (wasNew) {
      newCount++;
      // Polite rate limit: 3 req/s
      await new Promise(r => setTimeout(r, 340));
    }
  } catch (err) {
    process.stderr.write(`  ✗ ${id}: ${err.message}\n`);
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(generated, null, 2));
console.log(`\nDone. ${newCount} new clips, ${generated.length} total → public/audio/`);
