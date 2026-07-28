import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Custom Order Checkout',
  robots: { index: false, follow: false, nocache: true },
}

export default function ConfiguratorCartLayout({ children }: { children: React.ReactNode }) {
  return children
}
