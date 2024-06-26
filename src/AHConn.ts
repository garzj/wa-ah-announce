import { Socket } from 'net';
import { prefixedErr, prefixedLog } from './config/logger';
import { TypedEmitter } from 'tiny-typed-emitter';
import { env } from './config/env';

interface Events {
  authed: () => void;
}

export class AHConn extends TypedEmitter<Events> {
  static readonly reconnectTimeoutStart = 1000;
  static readonly reconnectTimeoutMult = 1.7;
  static readonly reconnectTimeoutMax = 3600000;

  reconnectTimeout = AHConn.reconnectTimeoutStart;

  client = new Socket();
  authed = false;
  destroyed = false;

  writePreset?: () => void;
  recallPreset(preset: number) {
    if (env.AH_MOCK === 'true') {
      return this.log(`Preset ${preset} has been recalled.`);
    }

    if (this.writePreset) {
      this.off('authed', this.writePreset);
    }

    this.writePreset = () => {
      const zPreset = preset - 1;
      const bank = Math.floor(zPreset / 128);
      const ss = zPreset % 128;
      this.client.write(Buffer.from([0xf0, 0xb0, 0x00, bank, 0xc0, ss]));
    };
    if (this.authed) this.writePreset();
    this.on('authed', this.writePreset);
  }

  log(...data: any[]) {
    prefixedLog(this.prefix, ...data);
  }

  errLog(...data: any[]) {
    prefixedErr(this.prefix, ...data);
  }

  constructor(
    private config: {
      host: string;
      port: number;
      user?: number;
      password?: string;
    },
    private prefix = 'A&H',
  ) {
    super();

    this.client.on('connect', () => {
      this.reconnectTimeout = AHConn.reconnectTimeoutStart;
      if (!this.config.user) {
        this.authed = true;
        this.emit('authed');
        return this.log('Connected without authentication.');
      }
      this.log('Connected. Logging in.');
      this.client.write(Buffer.from([0xf0, this.config.user]));
      this.client.write(Buffer.from(this.config.password || ''));
    });

    this.client.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        return this.errLog(err.message);
      }
      this.errLog(err);
    });

    this.client.on('close', () => {
      this.authed = false;

      const sTimeout = Math.round(this.reconnectTimeout / 1000);
      this.log(`Connection closed. Trying to reconnect in ${sTimeout}s.`);
      setTimeout(() => this.reconnect(), sTimeout * 1000);
      this.reconnectTimeout *= AHConn.reconnectTimeoutMult;
      this.reconnectTimeout = Math.min(
        this.reconnectTimeout,
        AHConn.reconnectTimeoutMax,
      );
    });

    this.client.on('data', (data) => {
      // todo: partial data?

      if (data.toString().slice(1) === 'AuthOK') {
        this.log('Authentication successful.');

        this.authed = true;
        this.emit('authed');
      }
    });

    if (env.AH_MOCK === 'true') {
      this.log(
        "Won't connect to the Dante receiver, because AH_MOCK has been set.",
      );
      return;
    }
    this.reconnect();
  }

  reconnect() {
    if (this.destroyed) return;

    this.client.connect({
      host: this.config.host,
      port: this.config.port,
    });
  }

  destroy() {
    this.destroyed = true;
    this.client.removeAllListeners();
    this.client.destroy();
    this.removeAllListeners();
  }
}
