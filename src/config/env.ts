try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch {}

interface Env {
  AH_HOST: string;
  AH_PORT: string;
  AH_USER: string;
  AH_PASSWORD: string;
  DATA_DIR: string;
  NODE_ENV: 'development' | 'production' | 'test';
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
process.env.PORT ??= '51325';
ensureVar('AH_USER');
ensureVar('AH_PASSWORD');
process.env.NODE_ENV ??= 'production';
process.env.DATA_DIR ??= './data';

const user = parseInt(process.env.AH_USER);
if (isNaN(user) || user < 0 || user > 31) {
  errs.push(`The variable AH_USER has to be a value from 0 to 31 inclusive.`);
}

if (errs.length > 0) {
  errs.forEach((err) => console.error(err));
  process.exit(1);
}

export {};