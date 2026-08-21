'use client'

import { Accordion } from '@base-ui/react/accordion'
import { homeFaqs as faqs } from '@/lib/homeContent'

export default function HomeFaqAccordion() {
  return (
    <Accordion.Root className="flex flex-col border-t border-[#E5E5E5]">
      {faqs.map(item => (
        <Accordion.Item
          key={item.q}
          value={item.q}
          className={({ open }) => `border-b border-[#E5E5E5] transition-[border-color,background-color] duration-200 ${open ? 'my-2 rounded-sm border border-(--color-rule) bg-(--color-cream-soft)/55 px-5' : ''}`}
        >
          <Accordion.Header className="m-0">
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left sm:gap-6 sm:py-6">
              <span className="text-base font-semibold text-(--text-primary)">{item.q}</span>
              <svg
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-[#555555] transition-[transform,color] duration-200 group-data-panel-open:rotate-45 group-data-panel-open:text-(--color-accent)"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="h-[var(--accordion-panel-height)] overflow-hidden opacity-100 transition-[height,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0">
            <p className="pb-5 pr-2 text-sm leading-relaxed text-[#4a4a4a] sm:pb-6 sm:pr-10">
              {item.a}
            </p>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
