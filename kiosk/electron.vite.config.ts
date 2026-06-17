import { resolve }     from 'path'
import { readFileSync } from 'fs'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// ── Load .env manually ────────────────────────────────────────────────────────
// electron-vite evaluates the config BEFORE Vite's env loading runs, so
// process.env.SUPABASE_URL is empty unless we read .env ourselves here.
function readEnvFile(): Record<string, string> {
  try {
    const lines = readFileSync(resolve(__dirname, '.env'), 'utf-8').split('\n')
    const out: Record<string, string> = {}
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
    }
    return out
  } catch {
    return {}
  }
}

const envFile = readEnvFile()

const supabaseUrl  = envFile.SUPABASE_URL      || process.env.SUPABASE_URL      || ''
const supabaseKey  = envFile.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
// Must match VITE_HASH_SALT in the web app's .env so PIN/RFID hashes align.
// Leave empty if VITE_HASH_SALT is not set in the web app (plain SHA-256 is used).
const hashSalt     = envFile.HASH_SALT         || process.env.HASH_SALT         || ''
// Admin PIN required to exit kiosk mode via the Admin button.
// Stored only in the main-process bundle — never sent to the renderer.
const adminPin     = envFile.ADMIN_PIN         || process.env.ADMIN_PIN         || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('[electron-vite] WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is empty. Check kiosk/.env')
} else {
  console.log(`[electron-vite] Supabase URL loaded: ${supabaseUrl.substring(0, 40)}…`)
}
if (hashSalt) {
  console.log('[electron-vite] HASH_SALT is set — hashes will be salted.')
} else {
  console.warn('[electron-vite] HASH_SALT is empty — plain SHA-256 used. Set if VITE_HASH_SALT is set in the web app.')
}
if (adminPin) {
  console.log('[electron-vite] ADMIN_PIN is set — Admin button requires PIN to exit.')
} else {
  console.warn('[electron-vite] ADMIN_PIN is empty — Admin button is disabled; only Ctrl+Alt+Q exits kiosk mode.')
}

// Main-process build-time defines (never exposed to renderer bundle)
const mainEnv = {
  __SUPABASE_URL__:      JSON.stringify(supabaseUrl),
  __SUPABASE_ANON_KEY__: JSON.stringify(supabaseKey),
  __HASH_SALT__:         JSON.stringify(hashSalt),
  __ADMIN_PIN__:         JSON.stringify(adminPin),
}

// Renderer-visible flag: true if admin button should show, false if not.
// The actual PIN is NOT sent to the renderer — only whether one is configured.
const rendererEnv = {
  __ADMIN_PIN_SET__: JSON.stringify(adminPin.length > 0),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: mainEnv,
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    define: rendererEnv,
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
  },
})
