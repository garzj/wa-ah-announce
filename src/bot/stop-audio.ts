import { WABot } from './WABot';

export async function stopAudio(this: WABot, remoteJid: string) {
  if (!this.player.isPlaying())
    return this.answer(remoteJid, 'No audio is being played.');

  await this.player.stopPlaying();
  await this.answer(remoteJid, 'Stopped playing audio.');
}
