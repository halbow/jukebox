// New-message notifications, Slack style: a dot on the favicon and a short ding, while you're not looking.
//
// The ding is synthesized with Web Audio, so there's no sound file to host. Browsers only let an
// AudioContext play after a user gesture, so it's unlocked on the first click or key press.

const SOUND_KEY = 'jukebox:sound' // 'off' when the ding is muted

const ICON = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📻</text></svg>`

let unread = false
let audio = null

export function soundOn() {
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setSound(on) {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
}

/** Whether you'd miss a message: the tab is hidden or another window has the focus. */
export function isAway() {
  return document.hidden || !document.hasFocus()
}

/** A message from someone else arrived while you're away. */
export function notify() {
  setUnread(true)
  if (soundOn()) ding()
}

function setUnread(on) {
  if (unread === on) return
  unread = on
  const svg = on ? ICON.replace('</svg>', `${badge()}</svg>`) : ICON
  document.querySelector('link[rel=icon]').href = `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// The theme's second accent, ringed with its background.
function badge() {
  const style = getComputedStyle(document.documentElement)
  const color = (name) => style.getPropertyValue(name).trim()
  return `<circle cx='80' cy='20' r='17' fill='${color('--accent-2')}' stroke='${color('--bg')}' stroke-width='6'/>`
}

function ding() {
  if (!audio || audio.state !== 'running') return // not unlocked yet: a silent miss beats an error
  const now = audio.currentTime
  for (const [freq, delay] of [[880, 0], [1320, 0.09]]) {
    const osc = new OscillatorNode(audio, { type: 'sine', frequency: freq })
    const gain = new GainNode(audio, { gain: 0 })
    gain.gain.setValueAtTime(0, now + delay)
    gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(now + delay)
    osc.stop(now + delay + 0.4)
  }
}

function unlockAudio() {
  audio ??= new AudioContext()
  if (audio.state === 'suspended') audio.resume()
}

// Back on the page: the dot goes. Clicks and keys count too, the YouTube iframe can hold the focus.
function seen() {
  unlockAudio()
  if (!isAway()) setUnread(false)
}

addEventListener('focus', () => setUnread(false))
addEventListener('pointerdown', seen, true)
addEventListener('keydown', seen, true)
document.addEventListener('visibilitychange', () => !isAway() && setUnread(false))
