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
        '\n!room' +
        '\n!whitelist' +
        '\n\nTo make an announcement, reply to media in this chat with the number of a preset or a room name.',
    );
  } else if (cmd === 'stop') {
    await this.player.stopPlaying();
    await this.answer(message, 'Stopped playing audio.');
  } else if (cmd === 'room') {
    if (args[0] === 'list') {
      const list = this.getRoomList(args[1]);
      return await this.answer(
        message,
        list === '' ? 'Found no rooms.' : 'Found rooms:\n' + list,
      );
    } else if (args[0] === 'set') {
      const room = args[1];
      const preset = args[2];
      if (room !== undefined && preset !== undefined) {
        const suc = this.setRoom(room, preset);
        return await this.answer(
          message,
          suc ? 'Saved room.' : 'This room is invalid.',
        );
      }
    } else if (args[0] === 'remove' || args[0] === 'delete') {
      const room = args[1];
      if (room !== undefined) {
        const suc = this.deleteRoom(room);
        return await this.answer(
          message,
          suc ? 'Removed room.' : "The specified room doesn't exist.",
        );
      }
    }

    await this.answer(message, 'Usage: !room <list|set|remove> [room] [1-500]');
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
