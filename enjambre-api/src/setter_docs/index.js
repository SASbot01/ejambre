// Loader for setter documentation files
// Reads all .md files from setter_docs/ and returns concatenated content
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 300_000; // 5 min

export function loadSetterDocs() {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  try {
    const files = readdirSync(__dirname)
      .filter(f => f.endsWith('.md'))
      .sort();
    const parts = files.map(f => {
      try { return readFileSync(join(__dirname, f), 'utf-8'); }
      catch { return ''; }
    });
    _cache = parts.filter(Boolean).join('\n\n---\n\n');
    _cacheTime = Date.now();
    return _cache;
  } catch (err) {
    console.error('Error loading setter docs:', err.message);
    return '';
  }
}
