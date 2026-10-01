// Signaling through public Nostr relays (Trystero): peers sharing a passphrase find each
// other and open direct WebRTC connections. Only the handshake goes through the relays,
// encrypted with the passphrase; sync and chat travel peer to peer.

const APP_ID = 'jukebox-listen-together'

export function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Every peer connects to every other peer (mesh). Trystero loads on demand, so the home page doesn't wait for the CDN.
 * The import map in index.html pins it to CDN files checked by hash.
 */
export async function joinJukebox(passphrase, { onJoinError }) {
  const { joinRoom } = await import('trystero')
  return joinRoom({ appId: APP_ID, password: passphrase }, passphrase, { onJoinError })
}
