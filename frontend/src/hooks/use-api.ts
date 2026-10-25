import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Loads data on mount (and when `key` changes). With `poll`, it refreshes every
 * `poll` ms while the tab is visible — used for live scores.
 */
export function useApi<T>(load: () => Promise<T>, key: string, { poll }: { poll?: number } = {}) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  loadRef.current = load

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current())
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void reload()
  }, [key, reload])

  useEffect(() => {
    if (!poll) return
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void reload()
    }, poll)
    return () => clearInterval(timer)
  }, [poll, reload, key])

  return { data, error, loading, reload, setData }
}
