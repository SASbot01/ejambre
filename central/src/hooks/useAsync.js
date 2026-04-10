import { useState, useEffect, useCallback } from 'react'

export function useAsync(asyncFn, defaultValue = null) {
  const [data, setData] = useState(defaultValue)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const result = await asyncFn()
      setData(result)
    } catch (err) {
      console.error('useAsync error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return [data, loading, refresh, setData]
}
