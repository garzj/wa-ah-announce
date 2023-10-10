# wa-ah-announce

This application forwards audio announcements received per WhatsApp to an Allen & Heath device.

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
AH_USER=31
AH_PASSWORD=supersecurepassword
DATA_DIR=./data
```

## Run the app

```
yarn start
```
