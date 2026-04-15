import { useState, useEffect } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

function getBreakpoint(width: number): Breakpoint {
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    getBreakpoint(window.innerWidth)
  )

  useEffect(() => {
    const mql640  = window.matchMedia('(max-width: 639px)')
    const mql1024 = window.matchMedia('(max-width: 1023px)')

    const update = () => setBreakpoint(getBreakpoint(window.innerWidth))

    mql640.addEventListener('change', update)
    mql1024.addEventListener('change', update)
    return () => {
      mql640.removeEventListener('change', update)
      mql1024.removeEventListener('change', update)
    }
  }, [])

  return {
    breakpoint,
    isMobile:  breakpoint === 'mobile',
    isTablet:  breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  }
}
