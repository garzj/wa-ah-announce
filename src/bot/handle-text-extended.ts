import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { exists } from '../config/paths';
import { getChannelByInput } from '../config/aliases';
import { readFile } from 'fs/promises';

export async function handleExtendedTextMsg(
  this: WABot,
  extended: proto.Message.IExtendedTextMessage,
  message: proto.IWebMessageInfo,
) {
  const quotedId = extended.contextInfo?.stanzaId;
  if (!quotedId) return;

  if (!extended.contextInfo?.quotedMessage?.audioMessage) {
    return await this.answer(message, 'The quoted message is not an audio.');
  }

  await this.savingMsgs.get(quotedId);
  const audioFile = this.getAudioPath(quotedId);
  if (!(await exists(audioFile))) {
    return await this.answer(
      message,
      'The mentioned audio file has not been saved. Please reupload it.',
    );
  }

  const channel =
    typeof extended.text === 'string'
      ? getChannelByInput(extended.text)
      : undefined;
  if (channel === undefined) {
    return await this.answer(
      message,
      "Invalid channel or alias specified. Won't play audio.",
    );
  }

  const buf = await readFile(audioFile);
  const suc = await this.player.playAudio(channel, buf);
  await this.answer(
    message,
    suc
      ? `Playing audio on channel ${channel}.`
      : `Failed to play audio on channel ${channel}.`,
  );
}
