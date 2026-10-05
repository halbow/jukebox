// Small DOM helpers shared by the UI modules.

export const $ = (id) => document.getElementById(id)

/** `el('p', { className: 'hint' }, 'Hi ', link)`: an element with its properties set and its children appended. */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

export function button(label, onClick, className = 'btn small') {
  const node = el('button', { type: 'button', className, textContent: label })
  node.addEventListener('click', onClick)
  return node
}

/** A row of buttons (and the odd input or credit) under a prompt. */
export function actionsRow(...children) {
  return el('div', { className: 'actions' }, ...children)
}

export const hint = (text) => el('p', { className: 'hint', textContent: text })
export const errorLine = (text) => el('p', { className: 'error', textContent: text })

// Error line id → what its message is about, so clearing one kind of error never hides another.
const errorTopics = new Map()

/** Shows `message` in the error line `id`, hides it if empty. `topic` names what it's about, for `clearError`. */
export function showError(id, message, topic = null) {
  $(id).textContent = message
  $(id).hidden = !message
  errorTopics.set(id, message ? topic : null)
}

/** Hides the error line `id`, or only if it's showing an error about `topic`. */
export function clearError(id, topic) {
  if (topic === undefined || errorTopics.get(id) === topic) showError(id, '')
}

/** The connection pill in the top bar. */
export function setStatus(text, tone) {
  const pill = $('status')
  pill.hidden = !text
  pill.textContent = text
  pill.dataset.tone = tone
}

/** A ✓ on the button for a moment. */
export function flash(button) {
  const label = button.textContent
  button.textContent = '✓'
  setTimeout(() => (button.textContent = label), 1500)
}

export async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API needs a secure context; plain http on a LAN IP falls back to execCommand.
    const area = el('textarea', { value: text })
    document.body.append(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  flash(button)
}
