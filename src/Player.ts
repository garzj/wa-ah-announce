import { AHConn } from './AHConn';
import { ChildProcess, spawn } from 'child_process';
import { exists } from './config/paths';

export class Player {
  playing: NodeJS.Timeout | ChildProcess | null = null;

  constructor(public ahConn: AHConn) {}

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
      this.playing = spawn(
        `cvlc '${file.replace("'", '')}' ${process.env.CVLC_ARGS}`,
      );
      this.playing.on('exit', () => {
        this.playing = null;
      });
    }, startDelay);

    return true;
  }

  async stopPlaying() {
    if (this.playing === null) return;

    if (this.playing instanceof NodeJS.Timeout) {
      clearTimeout(this.playing);
    } else {
      this.playing.removeAllListeners();
      this.playing.kill();
    }

    this.playing = null;
  }
}
