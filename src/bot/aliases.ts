import { WABot } from './WABot';

export function getAliasList(this: WABot, aliasInput?: string) {
  const alias = aliasInput && parseAlias(aliasInput);
  return Object.entries(this.state.aliases)
    .filter(([a]) => alias === undefined || alias === a)
    .map(([alias, chan]) => `${alias}: ${chan}`)
    .join('\n');
}

export function getPresetByInput(
  this: WABot,
  input: string,
): number | undefined {
  let preset = parsePreset(input);
  if (preset !== undefined) return preset;

  const alias = parseAlias(input);
  preset = this.state.aliases[alias];
  return preset;
}

function parseAlias(input: string) {
  return input.toLowerCase();
}

function parsePreset(input: string): number | undefined {
  const no = parseInt(input);
  if (isNaN(no)) return undefined;
  if (no < 1 || no > 500) return undefined;
  return no;
}

export function setAlias(
  this: WABot,
  input: string,
  presetInput: string,
): boolean {
  const preset = parsePreset(presetInput);
  if (preset === undefined) return false;
  const alias = parseAlias(input);
  this.state.aliases[alias] = preset;
  return true;
}

export function deleteAlias(this: WABot, input: string): boolean {
  const alias = parseAlias(input);
  if (!Object.prototype.hasOwnProperty.call(this.state.aliases, input))
    return false;
  delete this.state.aliases[alias];
  return true;
}
