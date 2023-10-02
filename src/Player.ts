import { AHConn } from './AHConn';

export class Player {
  constructor(public ahConn: AHConn) {}

  async playAudio(channel: number, buffer: Buffer): Promise<boolean> {
    console.log(channel, buffer.length);
    const success = false;
    return success;
  }
}
