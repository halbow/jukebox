// YouTube IFrame Player API helpers.

export const PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }

const VIDEO_ID = /^[\w-]{11}$/

let api

function loadApi() {
  api ??= new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => reject(new Error('Could not load the YouTube player'))
    document.head.append(script)
  })
  return api
}

export async function createPlayer(elementId, { onStateChange }) {
  const YT = await loadApi()
  return new Promise((resolve) => {
    new YT.Player(elementId, {
      width: '100%',
      height: '100%',
      playerVars: { playsinline: 1, rel: 0, origin: location.origin },
      events: {
        onReady: (e) => resolve(e.target),
        onStateChange: (e) => onStateChange(e.data),
      },
    })
  })
}

export function currentVideoId(player) {
  return player.getVideoData?.()?.video_id || null
}

/** Accepts a raw id or any common YouTube URL shape (watch, youtu.be, shorts, embed, live). */
export function parseVideoId(input) {
  const text = input.trim()
  if (VIDEO_ID.test(text)) return text

  let url
  try {
    url = new URL(text.includes('://') ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id = null
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1]
  }
  return id && VIDEO_ID.test(id) ? id : null
}

export function isVideoId(value) {
  return typeof value === 'string' && VIDEO_ID.test(value)
}
