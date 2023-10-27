import { getAggregateVotesInPollMessage, proto } from '@whiskeysockets/baileys';
import { WABot } from './WABot';

export async function handleRoomPoll(
  this: WABot,
  key: proto.IMessageKey,
  update: Partial<proto.IWebMessageInfo>,
) {
  const remoteJid = key.remoteJid!;

  const pollCreation = await this.getMessage(key);
  if (!pollCreation) {
    this.answer(
      remoteJid,
      "Sorry, I couldn't fetch the vote count, please try again.",
    );
  }
  const votes = getAggregateVotesInPollMessage({
    message: pollCreation,
    pollUpdates: update.pollUpdates,
  });

  const room = votes.find((vote) => vote.voters.includes(remoteJid))?.name;
  if (!room) return;

  if (room === WABot.STOP_ROOM_NAME) {
    return await this.stopAudio(remoteJid);
  }

  const preset = this.getRoomPreset(room);
  if (preset === undefined) {
    return this.answer(
      remoteJid,
      'This room got deleted from the list, please try again.',
    );
  }

  if (this.player.isPlaying()) {
    return this.answer(
      remoteJid,
      'An audio is already being played, please try again later.',
    );
  }

  const curPoll = this.state.curPoll;
  if (!curPoll || key.id !== curPoll.key.id) {
    return this.answer(
      remoteJid,
      'Someone else is trying to play a message or this poll is outdated, please try again.',
    );
  }

  const suc = await this.player.playAudio(preset, curPoll.audioFile);
  await this.answer(
    remoteJid,
    suc
      ? `Playing audio in ${room}.`
      : `Failed to play audio for preset ${preset} in room ${room}.`,
  );
}
