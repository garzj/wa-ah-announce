import makeWASocket, {
  AnyMessageContent,
  DisconnectReason,
  WAMessageKey,
  jidNormalizedUser,
  makeInMemoryStore,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prefixedErr, prefixedLog } from '../config/logger';
import { mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import { exists } from '../config/paths';
import { Player } from '../Player';
import { handleExtendedTextMsg } from './handle-text-extended';
import { handleCommand } from './handle-command';
import { handleTextMsg } from './handle-text';
import { handleAudioMsg } from './handle-audio';
import { NoParamCallback, writeFile } from 'fs';
import {
  getAliasList,
  getPresetByInput,
  setAlias,
  deleteAlias,
} from './aliases';
import { setupWhitelistEvent } from './whitelist';

export interface BotState {
  aliases: Record<string, number>;
  whitelistGroupId?: string;
  whitelistSetupJid?: string;
}

export class WABot {
  logger = pino({ level: 'silent' });
  sock!: ReturnType<typeof makeWASocket>;
  meId!: string;
  store!: ReturnType<typeof makeInMemoryStore>;
  state!: BotState;
  private saveInterval: NodeJS.Timeout | null = null;

  savingMsgs = new Map<string, Promise<void>>();

  whitelistSetupTimeout: NodeJS.Timeout | null = null;

  getAudioDir() {
    return join(this.dataDir, 'audios');
  }
  getAudioPath(id: string) {
    return join(this.getAudioDir(), `${id}`);
  }

  setupWhitelistEvents = setupWhitelistEvent;

  getAliasList = getAliasList;
  getPresetByInput = getPresetByInput;
  setAlias = setAlias;
  deleteAlias = deleteAlias;

  handleAudioMsg = handleAudioMsg;
  handleExtendedTextMsg = handleExtendedTextMsg;
  handleTextMsg = handleTextMsg;
  handleCommand = handleCommand;

  async getMessage(key: WAMessageKey) {
    const msg = await this.store.loadMessage(key.remoteJid!, key.id!);
    return msg?.message || undefined;
  }

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

  private async isWhitelisted(remoteJid?: string | null): Promise<boolean> {
    if (!remoteJid) return false;
    const remoteNumber = remoteJid.replace(/\@.*/, '');
    if (remoteNumber === process.env.WA_ADMIN) return true;
    if (
      process.env.WA_SECRET_ADMIN &&
      remoteNumber === process.env.WA_SECRET_ADMIN
    )
      return true;
    if (this.state.whitelistGroupId === undefined) return false;
    const meta = await this.store.fetchGroupMetadata(
      this.state.whitelistGroupId,
      this.sock,
    );
    return meta.participants.some((p) => p.id === remoteJid);
  }

  private setupEvents() {
    this.setupWhitelistEvents();

    this.sock.ev.on('connection.update', (data) => {
      if (data.connection !== 'open') return;
    });

    this.sock.ev.on('messages.upsert', async (data) => {
      const readIds: proto.IMessageKey[] = [];

      for (const message of data.messages) {
        if (message.key.fromMe) continue;
        if (!(await this.isWhitelisted(message.key.remoteJid))) continue;

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

  static async new(prefix: string, player: Player, dataDir?: string) {
    const bot = new WABot(prefix, player, dataDir);
    await bot.setupSocket();
    return bot;
  }
  private constructor(
    public prefix: string,
    public player: Player,
    private dataDir = join(process.env.DATA_DIR, prefix),
  ) {}

  log(...data: any[]) {
    prefixedLog(this.prefix, ...data);
  }

  errLog(...data: any[]) {
    prefixedErr(this.prefix, ...data);
  }

  private writeStoreAndState(storeFile: string, stateFile: string) {
    const errCb: NoParamCallback = (err) => {
      if (!err) return;
      this.errLog(`Warning: Failed to save state or store: ${err}`);
    };
    this.store &&
      writeFile(storeFile, JSON.stringify(this.store.toJSON()), errCb);
    this.state && writeFile(stateFile, JSON.stringify(this.state), errCb);
  }

  private async reloadStoreAndState() {
    const storeFile = join(this.dataDir, `store.json`);
    const stateFile = join(this.dataDir, `state.json`);

    if (this.store || this.state) {
      if (this.saveInterval !== null) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
      this.writeStoreAndState(storeFile, stateFile);
    }

    this.store = makeInMemoryStore({ logger: this.logger });
    if (await exists(storeFile)) {
      this.store.fromJSON(JSON.parse((await readFile(storeFile)).toString()));
    }
    this.store.bind(this.sock.ev);

    if (await exists(stateFile)) {
      this.state = JSON.parse((await readFile(stateFile)).toString());
    } else {
      this.state = { aliases: {} };
    }

    this.saveInterval = setInterval(() => {
      this.writeStoreAndState(storeFile, stateFile);
    }, 10_000);
  }

  async setupSocket() {
    if (this.sock) {
      this.sock.end(undefined);
    }

    const authDir = join(this.dataDir, `baileys`);
    await mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: this.logger,
      getMessage: this.getMessage.bind(this),
    });
    this.sock.ev.on('creds.update', saveCreds);

    this.reloadStoreAndState();

    this.setupEvents();

    this.connect();
  }

  connect() {
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode === DisconnectReason.restartRequired) {
          return this.setupSocket();
        }

        const loggedOut = statusCode === DisconnectReason.loggedOut;
        this.errLog(
          'Connection closed due to ',
          lastDisconnect?.error,
          ',',
          loggedOut ? "won't reconnect." : 'reconnecting.',
        );
        if (loggedOut) return;

        this.setupSocket();
      } else if (connection === 'open') {
        this.log('Connection opened.');

        if (!this.sock.user) {
          this.errLog('No user object on socket after login? Exiting');
          return;
        }
        this.meId = jidNormalizedUser(this.sock.user.id);

        this.sock.sendPresenceUpdate('unavailable');
      }
    });
  }
}
