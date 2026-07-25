'use client'

import Image from 'next/image'

const brands = [
  { name: 'Sony', logo: '/brands/sony.svg', width: 32 },
  { name: 'ASICS', logo: '/brands/asics.svg', width: 99 },
  { name: 'BeReal', logo: '/brands/bereal.svg', width: 32 },
  { name: 'Apartamento', logo: '/brands/apartamento.svg', width: 32 },
  { name: 'Thrive', logo: '/brands/thrive.svg', width: 32 },
  { name: 'Boat', logo: '/brands/boat.svg', width: 144 },
]

export default function TrustedBy() {
  const marquee = [
    ...brands.map(brand => ({ ...brand, duplicate: false })),
    ...brands.map(brand => ({ ...brand, duplicate: true })),
  ]

  return (
    <section className="bg-[var(--color-cream)] py-10 overflow-hidden">

      <div className="max-w-7xl mx-auto px-6">

        <div className="flex items-center gap-12">

          <h2 className="text-2xl font-semibold shrink-0 text-[#111111]">
            Trusted by
          </h2>

          <div className="relative flex-1 overflow-hidden">

            {/* left fade */}
            <div className="absolute left-0 top-0 h-full w-20 bg-gradient-to-r from-[var(--color-cream)] to-transparent z-10" />

            {/* right fade */}
            <div className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-[var(--color-cream)] to-transparent z-10" />

            <div className="marquee flex items-center">

              {marquee.map((brand, index) => (
                <div
                  key={`${brand.name}-${index}`}
                  aria-hidden={brand.duplicate || undefined}
                  className="flex-shrink-0 mx-8 md:mx-14"
                >
                  <Image
                    src={brand.logo}
                    alt={brand.duplicate ? '' : brand.name}
                    width={brand.width}
                    height={32}
                    className="h-8 w-auto opacity-80 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
                    unoptimized
                  />
                </div>
              ))}

            </div>

          </div>

        </div>

      </div>

    </section>
  )
}
