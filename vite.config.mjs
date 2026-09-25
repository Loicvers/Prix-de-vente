// Compilation de l'app (dossier app/) vers dist/, publié par GitHub Pages.
import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = join(ICI, 'app');
const PUBLIC = join(APP, 'public');

// Génère dist/sw.js à partir de app/sw-modele.js : liste de tous les fichiers
// publiés (pour le hors ligne) et version du cache = empreinte de leur contenu.
function serviceWorker() {
  return {
    name: 'prix-de-vente-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const contenus = {};
      for (const [nom, sortie] of Object.entries(bundle)) {
        // .map : outil de débogage ; .woff : repli des très vieux navigateurs (le .woff2 suffit).
        if (nom.endsWith('.map') || nom.endsWith('.woff')) continue;
        contenus[nom] = sortie.type === 'chunk' ? sortie.code : sortie.source;
      }
      for (const nom of readdirSync(PUBLIC)) contenus[nom] = readFileSync(join(PUBLIC, nom));
      const modele = readFileSync(join(APP, 'sw-modele.js'), 'utf8');
      const empreinte = createHash('sha256');
      for (const nom of Object.keys(contenus).sort()) empreinte.update(nom).update('\0').update(contenus[nom]).update('\0');
      empreinte.update(modele);
      const fichiers = ['./', ...Object.keys(contenus).sort()];
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: modele
          .replace('__VERSION__', empreinte.digest('hex').slice(0, 12))
          .replace('__FICHIERS__', JSON.stringify(fichiers)),
      });
    },
  };
}

export default defineConfig({
  root: APP,
  base: './',
  build: {
    outDir: join(ICI, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  plugins: [serviceWorker()],
});
