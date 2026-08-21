import { expect, test } from '@playwright/test'

test.describe('homepage', () => {
  test('presents a clear path from proof to configuration', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { level: 1, name: /Custom apparel/ })).toBeVisible()
    await expect(page.locator('#homepage-hero').getByRole('link', { name: 'Start designing' })).toHaveAttribute('href', '/configurator')
    await expect(page.locator('#homepage-hero').getByRole('link', { name: 'Explore products' })).toHaveAttribute('href', '/products')
    await expect(page.getByRole('link', { name: 'Read the Soundwave Festival case study' })).toBeVisible()
    await expect(page.getByText('300', { exact: true })).toBeVisible()
    await expect(page.getByText('22 days', { exact: true })).toBeVisible()
    await expect(page.getByText('From 50 pieces', { exact: true }).first()).toBeVisible()

    const firstProduct = page.locator('[data-home-product-grid]').getByRole('link').first()
    await expect(firstProduct.getByText(/From ₹[\d,]+ \/ pc/)).toBeVisible()
    await expect(firstProduct.getByText(/\d+ pcs/)).toBeVisible()

    const firstFaq = page.getByRole('button', { name: "What's the minimum custom order quantity?" })
    const secondFaq = page.getByRole('button', { name: 'How long does a custom order take?' })
    await firstFaq.click()
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'true')
    await secondFaq.click()
    await expect(secondFaq).toHaveAttribute('aria-expanded', 'true')
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false')
  })

  test('keeps the mobile page concise and shows a contextual CTA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const productCards = page.locator('[data-home-product-grid] > *')
    await expect(productCards).toHaveCount(4)
    await expect(productCards.nth(0)).toBeVisible()
    await expect(productCards.nth(1)).toBeVisible()
    await expect(productCards.nth(2)).toBeHidden()
    await expect(productCards.nth(3)).toBeHidden()

    const industryCards = page.locator('[data-home-industry-grid] > *')
    await expect(industryCards).toHaveCount(3)
    await expect(industryCards.nth(0)).toBeVisible()
    await expect(industryCards.nth(1)).toBeVisible()
    await expect(industryCards.nth(2)).toBeHidden()

    const stickyCta = page.getByTestId('mobile-home-cta')
    await expect(stickyCta).toHaveAttribute('aria-hidden', 'true')
    await page.getByRole('heading', { name: 'Popular places to begin.' }).scrollIntoViewIfNeeded()
    await expect(stickyCta).toHaveAttribute('aria-hidden', 'false')
    await expect(stickyCta.getByRole('link', { name: 'Start designing' })).toHaveAttribute('href', '/configurator')

    await page.locator('#homepage-final-cta').scrollIntoViewIfNeeded()
    await expect(stickyCta).toHaveAttribute('aria-hidden', 'true')
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })

  test('returns focus when the customer login dialog closes', async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED !== 'true', 'Customer accounts are disabled in this environment')
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    const loginButton = page.getByRole('button', { name: 'Login / Sign up' })
    await expect(loginButton).toBeVisible()
    await loginButton.click()
    await expect(page.getByRole('dialog', { name: 'Sign in or create an account' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(loginButton).toBeFocused()
  })
})
