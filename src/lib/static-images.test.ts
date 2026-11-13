import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// En /vaini/ y /brand/ solo los WebP con el ancho en el nombre (scene-oxxo-256.webp) llevan
// caché de un año (vercel.json). Si una de esas imágenes cambia, se sube con otro nombre
// (por ejemplo -257.webp o -640.webp). Lo demás (og.png, logos de correo) se revalida.
const VERSIONED = /^\/(vaini|brand)\/[^/]+-\d+\.webp$/;
const LONG_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';
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

  it('vercel.json da caché largo a los WebP versionados y a /assets/, y revalida lo demás', () => {
    const images = referencedImages();
    for (const image of images.filter((path) => VERSIONED.test(path))) expect(cacheControlFor(image), image).toEqual([LONG_CACHE]);
    expect(cacheControlFor('/assets/index-abc123.js')).toEqual([LONG_CACHE]);
    const unversioned = [
      ...images.filter((path) => !VERSIONED.test(path)),
      '/brand/og.png',
      '/brand/vaiinilla-logo-light.png',
      '/brand/vaiinilla-mark.webp',
      '/vaini/mascot-question.webp',
      '/vaini/scene-laptop.png',
    ];
    for (const path of [...unversioned, '/', '/index.html', '/spa.html', '/pedir', '/e/cafe-norte', '/sw.js', '/vainilla-2.webp']) {
      expect(cacheControlFor(path), path).toEqual([REVALIDATE]);
    }
  });

  it('cada archivo de public/vaini y public/brand cae en una sola regla de caché', () => {
    for (const dir of ['vaini', 'brand']) {
      for (const name of readdirSync(join('public', dir))) {
        const path = `/${dir}/${name}`;
        expect(cacheControlFor(path), path).toEqual([VERSIONED.test(path) ? LONG_CACHE : REVALIDATE]);
      }
    }
  });
});
