// The chat log: messages (`session.chat`, sorted by `sentAt`, replayed to late joiners, see history.js)
// and notices ("<name> joined", "… switched the theme"), which only show here.

import { chatKey, isNewerEdit, senderColor } from './chat.js'
import { $, el } from './dom.js'
import { gifStillUrl, gifUrl } from './giphy.js'
import { HISTORY_SIZE } from './limits.js'
import { isAway, notify } from './notify.js'
import { on, send } from './peers.js'
import { save, session } from './session.js'

let notices = [] // never replayed nor saved: [{ notice: true, text, sentAt }]

on('chat', receiveChat)

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
  send('chat', msg)
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
  if (session.chat.length > HISTORY_SIZE) session.chat = session.chat.slice(-HISTORY_SIZE)
  renderChat()
  save()
  // Not for your own, nor for the history replayed to you when you join.
  if (msg.from !== session.peerId && msg.sentAt > session.joinedAt && isAway()) notify()
}

export function renderChat() {
  const list = $('chat-log')
  const entries = [...session.chat, ...notices].sort((a, b) => a.sentAt - b.sentAt)
  list.replaceChildren(...entries.map((msg) => (msg.notice ? noticeItem(msg) : messageItem(msg))))
  list.scrollTop = list.scrollHeight
  $('chat-empty').hidden = entries.length > 0
}

function noticeItem({ text, sentAt }) {
  const time = new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return el('li', { className: 'notice', textContent: `${time}: ${text}` })
}

function messageItem(msg) {
  const mine = msg.from === session.peerId
  const li = el('li', { className: mine ? 'mine' : '' })
  const sender = el('b', { textContent: mine ? 'You' : msg.name || 'Friend' })
  if (!mine) sender.style.color = senderColor(msg.from)
  if (msg.gif) {
    // the search reads as the command it was, not as something said
    li.append(sender, el('small', { className: 'gif-query', textContent: `/giphy ${msg.text}` }), gifElement(msg.gif, msg.text))
  } else {
    li.append(sender, msg.text)
  }
  if (msg.editedAt) li.append(el('small', { textContent: '(edited)' }))
  return li
}

/** A GIF for the chat log or the /giphy preview: the still frame for reduced motion, a placeholder once it's gone. */
export function gifElement({ id, width, height }, alt) {
  const still = el('source', { srcset: gifStillUrl(id), media: '(prefers-reduced-motion: reduce)' })
  const img = el('img', { src: gifUrl(id), width, height, alt, loading: 'lazy' })
  const picture = el('picture', { className: 'gif' }, still, img)
  img.addEventListener('error', () => picture.replaceChildren(el('small', { textContent: 'GIF unavailable' })))
  return picture
}
