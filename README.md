# wa-ah-announce

This application forwards audio announcements received per WhatsApp to an Allen & Heath AHM device.

It uses the [aes67-linux-daemon](https://github.com/bondagit/aes67-linux-daemon) to transmit an RTP stream, while using the AHM TCP protocol on port 51325 to configure presets.

## Setup

- install [ffmpeg](https://ffmpeg.org/)
- ```
  git clone
  cd wa-ah-announce
  yarn
  yarn build
  ```
- setup the [aes67-linux-daemon](https://github.com/bondagit/aes67-linux-daemon)
  - configure a new source in the web UI

### Configuration

The app is configured via environment variables. Here is an example `.env` file:

```
# application
AH_HOST=69.42.0.1
AH_PORT=51325
AH_USER=31
AH_PASSWORD=supersecurepassword
DATA_DIR=./data
MAX_AUDIO_FILES=100
AUDIO_START_DELAY=3000

# ffplay
SDL_AUDIODRIVER=alsa
AUDIODEV=plughw:RAVENNA # aes67-daemon loopback device
```

## Run the app

```
yarn start
```
