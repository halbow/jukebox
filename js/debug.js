// The debug log, switched on in the settings: every message to and from the peers, who comes and goes, and
// what the player sync sees and decides, in the browser console. Off, it costs nothing.

let on = false

export function debugOn() {
  return on
}

export function setDebug(value) {
  on = value
}

/** `debug('topic', ...details)`, timestamped to the millisecond: sync issues are about timing. */
export function debug(topic, ...details) {
  if (!on) return
  const time = new Date().toISOString().slice(11, 23)
  console.log(`[jukebox ${time}] ${topic}`, ...details)
}
