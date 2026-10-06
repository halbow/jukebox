// Keeps the local YouTube player in line with the shared room State, and turns local
// player changes (play / pause / seek / video change) into State broadcasts.
//
// The room State itself is in protocol.js.

import { debug } from './debug.js'
import { createState } from './protocol.js'
import { PLAYER_STATE, currentVideoId, getVideoDuration } from './youtube.js'

const { UNSTARTED, PLAYING, PAUSED, BUFFERING, CUED } = PLAYER_STATE

const DRIFT_S = 1 // only seek when further than this from the expected position
const SEEK_JUMP_S = 1.5 // an unexplained jump between two samples means the user seeked
const TICK_MS = 500
const RESYNC_COOLDOWN_MS = 5000
const STALE_STATE_MAX_AGE_MS = 120000 // 2 minutes - ignore state older than this
// Echo guard windows: how long player changes we caused ourselves are not re-broadcast.
// They end early (after SETTLE_MS) once the player reaches the target state.
const GUARD_SEEK_MS = 1500
const GUARD_PLAY_MS = 3000
const GUARD_LOAD_MS = 8000
const SETTLE_MS = 500

const STATE_NAMES = Object.fromEntries(Object.entries(PLAYER_STATE).map(([name, value]) => [value, name]))
const s1 = (seconds) => `${seconds.toFixed(1)}s`

export function expectedPosition(state, now = Date.now()) {
  return state.playing ? state.position + (now - state.sentAt) / 1000 : state.position
}

export class Sync {
  /** Last agreed room state. */
  state = null
  /** "Pause for me": the player stops and ignores the room, which keeps updating `state`. Not broadcast. */
  pausedLocally = false

  #player = null
  #started = false
  #guardUntil = 0
  #sample = null // { t, at, advancing } last observed player position, for seek detection
  #lastResync = 0
  #timer = null

  constructor({ peerId, onBroadcast, onNeedsGesture }) {
    this.peerId = peerId
    this.onBroadcast = onBroadcast
    this.onNeedsGesture = onNeedsGesture
  }

  attach(player) {
    this.#player = player
    this.#timer = setInterval(() => this.#tick(), TICK_MS)
    this.#apply()
  }

  /** Call from a user gesture so the browser lets the player start with sound. */
  start() {
    this.#started = true
    this.#apply()
  }

  stop() {
    clearInterval(this.#timer)
    this.#started = false
    this.#player?.stopVideo()
  }

  pauseLocally() {
    this.pausedLocally = true
    this.#player?.pauseVideo()
  }

  /** Back to the room: wherever it is now, the video it's on, at the live position. */
  resumeLocally() {
    this.pausedLocally = false
    this.#apply()
  }

  receive(state) {
    const ageMs = Date.now() - state.sentAt
    if (ageMs > STALE_STATE_MAX_AGE_MS) {
      debug(`sync: ignoring stale state from ${state.from} (age: ${(ageMs / 1000).toFixed(1)}s)`)
      return
    }
    debug(`sync: room state from ${state.from}`, { ...state, expected: s1(expectedPosition(state)) })
    this.state = state
    this.#apply()
  }

  /** Local "change video" from the URL bar, or cued paused (`playing: false`) for an auto-paste. */
  load(videoId, { playing = true } = {}) {
    this.state = createState({ videoId, playing, position: 0 }, this.peerId)
    debug(`sync: telling the room ${playing ? 'play' : 'cue'} ${videoId} from the start`)
    this.onBroadcast(this.state)
    this.#apply()
  }

  onPlayerState(playerState) {
    if (!this.#active()) return
    debug(`sync: player ${STATE_NAMES[playerState] ?? playerState} at ${s1(this.#player.getCurrentTime())}${this.#guarded() ? ' (ours, ignored)' : ''}`)
    this.#tick() // catch a seek before interpreting the state change
    if (this.#guarded()) {
      if (this.#reached(playerState)) this.#guardUntil = Math.min(this.#guardUntil, Date.now() + SETTLE_MS)
      return
    }
    if (!this.state) return
    if (playerState === PLAYING) {
      if (!this.state.playing) this.#broadcastLocal('played here')
      else this.#resync() // back from buffering or an ad
    } else if (playerState === PAUSED && this.state.playing) {
      this.#broadcastLocal('paused here')
    }
    // BUFFERING is deliberately ignored: one slow peer must not pause everyone.
  }

  #active() {
    return this.#player && this.#started && !this.pausedLocally
  }

  #guarded() {
    return Date.now() < this.#guardUntil
  }

  #guard(ms) {
    this.#guardUntil = Math.max(this.#guardUntil, Date.now() + ms)
  }

  #reached(playerState) {
    return this.state.playing ? playerState === PLAYING : playerState === PAUSED || playerState === CUED
  }

  #tick() {
    if (!this.#active()) return
    const player = this.#player
    const playerState = player.getPlayerState()
    const t = player.getCurrentTime()
    const now = performance.now()

    if (this.#guardUntil && !this.#guarded()) {
      this.#guardUntil = 0
      const blocked = [UNSTARTED, PAUSED, CUED].includes(playerState)
      if (this.state?.playing && blocked) {
        debug(`sync: autoplay refused (player ${STATE_NAMES[playerState]}), asking for a click`)
        this.onNeedsGesture()
      }
    }

    const prev = this.#sample
    const predicted = prev ? prev.t + (prev.advancing ? (now - prev.at) / 1000 : 0) : t
    const stable = playerState === PLAYING || playerState === PAUSED
    this.#sample = stable ? { t, at: now, advancing: playerState === PLAYING } : { t: predicted, at: now, advancing: false }
    if (!stable || this.#guarded() || !this.state) return

    // A stall (ad, network) freezes the position; a seek moves it away from where it was.
    const seeked = prev && Math.abs(t - predicted) > SEEK_JUMP_S && Math.abs(t - prev.t) > TICK_MS / 1000
    const videoChanged = currentVideoId(player) && currentVideoId(player) !== this.state.videoId
    if (seeked) return this.#broadcastLocal(`seek detected: ${s1(prev.t)} → ${s1(t)}, expected ${s1(predicted)}`)
    if (videoChanged) return this.#broadcastLocal(`video changed in the player to ${currentVideoId(player)}`)

    if (playerState === PLAYING && this.state.playing && Date.now() - this.#lastResync > RESYNC_COOLDOWN_MS) {
      this.#resync()
    }
  }

  #resync() {
    let target = expectedPosition(this.state)
    if (Math.abs(this.#player.getCurrentTime() - target) <= DRIFT_S) return
    
    // Clamp target to video duration to avoid YouTube resetting to 0
    const duration = getVideoDuration(this.#player)
    if (duration !== null && target > duration) {
      debug(`sync: resync target ${s1(target)} exceeds video duration ${s1(duration)}, clamping`)
      target = duration
    }
    
    debug(`sync: resync, drifted from ${s1(this.#player.getCurrentTime())} to ${s1(target)}`)
    this.#lastResync = Date.now()
    this.#guard(GUARD_SEEK_MS)
    this.#player.seekTo(target, true)
    this.#sample = null
  }

  #apply() {
    if (!this.#active() || !this.state) return
    const player = this.#player
    const { videoId, playing } = this.state
    let target = expectedPosition(this.state)
    const playerState = player.getPlayerState()
    
    // Clamp target to video duration to avoid YouTube resetting to 0
    const duration = getVideoDuration(player)
    if (duration !== null && target > duration) {
      target = duration
    }
    if (target < 0) target = 0
    
    const drifted = Math.abs(player.getCurrentTime() - target) > DRIFT_S
    const log = (action) => debug(`sync: ${action} (player ${STATE_NAMES[playerState]} at ${s1(player.getCurrentTime())}, room ${playing ? 'playing' : 'paused'} at ${s1(target)})`)

    if (currentVideoId(player) !== videoId) {
      this.#guard(GUARD_LOAD_MS)
      log(`${playing ? 'load' : 'cue'} ${videoId}`)
      if (playing) player.loadVideoById({ videoId, startSeconds: target })
      else player.cueVideoById({ videoId, startSeconds: target })
    } else if (playing) {
      const needsPlay = playerState !== PLAYING && playerState !== BUFFERING
      if (!drifted && !needsPlay) return
      this.#guard(needsPlay ? GUARD_PLAY_MS : GUARD_SEEK_MS)
      log([drifted && 'seek', needsPlay && 'play'].filter(Boolean).join(' + '))
      if (drifted) player.seekTo(target, true)
      if (needsPlay) player.playVideo()
    } else if (playerState === PAUSED) {
      if (!drifted) return
      this.#guard(GUARD_SEEK_MS)
      log('seek')
      player.seekTo(target, true)
    } else if (playerState === PLAYING || playerState === BUFFERING) {
      this.#guard(GUARD_PLAY_MS)
      log(drifted ? 'pause + seek' : 'pause')
      player.pauseVideo()
      if (drifted) player.seekTo(target, true)
    } else {
      // Cued / ended / unstarted: seekTo would start playback, so re-cue at the right spot instead.
      this.#guard(GUARD_LOAD_MS)
      log('re-cue')
      player.cueVideoById({ videoId, startSeconds: target })
    }
    this.#sample = null
  }

  /** `reason` is for the debug log: the room follows us from here, so it's what explains a jump. */
  #broadcastLocal(reason) {
    const player = this.#player
    this.state = createState(
      {
        videoId: currentVideoId(player) || this.state.videoId,
        playing: player.getPlayerState() === PLAYING,
        position: player.getCurrentTime(),
      },
      this.peerId,
    )
    debug(`sync: telling the room ${this.state.playing ? 'playing' : 'paused'} at ${s1(this.state.position)}: ${reason}`)
    this.onBroadcast(this.state)
  }
}
