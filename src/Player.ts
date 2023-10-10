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
      this.stopPlaying();
    }

    this.playing = spawn('ffplay', ['-nodisp', '-autoexit', file]);
    this.playing.on('exit', () => {
      this.playing = null;
    });

    return true;
  }

  async stopPlaying() {
    if (!this.playing) return;
    this.playing.removeAllListeners();
    this.playing.kill();
    this.playing = null;
  }
}
