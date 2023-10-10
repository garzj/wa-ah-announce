import { readFileSync, writeFile } from 'fs';
import { aliasesFile } from './paths';

let aliases: Record<string, number> = {};
try {
  aliases = JSON.parse(readFileSync(aliasesFile).toString());
} catch {}

function saveAliases() {
  writeFile(
    aliasesFile,
    JSON.stringify(aliases, undefined, 2) + '\n',
    (err) => {
      if (err) {
        console.error(err);
        console.error('Warning: Aliases file could not be written.');
      }
    },
  );
}

export function getAliasList(aliasInput?: string) {
  const alias = aliasInput && parseAlias(aliasInput);
  return Object.entries(aliases)
    .filter(([a]) => alias === undefined || alias === a)
    .map(([alias, chan]) => `${alias}: ${chan}`)
    .join('\n');
}

export function getPresetByInput(input: string): number | undefined {
  let preset = parsePreset(input);
  if (preset !== undefined) return preset;

  const alias = parseAlias(input);
  preset = aliases[alias];
  return preset;
}

function parseAlias(input: string) {
  return input.toLowerCase();
}

function parsePreset(input: string): number | undefined {
  if (input === '*') return 0;

  const no = parseInt(input);
  if (isNaN(no)) return undefined;
  return no;
}

export function setAlias(input: string, presetInput: string): boolean {
  const preset = parsePreset(presetInput);
  if (preset === undefined) return false;
  const alias = parseAlias(input);
  aliases[alias] = preset;
  saveAliases();
  return true;
}

export function deleteAlias(input: string): boolean {
  const alias = parseAlias(input);
  if (!Object.prototype.hasOwnProperty.call(aliases, input)) return false;
  delete aliases[alias];
  saveAliases();
  return true;
}
