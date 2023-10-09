import makeWASocket, {
  AnyMessageContent,
  AuthenticationState,
  DisconnectReason,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prefixedErr, prefixedLog } from '../config/logger';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import { audioDir } from '../config/paths';
import { Player } from '../Player';
import { handleExtendedTextMsg } from './handle-text-extended';
import { handleCommand } from './handle-command';
import { handleTextMsg } from './handle-text';
import { handleAudioMsg } from './handle-audio';

export class WABot {
  logger = pino({ level: 'silent' });
  sock!: ReturnType<typeof makeWASocket>;

  savingMsgs = new Map<string, Promise<void>>();

  getAudioPath(id: string) {
    return join(audioDir, `${id}`);
  }

  handleAudioMsg = handleAudioMsg;
  handleExtendedTextMsg = handleExtendedTextMsg;
  handleTextMsg = handleTextMsg;
  handleCommand = handleCommand;

  async answer(
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
