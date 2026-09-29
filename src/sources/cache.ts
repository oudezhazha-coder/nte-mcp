/** 本地 JSON 缓存 */

import { promises as fs } from 'node:fs';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { config } from '../config.js';

function cacheDir(): string {
  const dir = resolve(process.cwd(), config.cache.dir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function cacheKey(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const chr = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return `cache_${Math.abs(hash).toString(36)}`;
}

function cachePath(url: string): string {
  return resolve(cacheDir(), `${cacheKey(url)}.json`);
}

interface CacheEntry {
  url: string;
  data: unknown;
  fetchedAt: number;
}

export async function getCached(url: string): Promise<unknown | null> {
  const path = cachePath(url);
  try {
    const raw = await fs.readFile(path, 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);
    const age = Date.now() - entry.fetchedAt;
    if (age < config.cache.ttlSec * 1000) {
      return entry.data;
    }
  } catch {
    // 缓存不存在或过期
  }
  return null;
}

export async function setCache(url: string, data: unknown): Promise<void> {
  const path = cachePath(url);
  const entry: CacheEntry = { url, data, fetchedAt: Date.now() };
  await fs.writeFile(path, JSON.stringify(entry, null, 2), 'utf-8');
}