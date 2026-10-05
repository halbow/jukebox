// The call: the 📞 button next to "In the room", the call screen in the player's place, and "<name> is calling" in
// the chat. See call.js for how it works without a call object.
//
// You send your stream (the mic, plus the camera while it's on) to everyone in the call and get theirs back.
// Joining pauses the music for you, hanging up rejoins the room.

import { callStarted, streamChanges, videoQuality } from './call.js'
import { $, actionsRow, button, clearError, el, hint, showError } from './dom.js'
import { isAway, notify } from './notify.js'
import * as peers from './peers.js'
import { session } from './session.js'
import { setPausedLocally, sync } from './stage.js'

let call = null // { muted, camera } while you're in the call, as sent in `hello`
let stream = null // yours, while you're in the call
let pausedBeforeCall = false // you had paused the music yourself: hanging up leaves it paused
let people = new Map() // everyone else, see people.js: passed in by `updateCall`
let othersInCall = 0
let caller = null // the name in "<name> is calling", until you answer
let onChange = () => {}
const sending = new Set() // Trystero peer ids getting your stream
const streams = new Map() // Trystero peer id → their stream
const tiles = new Map() // Trystero peer id, or '' for you → their tile, kept so the videos don't restart

/** Yours for `hello`: null out of the call. */
export function myCall() {
  return call && { ...call }
}

/** `fn()` after you join, leave, mute or switch the camera. */
export function onCallChange(fn) {
  onChange = fn
}

/** Someone's `hello` changed or someone left: `everyone` is people.js's map. */
export function updateCall(everyone) {
  people = everyone
  const before = othersInCall
  othersInCall = inCall().size
  if (callStarted(before, othersInCall) && !call) {
    caller = [...people.values()].find((person) => person.call)?.name ?? 'Someone'
    if (isAway()) notify()
  }
  if (!othersInCall) caller = null
  for (const peerId of streams.keys()) if (!inCall().has(peerId)) streams.delete(peerId)
  if (call) {
    sendStream()
    cameraTrack()?.applyConstraints(videoQuality(othersInCall + 1))
  }
  render()
}

/** Trystero ids of the others in the call. */
function inCall() {
  return new Set([...people].filter(([, person]) => person.call).map(([peerId]) => peerId))
}

function cameraTrack() {
  return stream?.getVideoTracks()[0]
}

/** Starts sending your stream to those who just joined the call, stops for those who left. */
function sendStream() {
  const { add, remove } = streamChanges(call ? inCall() : new Set(), sending)
  for (const peerId of add) {
    peers.addStream(stream, peerId)
    sending.add(peerId)
  }
  for (const peerId of remove) {
    if (people.has(peerId)) peers.removeStream(stream, peerId) // gone from the room: nothing to stop
    sending.delete(peerId)
  }
}

peers.onPeerStream((theirs, peerId) => {
  if (!call) return // from before we hung up
  streams.set(peerId, theirs)
  render()
})

// Their camera came on: the tile's video plays the stream again, now with a picture.
peers.onPeerTrack((_, theirs, peerId) => {
  if (!call) return
  streams.set(peerId, theirs)
  const video = tiles.get(peerId)?.querySelector('video')
  if (video) play(video, theirs)
})

async function joinCall() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err) {
    return showError('room-error', `Couldn't use your microphone (${err.message}). Allow it in the browser to join the call.`, 'call')
  }
  clearError('room-error', 'call')
  call = { muted: false, camera: false }
  caller = null
  pausedBeforeCall = sync.pausedLocally
  if (!pausedBeforeCall) setPausedLocally(true)
  sendStream()
  render()
  onChange()
}

function hangUp() {
  call = null
  sendStream() // stops it for everyone
  stream.getTracks().forEach((track) => track.stop())
  stream = null
  streams.clear()
  clearError('call-error')
  if (!pausedBeforeCall) setPausedLocally(false)
  render()
  onChange()
}

function toggleMute() {
  call.muted = !call.muted
  stream.getAudioTracks().forEach((track) => (track.enabled = !call.muted))
  render()
  onChange()
}

/** Turning it off stops the camera (its light goes off), rather than sending black frames. */
async function toggleCamera() {
  clearError('call-error')
  if (call.camera) {
    const track = cameraTrack()
    for (const peerId of sending) peers.removeTrack(track, peerId)
    stream.removeTrack(track)
    track.stop()
  } else {
    let track
    try {
      ;[track] = (await navigator.mediaDevices.getUserMedia({ video: videoQuality(othersInCall + 1) })).getVideoTracks()
    } catch (err) {
      return showError('call-error', `Couldn't use your camera (${err.message}).`)
    }
    if (!call) return track.stop() // hung up while the browser was asking
    stream.addTrack(track)
    for (const peerId of sending) peers.addTrack(track, stream, peerId)
  }
  call.camera = !call.camera
  render()
  onChange()
}

$('call').addEventListener('click', () => (call ? hangUp() : joinCall()))
$('call-mute').addEventListener('click', toggleMute)
$('call-camera').addEventListener('click', toggleCamera)
$('call-hang-up').addEventListener('click', hangUp)
render() // the button's title, before anyone's here

// ---------- render ----------

function render() {
  const others = inCall().size
  $('call').textContent = call ? 'Hang up' : others ? '📞 Join' : '📞'
  $('call').title = call ? 'Hang up' : others ? `Join the call (${others} in it), the music pauses for you` : 'Start a call, the music pauses for you'
  $('call').ariaLabel = $('call').title
  $('call').classList.toggle('primary', Boolean(others) && !call)
  $('view-room').classList.toggle('in-call', Boolean(call))
  $('call-screen').hidden = !call
  renderAsk()
  if (!call) {
    tiles.forEach((tile) => tile.remove())
    tiles.clear()
    return
  }
  renderControl($('call-mute'), call.muted ? ICONS.micOff : ICONS.mic, call.muted ? 'Unmute' : 'Mute', call.muted)
  renderControl($('call-camera'), call.camera ? ICONS.camera : ICONS.cameraOff, call.camera ? 'Hide my video' : 'Show my video', !call.camera)
  renderTiles()
}

// Material icons' paths, as in Meet: the icon shows the current state, crossed out when it's off.
const ICONS = {
  mic: 'M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z',
  micOff:
    'M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z',
  camera: 'M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z',
  cameraOff:
    'M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2 2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z',
}

/** A round call button: its icon, and `label` (what clicking does) as title and label. `off` highlights it. */
function renderControl(button, icon, label, off) {
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icon}"/></svg>`
  button.title = button.ariaLabel = label
  button.classList.toggle('off', off)
}

function renderTiles() {
  const shown = new Map([['', { name: 'You', initial: session.name, call, stream }]])
  for (const peerId of inCall()) shown.set(peerId, { ...people.get(peerId), stream: streams.get(peerId) })
  for (const [key, tile] of tiles) {
    if (shown.has(key)) continue
    tile.remove()
    tiles.delete(key)
  }
  for (const [key, { name, initial = name, call: theirs, stream: media }] of shown) {
    if (!tiles.has(key)) tiles.set(key, newTile(key === ''))
    const tile = tiles.get(key)
    tile.classList.toggle('camera', theirs.camera)
    tile.classList.toggle('muted', theirs.muted)
    tile.querySelector('.tile-name').textContent = name
    tile.querySelector('.avatar').textContent = [...initial][0]?.toUpperCase() ?? '?'
    const video = tile.querySelector('video')
    if (media && video.srcObject !== media) play(video, media)
    $('call-tiles').append(tile) // in order: you first, then by `hello`
  }
  $('call-tiles').dataset.count = shown.size
}

/** Your own tile plays muted, or you'd hear yourself. */
function newTile(mine) {
  const video = el('video', { autoplay: true, playsInline: true, muted: mine })
  return el('li', { className: mine ? 'tile mine' : 'tile' }, video, el('span', { className: 'avatar' }), el('span', { className: 'tile-name' }))
}

function play(video, media) {
  video.srcObject = media
  // A click joined the call, so the browser should let it play with sound. If it doesn't, the next click does.
  video.play().catch(() => addEventListener('pointerdown', () => video.play().catch(() => {}), { once: true }))
}

function renderAsk() {
  $('call-asks').replaceChildren(
    ...(caller && !call
      ? [
          el(
            'div',
            { className: 'history-ask' },
            hint(`📞 ${caller} is calling. Joining pauses the music for you.`),
            actionsRow(button('Join', joinCall, 'btn small primary'), button('Not now', () => ((caller = null), render()))),
          ),
        ]
      : []),
  )
}
