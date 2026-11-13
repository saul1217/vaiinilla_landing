import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// /vaini/ y /brand/ se sirven con caché de un año (vercel.json). Si una imagen cambia,
// cambia también su nombre (por ejemplo -512.webp a -512b.webp o -640.webp).
const CACHED_DIRS = ['vaini', 'brand'] as const;
const MAX_IMAGE_KB = 80;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function referencedImages(): string[] {
  const found = new Set<string>();
  for (const file of sourceFiles('src')) {
    for (const match of readFileSync(file, 'utf8').matchAll(/['"(]\/(vaini|brand)\/([\w.-]+\.(?:png|jpe?g|webp))/g)) {
      found.add(`/${match[1]}/${match[2]}`);
    }
  }
  return [...found].sort();
}

function cacheControlFor(path: string): string[] {
  const { headers } = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  return headers
    .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
    .flatMap((rule) => rule.headers.filter((h) => h.key === 'Cache-Control').map((h) => h.value));
}

describe('imágenes estáticas', () => {
  it('cada imagen de /vaini/ y /brand/ que usa la interfaz existe en public/', () => {
    const images = referencedImages();
    expect(images.length).toBeGreaterThan(5);
    for (const image of images) expect(existsSync(join('public', image)), image).toBe(true);
  });

  it(`las imágenes que usa la interfaz son WebP de menos de ${MAX_IMAGE_KB} KB`, () => {
    for (const image of referencedImages()) {
      expect(image, image).toMatch(/\.webp$/);
      expect(statSync(join('public', image)).size / 1024, image).toBeLessThan(MAX_IMAGE_KB);
    }
  });

  it('vercel.json da caché largo a /vaini/, /brand/ y /assets/, y revalida el HTML', () => {
    const longCache = 'public, max-age=31536000, immutable';
    for (const dir of CACHED_DIRS) expect(cacheControlFor(`/${dir}/cutout-frente-512.webp`)).toEqual([longCache]);
    expect(cacheControlFor('/assets/index-abc123.js')).toEqual([longCache]);
    for (const path of ['/', '/index.html', '/spa.html', '/pedir', '/e/cafe-norte', '/sw.js', '/vainilla']) {
      expect(cacheControlFor(path), path).toEqual(['public, max-age=0, must-revalidate']);
    }
  });
});
