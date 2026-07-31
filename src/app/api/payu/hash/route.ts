import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { products } from '@/lib/products'
import { createPaymentToken, type PaymentKind } from '@/lib/payu'
import { RESERVATION_PRODUCT_INFO } from '@/lib/configurator/reservation'
import { isFeatureEnabled } from '@/lib/config/featureFlags'

const RESERVATION_AMOUNT = '499.00'
const MAX_ITEM_QUANTITY = 100
const MAX_CHECKOUT_ITEMS = 50

type CheckoutItem = {
  id?: unknown
  size?: unknown
  quantity?: unknown
}

function getCheckoutDetails(
  items: CheckoutItem[]
): { amount: string; productinfo: string } | null {
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_CHECKOUT_ITEMS) {
    return null
  }

  let subtotal = 0
  const descriptions: string[] = []
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
    descriptions.push(`${product.name} (${item.size}) x${quantity}`)
  }

  const shipping = subtotal >= 2000 ? 0 : 99
  return {
    amount: (subtotal + shipping).toFixed(2),
    productinfo: descriptions.join(', ').slice(0, 500),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { txnid, amount, productinfo, firstname, email, items } = body

    if (Array.isArray(items) && isFeatureEnabled('DURABLE_SAMPLE_CHECKOUT_ENABLED')) {
      return NextResponse.json(
        { error: 'Legacy sample checkout is disabled. Submit a durable sample order instead.' },
        { status: 410 },
      )
    }

    if (
      typeof txnid !== 'string' ||
      typeof amount !== 'string' ||
      typeof productinfo !== 'string' ||
      typeof firstname !== 'string' ||
      typeof email !== 'string' ||
      !txnid ||
      !amount ||
      !productinfo.trim() ||
      !firstname.trim() ||
      !email.trim()
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (
      txnid.length > 64 ||
      productinfo.length > 500 ||
      firstname.length > 60 ||
      email.length > 254 ||
      firstname.includes('|') ||
      productinfo.includes('|')
    ) {
      return NextResponse.json({ error: 'Invalid payment details' }, { status: 400 })
    }

    const checkout = Array.isArray(items) ? getCheckoutDetails(items) : null
    const kind: PaymentKind = checkout ? 'sample-cart' : 'configurator'
    const verifiedAmount = checkout?.amount ?? (
      !Array.isArray(items) && amount === RESERVATION_AMOUNT ? RESERVATION_AMOUNT : null
    )
    const verifiedProductInfo = checkout?.productinfo ?? RESERVATION_PRODUCT_INFO

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

    const udf1 = createPaymentToken(txnid, verifiedAmount, kind)
    if (!udf1) {
      return NextResponse.json(
        { error: 'Payment signing is not configured' },
        { status: 503 }
      )
    }

    const key = process.env.PAYU_MERCHANT_KEY
    const salt = process.env.PAYU_SALT

    if (!key || !salt) {
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          mockPayment: true,
          amount: verifiedAmount,
          txnid,
          productinfo: verifiedProductInfo,
          udf1,
        })
      }
      return NextResponse.json(
        { error: 'PayU is not configured. Add PAYU_MERCHANT_KEY and PAYU_SALT.' },
        { status: 503 }
      )
    }

    const hashString = [
      key,
      txnid,
      verifiedAmount,
      verifiedProductInfo,
      firstname.trim(),
      email.trim(),
      udf1,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      salt,
    ].join('|')
    const hash = crypto.createHash('sha512').update(hashString).digest('hex')

    return NextResponse.json({
      hash,
      key,
      amount: verifiedAmount,
      productinfo: verifiedProductInfo,
      udf1,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
