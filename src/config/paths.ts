import { existsSync, mkdirSync } from 'fs';
import { access, constants } from 'fs/promises';
import { join } from 'path';

export const exists = (file: string) =>
  access(file, constants.F_OK)
    .then(() => true)
    .catch(() => false);

function ensureDirSync(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export const dataDir = process.env.DATA_DIR;
ensureDirSync(dataDir);

export const aliasesFile = join(process.env.DATA_DIR, 'aliases.json');

export const audioDir = join(dataDir, 'audios');
ensureDirSync(audioDir);
