import { defineConfig, type Plugin } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { assertReleaseAssets, assertCurrentCastAssets } from './tools/release-assets.mjs';
import { dirname, resolve } from 'node:path';

/**
 * Yalnızca `vite dev` sırasında çalışan geliştirme yardımcısı:
 * `POST /__shot` ile gönderilen PNG'yi `.devshots/` altına yazar
 * (kamera/animasyon/yerleşim doğrulaması için). `apply: 'serve'`
 * olduğu için üretim derlemesine dahil edilmez.
 */
function devScreenshot(): Plugin {
  return {
    name: 'dev-screenshot',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
            const { name, data } = JSON.parse(body) as { name: string; data: string };
            const safe = name.replace(/[^a-z0-9._-]/gi, '_');
            const out = resolve(process.cwd(), '.devshots', safe);
            mkdirSync(dirname(out), { recursive: true });
            writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
            res.statusCode = 200;
            res.end(out);
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

function releaseGuard(): Plugin {
  let output = '';
  return {
    name: 'release-asset-guard',
    apply: 'build',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    buildStart() {
      assertReleaseAssets(resolve('public'));
      assertCurrentCastAssets(resolve('public'));
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (
          chunk.type === 'chunk' &&
          Object.keys(chunk.modules).some((id) =>
            /[/\\](OriginalCharacters|PackCharacters)\.ts$/.test(id),
          )
        )
          this.error('An alternative character family entered the game bundle.');
      }
    },
    closeBundle() {
      assertReleaseAssets(output);
      assertCurrentCastAssets(output);
    },
  };
}
export default defineConfig({
  base: './',
  plugins: [devScreenshot(), releaseGuard()],
  // PORT env değişkeni (araç atadıysa) sabit portun önüne geçer.
  server: {
    host: true,
    port: Number(process.env.PORT) || 5173,
    open: false,
    // Büyük kaynak/arşiv paketleri çalışma anında kullanılmaz; Windows'un
    // dosya izleyicisine sokmak GLB kopyalanırken EBUSY ile sunucuyu düşürür.
    watch: {
      ignored: [
        '**/_paketler/**',
        '**/.asset-preview/**',
        '**/.devshots/**',
        '**/.tools/**',
        '**/android/**',
        '**/ios/**',
        '**/cikti/**',
        '**/docs/**',
        '**/.local-data/**',
      ],
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      input: resolve(process.cwd(), 'index.html'),
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
