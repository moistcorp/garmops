'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCartStore } from '@/lib/store'

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const isMockPayment = searchParams.get('mock') === '1'
  const hasSent = useRef(false)
  const clearCart = useCartStore(state => state.clearCart)
  const [orderSummary, setOrderSummary] = useState({ name: '', email: '', txnid: '' })

  useEffect(() => {
    if (hasSent.current) return
    hasSent.current = true

    // Send confirmation email now that payment is confirmed
    try {
      const raw = localStorage.getItem('mf_pending_order')
      if (raw) {
        const order = JSON.parse(raw)
        const summary = {
          name: order.name ?? '',
          email: order.email ?? '',
          txnid: order.txnid ?? searchParams.get('txnid') ?? '',
        }
        queueMicrotask(() => setOrderSummary(summary))
        if (order.kind === 'sample-cart') {
          clearCart()
          localStorage.removeItem('mf_pending_order')
          return
        }
        if (order.mockPayment) {
          localStorage.removeItem('mf_pending_order')
          return
        }
        fetch('/api/send-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: order.name,
            email: order.email,
            type: 'configure',
            orderDetails: {
              product: order.product,
              color: order.color,
              technique: order.technique,
              placements: order.placements,
              neckLabel: order.neckLabel,
              totalQty: order.totalQty,
              sizeBreakdown: order.sizeBreakdown,
              estimatedTotal: order.estimatedTotal,
              shippingAddress: order.shipping
                ? `${order.shipping.addressLine1}, ${order.shipping.city}, ${order.shipping.state} ${order.shipping.pincode}`
                : '',
            },
          }),
        })
          .then(() => {
            // Clear pending order and configurator progress
            localStorage.removeItem('mf_pending_order')
            localStorage.removeItem('mf_configurator_v2')
            sessionStorage.removeItem('mf_configurator_v2')
          })
          .catch(err => console.error('Email send failed:', err))
      }
    } catch (err) {
      console.error('Could not retrieve order from storage:', err)
    }
    const fallbackTxnid = searchParams.get('txnid') ?? ''
    if (fallbackTxnid) {
      queueMicrotask(() => setOrderSummary(summary => ({
        ...summary,
        txnid: summary.txnid || fallbackTxnid,
      })))
    }
  }, [clearCart, searchParams])

  const { name, email, txnid } = orderSummary

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-[var(--color-teal)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="stroke-[var(--color-teal)]" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-[#111111] mb-3 tracking-tight">
          {isMockPayment ? 'Reservation flow complete' : 'Payment successful'}
        </h1>
        {isMockPayment && (
          <p className="mb-4 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">
            Development preview — no payment was charged.
          </p>
        )}
        <p className="text-[#111111]/60 mb-2 text-sm">
          {name ? `Thanks ${name.split(' ')[0]}!` : 'Thank you!'} Your production slot has been reserved.
        </p>

        {email && (
          <p className="text-sm mb-1">
            Confirmation sent to <span className="font-medium text-[#111111]">{email}</span>
          </p>
        )}

        {txnid && (
          <p className="text-xs text-[#111111]/40 mt-2 mb-6">
            Transaction ID: <span className="font-mono">{txnid}</span>
          </p>
        )}

        <div className="bg-[var(--color-cream)] border border-[#ECE7DF] rounded-2xl p-5 text-xs text-left text-[#111111]/60 leading-relaxed mb-8">
          <p className="font-medium text-[#111111] mb-2">What happens next</p>
          <ul className="flex flex-col gap-1.5">
            <li>· Our team will review your order and send a proforma invoice within 24 hours</li>
            <li>· The ₹499 reservation fee will be deducted from your final invoice</li>
            <li>· Production begins after balance payment is received</li>
          </ul>
        </div>

        <Link
          href="/"
          className="inline-block bg-[var(--color-teal)] text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors"
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
