import { WABot } from './WABot';

export function getRoomList(this: WABot, roomInput?: string) {
  const room = roomInput && parseRoom(roomInput);
  return Object.entries(this.state.rooms)
    .filter(([a]) => room === undefined || room === a)
    .map(([room, preset]) => `${room}: ${preset}`)
    .join('\n');
}

export function getPresetByInput(
  this: WABot,
  input: string,
): number | undefined {
  let preset = parsePreset(input);
  if (preset !== undefined) return preset;

  const room = parseRoom(input);
  preset = this.state.rooms[room];
  return preset;
}

function parseRoom(input: string) {
  return input.toLowerCase();
}

function parsePreset(input: string): number | undefined {
  const no = parseInt(input);
  if (isNaN(no)) return undefined;
  if (no < 1 || no > 500) return undefined;
  return no;
}

export function setRoom(
  this: WABot,
  input: string,
  presetInput: string,
): boolean {
  const preset = parsePreset(presetInput);
  if (preset === undefined) return false;
  const room = parseRoom(input);
  this.state.rooms[room] = preset;
  return true;
}

export function deleteRoom(this: WABot, input: string): boolean {
  const room = parseRoom(input);
  if (!Object.prototype.hasOwnProperty.call(this.state.rooms, input))
    return false;
  delete this.state.rooms[room];
  return true;
}
