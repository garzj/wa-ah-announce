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
        '\n!help:        \tShow this list' +
        '\n!stop:        \tStop playing any audio' +
        '\n!room:        \tMap room names to presets' +
        '\n!whitelist:   \tSetup or show whitelisted numbers' +
        '\n\nTo play some audio, send me an audio message or reply to one with a "."',
    );
  } else if (cmd === 'stop') {
    await this.stopAudio(message.key.remoteJid!);
  } else if (cmd === 'room') {
    if (args[0] === 'list') {
      const list = this.getRoomList(args[1]);
      return await this.answer(
        message,
        list === ''
          ? 'No rooms found.'
          : args[1] === undefined
          ? 'Rooms: \n' + list
          : 'Found room:\n' + list,
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
