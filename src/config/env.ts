try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch {}

interface Env {
  AH_MOCK?: 'true' | 'false';
  AH_HOST: string;
  AH_PORT: string;
  AH_USER: string;
  AH_PASSWORD: string;
  DATA_DIR: string;
  NODE_ENV: 'development' | 'production' | 'test';
  MAX_AUDIO_FILES: string;
  AUDIO_START_DELAY: string;
  CVLC_ARGS: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}

const errs: string[] = [];

function ensureVar(name: keyof Env) {
  if (typeof process.env[name] !== 'string') {
    errs.push(`The env variable ${name} has not been set, but is required.`);
  }
}

ensureVar('AH_HOST');
process.env.AH_PORT ??= '51325';
process.env.AH_USER ??= '';
process.env.AH_PASSWORD ??= '';
process.env.DATA_DIR ??= './data';
process.env.NODE_ENV ??= 'production';
process.env.MAX_AUDIO_FILES ??= '100';
process.env.AUDIO_START_DELAY ??= '3000';
ensureVar('CVLC_ARGS');

if (isNaN(parseInt(process.env.MAX_AUDIO_FILES))) {
  errs.push('The variable MAX_AUDIO_FILES should be an integer.');
}

if (isNaN(parseInt(process.env.AUDIO_START_DELAY))) {
  errs.push('The variable AUDIO_START_DELAY should be an integer.');
}

if (!['true', 'false', undefined].includes(process.env.AH_MOCK)) {
  errs.push(
    'The variable AH_MOCK has to be one either true, false or undefined.',
  );
}

if (process.env.AH_USER) {
  const user = parseInt(process.env.AH_USER);
  if (isNaN(user) || user < 0 || user > 31) {
    errs.push(`The variable AH_USER has to be a value from 0 to 31 inclusive.`);
  }
} else {
  console.log('The variable AH_USER is empty, skipping authentication.');
}

if (errs.length > 0) {
  errs.forEach((err) => console.error(err));
  process.exit(1);
}

export {};
