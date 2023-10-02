import './config/logger';
import './config/env';

console.log(`Starting app in ${process.env.NODE_ENV} mode.`);

import { AHConn } from './AHConn';
import { WABot } from './WABot';
import { Player } from './Player';

const ahConn = new AHConn({
  host: process.env.AH_HOST,
  port: parseInt(process.env.AH_PORT),
  user: parseInt(process.env.AH_USER),
  password: process.env.AH_PASSWORD,
});

const player = new Player(ahConn);

WABot.new('wa-bot', player);
