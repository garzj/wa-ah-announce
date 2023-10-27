import { WABot } from './WABot';

export function setupWhitelistEvent(this: WABot) {
  this.sock.ev.on('groups.upsert', async (metas) => {
    for (const meta of metas) {
      if (this.state.whitelistSetupJid === undefined) return;
      if (this.state.whitelistGroupId !== undefined) return;
      if (meta.author !== this.state.whitelistSetupJid) return;
      this.whitelistSetupTimeout = null;

      this.state.whitelistGroupId = meta.id;
      await this.sock.sendMessage(this.state.whitelistSetupJid, {
        text: 'A whitelist group has been setup successfully. Run the command again to for more information.',
      });
    }
  });

  this.sock.ev.on('group-participants.update', async (ev) => {
    console.log(ev, this.meId, this.state);
    if (ev.action !== 'remove') return;
    if (!ev.participants.includes(this.meId)) return;
    if (ev.id !== this.state.whitelistGroupId) return;
    delete this.state.whitelistGroupId;
    const setupJid = this.state.whitelistSetupJid;
    delete this.state.whitelistSetupJid;
    if (setupJid) {
      await this.sock.sendMessage(setupJid, {
        text: 'Ey, someone removed me from the whitelist group. Run the whitelist command to set it up again.',
      });
    }
  });
}
