import { answerInvite, createInvite, decode, randomId } from './signal.js'
import { Sync, isState } from './sync.js'
import { PLAYER_STATE, createPlayer, parseVideoId } from './youtube.js'

const MAX_PEOPLE = 5 // host included
const CONNECT_TIMEOUT_MS = 30000

const $ = (id) => document.getElementById(id)
const views = { home: $('view-home'), join: $('view-join'), room: $('view-room'), ended: $('view-ended') }

const peerId = randomId()
let role = null // 'host' | 'guest'
let player = null

const sync = new Sync({
  peerId,
  onBroadcast: (state) => (role === 'host' ? sendToGuests(state) : send(hostChannel, state)),
  onNeedsGesture: () => role === 'guest' && ($('start-overlay').hidden = false),
})

// ---------- shared UI ----------

function show(name) {
  for (const [key, el] of Object.entries(views)) el.hidden = key !== name
}

function setStatus(text, tone) {
  const pill = $('status')
  pill.hidden = !text
  pill.textContent = text
  pill.dataset.tone = tone
}

function showError(id, message) {
  $(id).textContent = message
  $(id).hidden = !message
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API needs a secure context; plain http on a LAN IP falls back to execCommand.
    const area = Object.assign(document.createElement('textarea'), { value: text })
    document.body.append(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  const label = button.textContent
  button.textContent = 'Copied ✓'
  setTimeout(() => (button.textContent = label), 1500)
}

function send(channel, state) {
  if (channel?.readyState === 'open') channel.send(JSON.stringify(state))
}

function parseMessage(data) {
  try {
    const msg = JSON.parse(data)
    return isState(msg) ? msg : null
  } catch {
    return null
  }
}

function renderNowPlaying() {
  const playing = player?.getPlayerState() === PLAYER_STATE.PLAYING
  const title = player?.getVideoData?.()?.title
  $('empty-screen').hidden = Boolean(sync.state)
  $('now-playing').textContent = title ? title : ''
  $('now-playing').hidden = !title
  document.querySelectorAll('.vinyl').forEach((el) => el.classList.toggle('spinning', playing))
}

function enterRoom() {
  show('room')
  if (player) return
  createPlayer('player', {
    onStateChange: (playerState) => {
      sync.onPlayerState(playerState)
      renderNowPlaying()
    },
  })
    .then((p) => {
      player = p
      sync.attach(p)
      renderNowPlaying()
    })
    .catch((err) => showError('room-error', `${err.message}. Check your connection and reload.`))
}

function endRoom(message) {
  sync.stop()
  setStatus('')
  $('ended-message').textContent = message
  show('ended')
}

function playVideo(videoId, options) {
  sync.load(videoId, options)
  renderNowPlaying()
}

/** If nothing is playing yet and the clipboard holds a YouTube link, cue it up paused. */
async function autoPaste() {
  if (sync.state || views.room.hidden || !navigator.clipboard?.readText) return
  let text
  try {
    text = await navigator.clipboard.readText()
  } catch {
    return // permission denied or no focus: the URL input still works
  }
  const videoId = parseVideoId(text)
  // A bare 11-char word would parse as an id, so only trust actual links.
  if (!videoId || videoId === text.trim() || sync.state) return
  playVideo(videoId, { playing: false })
}

$('video-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $('video-url')
  const videoId = parseVideoId(input.value)
  if (!videoId) {
    input.classList.remove('shake')
    void input.offsetWidth // restart the animation
    input.classList.add('shake')
    return
  }
  input.value = ''
  playVideo(videoId)
})

$('start-overlay').addEventListener('click', () => {
  $('start-overlay').hidden = true
  sync.start()
  autoPaste() // by now a guest has the host's state, if there is one
})

addEventListener('focus', autoPaste) // e.g. back from copying a link in another tab

// ---------- host ----------

const guests = new Map() // invite id → { name, pc, channel, connected }
let currentInvite = null
let preparingInvite = false
let guestCounter = 0

function sendToGuests(state) {
  for (const guest of guests.values()) send(guest.channel, state)
}

function isFull() {
  return guests.size + 1 >= MAX_PEOPLE
}

async function startHosting() {
  role = 'host'
  sync.start() // the click on "Create room" counts as the autoplay gesture
  $('invite-panel').hidden = false
  $('people-panel').hidden = false
  enterRoom()
  autoPaste()
  renderPeople()
  await refreshInvite()
}

async function refreshInvite() {
  if (preparingInvite || currentInvite || isFull()) return renderInvite()
  preparingInvite = true
  renderInvite()
  try {
    currentInvite = await createInvite()
  } catch (err) {
    showError('invite-error', `Couldn't create an invite: ${err.message}`)
  } finally {
    preparingInvite = false
  }
  renderInvite()
}

function inviteUrl(code) {
  return `${location.origin}${location.pathname}#offer=${code}`
}

function renderInvite() {
  const full = isFull()
  $('invite-full').hidden = !full
  $('invite-steps').hidden = full
  $('invite-link').value = currentInvite ? inviteUrl(currentInvite.code) : 'Preparing a fresh link…'
  $('copy-invite').disabled = !currentInvite
  $('let-in').disabled = !currentInvite
}

function renderPeople() {
  const list = [{ name: 'You', tag: 'host' }, ...[...guests.values()].map((g) => ({ name: g.name, tag: g.connected ? '' : 'connecting…' }))]
  $('people').replaceChildren(
    ...list.map(({ name, tag }) => {
      const li = document.createElement('li')
      li.textContent = name
      if (tag) li.append(Object.assign(document.createElement('small'), { textContent: tag }))
      return li
    }),
  )
  const connected = [...guests.values()].filter((g) => g.connected).length + 1
  $('people-count').textContent = `${connected}/${MAX_PEOPLE}`
  setStatus(`Hosting · ${connected}/${MAX_PEOPLE}`, 'ok')
}

async function letIn(code) {
  showError('invite-error', '')
  let answer
  try {
    answer = await decode(code)
  } catch {
    return showError('invite-error', "That doesn't look like an answer code. Ask your friend to copy it again.")
  }
  if (!currentInvite || answer.id !== currentInvite.id) {
    return showError('invite-error', 'This code belongs to an older invite link. Send your friend the current link.')
  }
  const invite = currentInvite
  try {
    await invite.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp })
  } catch (err) {
    return showError('invite-error', `Couldn't use that code: ${err.message}`)
  }
  $('answer-input').value = ''
  currentInvite = null
  addGuest(invite)
  refreshInvite()
}

function addGuest({ id, pc, channel }) {
  const guest = { name: `Friend ${++guestCounter}`, pc, channel, connected: false }
  guests.set(id, guest)
  renderPeople()

  const drop = () => {
    if (!guests.has(id)) return
    guests.delete(id)
    pc.close()
    renderPeople()
    refreshInvite()
  }
  const timeout = setTimeout(() => !guest.connected && drop(), CONNECT_TIMEOUT_MS)

  channel.onopen = () => {
    clearTimeout(timeout)
    guest.connected = true
    if (sync.state) send(channel, sync.state)
    renderPeople()
  }
  channel.onclose = drop
  pc.onconnectionstatechange = () => pc.connectionState === 'failed' && drop()
  channel.onmessage = (e) => {
    const state = parseMessage(e.data)
    if (!state) return
    // Host arbitrates: last sentAt wins. Correct a guest that sent something stale.
    if (sync.state && state.sentAt < sync.state.sentAt) return send(channel, sync.state)
    sync.receive(state)
    renderNowPlaying()
    sendToGuests(state) // including the sender, so everyone converges on the same last state
  }
}

$('create-room').addEventListener('click', startHosting)
$('copy-invite').addEventListener('click', (e) => copy($('invite-link').value, e.currentTarget))
$('answer-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const code = $('answer-input').value.trim()
  if (code) letIn(code)
})

// ---------- guest ----------

let hostChannel = null
let guestPc = null

async function startJoining(offerCode) {
  role = 'guest'
  show('join')
  let code
  try {
    const offer = await decode(offerCode)
    ;({ pc: guestPc, code } = await answerInvite(offer, peerId))
  } catch {
    return showError('join-error', 'This invite link looks broken. Ask your host for a new one.')
  }
  $('answer-code').value = code
  $('copy-answer').disabled = false
  $('join-status').textContent = 'Waiting for the host to let you in…'

  guestPc.addEventListener('datachannel', ({ channel }) => {
    hostChannel = channel
    channel.onmessage = (e) => {
      const state = parseMessage(e.data)
      if (!state) return
      sync.receive(state)
      renderNowPlaying()
    }
    channel.onclose = () => endRoom('The host left, so the room is closed.')
    const onOpen = () => {
      setStatus('Connected to host', 'ok')
      views.room.classList.add('solo') // guests have no side panel
      enterRoom()
      $('start-overlay').hidden = false
    }
    if (channel.readyState === 'open') onOpen()
    else channel.onopen = onOpen
  })
  guestPc.addEventListener('connectionstatechange', () => {
    if (guestPc.connectionState === 'connecting') $('join-status').textContent = 'Connecting…'
    if (guestPc.connectionState === 'failed' && hostChannel?.readyState !== 'open') {
      showError('join-error', "Couldn't connect. One of you may be on a strict network (mobile data, office Wi-Fi). Try another network.")
    }
  })
}

$('copy-answer').addEventListener('click', (e) => copy($('answer-code').value, e.currentTarget))

// ---------- boot ----------

addEventListener('pagehide', () => {
  for (const guest of guests.values()) guest.pc.close()
  currentInvite?.pc.close()
  guestPc?.close()
})

addEventListener('hashchange', () => location.hash.includes('offer=') && location.reload())

const offerCode = new URLSearchParams(location.hash.slice(1)).get('offer')
if (location.protocol === 'file:') {
  show('home')
  $('create-room').disabled = true
  showError('home-error', 'jukebox needs to be served over http(s). Run `npx serve` in this folder and open the URL it prints.')
} else if (offerCode) {
  history.replaceState(null, '', location.pathname + location.search) // the offer is single-use
  startJoining(offerCode)
} else {
  show('home')
}
