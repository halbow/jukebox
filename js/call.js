// The call, without the DOM: what `hello` says about it, who gets your stream, and your video's quality.
//
// There's no call object to start or end: the call is whoever's `hello` has a `call`, and it's over when
// nobody's does. See call-ui.js for the screen.

/** Your video by the number of people in the call, you included: in a mesh each one gets their own copy. */
const QUALITY = [
  [2, { width: 640, height: 360, frameRate: 30 }],
  [4, { width: 480, height: 270, frameRate: 24 }],
  [6, { width: 320, height: 180, frameRate: 15 }],
  [Infinity, { width: 160, height: 90, frameRate: 10 }],
]

/** `hello.call`: null out of the call, `{ muted, camera }` in it. */
export function isCall(value) {
  return value === null || (typeof value?.muted === 'boolean' && typeof value.camera === 'boolean')
}

/** The camera constraints for `count` people in the call. */
export function videoQuality(count) {
  return QUALITY.find(([max]) => count <= max)[1]
}

/**
 * Who to start and stop sending your stream to: everyone in the call (`inCall`, Trystero peer ids) and no
 * one else. `sending` is who gets it now; out of the call, pass an empty `inCall`.
 */
export function streamChanges(inCall, sending) {
  return {
    add: [...inCall].filter((peerId) => !sending.has(peerId)),
    remove: [...sending].filter((peerId) => !inCall.has(peerId)),
  }
}

/** A call just started, from where you stand: nobody else was in one and now someone is. */
export function callStarted(before, after) {
  return before === 0 && after > 0
}
