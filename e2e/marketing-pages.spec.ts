import { expect, test } from '@playwright/test'

test.describe('marketing collection pages', () => {
  test('persists product filters in the URL and exposes order facts', async ({ page }) => {
    await page.goto('/products?category=hoodies', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('button', { name: 'Hoodies' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/2 products/)).toBeVisible()
    await expect(page.getByText('Catalogue sample', { exact: true }).first()).toBeVisible()
    const firstProduct = page.locator('article').filter({ hasText: 'Classic Hoodie' }).first()
    await expect(firstProduct.getByText('Custom MOQ', { exact: true })).toBeVisible()
    await expect(firstProduct.getByText('50 pcs', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Oversized', exact: true }).click()
    await expect(page).toHaveURL(/category=hoodies/)
    await expect(page).toHaveURL(/fit=oversized/)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Oversized', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('gives every industry card a guide and links named products', async ({ page }) => {
    await page.goto('/industries', { waitUntil: 'domcontentloaded' })

    const guideLinks = page.getByRole('link', { name: /Open the .* industry guide/ })
    await expect(guideLinks).toHaveCount(6)
    await expect(guideLinks.nth(3)).toHaveAttribute('href', '/industries/sports-fitness')
    await expect(guideLinks.nth(4)).toHaveAttribute('href', '/industries/creative-teams')
    await expect(guideLinks.nth(5)).toHaveAttribute('href', '/industries/arts-culture')
    await expect(page.getByRole('link', { name: 'Canvas Tote Bag' }).first()).toHaveAttribute('href', '/products/canvas-tote-bag')

    await page.goto('/industries/sports-fitness', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: /Branded apparel for clubs/ })).toBeVisible()
  })

  test('frames the portfolio as one documented project with matching product bases', async ({ page }) => {
    await page.goto('/work', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { level: 1, name: 'One project, shown with the details we have.' })).toBeVisible()
    await expect(page.getByText('300 pcs', { exact: true })).toBeVisible()
    await expect(page.getByText('22 days', { exact: true })).toBeVisible()
    await expect(page.getByText('280 / 300', { exact: true })).toBeVisible()
    await expect(page.getByAltText(/Premium Oversized T-Shirt, a garment base/)).toBeVisible()
    await expect(page.getByAltText(/Canvas Tote Bag, a garment base/)).toBeVisible()
  })

  test('supports keyboard product selection and carries the estimate into Studio', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' })

    const productSelect = page.getByRole('combobox', { name: '1. Choose a product' })
    await productSelect.focus()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(productSelect).not.toHaveText(/Classic T-Shirt/)

    const quantity = page.getByRole('spinbutton', { name: '2. Enter quantity' })
    await quantity.fill('250')
    const rush = page.getByRole('switch', { name: /Rush production/ })
    await expect(rush).toBeVisible()
    await rush.click()

    await expect(page.getByText('Blank garment estimate', { exact: true })).toBeVisible()
    const continueLink = page.getByRole('link', { name: /Continue in Studio/ })
    await expect(continueLink).toHaveAttribute('href', /quantity=250&rush=1$/)
    await continueLink.click()
    await expect(page).toHaveURL(/quantity=250&rush=1/)
    await expect(page.getByRole('textbox', { name: /Order quantity/ })).toHaveValue('250')
    await expect(page.getByText('Rush production applied · ₹75 per piece', { exact: true })).toBeVisible()
  })

  test('has no horizontal overflow on the four audited mobile pages', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    for (const path of ['/products', '/industries', '/work', '/pricing']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  })
})
