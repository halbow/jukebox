// Stands in for Trystero (see peers.test.js): one room, with a hand on who joins and what arrives,
// and a log of everything sent.

export const sent = [] // { type, msg, to }, `to` undefined for everyone
export let room = null

class FakeRoom {
  peers = {}
  #actions = {}

  makeAction(type) {
    const action = { send: (msg, options) => sent.push({ type, msg, to: options?.target }), onMessage: null }
    this.#actions[type] = action
    return action
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

  /** `peerId` sends us `msg` on `type`. */
  receive(type, msg, peerId) {
    this.#actions[type].onMessage?.(msg, { peerId })
  }
}

export function joinRoom() {
  room = new FakeRoom()
  return room
}
