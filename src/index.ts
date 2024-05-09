import './config/logger';
import './config/env';

console.log(`Starting app in ${env.NODE_ENV} mode.`);

import { AHConn } from './AHConn';
import { WABot } from './bot/WABot';
import { Player } from './Player';
import { env } from './config/env';

const ahConn = new AHConn({
  host: env.AH_HOST,
  port: parseInt(env.AH_PORT),
  user: parseInt(env.AH_USER),
  password: env.AH_PASSWORD,
});

const player = new Player(ahConn);

(async () => {
  const bot = await WABot.new('wa-bot', player);
  bot.on('err-exit', (err) => {
    throw err;
  });
})();
