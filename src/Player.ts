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

    console.log('spawn timeout set');
    this.playing = setTimeout(() => {
      // todo: sanitize
      console.log('child process spawned');
      this.playing = spawn('sh', [
        '-c',
        `/usr/bin/cvlc ${resolve(file)} ${process.env.CVLC_ARGS}`,
      ]);
      this.playing.on('exit', () => {
        console.log('child process exited by itself');
        this.playing = null;
      });
    }, startDelay);

    return true;
  }

  async stopPlaying() {
    if (this.playing === null) return;

    if (!(this.playing instanceof ChildProcess)) {
      console.log('spawn timeout cleared');
      clearTimeout(this.playing);
    } else {
      this.playing.removeAllListeners();
      console.log('child process killed');
      this.playing.on('exit', () =>
        console.log('child process exited after kill signal'),
      );
      this.playing.kill();
    }

    this.playing = null;
  }
}
