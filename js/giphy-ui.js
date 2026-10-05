// The `/giphy` preview between the chat log and the input: only you see it, until you send the GIF.
// It's never in the chat log, never saved, never sent. The API side is in giphy.js.

import { createChat } from './chat.js'
import { gifElement, postChat } from './chat-log.js'
import { $, actionsRow, button, el, errorLine, hint } from './dom.js'
import { KEY_HELP_URL, checkKey, loadKey, saveKey, searchGifs } from './giphy.js'
import { MAX_CHAT_LENGTH } from './limits.js'
import { session } from './session.js'

// { query?, results?, index?, loading?, error?, askKey? }, or null when closed
let giphy = null
let giphyRun = 0 // bumped by every search, key check or close, so a late answer can't reopen the preview

/** Runs a parsed `/giphy` command, see `parseGiphyCommand`. */
export function runGiphyCommand(command) {
  if (command.key) askGiphyKey()
  else if (!command.query) showGiphy({ error: "Say what you're looking for, e.g. /giphy dancing cat" })
  else searchGiphy(command.query)
}

export function isGiphyOpen() {
  return giphy !== null
}

export function closeGiphy() {
  giphyRun++
  showGiphy(null)
}

function showGiphy(preview) {
  giphy = preview
  renderGiphy()
}

function renderGiphy() {
  const box = $('giphy-preview')
  box.hidden = !giphy
  if (!giphy) return box.replaceChildren()
  const { query, results, index, loading, error, askKey } = giphy
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
      el('small', { className: 'powered', textContent: 'Powered by GIPHY' }),
    ),
  )
}

function keyForm() {
  const link = el('a', { href: KEY_HELP_URL, target: '_blank', rel: 'noopener', textContent: 'Get a free one' })
  const intro = el('p', { className: 'hint' }, '/giphy needs your own Giphy API key, it stays in this browser. ', link, ' (Create an App → API).')
  const input = el('input', { type: 'text', placeholder: 'Giphy API key', value: loadKey(), autocomplete: 'off', spellcheck: false })
  input.addEventListener('keydown', (e) => e.key === 'Escape' && closeGiphy())
  const form = el('form', { className: 'actions' }, input, el('button', { className: 'btn small primary', textContent: 'Save' }))
  const removeKey = () => {
    saveKey('')
    closeGiphy()
  }
  if (loadKey()) form.append(button('Remove', removeKey))
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
  postChat(createChat(query.slice(0, MAX_CHAT_LENGTH), { name: session.name, from: session.peerId, gif: results[index] }))
  $('chat-input').focus()
}
