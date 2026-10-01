import { HISTORY_SIZE, MAX_CHAT_LENGTH, chatKey, createChat, isChat } from './chat.js'
import { cleanPassphrase, createPassphrase } from './passphrase.js'
import { joinJukebox, randomId } from './room.js'
import { Sync, isNewer, isState } from './sync.js'
import { PLAYER_STATE, createPlayer, parseVideoId } from './youtube.js'

const MAX_PEOPLE = 12 // you included. Soft cap: in a mesh every extra person costs everyone a connection.
const MAX_NAME_LENGTH = 24
const NAME_KEY = 'jukebox:name'

const $ = (id) => document.getElementById(id)
const views = { home: $('view-home'), room: $('view-room'), ended: $('view-ended') }

let player = null
let room = null
let actions = null // { hello, state, chat } Trystero actions
let passphrase = null
let creating = false // just clicked "Create a room", so the name prompt says so
// What survives a refresh, per tab and per room: { peerId, name, joinedAt, state, chat }
let session = null

const people = new Map() // Trystero peer id → { name, joinedAt }

const sync = new Sync({
  peerId: '', // set once the session is known
  onBroadcast: (state) => {
    actions?.state.send(state)
    save()
  },
  onNeedsGesture: () => ($('start-overlay').hidden = false),
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

/** Trim, collapse whitespace and cap a display name. Empty means "no name". */
function cleanName(name) {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : ''
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
  room?.leave()
  room = actions = null
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

// ---------- session (survives a refresh) ----------

const sessionKey = (phrase) => `jukebox:room:${phrase}`

function loadSession(phrase) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey(phrase)))
    if (typeof saved?.peerId === 'string' && Number.isFinite(saved.joinedAt)) {
      return {
        peerId: saved.peerId,
        name: cleanName(saved.name),
        joinedAt: saved.joinedAt,
        state: isState(saved.state) ? saved.state : null,
        chat: Array.isArray(saved.chat) ? saved.chat.filter(isChat) : [],
      }
    }
  } catch {
    // corrupted or missing: start fresh
  }
  return { peerId: randomId(), name: '', joinedAt: Date.now(), state: null, chat: [] }
}

function save() {
  if (!session) return
  session.state = sync.state
  session.chat = chatLog
  sessionStorage.setItem(sessionKey(passphrase), JSON.stringify(session))
}

// ---------- chat ----------

let chatLog = [] // sorted by sentAt; replayed to everyone who joins after us

function receiveChat(msg) {
  const key = chatKey(msg)
  if (chatLog.some((m) => chatKey(m) === key)) return // history replays overlap
  chatLog.push(msg)
  chatLog.sort((a, b) => a.sentAt - b.sentAt)
  if (chatLog.length > HISTORY_SIZE) chatLog = chatLog.slice(-HISTORY_SIZE)
  renderChat()
  save()
}

function renderChat() {
  const list = $('chat-log')
  list.replaceChildren(
    ...chatLog.map((msg) => {
      const mine = msg.from === session.peerId
      const li = document.createElement('li')
      li.classList.toggle('mine', mine)
      li.append(Object.assign(document.createElement('b'), { textContent: mine ? 'You' : msg.name }), msg.text)
      return li
    }),
  )
  list.scrollTop = list.scrollHeight
  $('chat-empty').hidden = chatLog.length > 0
}

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $('chat-input')
  const text = input.value.trim().slice(0, MAX_CHAT_LENGTH)
  if (!text) return
  input.value = ''
  const msg = createChat(text, { name: session.name, from: session.peerId })
  receiveChat(msg)
  actions?.chat.send(msg)
})

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
  autoPaste() // by now we have the room's state, if there is one
})

addEventListener('focus', autoPaste) // e.g. back from copying a link in another tab

// ---------- home ----------

function goToRoom(phrase) {
  location.hash = `room=${phrase}` // the hashchange handler takes it from here
}

$('create-room').addEventListener('click', () => {
  creating = true
  goToRoom(createPassphrase())
})

$('passphrase-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const phrase = cleanPassphrase($('passphrase-input').value)
  if (phrase) goToRoom(phrase)
})

// ---------- room ----------

async function openRoom(phrase) {
  passphrase = phrase
  session = loadSession(phrase)
  sync.peerId = session.peerId
  chatLog = session.chat
  renderChat()

  if (session.state) sync.receive(session.state) // resumes where it was, `expectedPosition` covers the gap
  $('invite-link').value = `${location.origin}${location.pathname}#room=${phrase}`
  $('invite-passphrase').textContent = phrase
  enterRoom() // behind the name prompt, so the player loads while you type
  renderPeople()

  if (!session.name) session.name = await askName()
  // The click on "Join" counts as the autoplay gesture. Back from a refresh there's none,
  // so the overlay shows if autoplay gets refused.
  sync.start()
  save()
  autoPaste()
  connect()
}

async function connect() {
  try {
    room = await joinJukebox(passphrase, {
      onJoinError: ({ error }) => {
        console.warn('jukebox: join error', error)
        showError('room-error', "Couldn't connect to someone in the room. One of you may be on a strict network (mobile data, office Wi-Fi).")
      },
    })
  } catch (err) {
    return showError('room-error', `Couldn't reach the relays (${err.message}). Check your connection and reload.`)
  }
  actions = { hello: room.makeAction('hello'), state: room.makeAction('state'), chat: room.makeAction('chat') }

  room.onPeerJoin = (id) => {
    const target = { target: id }
    actions.hello.send({ name: session.name, joinedAt: session.joinedAt }, target)
    if (sync.state) actions.state.send(sync.state, target)
    for (const msg of chatLog) actions.chat.send(msg, target)
  }
  room.onPeerLeave = (id) => {
    people.delete(id)
    renderPeople()
  }

  actions.hello.onMessage = (data, { peerId: id }) => {
    if (!Number.isFinite(data?.joinedAt)) return
    people.set(id, { name: cleanName(data.name) || 'Friend', joinedAt: data.joinedAt })
    renderPeople()
    if (isOverCap()) endRoom(`The room is full: ${MAX_PEOPLE} people are already listening.`)
  }
  actions.state.onMessage = (state, { peerId: id }) => {
    if (!isState(state)) return
    if (sync.state && !isNewer(state, sync.state)) {
      // Stale (e.g. restored after a refresh while the room moved on): bring them up to date.
      if (isNewer(sync.state, state)) actions.state.send(sync.state, { target: id })
      return
    }
    sync.receive(state)
    renderNowPlaying()
    save()
  }
  actions.chat.onMessage = (msg) => isChat(msg) && receiveChat(msg)
}

/** Whoever arrived after the first MAX_PEOPLE leaves. Older members stay, even after a refresh. */
function isOverCap() {
  const before = [...people.values()].filter((p) => p.joinedAt < session.joinedAt).length
  return before >= MAX_PEOPLE
}

function renderPeople() {
  const others = [...people.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  $('people').replaceChildren(
    ...[{ name: 'You' }, ...others].map(({ name }) => Object.assign(document.createElement('li'), { textContent: name })),
  )
  const count = others.length + 1
  $('people-count').textContent = `${count}/${MAX_PEOPLE}`
  setStatus(others.length ? `In the room · ${count}` : 'Waiting for friends…', others.length ? 'ok' : '')
}

/** Resolves with the name the user submits, remembered for next time. */
function askName() {
  $('name-modal').hidden = false
  $('join-title').textContent = creating ? 'Your room is ready 🎶' : "You're invited 🎶"
  const input = $('guest-name')
  input.value = localStorage.getItem(NAME_KEY) ?? ''
  input.focus()
  return new Promise((resolve) => {
    $('name-form').addEventListener('submit', function onSubmit(e) {
      e.preventDefault()
      const name = cleanName(input.value)
      if (!name) return
      $('name-form').removeEventListener('submit', onSubmit)
      $('name-modal').hidden = true
      localStorage.setItem(NAME_KEY, name)
      resolve(name)
    })
  })
}

$('copy-invite').addEventListener('click', (e) => copy($('invite-link').value, e.currentTarget))

// ---------- boot ----------

addEventListener('pagehide', () => {
  save()
  room?.leave()
})

function hashPassphrase() {
  return cleanPassphrase(new URLSearchParams(location.hash.slice(1)).get('room'))
}

addEventListener('hashchange', () => {
  const phrase = hashPassphrase()
  if (!phrase || phrase === passphrase) return
  if (passphrase) return location.reload() // switching rooms: start from a clean page
  openRoom(phrase)
})

if (location.protocol === 'file:') {
  show('home')
  $('create-room').disabled = true
  showError('home-error', 'jukebox needs to be served over http(s). Run `npx serve` in this folder and open the URL it prints.')
} else if (hashPassphrase()) {
  openRoom(hashPassphrase())
} else {
  show('home')
}
