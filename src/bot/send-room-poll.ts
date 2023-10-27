import { WABot } from './WABot';

export async function sendRoomPoll(
  this: WABot,
  remoteJid: string,
  audioFile: string,
) {
  if (this.state.curPoll) {
    await this.sock.sendMessage(this.state.curPoll.key.remoteJid!, {
      delete: this.state.curPoll.key,
    });
  }
  delete this.state.curPoll;

  if (Object.keys(this.state.rooms).length === 0)
    return this.answer(
      remoteJid,
      "No rooms were configured yet, won't play audio. Enter !help for more information.",
    );

  const rooms = Object.keys(this.state.rooms);
  rooms.unshift(WABot.STOP_ROOM_NAME);

  const msg = await this.sock.sendMessage(remoteJid, {
    poll: {
      name: 'Where should I play this?',
      values: rooms,
      selectableCount: 1,
    },
  });
  if (!msg) {
    return this.answer(
      remoteJid,
      'Somehow I failed to handle your request correctly, please try again.',
    );
  }
  this.state.curPoll = {
    audioFile,
    key: msg.key,
  };
}
