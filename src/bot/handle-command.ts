import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';
import { deleteAlias, getAliasList, setAlias } from '../config/aliases';

export async function handleCommand(
  this: WABot,
  cmd: string,
  args: string[],
  message: proto.IWebMessageInfo,
) {
  if (cmd === 'help') {
    await this.answer(
      message,
      'Possible commands are:' +
        '\n!help' +
        '\n!alias' +
        '\n\nTo make an announcement, reply to media in this chat with the number of the channel or an alias.',
    );
  } else if (cmd === 'alias') {
    if (args[0] === 'list') {
      const list = getAliasList(args[1]);
      return await this.answer(
        message,
        list === '' ? 'Found no aliases.' : 'Found aliases:\n' + list,
      );
    } else if (args[0] === 'set') {
      const alias = args[1];
      const channel = args[2];
      if (alias !== undefined && channel !== undefined) {
        const suc = setAlias(alias, channel);
        return await this.answer(
          message,
          suc ? 'Saved alias.' : 'This alias is invalid.',
        );
      }
    } else if (args[0] === 'remove' || args[0] === 'delete') {
      const alias = args[1];
      if (alias !== undefined) {
        const suc = deleteAlias(alias);
        return await this.answer(
          message,
          suc ? 'Removed alias.' : "The specified alias doesn't exist.",
        );
      }
    }

    await this.answer(
      message,
      'Usage: !alias <list|set|remove> [alias] [channel_no|*]',
    );
  } else {
    await this.answer(
      message,
      `The specified command doesn't exist. Try !help.`,
    );
  }
}
