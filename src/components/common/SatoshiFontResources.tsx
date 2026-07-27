'use client'

import { preconnect } from 'react-dom'

const FONT_SHARE_API_ORIGIN = 'https://api.fontshare.com'
const FONT_SHARE_CDN_ORIGIN = 'https://cdn.fontshare.com'
const SATOSHI_VARIABLE_STYLESHEET =
  'https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap'

export default function SatoshiFontResources() {
  preconnect(FONT_SHARE_API_ORIGIN)
  preconnect(FONT_SHARE_CDN_ORIGIN, { crossOrigin: 'anonymous' })

  return (
    <link
      href={SATOSHI_VARIABLE_STYLESHEET}
      rel="stylesheet"
      precedence="satoshi"
    />
  )
}
