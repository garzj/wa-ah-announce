import { downloadMediaMessage, proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { readdir, stat, unlink, writeFile } from 'fs/promises';

export async function handleAudioMsg(
  this: WABot,
  message: proto.IWebMessageInfo,
) {
  const id = message.key.id;
  if (!id) return;

  const audioFile = this.getAudioPath(id);

  const saving = (async () => {
    const stream = await downloadMediaMessage(
      message,
      'stream',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.sock.updateMediaMessage,
      },
    );
    await writeFile(audioFile, stream);
  })();
  this.savingMsgs.set(id, saving);
  await saving;
  this.savingMsgs.delete(id);

  await this.sendRoomPoll(message.key.remoteJid!, audioFile);

  // Delete old media
  const files = await readdir(this.getAudioDir());
  if (files.length > parseInt(process.env.MAX_AUDIO_FILES)) {
    let oldestTime: Date | undefined;
    let oldestFile: string | null = null;
    await Promise.all(
      files.map(async (file) => {
        const stats = await stat(file);
        if (oldestTime === undefined || stats.mtime < oldestTime) {
          oldestTime = stats.mtime;
          oldestFile = file;
        }
      }),
    );

    oldestFile && (await unlink(oldestFile));
  }
}
