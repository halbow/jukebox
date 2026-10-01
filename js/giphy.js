// Slack-style `/giphy <query>` for the chat. Only searching needs a Giphy API key, and each user brings
// their own (no backend to hide a shared one): it stays in `localStorage` and never goes to peers.
//
// Peers only ever get a Giphy id, and build the image URL from it, so nobody can make the room load
// an arbitrary URL. type Gif = { id, width, height }

const API = 'https://api.giphy.com/v1/gifs'
const KEY_KEY = 'jukebox:giphy-key'
const RESULTS = 25 // what Shuffle picks from, one API call per search
const MAX_SIZE = 1000 // px; the 200px-high rendition is far below

export const KEY_HELP_URL = 'https://developers.giphy.com/dashboard/'

export function isGif(gif) {
  return (
    typeof gif?.id === 'string' &&
    /^[A-Za-z0-9]{1,64}$/.test(gif.id) &&
    [gif.width, gif.height].every((size) => Number.isInteger(size) && size > 0 && size <= MAX_SIZE)
  )
}

export const gifUrl = (id) => `https://media.giphy.com/media/${id}/200.webp`
export const gifStillUrl = (id) => `https://media.giphy.com/media/${id}/200_s.gif`

/** `/giphy cats` → { query: 'cats' }, `/giphy key` → { key: true }, `/giphy` → { query: '' }, anything else → null. */
export function parseGiphyCommand(text) {
  const match = /^\/giphy(?:\s+(.*))?$/is.exec(text.trim())
  if (!match) return null
  const query = (match[1] ?? '').trim()
  return query.toLowerCase() === 'key' ? { key: true } : { query }
}

/** Typing `/`, `/gi`… (no space yet) offers the command, like `:` offers emoji. */
export function completesCommand(text) {
  return /^\/\w*$/.test(text) && '/giphy'.startsWith(text.toLowerCase())
}

export function loadKey() {
  return localStorage.getItem(KEY_KEY) ?? ''
}

export function saveKey(key) {
  if (key) localStorage.setItem(KEY_KEY, key)
  else localStorage.removeItem(KEY_KEY)
}

export class GiphyError extends Error {
  constructor(message, { badKey = false } = {}) {
    super(message)
    this.badKey = badKey
  }
}

async function call(path, params) {
  let res
  try {
    res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`)
  } catch {
    throw new GiphyError("Couldn't reach Giphy. Check your connection.")
  }
  if (res.status === 401 || res.status === 403) throw new GiphyError('Giphy refused this key.', { badKey: true })
  if (res.status === 429) throw new GiphyError('Too many searches for this key, try again in a while.')
  if (!res.ok) throw new GiphyError(`Giphy is having trouble (${res.status}).`)
  return (await res.json()).data
}

/** Resolves with up to RESULTS GIFs for `query`, as `Gif`s. */
export async function searchGifs(apiKey, query) {
  const data = await call('search', { api_key: apiKey, q: query, limit: RESULTS, rating: 'pg-13' })
  return data
    .map(({ id, images }) => ({ id, width: Number(images?.fixed_height?.width), height: Number(images?.fixed_height?.height) }))
    .filter(isGif)
}

/** Rejects with a `GiphyError` if the key doesn't work. */
export async function checkKey(apiKey) {
  await call('trending', { api_key: apiKey, limit: 1 })
}
