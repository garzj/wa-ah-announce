import { Socket } from 'net';
import './config/env';
console.log(`Starting app in ${process.env.NODE_ENV} mode.`);

const reconnectTimeoutStart = 1000;
const reconnectTimeoutMult = 1.5;
let reconnectTimeout = 0;

const client = new Socket();

function reconnect(callback?: () => void) {
  client.connect(
    {
      host: process.env.AH_HOST,
      port: parseInt(process.env.AH_PORT),
    },
    callback,
  );
}
client.on('close', () => {
  console.log(
    `Connection closed. Trying to reconnect in ${reconnectTimeout / 1000}s.`,
  );
  setTimeout(reconnect, reconnectTimeout);
  reconnectTimeout *= reconnectTimeoutMult;
});

reconnect(() => {
  reconnectTimeout = reconnectTimeoutStart;

  console.log('Connected. Logging in.');
  client.write(Buffer.from([parseInt(process.env.AH_USER)]));
  client.write(Buffer.from(process.env.AH_PASSWORD));
});

client.on('data', (data) => {
  // todo: partial data
  if (data.toString() === 'AuthOK') {
    console.log('Authentication successful.');

    test();
  }
});

function test() {
  // Recalls preset 00
  client.write(Buffer.from([0xb0, 0x00, 0x00, 0xc0, 0x00]));
}

// const buffer = Buffer.from('')
// client.on('data', data => {
//   buffer = Buffer.from()
// });
