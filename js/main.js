// Boots the page: home or room from the URL, joining a room, and who comes and goes. The rest of the room
// lives in its own modules, each wired to the peers on import (see peers.js for the messages).

import { addNotice, renderChat } from './chat-log.js'
import './chat-input.js'
import { $, clearError, copy, setStatus, showError } from './dom.js'
import { offerHistory } from './history.js'
import { MAX_NAME_LENGTH, MAX_PEOPLE, cleanName } from './limits.js'
import { createPassphrase, parsePassphrase } from './passphrase.js'
import * as peers from './peers.js'
import { hello, isOverCap, people, renderPeople } from './people.js'
import { openSession, save, session } from './session.js'
import { rememberName, rememberedName } from './settings.js'
import { autoPaste, loadPlayer, onPausedLocallyChange, renderQueue, sync } from './stage.js'
import { applyTheme } from './theme.js'

const LAYOUT_KEY = 'jukebox:layout' // 'chat' when the chat is in focus, the video otherwise
const UNREACHABLE = "Couldn't connect to someone in the room. One of you may be on a strict network (mobile data, office Wi-Fi)."

const views = { home: $('view-home'), room: $('view-room'), ended: $('view-ended') }

let passphrase = null
let creating = false // just clicked "Create a room", so the name prompt says so
const leftWhileHere = new Set() // session peer ids of people who left since we came, so their comeback shows
const unreachable = new Set() // Trystero peer ids whose connection failed and who haven't connected since

$('guest-name').maxLength = MAX_NAME_LENGTH

function show(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name
  $('open-settings').hidden = name !== 'room'
}

// ---------- home ----------

$('create-room').addEventListener('click', () => {
  creating = true
  location.hash = `room=${createPassphrase()}` // the hashchange handler takes it from here
})

// ---------- room ----------

async function openRoom(phrase) {
  passphrase = phrase
  openSession(phrase)
  sync.peerId = session.peerId
  applyTheme(session.theme.id)
  renderChat()
  renderQueue()

  if (session.state) sync.receive(session.state) // resumes where it was, `expectedPosition` covers the gap
  show('room')
  loadPlayer() // behind the name prompt, so the player loads while you type
  renderPeople()

  if (!session.name) session.name = await askName()
  // The click on "Join" counts as the autoplay gesture. Back from a refresh there's none,
  // so the overlay shows if autoplay gets refused.
  sync.start()
  save()
  autoPaste()
  connect()
}

/** Resolves with the name the user submits, remembered for next time. */
function askName() {
  $('name-modal').hidden = false
  $('join-title').textContent = creating ? 'Your room is ready 🎶' : "You're invited 🎶"
  const input = $('guest-name')
  input.value = rememberedName()
  input.focus()
  return new Promise((resolve) => {
    $('name-form').addEventListener('submit', function onSubmit(e) {
      e.preventDefault()
      const name = cleanName(input.value)
      if (!name) return
      $('name-form').removeEventListener('submit', onSubmit)
      $('name-modal').hidden = true
      rememberName(name)
      resolve(name)
    })
  })
}

async function connect() {
  try {
    await peers.connect(passphrase, {
      onUnreachable: (peerId) => {
        unreachable.add(peerId)
        showError('room-error', UNREACHABLE, 'unreachable')
      },
    })
  } catch (err) {
    showError('room-error', `Couldn't reach the relays (${err.message}). Check your connection and reload.`, 'relays')
  }
}

function endRoom(message) {
  peers.leave()
  sync.stop()
  setStatus('')
  $('ended-message').textContent = message
  show('ended')
}

// ---------- who comes and goes ----------

peers.onPeerJoin((peerId) => {
  unreachable.delete(peerId)
  if (!unreachable.size) clearError('room-error', 'unreachable')
  peers.send('hello', hello(), peerId)
  // The chat history waits for their hello: it says who they are, and whether they're new.
})

peers.onPeerLeave((peerId) => {
  const person = people.get(peerId)
  if (person) {
    leftWhileHere.add(person.from)
    addNotice(`${person.name} left`)
  }
  people.delete(peerId)
  renderPeople()
})

peers.on('hello', (msg, peerId) => {
  const first = !people.has(peerId) // hello is resent on every change
  const person = { name: cleanName(msg.name) || 'Friend', joinedAt: msg.joinedAt, pausedLocally: msg.pausedLocally, from: msg.from }
  people.set(peerId, person)
  renderPeople()
  if (isOverCap()) return endRoom(`The room is full: ${MAX_PEOPLE} people are already listening.`)
  if (!first) return
  // Not for those already here when we came, unless they left meanwhile (e.g. a refresh).
  if (person.joinedAt > session.joinedAt || leftWhileHere.has(person.from)) addNotice(`${person.name} joined`)
  offerHistory(peerId, person)
})

// So the others see the ⏸ next to your name.
onPausedLocallyChange(() => {
  peers.send('hello', hello())
  renderPeople()
})

$('copy-invite').addEventListener('click', (e) => copy(`${location.origin}${location.pathname}#room=${passphrase}`, e.currentTarget))

// ---------- layout ----------

function setChatMode(on) {
  views.room.classList.toggle('chat-mode', on)
  const toggle = $('toggle-layout')
  toggle.textContent = on ? '📺' : '💬'
  toggle.title = toggle.ariaLabel = on ? 'Focus on the video' : 'Focus on the chat'
  toggle.ariaPressed = String(on)
  localStorage.setItem(LAYOUT_KEY, on ? 'chat' : 'video')
}

$('toggle-layout').addEventListener('click', () => setChatMode(!views.room.classList.contains('chat-mode')))
setChatMode(localStorage.getItem(LAYOUT_KEY) === 'chat')

// ---------- boot ----------

addEventListener('pagehide', () => {
  save()
  peers.leave()
})

function hashRoom() {
  return new URLSearchParams(location.hash.slice(1)).get('room')
}

addEventListener('hashchange', () => {
  const phrase = parsePassphrase(hashRoom())
  if (!phrase || phrase === passphrase) return
  if (passphrase) return location.reload() // switching rooms: start from a clean page
  openRoom(phrase)
})

const phrase = parsePassphrase(hashRoom())
if (location.protocol === 'file:') {
  show('home')
  $('create-room').disabled = true
  showError('home-error', 'jukebox needs to be served over http(s). Run `npx serve` in this folder and open the URL it prints.')
} else if (phrase) {
  openRoom(phrase)
} else {
  show('home')
  if (hashRoom()) showError('home-error', 'This invite link is broken or too old. Ask for a new one.')
}
