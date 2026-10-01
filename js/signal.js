// WebRTC connection setup with copy/paste signaling (non-trickle ICE, no server).

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }]
const ICE_GATHERING_TIMEOUT_MS = 5000

export function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

/** JSON → deflate → base64url */
export async function encode(obj) {
  const json = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate'))
  const bytes = new Uint8Array(await new Response(json).arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url → inflate → JSON. Tolerates whitespace from copy/paste. */
export async function decode(code) {
  const base64 = code.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const json = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))
  return JSON.parse(await new Response(json).text())
}

/** Resolves once every ICE candidate is in the local description (or after a timeout). */
function iceGatheringComplete(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', check)
      resolve()
    }
    const check = () => pc.iceGatheringState === 'complete' && done()
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS)
    pc.addEventListener('icegatheringstatechange', check)
  })
}

/** Host side: one peer connection + data channel per guest, and the offer code to share with them. */
export async function createInvite() {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  const channel = pc.createDataChannel('sync')
  await pc.setLocalDescription(await pc.createOffer())
  await iceGatheringComplete(pc)
  const id = randomId()
  const code = await encode({ id, sdp: pc.localDescription.sdp })
  return { id, pc, channel, code }
}

/** Guest side: answers a decoded offer. The data channel arrives later via the `datachannel` event. */
export async function answerInvite(offer, peerId) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp })
  await pc.setLocalDescription(await pc.createAnswer())
  await iceGatheringComplete(pc)
  const code = await encode({ id: offer.id, peerId, sdp: pc.localDescription.sdp })
  return { pc, code }
}
