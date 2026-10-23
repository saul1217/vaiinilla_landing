// Falla si el bundle de development trae dominios de producción fijos (QA-042).
// Uso: VITE_APP_ENV=development npm run build  (en production no revisa nada: ahí son válidos).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FORBIDDEN = [/app\.vaiinilla\.app/g, /(?<![\w.-])vaiinilla\.app\/u\//g];
const SCANNED = /\.(js|css|html|webmanifest|json)$/;

export function findProductionDomains(text) {
  return FORBIDDEN.flatMap((pattern) => text.match(pattern) ?? []);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (SCANNED.test(name)) yield path;
  }
}

export function checkBundle(dir) {
  const offenders = [];
  for (const file of walk(dir)) {
    const hits = findProductionDomains(readFileSync(file, 'utf8'));
    if (hits.length) offenders.push(`${file}: ${[...new Set(hits)].join(', ')}`);
  }
  return offenders;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = process.env.VITE_APP_ENV?.trim();
  if (environment !== 'development') {
    console.log('check-bundle-domains: VITE_APP_ENV no es development, no se revisa.');
  } else {
    const offenders = checkBundle(process.argv[2] ?? 'dist');
    if (offenders.length) {
      console.error('El bundle de development trae dominios de producción fijos:\n' + offenders.join('\n'));
      process.exit(1);
    }
    console.log('check-bundle-domains: el bundle de development no trae dominios de producción.');
  }
}
