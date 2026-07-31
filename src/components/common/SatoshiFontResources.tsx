'use client'

import { preconnect } from 'react-dom'

const FONT_SHARE_API_ORIGIN = 'https://api.fontshare.com'
const FONT_SHARE_CDN_ORIGIN = 'https://cdn.fontshare.com'
const GOOGLE_FONTS_ORIGIN = 'https://fonts.googleapis.com'
const GOOGLE_FONTS_CDN_ORIGIN = 'https://fonts.gstatic.com'
const IBM_PLEX_MONO_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap'

export default function SatoshiFontResources() {
  preconnect(FONT_SHARE_API_ORIGIN)
  preconnect(FONT_SHARE_CDN_ORIGIN, { crossOrigin: 'anonymous' })
  preconnect(GOOGLE_FONTS_ORIGIN)
  preconnect(GOOGLE_FONTS_CDN_ORIGIN, { crossOrigin: 'anonymous' })

  return (
    <link
      href={IBM_PLEX_MONO_STYLESHEET}
      rel="stylesheet"
      precedence="ibm-plex-mono"
    />
  )
}
