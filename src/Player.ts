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
      const cvlcCommand = `${process.env.CVLC_COMMAND} ${resolve(file)} ${
        process.env.CVLC_ARGS
      }`;
      // todo: don't split quotes
      const args = (
        cvlcCommand.match(/[^\s"']+|"([^"]*)"|'([^']*)'/gim) ?? []
      ).map((x) => x.replace(/^(?:"|')(.*)(?:"|')$/, '$1'));
      const cmd = args.shift()!;
      this.playing = spawn(cmd, args);
      this.playing.on('exit', () => {
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
      console.log('Child process was killed due to timeout.');
      this.playing.on('exit', () =>
        console.log('Child process exited after kill signal.'),
      );
      this.playing.kill();
    }

    this.playing = null;
  }
}
