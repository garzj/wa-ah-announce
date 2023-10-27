import { proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';

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
        '\n!stop' +
        '\n!alias' +
        '\n!whitelist' +
        '\n\nTo make an announcement, reply to media in this chat with the number of a preset or an alias.',
    );
  } else if (cmd === 'stop') {
    await this.player.stopPlaying();
    await this.answer(message, 'Stopped playing audio.');
  } else if (cmd === 'alias') {
    if (args[0] === 'list') {
      const list = this.getAliasList(args[1]);
      return await this.answer(
        message,
        list === '' ? 'Found no aliases.' : 'Found aliases:\n' + list,
      );
    } else if (args[0] === 'set') {
      const alias = args[1];
      const preset = args[2];
      if (alias !== undefined && preset !== undefined) {
        const suc = this.setAlias(alias, preset);
        return await this.answer(
          message,
          suc ? 'Saved alias.' : 'This alias is invalid.',
        );
      }
    } else if (args[0] === 'remove' || args[0] === 'delete') {
      const alias = args[1];
      if (alias !== undefined) {
        const suc = this.deleteAlias(alias);
        return await this.answer(
          message,
          suc ? 'Removed alias.' : "The specified alias doesn't exist.",
        );
      }
    }

    await this.answer(
      message,
      'Usage: !alias <list|set|remove> [alias] [1-500]',
    );
  } else if (cmd === 'whitelist') {
    if (this.state.whitelistGroupId !== undefined) {
      const meta = await this.store.fetchGroupMetadata(
        this.state.whitelistGroupId,
        this.sock,
      );
      await this.answer(message, {
        text:
          'Whitelist group:' +
          `\n${meta.subject}` +
          '\n' +
          '\nParticipants:' +
          `\n${meta.participants
            .map(
              (p) =>
                `@${p.id.replace(/\@.*/, '')}` +
                (typeof p.admin === 'string' ? ` (${p.admin})` : ''),
            )
            .join('\n')}`,
        mentions: meta.participants.map((p) => p.id),
      });
      return;
    }

    if (this.state.whitelistSetupJid === undefined) {
      this.state.whitelistSetupJid = message.key.remoteJid!;
      this.whitelistSetupTimeout = setTimeout(async () => {
        if (this.state.whitelistSetupJid === undefined) return;
        this.whitelistSetupTimeout = null;

        await this.sock.sendMessage(this.state.whitelistSetupJid, {
          text: 'The whitelist setup timed out.',
        });
      }, 5 * 60 * 1000);

      await this.answer(
        message,
        'Go ahead and add this bot to a group in the next 5 minutes to setup the whitelist.',
      );
      return;
    }

    await this.answer(message, 'There is already an ongoing whitelist setup.');
  } else {
    await this.answer(
      message,
      `The specified command doesn't exist. Try !help.`,
    );
  }
}
