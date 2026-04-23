import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false)

  React.useEffect(() => {
    let mounted = true;
    
    const checkIsMobile = () => {
      if (mounted) setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", checkIsMobile)
    
    // Avoid synchronous setState during render by deferring
    requestAnimationFrame(checkIsMobile);
    
    return () => {
        mounted = false;
        mql.removeEventListener("change", checkIsMobile);
    }
  }, [])

  return isMobile
}
