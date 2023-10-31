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
import { writeFile } from 'fs/promises';
import {
  getRoomList,
  getRoomPreset,
  setRoom,
  deleteRoom,
  roomExists,
} from './rooms';
import { setupWhitelistEvent } from './whitelist';
import { writeFileSync } from 'fs';
import { handleRoomPoll as handleRoomPoll } from './handle-room-poll';
import { sendRoomPoll } from './send-room-poll';
import { stopAudio } from './stop-audio';

export interface BotState {
  rooms: Record<string, number>;
  curPoll?: {
    key: proto.IMessageKey;
    audioFile: string;
  };
  whitelistGroupId?: string;
  whitelistSetupJid?: string;
}

export class WABot {
  logger = pino({ level: 'silent' });
  sock!: ReturnType<typeof makeWASocket>;
  private destroyed = false;
  private onProcExit: NodeJS.ExitListener;
  meId!: string;
  store!: ReturnType<typeof makeInMemoryStore>;
  state!: BotState;
  private storeFile = join(this.dataDir, `store.json`);
  private stateFile = join(this.dataDir, `state.json`);
  private saveInterval: NodeJS.Timeout | null = null;

  savingMsgs = new Map<string, Promise<void>>();

  static readonly STOP_ROOM_NAME = 'Stop';
  whitelistSetupTimeout: NodeJS.Timeout | null = null;

  getAudioDir() {
    return join(this.dataDir, 'audios');
  }
  getAudioPath(id: string) {
    return join(this.getAudioDir(), `${id}`);
  }

  setupWhitelistEvents = setupWhitelistEvent;

  stopAudio = stopAudio;

  roomExists = roomExists;
  getRoomList = getRoomList;
  getRoomPreset = getRoomPreset;
  setRoom = setRoom;
  deleteRoom = deleteRoom;

  handleAudioMsg = handleAudioMsg;
  handleExtendedTextMsg = handleExtendedTextMsg;
  handleTextMsg = handleTextMsg;
  handleCommand = handleCommand;
  handleRoomPool = handleRoomPoll;
  sendRoomPoll = sendRoomPoll;

  async getMessage(key: WAMessageKey) {
    const msg = await this.store.loadMessage(key.remoteJid!, key.id!);
    return msg?.message || undefined;
  }

  async answer(
    remote: proto.IWebMessageInfo | string | null | undefined,
    _content: AnyMessageContent | string,
  ) {
    const content =
      typeof _content === 'string' ? { text: _content } : _content;
    const remoteJid =
      typeof remote === 'object' ? remote?.key.remoteJid : remote;
    if (!remoteJid) {
      typeof remote === 'object' && this.errLog(remote);
      this.errLog(
        `Could not resond to a message. The remoteJid field is empty.`,
      );
      return;
    }
    return await this.sock.sendMessage(remoteJid, content);
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

    this.sock.ev.on('messages.update', async (ev) => {
      for (const { key, update } of ev) {
        if (!this.isWhitelisted(key.remoteJid)) continue;

        if (update.pollUpdates) {
          this.handleRoomPool(key, update);
        }
      }
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
    await mkdir(bot.dataDir, { recursive: true });
    await mkdir(bot.getAudioDir(), { recursive: true });
    await bot.setupSocket();
    return bot;
  }
  private constructor(
    public prefix: string,
    public player: Player,
    private dataDir = join(process.env.DATA_DIR, prefix),
  ) {
    this.onProcExit = (no) => {
      this.destroy();
      process.exit(no);
    };
    process.on('exit', this.onProcExit);
    process.on('SIGINT', this.onProcExit);
    process.on('uncaughtException', this.onProcExit);
  }

  log(...data: any[]) {
    prefixedLog(this.prefix, ...data);
  }

  errLog(...data: any[]) {
    prefixedErr(this.prefix, ...data);
  }

  private async writeStoreAndState(sync = false) {
    const write = sync ? writeFileSync : writeFile;
    try {
      this.store &&
        (await write(this.storeFile, JSON.stringify(this.store.toJSON())));
      this.state && (await write(this.stateFile, JSON.stringify(this.state)));
    } catch (err) {
      this.errLog(`Warning: Failed to save state or store: ${err}`);
    }
  }

  private async reloadStoreAndState() {
    if (this.store || this.state) {
      if (this.saveInterval !== null) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
      this.writeStoreAndState();
    }

    this.store = makeInMemoryStore({ logger: this.logger });
    if (await exists(this.storeFile)) {
      this.store.fromJSON(
        JSON.parse((await readFile(this.storeFile)).toString()),
      );
    }
    this.store.bind(this.sock.ev);

    if (await exists(this.stateFile)) {
      this.state = JSON.parse((await readFile(this.stateFile)).toString());
    } else {
      this.state = { rooms: {} };
    }

    this.saveInterval = setInterval(() => {
      this.writeStoreAndState();
    }, 10_000);
  }

  async setupSocket() {
    if (this.destroyed) return;

    if (this.sock) {
      this.sock.ev.removeAllListeners('connection.update');
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

    this.setupConn();
  }

  private setupConn() {
    this.sock.ev.on('connection.update', (update) => {
      if (this.destroyed) return;

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
      }
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;

    process.off('exit', this.onProcExit);
    process.off('SIGINT', this.onProcExit);
    process.off('uncaughtException', this.onProcExit);

    this.whitelistSetupTimeout && clearTimeout(this.whitelistSetupTimeout);
    this.writeStoreAndState(true);

    if (this.sock) {
      this.sock.end(undefined);
    }
  }
}
