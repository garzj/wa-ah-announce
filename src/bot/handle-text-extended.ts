import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { exists } from '../config/paths';

export async function handleExtendedTextMsg(
  this: WABot,
  extended: proto.Message.IExtendedTextMessage,
  message: proto.IWebMessageInfo,
) {
  const quotedId = extended.contextInfo?.stanzaId;
  if (!quotedId) {
    if (extended.text) this.handleTextMsg(extended.text, message);
    return;
  }

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

  await this.sendRoomPoll(message.key.remoteJid!, audioFile);
}
