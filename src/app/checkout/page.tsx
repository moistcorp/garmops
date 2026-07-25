'use client'
import { useState } from 'react'
import { useCartStore } from '@/lib/store'
import Link from 'next/link'

const countryCodes = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US', flag: '🇺🇸' },
  { code: '+44', country: 'GB', flag: '🇬🇧' },
  { code: '+971', country: 'AE', flag: '🇦🇪' },
  { code: '+65', country: 'SG', flag: '🇸🇬' },
  { code: '+60', country: 'MY', flag: '🇲🇾' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
]

const countries = ['India', 'United States', 'United Kingdom', 'UAE', 'Singapore', 'Malaysia', 'Australia', 'Germany', 'France', 'Japan', 'Other']

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
]

const indianCities: Record<string, string[]> = {
  'Delhi': ['New Delhi', 'Noida', 'Greater Noida', 'Gurgaon', 'Faridabad', 'Ghaziabad'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Thane'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli', 'Mangalore', 'Belgaum'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem', 'Trichy'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Gandhinagar'],
  'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Ajmer'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj', 'Noida', 'Ghaziabad', 'Meerut'],
  'Punjab': ['Chandigarh', 'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala'],
  'Haryana': ['Gurgaon', 'Faridabad', 'Panipat', 'Ambala', 'Rohtak'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain'],
  'Bihar': ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur'],
  'Odisha': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur'],
  'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur'],
}

const selectClass = "border border-[#E5E5E5] bg-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors appearance-none w-full cursor-pointer"
const inputClass = "border border-[#E5E5E5] bg-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors w-full"
const labelClass = "text-xs font-medium text-[#111111]/50 uppercase tracking-wide mb-1.5 block"

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" opacity="0.4">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}

export default function Checkout() {
  const { items, total } = useCartStore()
  const cartTotal = total()
  const shipping = cartTotal >= 2000 ? 0 : 99
  const grandTotal = cartTotal + shipping

  const [countryCode, setCountryCode] = useState('+91')
  const [selectedCountry, setSelectedCountry] = useState('India')
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [customCity, setCustomCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    firstname: '', lastname: '', email: '', phone: '',
    address: '', pincode: ''
  })

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const availableCities = selectedState && indianCities[selectedState] ? indianCities[selectedState] : []
  const cityValue = customCity || selectedCity

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-4 tracking-tight">Nothing to checkout</h1>
        <Link href="/products" className="inline-block bg-[var(--color-teal)] text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition">
          Back to shop
        </Link>
      </div>
    )
  }

  async function handlePayment() {
    if (!form.firstname.trim() || !form.email.trim() || !form.phone.trim() || !form.address.trim() || !selectedCountry) {
      setError('Please fill in all required fields')
      return
    }
    if (!selectedState.trim() || !cityValue.trim()) {
      setError('Please select your state and city')
      return
    }
    if (selectedCountry === 'India' && !/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
      setError('Please enter a valid 6-digit pincode')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')

    const txnid = 'MF' + Date.now()
    const amount = grandTotal.toFixed(2)
    const productinfo = items.map(i => `${i.name} (${i.size}) x${i.quantity}`).join(', ')

    try {
      const res = await fetch('/api/payu/hash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txnid,
          amount,
          productinfo,
          firstname: form.firstname,
          email: form.email,
          items: items.map(item => ({ id: item.id, size: item.size, quantity: item.quantity })),
        })
      })
      const payment = await res.json()
      if (!res.ok || payment.amount !== amount) {
        throw new Error(payment.error ?? 'Could not initialize payment')
      }

      localStorage.setItem('mf_pending_order', JSON.stringify({
        kind: 'sample-cart',
        mockPayment: Boolean(payment.mockPayment),
        name: `${form.firstname} ${form.lastname}`.trim(),
        email: form.email,
        txnid,
      }))

      if (payment.mockPayment) {
        window.location.assign(`/payment/success?txnid=${encodeURIComponent(txnid)}&mock=1`)
        return
      }

      const { hash, key } = payment
      if (!hash || !key) {
        throw new Error('PayU returned an invalid payment response')
      }

      const payuForm = document.createElement('form')
      payuForm.method = 'POST'
      payuForm.action = process.env.NEXT_PUBLIC_PAYU_BASE_URL ??
        (process.env.NODE_ENV === 'production'
          ? 'https://secure.payu.in/_payment'
          : 'https://test.payu.in/_payment')

      const fields: Record<string, string> = {
        key, txnid, amount, productinfo,
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        phone: `${countryCode}${form.phone}`,
        address1: form.address,
        city: cityValue || selectedCity,
        state: selectedState,
        zipcode: form.pincode,
        country: selectedCountry,
        hash,
        surl: `${window.location.origin}/payment/success`,
        furl: `${window.location.origin}/payment/failure`,
      }

      Object.entries(fields).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = v
        payuForm.appendChild(input)
      })

      document.body.appendChild(payuForm)
      payuForm.submit()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-12 tracking-tight">Checkout</h1>

      <div className="grid lg:grid-cols-3 gap-12">

        {/* Form */}
          <form id="checkout-details" className="lg:col-span-2 flex flex-col gap-8" onSubmit={(event) => { event.preventDefault(); void handlePayment() }}>

          {/* Contact */}
          <div>
            <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-5">Contact details</p>
            <div className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-firstname" className={labelClass}>First name *</label>
                  <input id="checkout-firstname" name="firstname" autoComplete="given-name" required value={form.firstname} onChange={handle}
                    className={inputClass} placeholder="Rahul" />
                </div>
                <div>
                  <label htmlFor="checkout-lastname" className={labelClass}>Last name</label>
                  <input id="checkout-lastname" name="lastname" autoComplete="family-name" value={form.lastname} onChange={handle}
                    className={inputClass} placeholder="Sharma" />
                </div>
              </div>
              <div>
                <label htmlFor="checkout-email" className={labelClass}>Email *</label>
                <input id="checkout-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={handle}
                  className={inputClass} placeholder="you@email.com" />
              </div>

              {/* Phone with country code */}
              <div>
                <label htmlFor="checkout-phone" className={labelClass}>Phone *</label>
                <div className="flex gap-0">
                  <SelectWrapper>
                    <select
                      aria-label="Phone country code"
                      value={countryCode}
                      onChange={e => setCountryCode(e.target.value)}
                      className="border border-[#E5E5E5] border-r-0 bg-white pl-3 pr-8 py-3 rounded-l-xl text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors appearance-none cursor-pointer shrink-0"
                      style={{ minWidth: 90 }}
                    >
                      {countryCodes.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                  </SelectWrapper>
                  <input
                    id="checkout-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel-national"
                    required
                    value={form.phone}
                    onChange={handle}
                    className="border border-[#E5E5E5] bg-white px-4 py-3 rounded-r-xl text-sm focus:outline-none focus:border-[var(--color-teal)] transition-colors flex-1"
                    placeholder="98765 43210"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Delivery address */}
          <div>
            <p className="text-xs font-medium text-[#111111]/40 uppercase tracking-widest mb-5">Delivery address</p>
            <div className="flex flex-col gap-4">

              {/* Country */}
              <div>
                <label htmlFor="checkout-country" className={labelClass}>Country *</label>
                <SelectWrapper>
                  <select
                    id="checkout-country"
                    autoComplete="country-name"
                    value={selectedCountry}
                    onChange={e => {
                      setSelectedCountry(e.target.value)
                      setSelectedState('')
                      setSelectedCity('')
                      setCustomCity('')
                    }}
                    className={selectClass}
                  >
                    {countries.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </div>

              <div>
                <label htmlFor="checkout-address" className={labelClass}>Street address *</label>
                <input id="checkout-address" name="address" autoComplete="street-address" required value={form.address} onChange={handle}
                  className={inputClass} placeholder="Building, street, area" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* State */}
                <div>
                  <label htmlFor="checkout-state" className={labelClass}>State *</label>
                  {selectedCountry === 'India' ? (
                    <SelectWrapper>
                      <select
                        id="checkout-state"
                        autoComplete="address-level1"
                        value={selectedState}
                        onChange={e => {
                          setSelectedState(e.target.value)
                          setSelectedCity('')
                          setCustomCity('')
                        }}
                        className={selectClass}
                      >
                        <option value="">Select state</option>
                        {indianStates.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  ) : (
                    <input
                      id="checkout-state"
                      autoComplete="address-level1"
                      value={selectedState}
                      onChange={e => setSelectedState(e.target.value)}
                      className={inputClass}
                      placeholder="State / Province"
                    />
                  )}
                </div>

                {/* City */}
                <div>
                  <label htmlFor="checkout-city" className={labelClass}>City *</label>
                  {selectedCountry === 'India' && availableCities.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <SelectWrapper>
                        <select
                          id="checkout-city"
                          autoComplete="address-level2"
                          value={selectedCity}
                          onChange={e => {
                            setSelectedCity(e.target.value)
                            setCustomCity('')
                          }}
                          className={selectClass}
                        >
                          <option value="">Select city</option>
                          {availableCities.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="other">Other</option>
                        </select>
                      </SelectWrapper>
                      {selectedCity === 'other' && (
                        <input
                          id="checkout-city-other"
                          aria-label="Enter your city"
                          autoComplete="address-level2"
                          value={customCity}
                          onChange={e => setCustomCity(e.target.value)}
                          className={inputClass}
                          placeholder="Enter your city"
                        />
                      )}
                    </div>
                  ) : (
                    <input
                      id="checkout-city"
                      autoComplete="address-level2"
                      value={customCity || selectedCity}
                      onChange={e => setCustomCity(e.target.value)}
                      className={inputClass}
                      placeholder={selectedCountry === 'India' && !selectedState ? 'Select state first' : 'City'}
                    />
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="checkout-pincode" className={labelClass}>
                    {selectedCountry === 'India' ? 'Pincode *' : 'Postal code'}
                  </label>
                  <input id="checkout-pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" value={form.pincode} onChange={handle}
                    className={inputClass}
                    placeholder={selectedCountry === 'India' ? '110001' : 'Postal code'} />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700 border border-red-200 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}
          </form>

        {/* Order summary */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[#ECE7DF] bg-white p-6 flex flex-col gap-4 shadow-[0_4px_16px_rgba(22,33,43,0.04)]">
            <p className="text-sm font-semibold">Order summary</p>

            <div className="flex flex-col gap-3 border-t border-[#ECE7DF] pt-4">
              {items.map(item => (
                <div key={`${item.id}-${item.size}`} className="flex justify-between text-xs">
                  <span className="text-[#111111]/60 leading-snug pr-2">
                    {item.name} ({item.size}) &times;{item.quantity}
                  </span>
                  <span className="font-medium shrink-0">
                    &#8377;{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 text-sm border-t border-[#ECE7DF] pt-4">
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Subtotal</span>
                <span>&#8377;{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#111111]/50">Shipping</span>
                <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
              </div>
              {shipping > 0 && (
                <p className="text-xs text-[#111111]/40">
                  Add &#8377;{(2000 - cartTotal).toLocaleString('en-IN')} more for free shipping
                </p>
              )}
            </div>

            <div className="flex justify-between font-bold text-base border-t border-[#ECE7DF] pt-4">
              <span>Total</span>
              <span>&#8377;{grandTotal.toLocaleString('en-IN')}</span>
            </div>

            <button
              type="submit"
              form="checkout-details"
              disabled={loading}
              className="w-full bg-[var(--color-teal)] text-white py-3.5 rounded-full text-sm font-medium hover:bg-[var(--color-teal-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : `Pay ₹${grandTotal.toLocaleString('en-IN')}`}
            </button>

            <p className="text-xs text-center text-[#111111]/40">
              Secured by PayU. We never store card details.
            </p>
          </div>

          <Link href="/cart" className="text-xs text-center text-[#111111]/40 hover:text-[#111111] transition-colors">
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  )
}
