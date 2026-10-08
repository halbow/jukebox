// The chat log: messages (`session.chat`, sorted by `sentAt`, replayed to late joiners, see history.js)
// and notices ("<name> joined", "… switched the theme"), which only show here. Messages carry their reactions
// (`session.reactions`, see reactions.js) as pills underneath, Slack style, and the emoji picker opens below them.

import { chatKey, isNewerEdit, senderColor } from './chat.js'
import { $, el } from './dom.js'
import { addChessJoin, playersOf } from './chess.js'
import { chessCard } from './chess-ui.js'
import { gifStillUrl, gifUrl } from './giphy.js'
import { HISTORY_SIZE } from './limits.js'
import { isAway, notify } from './notify.js'
import { createChessJoin, createReaction, onChat, onChessJoin, onReaction, sendChat, sendChessJoin, sendReaction } from './protocol.js'
import { reactionPickerFor, toggleReactionPicker } from './reaction-picker.js'
import { addReaction, findReaction, reactionsOn } from './reactions.js'
import { save, session } from './session.js'

let notices = [] // never replayed nor saved: [{ notice: true, text, sentAt }]

onChat(receiveChat)
onReaction(receiveReaction)
onChessJoin(receiveChessJoin)

// Read to the end unless you scrolled up, and kept there when the log shrinks (the input growing, the window resizing).
let atBottom = true
const log = $('chat-log')
log.addEventListener('scroll', () => {
  atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 2
})
new ResizeObserver(() => {
  if (atBottom) log.scrollTop = log.scrollHeight
}).observe(log)

/** A message of yours, new or edited: shown here and sent to everyone. */
export function postChat(msg) {
  receiveChat(msg)
  sendChat(msg)
}

export function addNotice(text) {
  notices.push({ notice: true, text, sentAt: Date.now() })
  renderChat()
}

function receiveChat(msg) {
  const key = chatKey(msg)
  const i = session.chat.findIndex((m) => chatKey(m) === key)
  if (i >= 0) {
    // History replays overlap; only a newer edit gets through, and it only changes the text.
    if (!isNewerEdit(msg, session.chat[i])) return
    session.chat[i] = { ...session.chat[i], text: msg.text, editedAt: msg.editedAt }
    renderChat()
    return save()
  }
  session.chat.push(msg)
  session.chat.sort((a, b) => a.sentAt - b.sentAt)
  if (session.chat.length > HISTORY_SIZE) {
    const dropped = new Set(session.chat.slice(0, -HISTORY_SIZE).map(chatKey))
    session.chat = session.chat.slice(-HISTORY_SIZE)
    session.reactions = session.reactions.filter((r) => !dropped.has(r.key))
    session.chessJoins = session.chessJoins.filter((j) => !dropped.has(j.key))
  }
  renderChat()
  save()
  // Not for your own, nor for the history replayed to you when you join.
  if (msg.from !== session.peerId && msg.sentAt > session.joinedAt && isAway()) notify()
}

/** Puts your reaction with `emoji` on the message `key`, or takes it off, and tells everyone. */
export function toggleReaction(key, emoji) {
  const mine = findReaction(session.reactions, { key, emoji, from: session.peerId })
  const reaction = createReaction(key, emoji, !mine?.on, { name: session.name, from: session.peerId })
  receiveReaction(reaction)
  sendReaction(reaction)
}

// Kept even before its message arrives (the history replays both, in no set order).
function receiveReaction(reaction) {
  const reactions = addReaction(session.reactions, reaction)
  if (!reactions) return
  session.reactions = reactions
  renderChat({ follow: false })
  save()
}

/** You clicked Join on the game posted as message `key`: tells everyone, so they see who's playing. */
function joinChess(key) {
  const join = createChessJoin(key, { name: session.name, from: session.peerId })
  receiveChessJoin(join)
  sendChessJoin(join)
}

// Like reactions, kept even before its message arrives.
function receiveChessJoin(join) {
  const joins = addChessJoin(session.chessJoins, join)
  if (!joins) return
  session.chessJoins = joins
  renderChat({ follow: false })
  save()
}

/** `follow: false` keeps the log where you scrolled it, for changes to older messages. */
export function renderChat({ follow = true } = {}) {
  const list = $('chat-log')
  const scrolled = list.scrollTop
  const focused = document.activeElement
  const entries = [...session.chat, ...notices].sort((a, b) => a.sentAt - b.sentAt)
  list.replaceChildren(...entries.map((msg) => (msg.notice ? noticeItem(msg) : messageItem(msg))))
  list.scrollTop = follow || atBottom ? list.scrollHeight : scrolled
  // the reaction picker moved to the new list, which takes the focus out of its search
  if (focused !== document.activeElement && list.contains(focused)) focused.focus({ preventScroll: true })
  $('chat-empty').hidden = entries.length > 0
}

function noticeItem({ text, sentAt }) {
  const time = new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return el('li', { className: 'notice', textContent: `${time}: ${text}` })
}

function messageItem(msg) {
  const key = chatKey(msg)
  const mine = msg.from === session.peerId
  const li = el('li', { className: mine ? 'mine' : '' })
  const sender = el('b', { textContent: mine ? 'You' : msg.name || 'Friend' })
  if (!mine) sender.style.color = senderColor(msg.from)
  if (msg.gif) {
    // the search reads as the command it was, not as something said
    li.append(sender, el('small', { className: 'gif-query', textContent: `/giphy ${msg.text}` }), gifElement(msg.gif, msg.text))
  } else if (msg.chess) {
    li.append(
      sender,
      el('small', { className: 'gif-query', textContent: '/chess' }),
      chessCard(msg.chess, playersOf(session.chessJoins, key), session.peerId, () => joinChess(key)),
    )
  } else {
    li.append(sender, msg.text)
  }
  if (msg.editedAt) li.append(el('small', { textContent: '(edited)' }))
  const openPicker = () => {
    toggleReactionPicker(msg, (emoji) => toggleReaction(key, emoji))
    renderChat({ follow: false })
  }
  li.append(addReactionButton('icon-btn react', openPicker))
  const pills = reactionsOn(session.reactions, key, session.peerId)
  if (pills.length) {
    const row = el('div', { className: 'reactions' }, ...pills.map((pill) => reactionPill(key, pill)))
    row.append(addReactionButton('reaction add-reaction', openPicker))
    li.append(row)
  }
  const picker = reactionPickerFor(key)
  if (picker) li.append(picker)
  return li
}

// Slack's smiley with a plus, in the text color so every theme tints it.
const SMILEY_PLUS =
  '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M17 9.5A7.5 7.5 0 1 1 10.5 2.6"/><path d="M7 12.2c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5"/>' +
  '<circle cx="7.3" cy="8" r=".6" fill="currentColor"/><circle cx="12.7" cy="8" r=".6" fill="currentColor"/>' +
  '<path d="M16 1.5v5M13.5 4h5"/></svg>'

function addReactionButton(className, onClick) {
  const node = el('button', { type: 'button', className, title: 'Add a reaction', ariaLabel: 'Add a reaction', innerHTML: SMILEY_PLUS })
  node.addEventListener('click', onClick)
  return node
}

function reactionPill(key, { emoji, names, mine }) {
  const pill = el('button', { type: 'button', className: 'reaction', title: names.join(', '), ariaPressed: String(mine) })
  pill.append(emoji, el('span', { textContent: names.length }))
  pill.addEventListener('click', () => toggleReaction(key, emoji))
  return pill
}

/** A GIF for the chat log or the /giphy preview: the still frame for reduced motion, a placeholder once it's gone. */
export function gifElement({ id, width, height }, alt) {
  const still = el('source', { srcset: gifStillUrl(id), media: '(prefers-reduced-motion: reduce)' })
  const img = el('img', { src: gifUrl(id), width, height, alt, loading: 'lazy' })
  const picture = el('picture', { className: 'gif' }, still, img)
  img.addEventListener('error', () => picture.replaceChildren(el('small', { textContent: 'GIF unavailable' })))
  return picture
}
