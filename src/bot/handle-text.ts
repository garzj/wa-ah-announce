import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';

export async function handleTextMsg(
  this: WABot,
  text: string,
  message: proto.IWebMessageInfo,
) {
  if (text.startsWith('!')) {
    const args = text.slice(1).split(/\s+/);
    const cmd = args.shift()!;
    return await this.handleCommand(cmd, args, message);
  }

  return await this.answer(
    message,
    'Please reply to an audio message or use !help.',
  );
}
