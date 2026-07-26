import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { products } from './products'

export const MAX_SAMPLE_ITEM_QUANTITY = 100

export type CartItem = {
  id: number
  name: string
  price: number
  size: string
  quantity: number
  image: string | null
}

type CartStore = {
  items: CartItem[]
  hasHydrated: boolean
  setHasHydrated: (hasHydrated: boolean) => void
  addItem: (item: CartItem) => void
  removeItem: (id: number, size: string) => void
  updateQuantity: (id: number, size: string, quantity: number) => void
  clearCart: () => void
  total: () => number
}

function normalizeQuantity(quantity: unknown): number {
  const parsed = Number(quantity)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(MAX_SAMPLE_ITEM_QUANTITY, Math.max(0, Math.floor(parsed)))
}

function normalizeItem(value: unknown): CartItem | null {
  if (typeof value !== 'object' || value === null) return null

  const candidate = value as Partial<CartItem>
  const product = products.find(item => item.id === candidate.id)
  const quantity = normalizeQuantity(candidate.quantity)
  if (!product || typeof candidate.size !== 'string' || !product.sizes.includes(candidate.size) || quantity === 0) {
    return null
  }

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    size: candidate.size,
    quantity,
    image: product.image,
  }
}

function normalizeItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return []

  return value.reduce<CartItem[]>((items, candidate) => {
    const item = normalizeItem(candidate)
    if (!item) return items

    const existing = items.find(entry => entry.id === item.id && entry.size === item.size)
    if (existing) {
      existing.quantity = normalizeQuantity(existing.quantity + item.quantity)
    } else {
      items.push(item)
    }
    return items
  }, [])
}

export const useCartStore = create<CartStore>()(persist((set, get) => ({
  items: [],
  hasHydrated: false,

  setHasHydrated: (hasHydrated) => set({ hasHydrated }),

  addItem: (item) => {
    const normalized = normalizeItem(item)
    if (!normalized) return

    const existing = get().items.find(i => i.id === normalized.id && i.size === normalized.size)
    if (existing) {
      set(state => ({
        items: state.items.map(i =>
          i.id === normalized.id && i.size === normalized.size
            ? { ...i, quantity: normalizeQuantity(i.quantity + normalized.quantity) }
            : i
        )
      }))
    } else {
      set(state => ({ items: [...state.items, normalized] }))
    }
  },

  removeItem: (id, size) => {
    set(state => ({ items: state.items.filter(i => !(i.id === id && i.size === size)) }))
  },

  updateQuantity: (id, size, quantity) => {
    const normalizedQuantity = normalizeQuantity(quantity)
    if (normalizedQuantity === 0) {
      get().removeItem(id, size)
      return
    }
    set(state => ({
      items: state.items.map(i =>
        i.id === id && i.size === size ? { ...i, quantity: normalizedQuantity } : i
      )
    }))
  },

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}), {
  name: 'garmops-sample-cart',
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({ items: state.items }),
  merge: (persistedState, currentState) => ({
    ...currentState,
    items: normalizeItems((persistedState as Partial<CartStore> | undefined)?.items),
  }),
  skipHydration: true,
  onRehydrateStorage: () => (state) => {
    state?.setHasHydrated(true)
  },
}))