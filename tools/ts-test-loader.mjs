import { access } from 'node:fs/promises';

/** Node test runner için Vite/TypeScript'in uzantısız yerel importlarını çözer. */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || /\.[a-z0-9]+$/i.test(specifier)) throw error;
    for (const suffix of ['.ts', '/index.ts']) {
      const url = new URL(specifier + suffix, context.parentURL);
      try {
        await access(url);
        return { url: url.href, shortCircuit: true };
      } catch {
        // Sonraki olası uzantıyı dene.
      }
    }
    throw error;
  }
}
