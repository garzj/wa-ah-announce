import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { exists } from '../config/paths';
import { getPresetByInput } from '../config/aliases';

export async function handleExtendedTextMsg(
  this: WABot,
  extended: proto.Message.IExtendedTextMessage,
  message: proto.IWebMessageInfo,
) {
  console.log('why extended');
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

  const preset =
    typeof extended.text === 'string'
      ? getPresetByInput(extended.text)
      : undefined;
  if (preset === undefined) {
    return await this.answer(
      message,
      "Invalid preset or alias specified. Won't play audio.",
    );
  }

  const suc = await this.player.playAudio(preset, audioFile);
  await this.answer(
    message,
    suc
      ? `Playing audio on ${extended.text}.`
      : `Failed to play audio with preset ${preset}.`,
  );
}
