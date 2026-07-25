'use client'

const brands = [
  { name: 'Sony', logo: '/brands/sony.svg' },
  { name: 'ASICS', logo: '/brands/asics.svg' },
  { name: 'BeReal', logo: '/brands/bereal.svg' },
  { name: 'Apartamento', logo: '/brands/apartamento.svg' },
  { name: 'Thrive', logo: '/brands/thrive.svg' },
  { name: 'Boat', logo: '/brands/boat.svg' },
]

export default function TrustedBy() {
  const marquee = [...brands, ...brands]

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
                  className="flex-shrink-0 mx-8 md:mx-14"
                >
                  <img
                 src={brand.logo}
                alt={brand.name}
                className="h-8 w-auto opacity-80 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
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