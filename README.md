# wa-ah-announce

This application forwards audio announcements received per WhatsApp to an Allen & Heath AHM device letting the user pick a room to play them.

It uses VLC to transmit a RTP stream, while using the AHM TCP protocol on port 51325 to load presets.

## Setup

- install [VLC](https://www.videolan.org/vlc/index.de.html), [Node](https://nodejs.org/en/download) and [Git](https://git-scm.com/downloads)
- ```
  git clone
  cd wa-ah-announce
  yarn
  yarn build
  ```

### Configuration

The app is configured via environment variables listed in [this file](./src/config/env.ts). Here is an example `.env` file:

```
# application
AH_HOST=69.42.0.1
AH_PORT=51325
AH_USER=31
AH_PASSWORD=supersecurepassword
DATA_DIR=./data
MAX_AUDIO_FILES=100
AUDIO_START_DELAY=3000

# whatsapp
WA_SKIP_HISTORY=false
WA_ADMIN=1234567890

# should not contain any special characters (optional)
BROWSER_NAME="Announcements Bot"
```

#### Stream using RTP (Windows)

```
CVLC_COMMAND='"C:\Program Files\VideoLAN\VLC\vlc.exe" -I dummy --dummy-quiet'
# the audio file will be specified between these parts
CVLC_ARGS="--sout '#transcode{vcodec=mp2v,vb=800,acodec=mpga,ab=128,channels=2,samplerate=48000,scodec=none}:rtp{dst=192.168.2.8,port=5004,mux=ts,sap,name=Announcement}' --no-sout-all --sout-keep"
```

#### Play audio on speaker (Windows)

First, get the id of the Speaker (using `powershell`):

```powershell
$AudioDeviceName="15-16"
Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Enum\SWD\MMDEVAPI\*" | Where-Object {($_.FriendlyName -Match $AudioDeviceName) -and ($_.PSChildName -Match "0\.0\.0")} | Select-Object -Property FriendlyName,PSChildName
```

Copy the PSChildName from the output and use like this here:

```
CVLC_COMMAND='"C:\Program Files\VideoLAN\VLC\vlc.exe" -I dummy --dummy-quiet --no-one-instance --mmdevice-audio-device {0.0.0.00000000}.{some-guid} --play-and-exit'
```

## Run the app

```
yarn start
```

Or use a tool like pm2 to run it in background mode.

## Usage

Login to a whatsapp account via the QR code and send it `!help` for a list of commands.
