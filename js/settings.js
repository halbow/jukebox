// The settings modal (⚙️ in the top bar): your name, the room's theme, chat mode, the message sound, the debug log,
// your Giphy key.
// All but the theme are yours and stay in `localStorage`; the theme is the room's (see theme.js).

import { addNotice } from './chat-log.js'
import { debugOn, setDebug } from './debug.js'
import { $, clearError, flash, showError } from './dom.js'
import { KEY_HELP_URL, checkKey, loadKey, saveKey } from './giphy.js'
import { MAX_NAME_LENGTH, cleanName } from './limits.js'
import { setSound, soundOn } from './notify.js'
import { connectedAt, send, shareNewest } from './peers.js'
import { hello } from './people.js'
import { save, session } from './session.js'
import { THEMES, applyTheme } from './theme.js'

const NAME_KEY = 'jukebox:name'
const LAYOUT_KEY = 'jukebox:layout' // 'chat' when the chat is in focus, the video otherwise
const DEBUG_KEY = 'jukebox:debug' // 'on' while the debug log is

$('settings-name-input').maxLength = MAX_NAME_LENGTH
$('settings-giphy-help').href = KEY_HELP_URL

function openSettings() {
  $('settings-name-input').value = session.name
  $('settings-theme').value = session.theme.id
  $('settings-chat-mode').checked = $('view-room').classList.contains('chat-mode')
  $('settings-sound').checked = soundOn()
  $('settings-debug').checked = debugOn()
  $('settings-giphy-input').value = loadKey()
  $('settings-giphy-remove').hidden = !loadKey()
  clearError('settings-error')
  $('settings-modal').hidden = false
}

function closeSettings() {
  $('settings-modal').hidden = true
}

$('open-settings').addEventListener('click', openSettings)
$('close-settings').addEventListener('click', closeSettings)
$('settings-modal').addEventListener('click', (e) => e.target === e.currentTarget && closeSettings())
$('settings-modal').addEventListener('keydown', (e) => e.key === 'Escape' && closeSettings())

// ---------- name ----------

/** The name you used last, in any room: the name prompt starts with it. */
export function rememberedName() {
  return localStorage.getItem(NAME_KEY) ?? ''
}

export function rememberName(name) {
  localStorage.setItem(NAME_KEY, name)
}

$('settings-name').addEventListener('submit', (e) => {
  e.preventDefault()
  const name = cleanName($('settings-name-input').value)
  if (!name) return
  session.name = name
  rememberName(name)
  save()
  send('hello', hello()) // the others' people lists pick it up; past messages keep the old name
  flash(e.submitter)
})

// ---------- theme ----------

$('settings-theme').append(...Object.entries(THEMES).map(([id, name]) => new Option(name, id)))
$('settings-theme').addEventListener('change', (e) => setTheme(e.target.value))

shareNewest('theme', {
  current: () => session.theme,
  accept: (msg) => {
    // Only a change made while we're here gets a line, not the room's theme handed to us on arrival.
    if (msg.sentAt > connectedAt && msg.id !== session.theme.id) addNotice(`${cleanName(msg.by) || 'Someone'} switched the theme to ${THEMES[msg.id]}`)
    receiveTheme(msg)
  },
})

function setTheme(id) {
  if (id === session.theme.id) return
  receiveTheme({ id, by: session.name, sentAt: Date.now(), from: session.peerId })
  send('theme', session.theme)
  addNotice(`You switched the theme to ${THEMES[id]}`)
}

function receiveTheme(msg) {
  session.theme = msg
  applyTheme(msg.id)
  $('settings-theme').value = msg.id
  save()
}

// ---------- chat mode ----------

function setChatMode(on) {
  $('view-room').classList.toggle('chat-mode', on)
  localStorage.setItem(LAYOUT_KEY, on ? 'chat' : 'video')
}

$('settings-chat-mode').addEventListener('change', (e) => setChatMode(e.target.checked))
setChatMode(localStorage.getItem(LAYOUT_KEY) === 'chat')

// ---------- sound ----------

$('settings-sound').addEventListener('change', (e) => setSound(e.target.checked))

// ---------- debug log ----------

function setDebugLog(on) {
  setDebug(on)
  localStorage.setItem(DEBUG_KEY, on ? 'on' : 'off')
}

$('settings-debug').addEventListener('change', (e) => setDebugLog(e.target.checked))
setDebug(localStorage.getItem(DEBUG_KEY) === 'on')

// ---------- Giphy key ----------

$('settings-giphy').addEventListener('submit', async (e) => {
  e.preventDefault()
  const key = $('settings-giphy-input').value.trim()
  if (!key) return
  clearError('settings-error')
  try {
    await checkKey(key)
  } catch (err) {
    return showError('settings-error', err.message)
  }
  saveKey(key)
  $('settings-giphy-remove').hidden = false
  flash(e.submitter)
})

$('settings-giphy-remove').addEventListener('click', () => {
  saveKey('')
  $('settings-giphy-input').value = ''
  $('settings-giphy-remove').hidden = true
})
