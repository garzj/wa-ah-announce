import { existsSync, mkdirSync } from 'fs';
import { access, constants } from 'fs/promises';
import { join } from 'path';
import { env } from './env';

export const exists = (file: string) =>
  access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);

function ensureDirSync(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export const dataDir = env.DATA_DIR;
ensureDirSync(dataDir);
