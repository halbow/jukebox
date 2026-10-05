// The room's "Up next" list, shared like the State: every change sends the whole list,
// and the newest `sentAt` wins (ties broken by peer id), so every peer converges.
//
// type Queue = { items: [{ id, videoId, addedBy /* name */, from /* peer id */ }], sentAt, from }

import { MAX_QUEUE, isId, isName, isTime } from './limits.js'
import { isVideoId } from './youtube.js'

export const EMPTY_QUEUE = { items: [], sentAt: 0, from: '' }

function isItem(item) {
  return (
    isId(item?.id) &&
    isVideoId(item.videoId) &&
    isName(item.addedBy) &&
    isId(item.from)
  )
}

export function isQueue(msg) {
  return (
    Array.isArray(msg?.items) &&
    msg.items.length <= MAX_QUEUE &&
    msg.items.every(isItem) &&
    isTime(msg.sentAt) &&
    isId(msg.from)
  )
}

/** Built from the id, like GIFs: peers never make the room load a URL. */
export function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}
