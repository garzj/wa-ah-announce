import { Socket } from 'net';
import { prefixedErr, prefixedLog } from './config/logger';

export class AHConn {
  static readonly reconnectTimeoutStart = 1000;
  static readonly reconnectTimeoutMult = 1.7;
  static readonly reconnectTimeoutMax = 3600000;

  reconnectTimeout = AHConn.reconnectTimeoutStart;

  client = new Socket();
  destroyed = false;

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
      user: number;
      password: string;
    },
    private prefix = 'A&H',
  ) {
    this.client.on('connect', () => {
      this.reconnectTimeout = AHConn.reconnectTimeoutStart;
      this.log('Connected. Logging in.');
      this.client.write(Buffer.from([this.config.user]));
      this.client.write(Buffer.from(this.config.password));
    });

    this.client.on('error', (err) => {
      if (err.message.includes('ECONNREFUSED')) {
        return this.errLog(err.message);
      }
      this.errLog(err);
    });

    this.client.on('close', () => {
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
      if (data.toString() === 'AuthOK') {
        this.log('Authentication successful.');

        // todo: remove this test
        // Recalls preset 00
        this.client.write(Buffer.from([0xb0, 0x00, 0x00, 0xc0, 0x00]));
      }
    });

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
  }
}
