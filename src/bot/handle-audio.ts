import { downloadMediaMessage, proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { writeFile } from 'fs/promises';

export async function handleAudioMsg(
  this: WABot,
  message: proto.IWebMessageInfo,
) {
  const id = message.key.id;
  if (!id) return;

  const saving = (async () => {})();
  this.savingMsgs.set(id, saving);
  await saving;
  this.savingMsgs.delete(id);

  const stream = await downloadMediaMessage(
    message,
    'stream',
    {},
    {
      logger: this.logger,
      reuploadRequest: this.sock.updateMediaMessage,
    },
  );
  await writeFile(this.getAudioPath(id), stream);
}
