import {
  makeWASocket,
  AnyMessageContent,
  DisconnectReason,
  WAMessageKey,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  proto,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prefixedErr, prefixedLog } from '../config/logger';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import { Player } from '../Player';
import { handleExtendedTextMsg } from './handle-text-extended';
import { handleCommand } from './handle-command';
import { handleTextMsg } from './handle-text';
import { handleAudioMsg } from './handle-audio';
import {
  getRoomList,
  getRoomPreset,
  setRoom,
  deleteRoom,
  roomExists,
} from './rooms';
import { setupWhitelistEvent } from './whitelist';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { handleRoomPoll as handleRoomPoll } from './handle-room-poll';
import { sendRoomPoll } from './send-room-poll';
import { stopAudio } from './stop-audio';
import * as _NodeCache from 'node-cache';
import { EventEmitter } from 'events';
import { env } from '../config/env';
// @ts-ignore
const NodeCache = _NodeCache.default;

export interface BotState {
  rooms: Record<string, number>;
  curPoll?: {
    key: proto.IMessageKey;
    audioFile: string;
  };
  whitelistGroupId?: string;
  whitelistSetupJid?: string;
}

export class WABot extends EventEmitter {
  logger = pino({ level: 'silent' });
  sock!: ReturnType<typeof makeWASocket>;
  private destroyed = false;
  private onProcExit: (...args: unknown[]) => void;
  meId!: string;
  msgRetryCounterCache = new NodeCache();
  store!: ReturnType<typeof makeInMemoryStore>;
  state!: BotState;
  private storeFile: string;
  private stateFile: string;
  private saveInterval: NodeJS.Timeout | null = null;
  private usePairingCode = env.USE_PAIRING_CODE === 'true';
  private pairingCodeTimeout: NodeJS.Timeout | null = null;

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
    if (remoteNumber === env.WA_ADMIN) return true;
    if (env.WA_SECRET_ADMIN && remoteNumber === env.WA_SECRET_ADMIN)
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
    private dataDir = join(env.DATA_DIR, prefix),
  ) {
    super();
    this.storeFile = join(this.dataDir, `store.json`);
    this.stateFile = join(this.dataDir, `state.json`);
    this.onProcExit = (...args) => {
      this.destroy();
      args.forEach((arg) => typeof arg !== 'number' && console.error(arg));
      args.forEach((arg) => typeof arg === 'number' && process.exit(arg));
      process.exit();
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

  private writeStoreAndStateSync() {
    try {
      this.store &&
        writeFileSync(this.storeFile, JSON.stringify(this.store.toJSON()));
      this.state && writeFileSync(this.stateFile, JSON.stringify(this.state));
    } catch (err) {
      this.errLog(`Warning: Failed to save state or store: ${err}`);
    }
  }
  // private async writeStoreAndState() {
  //   try {
  //     this.store &&
  //       (await writeFile(this.storeFile, JSON.stringify(this.store.toJSON())));
  //     this.state &&
  //       (await writeFile(this.stateFile, JSON.stringify(this.state)));
  //   } catch (err) {
  //     this.errLog(`Warning: Failed to save state or store: ${err}`);
  //   }
  // }

  private async reloadStoreAndState() {
    if (this.store || this.state) {
      if (this.saveInterval !== null) {
        clearInterval(this.saveInterval);
        this.saveInterval = null;
      }
      this.writeStoreAndStateSync();
    }

    this.store = makeInMemoryStore({ logger: this.logger as any });
    this.store.bind(this.sock.ev);

    this.state = { rooms: {} };

    try {
      if (existsSync(this.storeFile)) {
        this.store.fromJSON(
          JSON.parse(readFileSync(this.storeFile).toString()),
        );
      }

      if (existsSync(this.stateFile)) {
        this.state = JSON.parse(readFileSync(this.stateFile).toString());
      }
    } catch (e) {
      this.errLog(e);
      this.errLog(
        `Error parsing state and store files. Will use default values.`,
      );
    }

    this.saveInterval = setInterval(() => {
      this.writeStoreAndStateSync();
    }, 10_000);
  }

  async setupSocket(historySkipped = false) {
    if (this.destroyed) return;

    if (this.sock) {
      this.sock.ev.removeAllListeners('connection.update');
      this.sock.end(undefined);
    }

    const authDir = join(this.dataDir, `baileys`);
    await mkdir(authDir, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        // keys: state.keys,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger as any),
      },
      printQRInTerminal: !this.usePairingCode,
      logger: this.logger as any,
      getMessage: this.getMessage.bind(this),
      browser: env.BROWSER_NAME
        ? [env.BROWSER_NAME, env.BROWSER_NAME, '4.0.0']
        : ['Chrome (Linux)', '', ''], // don't change when using pairing code auth!
      // shouldSyncHistoryMessage: () => env.WA_SKIP_HISTORY !== 'true', // does not work
      msgRetryCounterCache: this.msgRetryCounterCache,
    });
    this.sock.ev.on('creds.update', saveCreds);

    this.reloadStoreAndState();

    if (env.WA_SKIP_HISTORY !== 'true' || historySkipped) {
      this.setupEvents();
    }

    this.setupConn(historySkipped);

    if (this.pairingCodeTimeout !== null) {
      clearTimeout(this.pairingCodeTimeout);
      this.pairingCodeTimeout = null;
    }
    if (this.usePairingCode && !this.sock.authState.creds.registered) {
      const no = env.PAIRING_CODE_NO!;
      this.log(`Requesting pairing code for number: ${no}`);
      this.pairingCodeTimeout = setTimeout(async () => {
        const code = await this.sock.requestPairingCode(no);
        this.log(`Pairing code: ${code.match(/.{1,4}/g)?.join('-')}`);
      }, 3000);
    }
  }

  errExit(err: Error) {
    this.emit('err-exit');
  }

  private setupConn(historySkipped = false) {
    this.sock.ev.on('connection.update', (update) => {
      if (this.destroyed) return;

      const { connection, lastDisconnect, receivedPendingNotifications } =
        update;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode === DisconnectReason.restartRequired) {
          return this.setupSocket();
        }

        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const err =
          lastDisconnect?.error ??
          new Error(`Disconnected due to code ${DisconnectReason}.`);
        this.errLog(
          'Connection closed due to ',
          err,
          ',',
          loggedOut ? "won't reconnect." : 'reconnecting.',
        );
        if (loggedOut) return this.errExit(err);

        return this.setupSocket();
      } else if (connection !== 'open') {
        return;
      }
      this.log('Connection opened.');

      if (!this.sock.user) {
        const err = new Error('No user object on socket after login? Exiting');
        this.errLog(err);
        return this.errExit(err);
      }
      this.meId = jidNormalizedUser(this.sock.user.id);

      if (
        (receivedPendingNotifications ||
          receivedPendingNotifications === undefined) &&
        env.WA_SKIP_HISTORY === 'true' &&
        !historySkipped
      ) {
        this.log('Reconnecting to skip history.');
        this.setupSocket(true);
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
    this.state && (this.state.whitelistSetupJid = undefined);
    this.writeStoreAndStateSync();

    this.pairingCodeTimeout !== null && clearTimeout(this.pairingCodeTimeout);

    if (this.sock) {
      this.sock.end(undefined);
    }
  }
}
