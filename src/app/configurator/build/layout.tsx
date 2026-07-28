import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Apparel Project',
  robots: { index: false, follow: false, nocache: true },
}

export default function ConfiguratorBuildLayout({ children }: { children: React.ReactNode }) {
  return children
}
