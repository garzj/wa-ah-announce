# wa-ah-announce

This application forwards audio announcements received per WhatsApp to an Allen & Heath AHM device.

It uses the [aes67-linux-daemon](https://github.com/bondagit/aes67-linux-daemon) to transmit an RTP stream, while using the AHM TCP protocol on port 51325 to configure presets.

## Setup

- install [vlc](https://www.videolan.org/vlc/index.de.html)
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

# vlc stream
CVLC_ARGS="--sout '#transcode{vcodec=mp2v,vb=800,acodec=mpga,ab=128,channels=2,samplerate=44100,scodec=none}:rtp{dst=192.168.2.8,port=5004,mux=ts,sap,name=Announcement}' --no-sout-all --sout-keep"
```

## Run the app

```
yarn start
```
