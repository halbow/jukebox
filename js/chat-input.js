// The chat input: sending, editing your last message (↑), `:emoji:`, `/giphy` and `/chess` commands.

import { createChat, editChat } from './protocol.js'
import { addNotice, postChat } from './chat-log.js'
import { chessText, completesChessCommand, createGame, isChessCommand } from './chess.js'
import { $ } from './dom.js'
import { completedShortcodeAt, replaceShortcodes, shortcodeAt, suggest } from './emoji.js'
import { completesCommand, parseGiphyCommand } from './giphy.js'
import { closeGiphy, isGiphyOpen, runGiphyCommand } from './giphy-ui.js'
import { MAX_CHAT_LENGTH } from './limits.js'
import { session } from './session.js'
import { suggestionList } from './suggestions.js'

const input = $('chat-input')
input.maxLength = MAX_CHAT_LENGTH

let editing = null // the message of yours being edited, picked with ↑ in an empty input

const suggestions = suggestionList(input, $('emoji-suggestions'), {
  onPick: () => {
    fitChatInput()
    renderCommandHint()
  },
})

const GIPHY_SUGGESTION = { icon: '🎞️', label: '/giphy', detail: '[search] · send a GIF', insert: '/giphy ' }
const CHESS_SUGGESTION = { icon: '♟️', label: '/chess', detail: 'start a Lichess game for the room', insert: '/chess' }

$('chat-form').addEventListener('submit', (e) => {
  e.preventDefault()
  const command = !editing && parseGiphyCommand(input.value)
  if (command) {
    clearInput()
    renderCommandHint()
    return runGiphyCommand(command)
  }
  if (!editing && isChessCommand(input.value)) {
    clearInput()
    renderCommandHint()
    return startChess()
  }
  const text = replaceShortcodes(input.value.trim()).slice(0, MAX_CHAT_LENGTH)
  if (!text && !editing) return
  clearInput()
  const edited = editing
  stopEditing()
  if (edited && (!text || text === edited.text)) return // emptied or unchanged: nothing to edit
  postChat(edited ? editChat(edited, text) : createChat(text, { name: session.name, from: session.peerId }))
})

input.addEventListener('keydown', (e) => {
  if (e.isComposing || suggestions.keydown(e)) return // while the list shows, it has the arrows, Enter and Escape
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      // Shift + Enter: insert a line break
      e.preventDefault()
      const start = input.selectionStart
      const end = input.selectionEnd
      input.setRangeText('\n', start, end, 'end')
    } else {
      // Enter alone: send the message
      e.preventDefault()
      $('chat-form').requestSubmit()
    }
  } else if (e.key === 'ArrowUp' && !input.value) {
    e.preventDefault()
    startEditing()
  } else if (e.key === 'Escape' && editing) {
    clearInput()
    stopEditing()
  } else if (e.key === 'Escape' && isGiphyOpen()) {
    closeGiphy()
  }
})

input.addEventListener('input', () => {
  const done = completedShortcodeAt(input.value, input.selectionStart)
  if (done) input.setRangeText(done.emoji, done.start, done.end, 'end')
  fitChatInput()
  renderCommandHint()
  const { start, found } = suggestionsAt()
  suggestions.show(start, found)
})

// The width changes with the window and chat mode, and so does the wrapping.
new ResizeObserver(fitChatInput).observe(input)

function clearInput() {
  input.value = ''
  fitChatInput()
  suggestions.close()
}

// A message in a box that grows with it, so you see all of it while typing: Enter sends, Shift+Enter for newline.
// The form keeps its height while the box is measured: otherwise the chat log grows for that moment, which
// clamps its scroll, and Firefox reports that as you scrolling up off the bottom (see chat-log.js).
function fitChatInput() {
  const form = input.form
  form.style.minHeight = `${form.offsetHeight}px`
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight + input.offsetHeight - input.clientHeight}px` // plus the borders
  form.style.minHeight = ''
}

function flattenLines() {
  const flat = (text) => text.replace(/\r?\n|\r/g, ' ')
  const before = flat(input.value.slice(0, input.selectionStart))
  input.value = before + flat(input.value.slice(input.selectionStart))
  input.setSelectionRange(before.length, before.length)
}

async function startChess() {
  try {
    const chess = await createGame()
    postChat(createChat(chessText(chess.id), { name: session.name, from: session.peerId, chess }))
  } catch (err) {
    addNotice(err.message)
  }
}

function startEditing() {
  editing = session.chat.findLast((m) => m.from === session.peerId && !m.gif && !m.chess) // a GIF or a game can't be edited
  if (!editing) return
  input.value = editing.text
  fitChatInput()
  input.setSelectionRange(input.value.length, input.value.length)
  input.scrollTop = input.scrollHeight // show the end, where the caret is
  $('chat-form').classList.add('editing')
  $('chat-editing').hidden = false
  renderCommandHint()
}

function stopEditing() {
  editing = null
  $('chat-form').classList.remove('editing')
  $('chat-editing').hidden = true
}

/** What the list above the input offers: the commands while one starts, emoji while a `:shortcode` is typed. */
function suggestionsAt() {
  const commands = editing
    ? []
    : [completesCommand(input.value) && GIPHY_SUGGESTION, completesChessCommand(input.value) && CHESS_SUGGESTION].filter(Boolean)
  if (commands.length) return { start: 0, found: commands }
  const typing = shortcodeAt(input.value, input.selectionStart)
  const matches = typing ? suggest(typing.query) : []
  return { start: typing?.start, found: matches.map(({ name, emoji }) => ({ icon: emoji, label: `:${name}:`, insert: emoji + ' ' })) }
}

// While a `/giphy …` or `/chess` is typed, say it's a command and what Enter will do.
function renderCommandHint() {
  const command = !editing && parseGiphyCommand(input.value)
  const chess = !editing && isChessCommand(input.value)
  $('chat-form').classList.toggle('command', !!command || chess)
  $('chat-command').hidden = !command && !chess
  if (chess) $('chat-command').textContent = '/chess · Enter to start a Lichess game, the first two to join play'
  if (!command) return
  $('chat-command').textContent = command.key
    ? '/giphy · Enter to change your Giphy key'
    : command.query
      ? `/giphy · Enter to search Giphy for “${command.query}”`
      : '/giphy · type what you’re looking for'
}
