import { WABot } from './WABot';

export function roomExists(this: WABot, room: string) {
  return Object.prototype.hasOwnProperty.call(this.state.rooms, room);
}

export function getRoomList(this: WABot, room?: string) {
  return Object.entries(this.state.rooms)
    .filter(([a]) => room === undefined || room === a)
    .map(([room, preset]) => `${room} -> ${preset}`)
    .join('\n');
}

export function getRoomPreset(this: WABot, input: string): number | undefined {
  let preset = parsePreset(input);
  if (preset !== undefined) return preset;

  preset = this.state.rooms[input];
  return preset;
}

function parsePreset(input: string): number | undefined {
  const no = parseInt(input);
  if (isNaN(no)) return undefined;
  if (no < 1 || no > 500) return undefined;
  return no;
}

export function setRoom(
  this: WABot,
  room: string,
  presetInput: string,
): boolean {
  if (room === WABot.STOP_ROOM_NAME) return false;
  const preset = parsePreset(presetInput);
  if (preset === undefined) return false;
  this.state.rooms[room] = preset;
  return true;
}

export function deleteRoom(this: WABot, room: string): boolean {
  if (!this.roomExists(room)) return false;
  delete this.state.rooms[room];
  return true;
}
