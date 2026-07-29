import Breadcrumbs from '@/components/ui/Breadcrumbs'
import JsonLd from '@/components/seo/JsonLd'
import { caseStudies } from '@/lib/casestudies'
import type { SeoLandingPageContent } from '@/lib/landingPages'
import { products } from '@/lib/products'
import {
  breadcrumbSchema,
  faqSchema,
  productItemListSchema,
  serviceSchema,
} from '@/lib/structuredData'
import CommercialCta from './CommercialCta'
import FaqSection from './FaqSection'
import FeatureGrid from './FeatureGrid'
import LandingHero from './LandingHero'
import ProcessSteps from './ProcessSteps'
import ProductCollection from './ProductCollection'
import ProofLinks from './ProofLinks'
import RelatedGuides from './RelatedGuides'
import TechniqueComparison from './TechniqueComparison'
import TrustStrip from './TrustStrip'
import UseCaseGrid from './UseCaseGrid'

export default function SeoLandingPage({ content }: { content: SeoLandingPageContent }) {
  const path = `/${content.slug}`
  const selectedProducts = products.filter(product => content.productSlugs?.includes(product.slug))
  const relevantCaseStudies = content.proofIndustries
    ? caseStudies.filter(study => content.proofIndustries?.includes(study.industry)).slice(0, 2)
    : []
  const breadcrumbItems = [
    { name: 'Home', path: '/' },
    { name: content.breadcrumbLabel, path },
  ]

  return (
    <article className="app-liquid-bg">
      <JsonLd data={breadcrumbSchema(breadcrumbItems)} />
      <JsonLd
        data={serviceSchema({
          id: 'service',
          name: content.title,
          description: content.seo.description,
          path,
          serviceType: content.serviceType,
          audience: content.audience,
          image: content.seo.image,
        })}
      />
      {selectedProducts.length > 0 && (
        <JsonLd data={productItemListSchema(content.productHeading, path, selectedProducts)} />
      )}
      <JsonLd data={faqSchema(content.faqs.map(item => ({ q: item.question, a: item.answer })))} />

      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8">
        <Breadcrumbs
          crumbs={[
            { label: 'Home', href: '/' },
            { label: content.breadcrumbLabel },
          ]}
        />
      </div>
      <LandingHero content={content} />
      <TrustStrip points={content.trustPoints} />
      <div className="app-liquid-section">
        <FeatureGrid
          title={content.featuresHeading}
          introduction={content.featuresIntroduction}
          features={content.features}
        />
      </div>
      <ProductCollection
        heading={content.productHeading}
        introduction={content.productIntroduction}
        products={selectedProducts}
        pagePath={path}
      />
      {content.useCases && content.useCasesHeading && (
        <div className="app-liquid-section">
          <UseCaseGrid
            title={content.useCasesHeading}
            introduction={content.useCasesIntroduction}
            useCases={content.useCases}
          />
        </div>
      )}
      {content.techniqueKeys && <TechniqueComparison techniqueKeys={content.techniqueKeys} />}
      {content.sections?.map((section, index) => (
        <div key={section.title} className={index % 2 === 0 ? 'app-liquid-section' : undefined}>
          <FeatureGrid
            eyebrow={section.eyebrow}
            title={section.title}
            introduction={section.introduction}
            features={section.features}
            links={section.links}
          />
        </div>
      ))}
      {content.steps && content.stepsHeading && (
        <ProcessSteps
          title={content.stepsHeading}
          introduction={content.stepsIntroduction}
          steps={content.steps}
        />
      )}
      {content.proofIndustries && <ProofLinks caseStudies={relevantCaseStudies} />}
      <FaqSection faqs={content.faqs} />
      <RelatedGuides guides={content.relatedGuides} pages={content.relatedPages} />
      <CommercialCta content={content} />
    </article>
  )
}
