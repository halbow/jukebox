// Stands in for Trystero (see peers.test.js): one room, with a hand on who joins and what arrives,
// and a log of everything sent.

export const sent = [] // { type, msg, to }, `to` undefined for everyone
export const media = [] // { op, stream?, track?, to }: what the call does with its stream
export let room = null

class FakeRoom {
  peers = {}
  #actions = {}

  makeAction(type) {
    const action = { send: (msg, options) => sent.push({ type, msg, to: options?.target }), onMessage: null }
    this.#actions[type] = action
    return action
  }

  addStream(stream, options) {
    media.push({ op: 'addStream', stream, to: options?.target })
  }

  removeStream(stream, options) {
    media.push({ op: 'removeStream', stream, to: options?.target })
  }

  addTrack(track, stream, options) {
    media.push({ op: 'addTrack', track, stream, to: options?.target })
  }

  removeTrack(track, options) {
    media.push({ op: 'removeTrack', track, to: options?.target })
  }

  getPeers() {
    return this.peers
  }

  leave() {}

  /** A peer connects. */
  join(peerId) {
    this.peers[peerId] = {}
    this.onPeerJoin?.(peerId)
  }

  /** `peerId` starts sending us `stream`. */
  stream(stream, peerId) {
    this.onPeerStream?.(stream, peerId)
  }

  /** `peerId` adds `track` to the `stream` they send us. */
  track(track, stream, peerId) {
    this.onPeerTrack?.(track, stream, peerId)
  }

  /** `peerId` sends us `msg` on `type`. */
  receive(type, msg, peerId) {
    this.#actions[type].onMessage?.(msg, { peerId })
  }
}

export function joinRoom() {
  room = new FakeRoom()
  return room
}
