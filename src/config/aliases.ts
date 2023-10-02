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

export function getChannelByInput(input: string): number | undefined {
  let channel = parseChannel(input);
  if (channel !== undefined) return channel;

  const alias = parseAlias(input);
  channel = aliases[alias];
  return channel;
}

function parseAlias(input: string) {
  return input.toLowerCase();
}

function parseChannel(input: string): number | undefined {
  if (input === '*') return 0;

  const no = parseInt(input);
  if (isNaN(no)) return undefined;
  return no;
}

export function setAlias(input: string, channelInput: string): boolean {
  const channel = parseChannel(channelInput);
  if (channel === undefined) return false;
  const alias = parseAlias(input);
  aliases[alias] = channel;
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
