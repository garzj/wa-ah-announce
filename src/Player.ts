import { AHConn } from './AHConn';
import { ChildProcess, spawn } from 'child_process';
import { exists } from './config/paths';

export class Player {
  playing: ChildProcess | null = null;

  constructor(public ahConn: AHConn) {}

  async playAudio(channel: number, file: string): Promise<boolean> {
    if (!(await exists(file))) return false;

    // todo: send preset through ahConn

    if (this.playing) {
      this.playing.kill();
    }

    this.playing = spawn('ffplay', ['-nodisp', '-autoexit', file]);

    return true;
  }
}
