import { AHConn } from './AHConn';
import { ChildProcess, spawn } from 'child_process';
import { exists } from './config/paths';
import { resolve } from 'path';

export class Player {
  playing: NodeJS.Timeout | ChildProcess | null = null;

  constructor(public ahConn: AHConn) {}

  isPlaying() {
    return this.playing !== null;
  }

  async playAudio(
    preset: number,
    file: string,
    startDelay = parseInt(process.env.AUDIO_START_DELAY),
  ): Promise<boolean> {
    if (!(await exists(file))) return false;
    if (preset < 1 || preset > 500) return false;

    this.ahConn.recallPreset(preset);

    this.stopPlaying();

    this.playing = setTimeout(() => {
      // todo: sanitize
      this.playing = spawn('sh', [
        '-c',
        `/usr/bin/cvlc ${resolve(file)} ${process.env.CVLC_ARGS}`,
      ]);
      this.playing.on('exit', () => {
        this.playing = null;
      });
    }, startDelay);

    return true;
  }

  async stopPlaying() {
    if (this.playing === null) return;

    if (!(this.playing instanceof ChildProcess)) {
      clearTimeout(this.playing);
    } else {
      this.playing.removeAllListeners();
      this.playing.kill();
    }

    this.playing = null;
  }
}
