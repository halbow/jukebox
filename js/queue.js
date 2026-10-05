// The room's "Up next" list, shared like the State: every change sends the whole list,
// and the newest `sentAt` wins (ties broken by peer id), so every peer converges.
//
// The Queue itself is in protocol.js.

export const EMPTY_QUEUE = { items: [], sentAt: 0, from: '' }

/** Built from the id, like GIFs: peers never make the room load a URL. */
export function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
