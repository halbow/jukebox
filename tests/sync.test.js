import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'
import { Sync, expectedPosition } from '../js/sync.js'
import { PLAYER_STATE } from '../js/youtube.js'

const { UNSTARTED, PLAYING, PAUSED, BUFFERING, CUED } = PLAYER_STATE
const ID = 'dQw4w9WgXcQ'
const OTHER_ID = 'aaaaaaaaaaa'
const NOW = 1_000_000

const state = { videoId: ID, playing: true, position: 10, sentAt: NOW, from: 'peer1' }

test('expectedPosition: playing moves on with the clock', () => {
  assert.equal(expectedPosition(state, state.sentAt), 10)
  assert.equal(expectedPosition(state, state.sentAt + 2500), 12.5)
})

test('expectedPosition: paused stays put', () => {
  assert.equal(expectedPosition({ ...state, playing: false }, state.sentAt + 60_000), 10)
})

/**
 * Stands in for the YouTube player: its position runs with the (mocked) clock while playing, and every
 * state change is reported to `onState`, like the IFrame API's onStateChange. The `user*` methods are
 * someone using the player's own controls.
 */
class FakePlayer {
  calls = [] // what Sync asked for, by method name
  autoplayBlocked = false
  onState = () => {}
  #state = UNSTARTED
  #videoId = null
  #position = 0
  #at = Date.now()
  #duration = null

  getPlayerState() {
    return this.#state
  }

  getCurrentTime() {
    return this.#state === PLAYING ? this.#position + (Date.now() - this.#at) / 1000 : this.#position
  }

  getVideoData() {
    return { video_id: this.#videoId }
  }

  getDuration() {
    return this.#duration ?? 1000 // default to 1000s if not set
  }

  setDuration(duration) {
    this.#duration = duration
  }

  loadVideoById({ videoId, startSeconds }) {
    this.calls.push('loadVideoById')
    this.#videoId = videoId
    this.#seek(startSeconds)
    this.#set(this.autoplayBlocked ? UNSTARTED : PLAYING)
  }

  cueVideoById({ videoId, startSeconds }) {
    this.calls.push('cueVideoById')
    this.#videoId = videoId
    this.#seek(startSeconds)
    this.#set(CUED)
  }

  seekTo(seconds) {
    this.calls.push('seekTo')
    this.#seek(seconds)
  }

  playVideo() {
    this.calls.push('playVideo')
    this.#set(PLAYING)
  }

  pauseVideo() {
    this.calls.push('pauseVideo')
    this.#set(PAUSED)
  }

  stopVideo() {
    this.calls.push('stopVideo')
    this.#set(UNSTARTED)
  }

  userPlay() {
    this.#set(PLAYING)
  }

  userPause() {
    this.#set(PAUSED)
  }

  userSeek(seconds) {
    this.#seek(seconds)
  }

  userBuffer() {
    this.#set(BUFFERING)
  }

  #seek(seconds) {
    this.#position = seconds
    this.#at = Date.now()
  }

  #set(playerState) {
    this.#seek(this.getCurrentTime())
    this.#state = playerState
    this.onState(playerState)
  }
}

let player, sync, broadcasts, needsGesture

beforeEach(() => {
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: NOW })
  mock.method(performance, 'now', () => Date.now())
  broadcasts = []
  needsGesture = 0
  player = new FakePlayer()
  sync = new Sync({
    peerId: 'me',
    onBroadcast: (s) => broadcasts.push(s),
    onNeedsGesture: () => needsGesture++,
  })
  player.onState = (s) => sync.onPlayerState(s)
})

afterEach(() => {
  sync.stop()
  mock.timers.reset()
  mock.restoreAll()
})

/** Attached, started, and on the room's video, playing, with the echo guard over. */
function inRoom(room = state) {
  sync.attach(player)
  sync.start()
  sync.receive(room)
  mock.timers.tick(10_000)
  player.calls.length = 0
  broadcasts.length = 0
}

test('Sync: does nothing before start (the browser needs a gesture to play with sound)', () => {
  sync.attach(player)
  sync.receive(state)
  assert.deepEqual(player.calls, [])
  sync.start()
  assert.deepEqual(player.calls, ['loadVideoById'])
})

test('Sync: a room state loads its video at the live position, without echoing it', () => {
  sync.attach(player)
  sync.start()
  mock.timers.tick(3000)
  sync.receive(state) // sent 3s ago, at 10s
  assert.deepEqual(player.calls, ['loadVideoById'])
  assert.equal(player.getCurrentTime(), 13)
  mock.timers.tick(10_000)
  assert.deepEqual(broadcasts, [])
})

test('Sync: a paused room cues its video instead', () => {
  sync.attach(player)
  sync.start()
  sync.receive({ ...state, playing: false })
  assert.deepEqual(player.calls, ['cueVideoById'])
  assert.equal(player.getPlayerState(), CUED)
})

test('Sync: the room pausing pauses us, at its position', () => {
  inRoom()
  sync.receive({ ...state, playing: false, position: 42, sentAt: Date.now() })
  assert.deepEqual(player.calls, ['pauseVideo', 'seekTo'])
  assert.equal(player.getPlayerState(), PAUSED)
  assert.equal(player.getCurrentTime(), 42)
  mock.timers.tick(10_000)
  assert.deepEqual(broadcasts, [])
})

test('Sync: the room changing video loads it', () => {
  inRoom()
  sync.receive({ ...state, videoId: OTHER_ID, position: 0, sentAt: Date.now() })
  assert.deepEqual(player.calls, ['loadVideoById'])
  assert.equal(player.getVideoData().video_id, OTHER_ID)
})

test('Sync: within a second of the room, no seek', () => {
  inRoom()
  const live = expectedPosition(state)
  sync.receive({ ...state, position: live + 0.8, sentAt: Date.now() })
  assert.deepEqual(player.calls, [])
})

test('Sync: further than a second from the room, seek', () => {
  inRoom()
  const live = expectedPosition(state)
  sync.receive({ ...state, position: live + 5, sentAt: Date.now() })
  assert.deepEqual(player.calls, ['seekTo'])
  assert.equal(player.getCurrentTime(), live + 5)
})

test('Sync: pausing the player tells the room', () => {
  inRoom()
  player.userPause()
  assert.equal(broadcasts.length, 1)
  assert.deepEqual(broadcasts[0], { videoId: ID, playing: false, position: player.getCurrentTime(), sentAt: Date.now(), from: 'me' })
  assert.deepEqual(sync.state, broadcasts[0])
})

test('Sync: playing the player tells the room', () => {
  inRoom({ ...state, playing: false })
  player.userPlay()
  assert.equal(broadcasts.length, 1)
  assert.equal(broadcasts[0].playing, true)
})

test('Sync: seeking in the player tells the room', () => {
  inRoom()
  player.userSeek(100)
  mock.timers.tick(500)
  assert.equal(broadcasts.length, 1)
  assert.equal(broadcasts[0].playing, true)
  assert.ok(Math.abs(broadcasts[0].position - 100) < 1)
})

test('Sync: buffering is not a pause (one slow peer must not pause everyone)', () => {
  inRoom()
  player.userBuffer()
  mock.timers.tick(2000)
  assert.deepEqual(broadcasts, [])
})

test('Sync: playing again after buffering catches up with the room', () => {
  inRoom()
  player.userBuffer()
  mock.timers.tick(4000) // the room moved on 4s
  player.userPlay()
  assert.deepEqual(player.calls, ['seekTo'])
  assert.ok(Math.abs(player.getCurrentTime() - expectedPosition(sync.state)) < 0.01)
  assert.deepEqual(broadcasts, [])
})

test('Sync: load sends the new video and plays it', () => {
  inRoom()
  sync.load(OTHER_ID)
  assert.deepEqual(broadcasts, [{ videoId: OTHER_ID, playing: true, position: 0, sentAt: Date.now(), from: 'me' }])
  assert.deepEqual(player.calls, ['loadVideoById'])
})

test('Sync: load paused cues it', () => {
  inRoom()
  sync.load(OTHER_ID, { playing: false })
  assert.equal(broadcasts[0].playing, false)
  assert.deepEqual(player.calls, ['cueVideoById'])
})

test('Sync: Pause for me stops the player and ignores the room, without telling it', () => {
  inRoom()
  sync.pauseLocally()
  assert.deepEqual(player.calls, ['pauseVideo'])
  sync.receive({ ...state, videoId: OTHER_ID, position: 0, sentAt: Date.now() })
  mock.timers.tick(10_000)
  assert.deepEqual(player.calls, ['pauseVideo'])
  assert.deepEqual(broadcasts, [])
})

test('Sync: rejoining goes to where the room is now', () => {
  inRoom()
  sync.pauseLocally()
  sync.receive({ ...state, videoId: OTHER_ID, position: 0, sentAt: Date.now() })
  mock.timers.tick(30_000)
  player.calls.length = 0
  sync.resumeLocally()
  assert.deepEqual(player.calls, ['loadVideoById'])
  assert.equal(player.getVideoData().video_id, OTHER_ID)
  assert.equal(player.getCurrentTime(), 30)
  assert.deepEqual(broadcasts, [])
})

test('Sync: autoplay refused asks for a gesture, once the load had its time', () => {
  player.autoplayBlocked = true
  sync.attach(player)
  sync.start()
  sync.receive(state)
  mock.timers.tick(7500)
  assert.equal(needsGesture, 0)
  mock.timers.tick(1000)
  assert.equal(needsGesture, 1)
  assert.deepEqual(broadcasts, [])
})

test('Sync: ignores stale state older than 2 minutes', () => {
  sync.attach(player)
  sync.start()
  const staleState = { ...state, sentAt: NOW - 130_000 } // 130s old, older than 120s threshold
  sync.receive(staleState)
  assert.deepEqual(player.calls, [])
  assert.equal(sync.state, null)
})

test('Sync: accepts state within 2 minutes', () => {
  sync.attach(player)
  sync.start()
  const freshState = { ...state, sentAt: NOW - 100_000 } // 100s old, within threshold
  sync.receive(freshState)
  assert.deepEqual(player.calls, ['loadVideoById'])
  assert.equal(sync.state, freshState)
})

test('Sync: clamps target position to video duration on resync', () => {
  player.setDuration(100) // video is only 100s long
  sync.attach(player)
  sync.start()
  // Start with a fresh state at position 0
  const initialState = { ...state, position: 0, sentAt: NOW }
  sync.receive(initialState)
  mock.timers.tick(10_000)
  player.calls.length = 0
  // Now receive a state that would calculate to a position beyond the video duration
  // position: 50, sentAt: 100s ago, so expectedPosition = 50 + 100 = 150, but duration is 100
  const oldState = { ...initialState, position: 50, sentAt: NOW - 100_000 }
  sync.receive(oldState)
  mock.timers.tick(10_000)
  // Should have sought to 100 (clamped from 150)
  // The position should be clamped to the video duration
  assert.equal(player.getCurrentTime(), 100)
  // Should have at least one seekTo call
  assert.ok(player.calls.includes('seekTo'))
})
