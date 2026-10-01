import { HISTORY_SIZE, MAX_CHAT_LENGTH, chatKey, createChat, editChat, isChat, isNewerEdit, senderColor } from './chat.js'
import { completedShortcodeAt, replaceShortcodes, shortcodeAt, suggest } from './emoji.js'
import { KEY_HELP_URL, checkKey, completesCommand, gifStillUrl, gifUrl, loadKey, parseGiphyCommand, saveKey, searchGifs } from './giphy.js'
import { createPassphrase, parsePassphrase } from './passphrase.js'
import { EMPTY_QUEUE, MAX_QUEUE, isQueue, thumbnailUrl } from './queue.js'
import { joinJukebox, randomId } from './room.js'
import { Sync, expectedPosition, isNewer, isState } from './sync.js'
import { PLAYER_STATE, createPlayer, currentVideoId, parseVideoId } from './youtube.js'

const MAX_PEOPLE = 12 // you included. Soft cap: in a mesh every extra person costs everyone a connection.
const MAX_NAME_LENGTH = 24
const NAME_KEY = 'jukebox:name'
const LAYOUT_KEY = 'jukebox:layout' // 'chat' when the chat is in focus, the video otherwise
const END_TOLERANCE_S = 10 // a video only auto-advances if it ended about when the room expected it to

const $ = (id) => document.getElementById(id)
const views = { home: $('view-home'), room: $('view-room'), ended: $('view-ended') }

let player = null
let room = null
let actions = null // { hello, state, chat, queue } Trystero actions
let passphrase = null
let creating = false // just clicked "Create a room", so the name prompt says so
// What survives a refresh, per tab and per room: { peerId, name, joinedAt, state, chat, queue }
let session = null

const people = new Map() // Trystero peer id → { name, joinedAt, pausedLocally }

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
  button.textContent = '✓'
  setTimeout(() => (button.textContent = label), 1500)
}

/** Trim, collapse whitespace and cap a display name. Empty means "no name". */
function cleanName(name) {
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : ''
}

function renderNowPlaying() {
  const playing = player?.getPlayerState() === PLAYER_STATE.PLAYING
  $('empty-screen').hidden = Boolean(sync.state)
  $('pause-locally').hidden = !player?.getVideoData?.()?.video_id
  document.querySelectorAll('.vinyl').forEach((el) => el.classList.toggle('spinning', playing))
}

function enterRoom() {
  show('room')
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
async function autoPaste() {
  if (!isIdle() || views.room.hidden || !navigator.clipboard?.readText) return
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
        queue: isQueue(saved.queue) ? saved.queue : EMPTY_QUEUE,
      }
    }
  } catch {
    // corrupted or missing: start fresh
  }
  return { peerId: randomId(), name: '', joinedAt: Date.now(), state: null, chat: [], queue: EMPTY_QUEUE }
}

function save() {
  if (!session) return
  session.state = sync.state
  session.chat = chatLog
  session.queue = queue
  sessionStorage.setItem(sessionKey(passphrase), JSON.stringify(session))
}

// ---------- chat ----------

let chatLog = [] // sorted by sentAt; replayed to everyone who joins after us
let editing = null // the message of yours being edited, picked with ↑ in an empty input

function receiveChat(msg) {
  const key = chatKey(msg)
  const i = chatLog.findIndex((m) => chatKey(m) === key)
  if (i >= 0) {
    // History replays overlap; only a newer edit gets through, and it only changes the text.
    if (!isNewerEdit(msg, chatLog[i])) return
    chatLog[i] = { ...chatLog[i], text: msg.text, editedAt: msg.editedAt }
    renderChat()
    return save()
  }
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
      const sender = Object.assign(document.createElement('b'), { textContent: mine ? 'You' : msg.name })
      if (!mine) sender.style.color = senderColor(msg.from)
      if (msg.gif) {
        // the search reads as the command it was, not as something said
        li.append(sender, Object.assign(document.createElement('small'), { className: 'gif-query', textContent: `/giphy ${msg.text}` }))
        li.append(gifElement(msg.gif, msg.text))
      } else {
        li.append(sender, msg.text)
      }
      if (msg.editedAt) li.append(Object.assign(document.createElement('small'), { textContent: '(edited)' }))
      return li
    }),
  )
  list.scrollTop = list.scrollHeight
  $('chat-empty').hidden = chatLog.length > 0
}

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $('chat-input')
  const command = !editing && parseGiphyCommand(input.value)
  if (command) {
    input.value = ''
    closeEmoji()
    renderCommandHint()
    if (command.key) return askGiphyKey()
    if (!command.query) return showGiphy({ error: "Say what you're looking for, e.g. /giphy dancing cat" })
    return searchGiphy(command.query)
  }
  const text = replaceShortcodes(input.value.trim()).slice(0, MAX_CHAT_LENGTH)
  if (!text && !editing) return
  input.value = ''
  closeEmoji()
  const edited = editing
  stopEditing()
  if (edited && (!text || text === edited.text)) return // emptied or unchanged: nothing to edit
  const msg = edited ? editChat(edited, text) : createChat(text, { name: session.name, from: session.peerId })
  receiveChat(msg)
  actions?.chat.send(msg)
})

function startEditing() {
  editing = chatLog.findLast((m) => m.from === session.peerId && !m.gif) // a GIF can't be edited
  if (!editing) return
  const input = $('chat-input')
  input.value = editing.text
  input.setSelectionRange(input.value.length, input.value.length)
  $('chat-form').classList.add('editing')
  $('chat-editing').hidden = false
  renderCommandHint()
}

function stopEditing() {
  editing = null
  $('chat-form').classList.remove('editing')
  $('chat-editing').hidden = true
}

$('chat-input').addEventListener('keydown', (e) => {
  if (emojiOpen || e.isComposing) return // the emoji list has the arrows and Escape
  if (e.key === 'ArrowUp' && !e.target.value) {
    e.preventDefault()
    startEditing()
  } else if (e.key === 'Escape' && editing) {
    e.target.value = ''
    stopEditing()
  } else if (e.key === 'Escape' && giphy) {
    closeGiphy()
  }
})

// ---------- /giphy ----------

// The private preview, only you see it: { query?, results?, index?, loading?, error?, askKey? }, or null.
// Never in `chatLog`, never saved, never sent.
let giphy = null
let giphyRun = 0 // bumped by every search, key check or close, so a late answer can't reopen the preview

/** A GIF for the chat log or the preview: the still frame for reduced motion, a placeholder once it's gone. */
function gifElement({ id, width, height }, alt) {
  const picture = Object.assign(document.createElement('picture'), { className: 'gif' })
  const still = Object.assign(document.createElement('source'), { srcset: gifStillUrl(id), media: '(prefers-reduced-motion: reduce)' })
  const img = Object.assign(document.createElement('img'), { src: gifUrl(id), width, height, alt, loading: 'lazy' })
  img.addEventListener('error', () => picture.replaceChildren(Object.assign(document.createElement('small'), { textContent: 'GIF unavailable' })))
  picture.append(still, img)
  return picture
}

function button(label, onClick, className = 'btn small') {
  const el = Object.assign(document.createElement('button'), { type: 'button', className, textContent: label })
  el.addEventListener('click', onClick)
  return el
}

function showGiphy(preview) {
  giphy = preview
  renderGiphy()
}

function closeGiphy() {
  giphyRun++
  giphy = null
  renderGiphy()
}

function renderGiphy() {
  const box = $('giphy-preview')
  box.hidden = !giphy
  if (!giphy) return box.replaceChildren()
  const { query, results, index, loading, error, askKey } = giphy
  const hint = (text) => Object.assign(document.createElement('p'), { className: 'hint', textContent: text })
  const cancel = button('Cancel', closeGiphy)

  if (askKey) return box.replaceChildren(...keyForm(), ...(error ? [errorLine(error)] : []))
  if (loading) return box.replaceChildren(hint(query ? `Searching Giphy for “${query}”…` : 'Checking your key…'))
  if (error) return box.replaceChildren(errorLine(error), actionsRow(cancel))
  if (!results.length) return box.replaceChildren(hint(`No GIFs for “${query}”.`), actionsRow(cancel))
  box.replaceChildren(
    hint(`Only you can see this · “${query}”`),
    gifElement(results[index], query),
    actionsRow(
      button('Send', sendGiphy, 'btn small primary'),
      ...(results.length > 1 ? [button('Shuffle', shuffleGiphy)] : []),
      cancel,
      Object.assign(document.createElement('small'), { className: 'powered', textContent: 'Powered by GIPHY' }),
    ),
  )
}

function actionsRow(...children) {
  const row = Object.assign(document.createElement('div'), { className: 'giphy-actions' })
  row.append(...children)
  return row
}

function errorLine(text) {
  return Object.assign(document.createElement('p'), { className: 'error', textContent: text })
}

function keyForm() {
  const intro = Object.assign(document.createElement('p'), { className: 'hint' })
  const link = Object.assign(document.createElement('a'), { href: KEY_HELP_URL, target: '_blank', rel: 'noopener', textContent: 'Get a free one' })
  intro.append('/giphy needs your own Giphy API key, it stays in this browser. ', link, ' (Create an App → API).')
  const form = Object.assign(document.createElement('form'), { className: 'giphy-actions' })
  const input = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Giphy API key', value: loadKey(), autocomplete: 'off', spellcheck: false })
  input.addEventListener('keydown', (e) => e.key === 'Escape' && closeGiphy())
  form.append(input, Object.assign(document.createElement('button'), { className: 'btn small primary', textContent: 'Save' }))
  if (loadKey()) {
    form.append(
      button('Remove', () => {
        saveKey('')
        closeGiphy()
      }),
    )
  }
  form.append(button('Cancel', closeGiphy))
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const key = input.value.trim()
    if (key) saveGiphyKey(key)
  })
  queueMicrotask(() => input.focus())
  return [intro, form]
}

/** `/giphy key`, or a search without a (working) key: `query` runs once the key is saved. */
function askGiphyKey({ query, error } = {}) {
  giphyRun++
  showGiphy({ askKey: true, query, error })
}

async function saveGiphyKey(key) {
  const run = ++giphyRun
  const { query } = giphy
  showGiphy({ loading: true })
  try {
    await checkKey(key)
  } catch (err) {
    if (run === giphyRun) askGiphyKey({ query, error: err.message })
    return
  }
  if (run !== giphyRun) return
  saveKey(key)
  if (query) searchGiphy(query)
  else closeGiphy()
}

async function searchGiphy(query) {
  const key = loadKey()
  if (!key) return askGiphyKey({ query })
  const run = ++giphyRun
  showGiphy({ query, loading: true })
  try {
    const results = await searchGifs(key, query)
    if (run === giphyRun) showGiphy({ query, results, index: 0 })
  } catch (err) {
    if (run !== giphyRun) return
    if (err.badKey) askGiphyKey({ query, error: err.message })
    else showGiphy({ query, error: err.message })
  }
}

function shuffleGiphy() {
  const { results, index } = giphy
  const next = (index + 1 + Math.floor(Math.random() * (results.length - 1))) % results.length // never the same one
  showGiphy({ ...giphy, index: next })
}

function sendGiphy() {
  const { query, results, index } = giphy
  closeGiphy()
  const msg = createChat(query.slice(0, MAX_CHAT_LENGTH), { name: session.name, from: session.peerId, gif: results[index] })
  receiveChat(msg)
  actions?.chat.send(msg)
  $('chat-input').focus()
}

// ---------- emoji ----------

let emojiOpen = null // { start, suggestions, selected } while the `:` (or `/`) list is showing

function closeEmoji() {
  emojiOpen = null
  $('emoji-suggestions').hidden = true
  $('chat-input').setAttribute('aria-expanded', 'false')
}

function renderEmoji() {
  const list = $('emoji-suggestions')
  list.replaceChildren(
    ...emojiOpen.suggestions.map(({ icon, label, detail }, i) => {
      const li = document.createElement('li')
      li.role = 'option'
      li.ariaSelected = String(i === emojiOpen.selected)
      li.append(Object.assign(document.createElement('span'), { textContent: icon }), label)
      if (detail) li.append(Object.assign(document.createElement('small'), { textContent: detail }))
      // mousedown, not click: keeps the focus (and the caret) in the input
      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        pickEmoji(i)
      })
      return li
    }),
  )
  list.hidden = false
  $('chat-input').setAttribute('aria-expanded', 'true')
  list.children[emojiOpen.selected]?.scrollIntoView({ block: 'nearest' })
}

function pickEmoji(i) {
  const input = $('chat-input')
  input.setRangeText(emojiOpen.suggestions[i].insert, emojiOpen.start, input.selectionStart, 'end')
  closeEmoji()
  renderCommandHint()
}

const GIPHY_SUGGESTION = { icon: '🎞️', label: '/giphy', detail: '[search] · send a GIF', insert: '/giphy ' }

function suggestionsAt(input) {
  if (!editing && completesCommand(input.value)) return { start: 0, suggestions: [GIPHY_SUGGESTION] }
  const typing = shortcodeAt(input.value, input.selectionStart)
  const found = typing ? suggest(typing.query) : []
  const suggestions = found.map(({ name, emoji }) => ({ icon: emoji, label: `:${name}:`, insert: emoji + ' ' }))
  return { start: typing?.start, suggestions }
}

// While a `/giphy …` is typed, say it's a command and what Enter will do.
function renderCommandHint() {
  const command = !editing && parseGiphyCommand($('chat-input').value)
  $('chat-form').classList.toggle('command', !!command)
  $('chat-command').hidden = !command
  if (!command) return
  $('chat-command').textContent = command.key
    ? '/giphy · Enter to change your Giphy key'
    : command.query
      ? `/giphy · Enter to search Giphy for “${command.query}”`
      : '/giphy · type what you’re looking for'
}

$('chat-input').addEventListener('input', (e) => {
  const input = e.target
  const done = completedShortcodeAt(input.value, input.selectionStart)
  if (done) input.setRangeText(done.emoji, done.start, done.end, 'end')
  renderCommandHint()
  const { start, suggestions } = suggestionsAt(input)
  if (!suggestions.length) return closeEmoji()
  emojiOpen = { start, suggestions, selected: 0 }
  renderEmoji()
})

$('chat-input').addEventListener('keydown', (e) => {
  if (!emojiOpen || e.isComposing) return
  const count = emojiOpen.suggestions.length
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    emojiOpen.selected = (emojiOpen.selected + (e.key === 'ArrowDown' ? 1 : -1) + count) % count
    renderEmoji()
  } else if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault() // pick it, don't send the message
    pickEmoji(emojiOpen.selected)
  } else if (e.key === 'Escape') {
    closeEmoji()
  }
})

$('chat-input').addEventListener('blur', closeEmoji)

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
  if (queue.items.length >= MAX_QUEUE) return showError('room-error', `The queue is full (${MAX_QUEUE} videos).`)
  showError('room-error', '')
  setQueue([...queue.items, { id: randomId(), videoId, addedBy: session.name, from: session.peerId }])
  $('video-url').focus()
})

// ---------- queue ----------

let queue = EMPTY_QUEUE

function setQueue(items) {
  queue = { items, sentAt: Date.now(), from: session.peerId }
  actions?.queue.send(queue)
  renderQueue()
  save()
}

/** Plays a queued video now and takes it out of the queue. */
function playFromQueue(id) {
  const item = queue.items.find((it) => it.id === id)
  if (!item) return
  setQueue(queue.items.filter((it) => it !== item))
  playVideo(item.videoId)
}

/**
 * Every peer sees the video end at about the same time. Only advance if the room is still on it,
 * and if it ended about when expected: a peer back from a refresh restores an old state past
 * the video's end, and must not skip the room ahead before it hears where the room is.
 */
function autoAdvance() {
  const { state } = sync
  if (!queue.items.length || !state?.playing || sync.pausedLocally) return
  if (currentVideoId(player) !== state.videoId) return
  if (Math.abs(expectedPosition(state) - player.getDuration()) > END_TOLERANCE_S) return
  playFromQueue(queue.items[0].id)
}

function renderQueue() {
  $('queue-title').hidden = !queue.items.length
  $('queue-count').textContent = queue.items.length
  $('queue-list').replaceChildren(
    ...queue.items.map((item) => {
      const li = document.createElement('li')
      const play = Object.assign(document.createElement('button'), { type: 'button', className: 'queue-play', title: 'Play it now' })
      const thumb = Object.assign(document.createElement('img'), { src: thumbnailUrl(item.videoId), alt: '', loading: 'lazy', width: 160, height: 90 })
      const by = item.from === session.peerId ? 'you' : item.addedBy || 'Friend'
      play.append(thumb, Object.assign(document.createElement('small'), { textContent: `Added by ${by}` }))
      play.addEventListener('click', () => playFromQueue(item.id))
      const remove = button('✕', () => setQueue(queue.items.filter((it) => it.id !== item.id)), 'icon-btn queue-remove')
      remove.title = remove.ariaLabel = 'Remove from the queue'
      li.append(play, remove)
      return li
    }),
  )
}

$('next-video').addEventListener('click', () => queue.items.length && playFromQueue(queue.items[0].id))

function setPausedLocally(paused) {
  if (paused) sync.pauseLocally()
  else sync.resumeLocally()
  $('rejoin-overlay').hidden = !paused
  $('pause-locally').disabled = paused
  actions?.hello.send(hello()) // so the others see the ⏸ next to your name
  renderPeople()
  renderNowPlaying()
}

$('pause-locally').addEventListener('click', () => setPausedLocally(true))
$('rejoin-overlay').addEventListener('click', () => setPausedLocally(false))

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

// ---------- room ----------

async function openRoom(phrase) {
  passphrase = phrase
  session = loadSession(phrase)
  sync.peerId = session.peerId
  chatLog = session.chat
  queue = session.queue
  renderChat()
  renderQueue()

  if (session.state) sync.receive(session.state) // resumes where it was, `expectedPosition` covers the gap
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
  actions = {
    hello: room.makeAction('hello'),
    state: room.makeAction('state'),
    chat: room.makeAction('chat'),
    queue: room.makeAction('queue'),
  }

  room.onPeerJoin = (id) => {
    const target = { target: id }
    actions.hello.send(hello(), target)
    if (sync.state) actions.state.send(sync.state, target)
    if (queue.sentAt) actions.queue.send(queue, target)
    for (const msg of chatLog) actions.chat.send(msg, target)
  }
  room.onPeerLeave = (id) => {
    people.delete(id)
    renderPeople()
  }

  actions.hello.onMessage = (data, { peerId: id }) => {
    if (!Number.isFinite(data?.joinedAt)) return
    people.set(id, { name: cleanName(data.name) || 'Friend', joinedAt: data.joinedAt, pausedLocally: data.pausedLocally === true })
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
  actions.queue.onMessage = (msg, { peerId: id }) => {
    if (!isQueue(msg)) return
    if (!isNewer(msg, queue)) {
      if (isNewer(queue, msg)) actions.queue.send(queue, { target: id }) // stale: bring them up to date
      return
    }
    queue = msg
    renderQueue()
    save()
  }
}

function hello() {
  return { name: session.name, joinedAt: session.joinedAt, pausedLocally: sync.pausedLocally }
}

/** Whoever arrived after the first MAX_PEOPLE leaves. Older members stay, even after a refresh. */
function isOverCap() {
  const before = [...people.values()].filter((p) => p.joinedAt < session.joinedAt).length
  return before >= MAX_PEOPLE
}

function renderPeople() {
  const others = [...people.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  $('people').replaceChildren(
    ...[{ name: 'You', pausedLocally: sync.pausedLocally }, ...others].map(({ name, pausedLocally }) => {
      const li = Object.assign(document.createElement('li'), { textContent: name })
      if (pausedLocally) {
        li.classList.add('paused')
        li.title = 'Paused for themselves, not listening right now'
      }
      return li
    }),
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

// ---------- layout ----------

function setChatMode(on) {
  views.room.classList.toggle('chat-mode', on)
  const button = $('toggle-layout')
  button.textContent = on ? '📺' : '💬'
  button.title = button.ariaLabel = on ? 'Focus on the video' : 'Focus on the chat'
  button.ariaPressed = String(on)
  localStorage.setItem(LAYOUT_KEY, on ? 'chat' : 'video')
}

$('toggle-layout').addEventListener('click', () => setChatMode(!views.room.classList.contains('chat-mode')))
setChatMode(localStorage.getItem(LAYOUT_KEY) === 'chat')

$('copy-invite').addEventListener('click', (e) => copy(`${location.origin}${location.pathname}#room=${passphrase}`, e.currentTarget))

// ---------- boot ----------

addEventListener('pagehide', () => {
  save()
  room?.leave()
})

function hashRoom() {
  return new URLSearchParams(location.hash.slice(1)).get('room')
}

function hashPassphrase() {
  return parsePassphrase(hashRoom())
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
  if (hashRoom()) showError('home-error', "This invite link is broken or too old. Ask for a new one.")
}
