// The stage, left of the chat: the player, the link form, Up next and Pause for me.
// The room's player state is `sync.state` (see sync.js), its queue `session.queue` (see queue.js).

import { $, button, clearError, el, showError } from './dom.js'
import { MAX_QUEUE, randomId } from './limits.js'
import { send, shareNewest } from './peers.js'
import { thumbnailUrl } from './queue.js'
import { save, session } from './session.js'
import { Sync, expectedPosition } from './sync.js'
import { PLAYER_STATE, createPlayer, currentVideoId, parseVideoId } from './youtube.js'

const END_TOLERANCE_S = 10 // a video only auto-advances if it ended about when the room expected it to

let player = null
let onPauseChange = () => {}

export const sync = new Sync({
  peerId: '', // set once the session is known
  onBroadcast: (state) => {
    send('state', state)
    session.state = state
    save()
  },
  onNeedsGesture: () => ($('start-overlay').hidden = false),
})

shareNewest('state', {
  current: () => sync.state,
  accept: (state) => {
    sync.receive(state)
    session.state = state
    renderNowPlaying()
    save()
  },
})

shareNewest('queue', {
  current: () => session.queue,
  accept: (queue) => {
    session.queue = queue
    renderQueue()
    save()
  },
})

/** Loads the YouTube player, once. */
export function loadPlayer() {
  if (player) return
  createPlayer('player', {
    onStateChange: (playerState) => {
      sync.onPlayerState(playerState)
      if (playerState === PLAYER_STATE.ENDED) autoAdvance()
      renderNowPlaying()
    },
  })
    .then((p) => {
      player = p
      sync.attach(p)
      renderNowPlaying()
    })
    .catch((err) => showError('room-error', `${err.message}. Check your connection and reload.`, 'player'))
}

/** `fn()` after you pause for yourself or rejoin the room. */
export function onPausedLocallyChange(fn) {
  onPauseChange = fn
}

function renderNowPlaying() {
  const playing = player?.getPlayerState() === PLAYER_STATE.PLAYING
  $('empty-screen').hidden = Boolean(sync.state)
  $('pause-locally').hidden = !player?.getVideoData?.()?.video_id
  document.querySelectorAll('.vinyl').forEach((node) => node.classList.toggle('spinning', playing))
}

function playVideo(videoId, options) {
  if (sync.pausedLocally) setPausedLocally(false) // picking a video means you're back
  sync.load(videoId, options)
  renderNowPlaying()
}

/** Nothing to listen to: no video yet, or the room's video played to its end. */
function isIdle() {
  if (!sync.state) return true
  return player?.getPlayerState() === PLAYER_STATE.ENDED && currentVideoId(player) === sync.state.videoId
}

/** If nothing is playing and the clipboard holds a YouTube link, cue it up paused. */
export async function autoPaste() {
  if (!isIdle() || $('view-room').hidden || !navigator.clipboard?.readText) return
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return // permission denied or no focus: the URL input still works
  }
  const videoId = parseVideoId(text)
  // A bare 11-char word would parse as an id, so only trust actual links.
  if (!videoId || videoId === text.trim() || !isIdle() || videoId === sync.state?.videoId) return
  playVideo(videoId, { playing: false })
}

addEventListener('focus', autoPaste) // e.g. back from copying a link in another tab

$('start-overlay').addEventListener('click', () => {
  $('start-overlay').hidden = true
  sync.start()
  autoPaste() // by now we have the room's state, if there is one
})

// ---------- link form ----------

/** The video in the link input, or null after shaking it. Clears the input on success. */
function takeVideoInput() {
  const input = $('video-url')
  const videoId = parseVideoId(input.value)
  if (!videoId) {
    input.classList.remove('shake')
    void input.offsetWidth // restart the animation
    input.classList.add('shake')
    return null
  }
  input.value = ''
  return videoId
}

$('video-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const videoId = takeVideoInput()
  if (videoId) playVideo(videoId)
})

$('queue-video').addEventListener('click', () => {
  const videoId = takeVideoInput()
  if (!videoId) return
  if (isIdle()) return playVideo(videoId) // nothing to wait for
  const { items } = session.queue
  if (items.length >= MAX_QUEUE) return showError('room-error', `The queue is full (${MAX_QUEUE} videos).`, 'queue')
  clearError('room-error', 'queue')
  setQueue([...items, { id: randomId(), videoId, addedBy: session.name, from: session.peerId }])
  $('video-url').focus()
})

// ---------- Up next ----------

function setQueue(items) {
  session.queue = { items, sentAt: Date.now(), from: session.peerId }
  send('queue', session.queue)
  renderQueue()
  save()
}

/** Plays a queued video now and takes it out of the queue. */
function playFromQueue(id) {
  const item = session.queue.items.find((it) => it.id === id)
  if (!item) return
  setQueue(session.queue.items.filter((it) => it !== item))
  playVideo(item.videoId)
}

/**
 * Every peer sees the video end at about the same time. Only advance if the room is still on it,
 * and if it ended about when expected: a peer back from a refresh restores an old state past
 * the video's end, and must not skip the room ahead before it hears where the room is.
 */
function autoAdvance() {
  const { state } = sync
  const { items } = session.queue
  if (!items.length || !state?.playing || sync.pausedLocally) return
  if (currentVideoId(player) !== state.videoId) return
  if (Math.abs(expectedPosition(state) - player.getDuration()) > END_TOLERANCE_S) return
  playFromQueue(items[0].id)
}

export function renderQueue() {
  const { items } = session.queue
  $('queue-title').hidden = !items.length
  $('queue-count').textContent = items.length
  $('queue-list').replaceChildren(
    ...items.map((item) => {
      const thumb = el('img', { src: thumbnailUrl(item.videoId), alt: '', loading: 'lazy', width: 160, height: 90 })
      const by = item.from === session.peerId ? 'you' : item.addedBy || 'Friend'
      const play = el('button', { type: 'button', className: 'queue-play', title: 'Play it now' }, thumb, el('small', { textContent: `Added by ${by}` }))
      play.addEventListener('click', () => playFromQueue(item.id))
      const remove = button('✕', () => setQueue(session.queue.items.filter((it) => it.id !== item.id)), 'icon-btn queue-remove')
      remove.title = remove.ariaLabel = 'Remove from the queue'
      return el('li', {}, play, remove)
    }),
  )
}

$('next-video').addEventListener('click', () => session.queue.items.length && playFromQueue(session.queue.items[0].id))

// ---------- Pause for me ----------

/** Pause for me, or rejoin the room. The call uses it too, see call-ui.js. */
export function setPausedLocally(paused) {
  if (paused) sync.pauseLocally()
  else sync.resumeLocally()
  $('rejoin-overlay').hidden = !paused
  $('pause-locally').disabled = paused
  onPauseChange()
  renderNowPlaying()
}

$('pause-locally').addEventListener('click', () => setPausedLocally(true))
$('rejoin-overlay').addEventListener('click', () => setPausedLocally(false))
