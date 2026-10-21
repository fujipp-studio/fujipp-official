export interface SpotifyController {
  play(): void
  pause(): void
  destroy(): void
  addListener(event: 'ready' | 'playback_started', callback: () => void): void
}

interface SpotifyApi {
  createController(
    element: HTMLElement,
    options: { uri: string; width: string; height: number },
    callback: (controller: SpotifyController) => void,
  ): void
}

type SpotifyWindow = Window & { onSpotifyIframeApiReady?: (api: SpotifyApi) => void }
let apiPromise: Promise<SpotifyApi> | undefined

export function loadSpotifyPlayer(): Promise<SpotifyApi> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise<SpotifyApi>((resolve, reject) => {
    const target = window as SpotifyWindow
    const previous = target.onSpotifyIframeApiReady
    const script = document.createElement('script')
    const timeout = window.setTimeout(fail, 15000)

    function restore() {
      window.clearTimeout(timeout)
      target.onSpotifyIframeApiReady = previous
    }
    function fail() {
      restore()
      script.remove()
      apiPromise = undefined
      reject(new Error('Spotify player could not load'))
    }

    target.onSpotifyIframeApiReady = (api) => {
      restore()
      resolve(api)
      previous?.(api)
    }
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    script.onerror = fail
    document.head.append(script)
  })
  return apiPromise
}
