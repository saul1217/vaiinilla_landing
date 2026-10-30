import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findProductionDomains } from '../../scripts/check-bundle-domains.mjs';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name) && !path.includes('/test/') ? [path] : [];
  });
}

describe('dominios de producción', () => {
  it('el detector encuentra el panel y los QR de producción', () => {
    expect(findProductionDomains('x="https://app.vaiinilla.app/acceso"')).toEqual(['app.vaiinilla.app']);
    expect(findProductionDomains('`https://vaiinilla.app/u/${id}`')).toEqual(['vaiinilla.app/u/']);
    expect(findProductionDomains('mailto:equipo@vaiinilla.app https://sand-user.vaiinilla.app/u/1')).toEqual([]);
  });

  it('el código fuente no fija dominios de producción: salen de VITE_*', () => {
    const offenders = sourceFiles(join(process.cwd(), 'src')).filter(
      (file) => findProductionDomains(readFileSync(file, 'utf8')).length > 0,
    );
    expect(offenders).toEqual([]);
  });
});
