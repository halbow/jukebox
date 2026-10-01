// The room's "Up next" list, shared like the State: every change sends the whole list,
// and the newest `sentAt` wins (ties broken by peer id), so every peer converges.
//
// type Queue = { items: [{ id, videoId, addedBy /* name */, from /* peer id */ }], sentAt, from }

import { isVideoId } from './youtube.js'

export const MAX_QUEUE = 50
const MAX_NAME_LENGTH = 24

export const EMPTY_QUEUE = { items: [], sentAt: 0, from: '' }

function isItem(item) {
  return (
    typeof item?.id === 'string' &&
    item.id.length <= 16 &&
    isVideoId(item.videoId) &&
    typeof item.addedBy === 'string' &&
    item.addedBy.length <= MAX_NAME_LENGTH &&
    typeof item.from === 'string'
  )
}

export function isQueue(msg) {
  return (
    Array.isArray(msg?.items) &&
    msg.items.length <= MAX_QUEUE &&
    msg.items.every(isItem) &&
    Number.isFinite(msg.sentAt) &&
    typeof msg.from === 'string'
  )
}

/** Built from the id, like GIFs: peers never make the room load a URL. */
export function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
