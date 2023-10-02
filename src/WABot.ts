import makeWASocket, {
  AnyMessageContent,
  AuthenticationState,
  DisconnectReason,
  downloadMediaMessage,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prefixedErr, prefixedLog } from './config/logger';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import {
  setAlias,
  getAliasList,
  deleteAlias,
  getChannelByInput,
} from './config/aliases';
import { audioDir, exists } from './config/paths';
import { Player } from './Player';

export class WABot {
  logger = pino({ level: 'silent' });
  sock!: ReturnType<typeof makeWASocket>;

  savingMsgs = new Map<string, Promise<void>>();

  private async answer(
    message: proto.IWebMessageInfo,
    _content: AnyMessageContent | string,
  ) {
    const content =
      typeof _content === 'string' ? { text: _content } : _content;
    if (!message.key.remoteJid) {
      this.errLog(message);
      this.errLog(
        `Could not resond to the message above. The remoteJid field is empty.`,
      );
      return;
    }
    return await this.sock.sendMessage(message.key.remoteJid, content);
  }

  private async handleCommand(
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

  private async handleTextMsg(text: string, message: proto.IWebMessageInfo) {
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

  async handleExtendedTextMsg(
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

  async handleAudioMsg(message: proto.IWebMessageInfo) {
    const id = message.key.id;
    if (!id) return;

    const saving = (async () => {})();
    this.savingMsgs.set(id, saving);
    await saving;
    this.savingMsgs.delete(id);

    const buf = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.sock.updateMediaMessage,
      },
    );
    await writeFile(this.getAudioPath(id), buf);
  }

  private getAudioPath(id: string) {
    return join(audioDir, `${id}`);
  }

  private setupEvents() {
    this.sock.ev.on('connection.update', (data) => {
      if (data.connection !== 'open') return;
    });

    this.sock.ev.on('messages.upsert', async (data) => {
      const readIds: proto.IMessageKey[] = [];

      for (const message of data.messages) {
        if (message.key.fromMe) continue;

        message.key && readIds.push(message.key);

        const msg = message.message;
        if (!msg) continue;

        if (msg.extendedTextMessage) {
          this.handleExtendedTextMsg(msg.extendedTextMessage, message);
          continue;
        }
        if (msg.conversation) {
          this.handleTextMsg(msg.conversation, message);
          continue;
        }
        if (msg.audioMessage) {
          this.handleAudioMsg(message);
          continue;
        }
      }

      await this.sock.readMessages(readIds);
    });
  }

  static async new(prefix: string, player: Player) {
    const authDir = join(process.env.DATA_DIR, 'baileys');
    await mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    return new WABot(prefix, state, saveCreds, player);
  }

  private constructor(
    public prefix: string,
    private state: AuthenticationState,
    private saveCreds: () => Promise<void>,
    public player: Player,
  ) {
    this.setupSocket();
  }

  log(...data: any[]) {
    prefixedLog(this.prefix, ...data);
  }

  errLog(...data: any[]) {
    prefixedErr(this.prefix, ...data);
  }

  private setupSocket() {
    this.sock = makeWASocket({
      auth: this.state,
      printQRInTerminal: true,
      logger: this.logger,
    });
    this.sock.ev.on('creds.update', this.saveCreds);

    this.setupEvents();

    this.connect();
  }

  connect() {
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        this.log(
          'Connection closed due to ',
          lastDisconnect?.error,
          ',',
          loggedOut ? "won't reconnect." : 'reconnecting.',
        );
        if (loggedOut) return;

        this.log(lastDisconnect?.error?.name);
        if (statusCode === DisconnectReason.restartRequired) {
          this.sock.end(undefined);
          this.setupSocket();
          return;
        }
        this.connect();
      } else if (connection === 'open') {
        this.log('Connection opened.');
      }
    });
  }
}
