import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { products } from '@/lib/products'

const RESERVATION_AMOUNT = '499.00'
const MAX_ITEM_QUANTITY = 100

type CheckoutItem = {
  id?: unknown
  size?: unknown
  quantity?: unknown
}

function getCheckoutAmount(items: CheckoutItem[]): string | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return null

  let subtotal = 0
  for (const item of items) {
    const product = products.find(candidate => candidate.id === item.id)
    const quantity = Number(item.quantity)
    if (
      !product ||
      typeof item.size !== 'string' ||
      !product.sizes.includes(item.size) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_ITEM_QUANTITY
    ) {
      return null
    }
    subtotal += product.price * quantity
  }

  const shipping = subtotal >= 2000 ? 0 : 99
  return (subtotal + shipping).toFixed(2)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { txnid, amount, productinfo, firstname, email, items } = body

    // Validate inputs
    if (!txnid || !amount || !productinfo || !firstname || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const verifiedAmount = Array.isArray(items)
      ? getCheckoutAmount(items)
      : amount === RESERVATION_AMOUNT
        ? RESERVATION_AMOUNT
        : null

    if (!verifiedAmount || amount !== verifiedAmount) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    // Sanitize txnid — only alphanumeric
    if (!/^[a-zA-Z0-9]+$/.test(txnid)) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }

    const key = process.env.PAYU_MERCHANT_KEY
    const salt = process.env.PAYU_SALT

    if (!key || !salt) {
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          mockPayment: true,
          amount: verifiedAmount,
          txnid,
        })
      }
      return NextResponse.json(
        { error: 'PayU is not configured. Add PAYU_MERCHANT_KEY and PAYU_SALT.' },
        { status: 503 }
      )
    }

    const hashString = `${key}|${txnid}|${verifiedAmount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`
    const hash = crypto.createHash('sha512').update(hashString).digest('hex')

    return NextResponse.json({ hash, key, amount: verifiedAmount })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
