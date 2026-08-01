import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'
import {
  PAYMENT_RESULT_COOKIE,
  decodePaymentResultCookie,
  type PaymentKind,
} from '@/lib/payu'
import {
  buildPaymentFailureEmail,
  buildPaymentSuccessEmail,
} from '@/lib/email/paymentTemplates'
import { consumeAuthRateLimit, requestIpAddress } from '@/lib/auth/rateLimit'
import { verifyTurnstile } from '@/lib/auth/turnstile'
import { isFeatureEnabled } from '@/lib/config/featureFlags'
import { getServerEnvironment } from '@/lib/config/env'
import { readBoundedBody, RequestBodyError } from '@/lib/http/requestBody'

type EmailType = 'contact' | 'configure' | 'sample'
type PaymentStatus = 'success' | 'failure'
type JsonObject = Record<string, unknown>

export const runtime = 'nodejs'

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
const ALLOWED_ATTACHMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png'])
const MAX_JSON_BYTES = 64 * 1024
const MAX_MULTIPART_BYTES = MAX_ATTACHMENT_BYTES + 256 * 1024

type EmailAttachment = {
  filename: string
  content: string
}

type ParsedRequest =
  | { ok: true; body: JsonObject; attachment?: EmailAttachment }
  | { ok: false; error: string; status: number }

// Rollout fallback for the public contact form while accounts remain disabled.
// The Phase 4 path uses the durable PostgreSQL limiter below.
const fallbackRateLimits = new Map<string, { count: number; resetAt: number }>()
const MAX_FALLBACK_RATE_LIMIT_ENTRIES = 10_000

function pruneFallbackRateLimits(now: number) {
  for (const [key, value] of fallbackRateLimits) {
    if (value.resetAt <= now) fallbackRateLimits.delete(key)
  }
  while (fallbackRateLimits.size >= MAX_FALLBACK_RATE_LIMIT_ENTRIES) {
    const oldest = fallbackRateLimits.keys().next().value
    if (oldest === undefined) break
    fallbackRateLimits.delete(oldest)
  }
}

function exceedsFallbackLimit(ip: string) {
  const now = Date.now()
  const existing = fallbackRateLimits.get(ip)
  if (!existing || existing.resetAt <= now) {
    if (!existing && fallbackRateLimits.size >= MAX_FALLBACK_RATE_LIMIT_ENTRIES) {
      pruneFallbackRateLimits(now)
    }
    fallbackRateLimits.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  existing.count += 1
  return existing.count > 3
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value).replace(/\0/g, '').trim().slice(0, maxLength)
}

function escapeHtml(value: unknown, maxLength = 500): string {
  return cleanText(value, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function detailRow(label: string, value: unknown, maxLength = 500): string {
  const safeValue = escapeHtml(value, maxLength)
  if (!safeValue) return ''

  return `
    <tr style="border-bottom: 1px solid #F0F0F0;">
      <td style="padding: 10px 20px; color: #888; width: 40%; vertical-align: top;">${escapeHtml(label)}</td>
      <td style="padding: 10px 20px; color: #111; font-weight: 500; white-space: pre-wrap;">${safeValue}</td>
    </tr>
  `
}

function formatOrderItems(value: unknown): string {
  if (typeof value === 'string') return cleanText(value, 2000)
  if (!Array.isArray(value)) return ''

  return value
    .map((item) => {
      if (typeof item === 'string') return cleanText(item, 250)
      if (!isObject(item)) return ''

      const name = cleanText(item.name, 120)
      if (!name) return ''
      const size = cleanText(item.size, 30)
      const quantity = Number(item.quantity)
      const quantityText = Number.isFinite(quantity) && quantity > 0 ? ` × ${quantity}` : ''
      return `${name}${size ? ` (${size})` : ''}${quantityText}`
    })
    .filter(Boolean)
    .join('\n')
}

function sameOriginUrl(req: NextRequest, value: unknown, fallbackPath: string): string {
  const candidate = cleanText(value, 500)
  const path =
    candidate.startsWith('/') &&
    !candidate.startsWith('//') &&
    !candidate.includes('\\')
      ? candidate
      : fallbackPath
  const fallbackUrl = new URL(fallbackPath, req.nextUrl.origin)
  const resolvedUrl = new URL(path, req.nextUrl.origin)

  return resolvedUrl.origin === fallbackUrl.origin
    ? resolvedUrl.toString()
    : fallbackUrl.toString()
}

async function parseRequest(req: NextRequest): Promise<ParsedRequest> {
  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('multipart/form-data')) {
      const multipartBytes = await readBoundedBody(req, MAX_MULTIPART_BYTES)
      const multipartBody = new ArrayBuffer(multipartBytes.byteLength)
      new Uint8Array(multipartBody).set(multipartBytes)
      const formData = await new Request(req.url, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: multipartBody,
      }).formData()
      const payload = formData.get('payload')
      if (typeof payload !== 'string') {
        return { ok: false, error: 'Missing request payload', status: 400 }
      }

      const parsed: unknown = JSON.parse(payload)
      if (!isObject(parsed)) {
        return { ok: false, error: 'Invalid request body', status: 400 }
      }

      const uploaded = formData.get('attachment')
      if (!(uploaded instanceof File) || uploaded.size === 0) {
        return { ok: true, body: parsed }
      }
      if (uploaded.size > MAX_ATTACHMENT_BYTES) {
        return { ok: false, error: 'Attachment exceeds 3 MB', status: 413 }
      }
      if (!ALLOWED_ATTACHMENT_TYPES.has(uploaded.type)) {
        return { ok: false, error: 'Unsupported attachment type', status: 415 }
      }

      const filename = cleanText(uploaded.name, 120)
        .replace(/[^A-Za-z0-9._ ()-]/g, '_') || 'purchase-order.pdf'
      const content = Buffer.from(await uploaded.arrayBuffer()).toString('base64')
      return { ok: true, body: parsed, attachment: { filename, content } }
    }

    if (!contentType.toLowerCase().startsWith('application/json')) {
      return { ok: false, error: 'JSON request required', status: 415 }
    }
    const parsed: unknown = JSON.parse(
      (await readBoundedBody(req, MAX_JSON_BYTES)).toString('utf8')
    )
    return isObject(parsed)
      ? { ok: true, body: parsed }
      : { ok: false, error: 'Invalid request body', status: 400 }
  } catch (error) {
    if (error instanceof RequestBodyError && error.code === 'too_large') {
      return { ok: false, error: 'Request is too large', status: 413 }
    }
    return { ok: false, error: 'Invalid request body', status: 400 }
  }
}

function hasExpectedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(getServerEnvironment().NEXT_PUBLIC_APP_URL).origin
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!hasExpectedOrigin(req)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL
    const contactToEmail = process.env.CONTACT_TO_EMAIL
    if (!apiKey || !fromEmail) {
      return NextResponse.json({ error: 'Email service is not configured' }, { status: 503 })
    }

    const parsedRequest = await parseRequest(req)
    if (!parsedRequest.ok) {
      return NextResponse.json(
        { error: parsedRequest.error },
        { status: parsedRequest.status }
      )
    }
    const rawBody = parsedRequest.body
    const attachment = parsedRequest.attachment

    const name = cleanText(rawBody.name, 120)
    const email = cleanText(rawBody.email, 320)
    const requestedType = cleanText(rawBody.type, 20)
    const requestedPaymentStatus = cleanText(rawBody.paymentStatus, 20)
    const allowedTypes: EmailType[] = ['contact', 'configure', 'sample']
    if (!name || !email || !allowedTypes.includes(requestedType as EmailType)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const type = requestedType as EmailType
    const paymentStatus: PaymentStatus =
      requestedPaymentStatus === 'failure' ? 'failure' : 'success'
    if (
      requestedPaymentStatus &&
      requestedPaymentStatus !== 'success' &&
      requestedPaymentStatus !== 'failure'
    ) {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
    }

    if (type === 'contact' && isFeatureEnabled('NEXT_PUBLIC_ACCOUNTS_ENABLED')) {
      const ip = await requestIpAddress()
      const verified = await verifyTurnstile(
        typeof rawBody.turnstileToken === 'string'
          ? rawBody.turnstileToken
          : null,
        'contact',
        ip,
      )
      if (!verified) {
        return NextResponse.json(
          { error: 'Security verification failed' },
          { status: 400 },
        )
      }
      const rate = await consumeAuthRateLimit('contact', email)
      if (!rate.allowed) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    } else if (type === 'contact') {
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0, 128) || 'unknown'
      if (exceedsFallbackLimit(ip)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const company = cleanText(rawBody.company, 120)
    const enquiryType = cleanText(rawBody.enquiryType, 120)
    const phone = cleanText(rawBody.phone, 40)
    const message = cleanText(rawBody.message, 2000)
    const txnid = cleanText(rawBody.txnid, 100)
    const orderDetails = isObject(rawBody.orderDetails) ? rawBody.orderDetails : {}
    const isValidTransactionId = /^[A-Za-z0-9_-]+$/.test(txnid)

    if (type === 'contact' && (!company || !enquiryType)) {
      return NextResponse.json({ error: 'Missing contact enquiry fields' }, { status: 400 })
    }
    if (txnid && !isValidTransactionId) {
      return NextResponse.json({ error: 'Invalid transaction ID' }, { status: 400 })
    }
    if (type !== 'contact' && !txnid) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 })
    }

    if (type === 'sample' && isFeatureEnabled('DURABLE_SAMPLE_CHECKOUT_ENABLED')) {
      return NextResponse.json(
        { error: 'Legacy sample confirmation is disabled. Durable order notifications are sent from verified database records.' },
        { status: 410 }
      )
    }
    if (type === 'configure' && isFeatureEnabled('DURABLE_CUSTOM_CHECKOUT_ENABLED')) {
      return NextResponse.json(
        { error: 'Legacy configurator confirmation is disabled. Durable order notifications are sent from verified database records.' },
        { status: 410 }
      )
    }

    const paymentKind: PaymentKind | null =
      type === 'contact'
        ? null
        : type === 'sample'
          ? 'sample-cart'
          : 'configurator'
    let verifiedAmount = ''

    if (type !== 'contact') {
      const payment = decodePaymentResultCookie(
        req.cookies.get(PAYMENT_RESULT_COOKIE)?.value
      )
      const authorized =
        payment?.status === paymentStatus &&
        payment.mock === false &&
        payment.txnid === txnid &&
        payment.kind === paymentKind &&
        payment.email === email.toLowerCase() &&
        payment.firstname.toLocaleLowerCase('en') ===
          name.split(/\s+/)[0]?.toLocaleLowerCase('en')

      if (!authorized) {
        return NextResponse.json(
          { error: 'Verified payment required' },
          { status: 403 }
        )
      }

      // The signed payment result is authoritative for both successful and
      // unsuccessful attempts; never trust a browser-restored amount.
      verifiedAmount = payment.amount
      orderDetails.amount = payment.amount
    }

    const resend = new Resend(apiKey)
    const firstName = escapeHtml(name.split(/\s+/)[0], 120)

    const contactEmailHtml = `
      <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #111111;">
        <div style="border-bottom: 1px solid #E5E5E5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 18px; font-weight: 700; margin: 0;">Garmops</h1>
        </div>
        <p style="font-size: 15px; margin-bottom: 6px;">Hi ${firstName},</p>
        <p style="font-size: 15px; color: #555; line-height: 1.7; margin-bottom: 24px;">
          Thanks for reaching out. We have received your enquiry and our team will review it and get back to you with a detailed quote within <strong style="color: #111;">24 hours</strong>.
        </p>
        <div style="border: 1px solid #E5E5E5; margin-bottom: 24px;">
          <div style="background: #111111; padding: 12px 20px;">
            <p style="font-size: 11px; font-weight: 600; color: white; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Enquiry summary</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            ${detailRow('Company', company, 120)}
            ${detailRow('Looking for', enquiryType, 120)}
            ${detailRow('Phone', phone, 40)}
          </table>
        </div>
        <div style="background: #F7F7F7; border: 1px solid #E5E5E5; padding: 16px 20px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 600; color: #111; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">What happens next</p>
          <ol style="margin: 0; padding-left: 18px; font-size: 13px; color: #555; line-height: 2;">
            <li>We review your requirements</li>
            <li>We send you a detailed proforma invoice</li>
            <li>Once confirmed, production begins</li>
            <li>Delivery within 35 days</li>
          </ol>
        </div>
        <p style="font-size: 13px; color: #888; line-height: 1.7;">If you have urgent questions, reply directly to this email.</p>
        <div style="border-top: 1px solid #E5E5E5; margin-top: 32px; padding-top: 20px; font-size: 11px; color: #aaa;">
          <p style="margin: 0;">Garmops &mdash; Powered by Moist Corp</p>
          <p style="margin: 4px 0 0 0;">Greater Noida, Uttar Pradesh, India</p>
        </div>
      </div>
    `

    const contactNotificationHtml = `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #111111;">
        <h1 style="font-size: 20px; margin: 0 0 20px;">New website enquiry</h1>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E5E5; font-size: 13px;">
          ${detailRow('Name', name, 120)}
          ${detailRow('Company', company, 120)}
          ${detailRow('Email', email, 320)}
          ${detailRow('Phone', phone, 40)}
          ${detailRow('Looking for', enquiryType, 120)}
          ${detailRow('Message', message, 2000)}
        </table>
        <p style="font-size: 12px; color: #888; margin-top: 18px;">Reply to this email to respond directly to the customer.</p>
      </div>
    `

    const totalQuantity = cleanText(orderDetails.totalQty, 30)
    const configureNotificationHtml = `
      <div style="font-family: sans-serif; max-width: 680px; margin: 0 auto; color: #111111;">
        <h1 style="font-size: 20px; margin: 0 0 20px;">New configurator reservation</h1>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E5E5; font-size: 13px;">
          ${detailRow('Transaction ID', txnid, 100)}
          ${detailRow('Company', orderDetails.companyName, 160)}
          ${detailRow('Industry', orderDetails.industry, 120)}
          ${detailRow('Company GSTIN', orderDetails.companyGstin, 30)}
          ${detailRow('Company website', orderDetails.companyWebsite, 300)}
          ${detailRow('Project contact', name, 120)}
          ${detailRow('Department', orderDetails.department, 80)}
          ${detailRow('Work email', email, 320)}
          ${detailRow('Phone', orderDetails.phone, 40)}
          ${detailRow('Billing entity', orderDetails.billingEntity, 160)}
          ${detailRow('Accounts-payable email', orderDetails.accountsPayableEmail, 320)}
          ${detailRow('Billing GSTIN', orderDetails.billingGstin, 30)}
          ${detailRow('Billing address', orderDetails.billingAddress, 1000)}
          ${detailRow('PO number', orderDetails.poNumber, 100)}
          ${detailRow('Cost centre / department', orderDetails.costCentre, 120)}
          ${detailRow('Purchase order attachment', orderDetails.purchaseOrder, 160)}
          ${detailRow('Multiple delivery locations', orderDetails.multipleLocations, 20)}
          ${detailRow('Distribution notes', orderDetails.multipleLocationsNotes, 1000)}
          ${detailRow('Target delivery date', orderDetails.targetDelivery, 120)}
          ${detailRow('Product', orderDetails.product, 300)}
          ${detailRow('Product colour', orderDetails.color, 200)}
          ${detailRow('Print technique', orderDetails.technique, 200)}
          ${detailRow('Placement', orderDetails.placements, 300)}
          ${detailRow('Custom label', orderDetails.neckLabel, 200)}
          ${detailRow('Total quantity', totalQuantity ? `${totalQuantity} pieces` : '', 50)}
          ${detailRow('Size breakdown', orderDetails.sizeBreakdown, 1000)}
          ${detailRow('Estimated total', orderDetails.estimatedTotal, 100)}
          ${detailRow('Delivery address', orderDetails.shippingAddress, 1000)}
          ${detailRow('Order notes', orderDetails.orderNotes, 2000)}
        </table>
        <p style="font-size: 12px; color: #888; margin-top: 18px;">Reply to this email to contact the project coordinator.</p>
      </div>
    `

    const sampleItems = formatOrderItems(orderDetails.items ?? orderDetails.productinfo)
    const paidAmount = orderDetails.amount ?? orderDetails.total ?? orderDetails.estimatedTotal
    const sampleNotificationHtml = `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto; color: #111111;">
        <h1 style="font-size: 20px; margin: 0 0 20px;">New paid sample order</h1>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E5E5; font-size: 13px;">
          ${detailRow('Customer', name, 120)}
          ${detailRow('Email', email, 320)}
          ${detailRow('Transaction ID', txnid, 100)}
          ${detailRow('Items', sampleItems, 2000)}
          ${detailRow('Amount paid', paidAmount, 100)}
          ${detailRow('Shipping address', orderDetails.shippingAddress, 1000)}
        </table>
      </div>
    `

    const successEmail =
      paymentKind && paymentStatus === 'success'
        ? buildPaymentSuccessEmail({
            name,
            transactionId: txnid,
            amount: verifiedAmount,
            kind: paymentKind,
            supportEmail: contactToEmail,
            siteUrl: req.nextUrl.origin,
            details: {
              projectName: cleanText(orderDetails.projectName, 160),
              items: type === 'sample' ? sampleItems : '',
              product: cleanText(orderDetails.product, 300),
              colour: cleanText(orderDetails.color, 200),
              totalQuantity: totalQuantity ? `${totalQuantity} pieces` : '',
              estimatedTotal: cleanText(orderDetails.estimatedTotal, 100),
              targetDelivery: cleanText(orderDetails.targetDelivery, 120),
              shippingAddress: cleanText(orderDetails.shippingAddress, 1000),
            },
          })
        : null

    if (type !== 'contact' && paymentStatus === 'failure') {
      if (!paymentKind) {
        return NextResponse.json({ error: 'Invalid order type' }, { status: 400 })
      }

      const failureEmail = buildPaymentFailureEmail({
        name,
        transactionId: txnid,
        amount: verifiedAmount,
        kind: paymentKind,
        supportEmail: contactToEmail,
        siteUrl: req.nextUrl.origin,
        retryUrl: sameOriginUrl(
          req,
          orderDetails.retryHref,
          type === 'sample' ? '/checkout' : '/configurator'
        ),
        details: {
          projectName: cleanText(orderDetails.projectName, 160),
        },
      })
      const result = await resend.emails.send(
        {
          from: fromEmail,
          to: email,
          replyTo: contactToEmail,
          subject: failureEmail.subject,
          html: failureEmail.html,
          text: failureEmail.text,
        },
        {
          idempotencyKey: `payment-failure/customer/${txnid}`,
        }
      )
      if (result.error) {
        console.error(
          'Resend payment failure email error:',
          result.error.name,
          result.error.message
        )
        return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
      }
    } else if (type === 'contact') {
      if (!contactToEmail) {
        return NextResponse.json({ error: 'Contact recipient is not configured' }, { status: 503 })
      }
      const companyForSubject = company.replace(/[\r\n]+/g, ' ').slice(0, 80)
      const result = await resend.batch.send([
        {
          from: fromEmail,
          to: email,
          replyTo: contactToEmail,
          subject: 'We received your enquiry - Garmops',
          html: contactEmailHtml,
        },
        {
          from: fromEmail,
          to: contactToEmail,
          replyTo: email,
          subject: `New website enquiry - ${companyForSubject}`,
          html: contactNotificationHtml,
        },
      ])
      if (result.error) {
        console.error('Resend contact batch error:', result.error.name, result.error.message)
        return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
      }
    } else if (type === 'sample') {
      if (!contactToEmail) {
        return NextResponse.json({ error: 'Order recipient is not configured' }, { status: 503 })
      }
      if (!successEmail) {
        return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
      }
      const result = await resend.batch.send(
        [
          {
            from: fromEmail,
            to: email,
            replyTo: contactToEmail,
            subject: successEmail.subject,
            html: successEmail.html,
            text: successEmail.text,
          },
          {
            from: fromEmail,
            to: contactToEmail,
            replyTo: email,
            subject: `Paid sample order - ${txnid}`,
            html: sampleNotificationHtml,
          },
        ],
        {
          idempotencyKey: `payment-success/sample/${txnid}`,
        }
      )
      if (result.error) {
        console.error('Resend sample batch error:', result.error.name, result.error.message)
        return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
      }
    } else {
      if (attachment && !contactToEmail) {
        return NextResponse.json(
          { error: 'Order recipient is not configured for purchase-order attachments' },
          { status: 503 }
        )
      }
      if (!successEmail) {
        return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 })
      }

      const customerResult = await resend.emails.send(
        {
          from: fromEmail,
          to: email,
          replyTo: contactToEmail,
          subject: successEmail.subject,
          html: successEmail.html,
          text: successEmail.text,
        },
        {
          idempotencyKey: `payment-success/customer/${txnid}`,
        }
      )
      if (customerResult.error) {
        console.error(
          'Resend configure customer email error:',
          customerResult.error.name,
          customerResult.error.message
        )
        return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
      }

      if (contactToEmail) {
        const companyForSubject = cleanText(orderDetails.companyName, 80)
          .replace(/[\r\n]+/g, ' ')
        const internalResult = await resend.emails.send(
          {
            from: fromEmail,
            to: contactToEmail,
            replyTo: email,
            subject: `Configurator reservation - ${companyForSubject || txnid || name}`,
            html: configureNotificationHtml,
            attachments: attachment ? [attachment] : undefined,
          },
          {
            idempotencyKey: `payment-success/internal/${txnid}`,
          }
        )
        if (internalResult.error) {
          console.error(
            'Resend configure notification error:',
            internalResult.error.name,
            internalResult.error.message
          )
          return NextResponse.json({ error: 'Email provider rejected the request' }, { status: 502 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
