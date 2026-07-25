import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

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
  addItem: (item: CartItem) => void
  removeItem: (id: number, size: string) => void
  updateQuantity: (id: number, size: string, quantity: number) => void
  clearCart: () => void
  total: () => number
}

export const useCartStore = create<CartStore>()(persist((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find(i => i.id === item.id && i.size === item.size)
    if (existing) {
      set(state => ({
        items: state.items.map(i =>
          i.id === item.id && i.size === item.size
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }))
    } else {
      set(state => ({ items: [...state.items, item] }))
    }
  },

  removeItem: (id, size) => {
    set(state => ({ items: state.items.filter(i => !(i.id === id && i.size === size)) }))
  },

  updateQuantity: (id, size, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id, size)
      return
    }
    set(state => ({
      items: state.items.map(i =>
        i.id === id && i.size === size ? { ...i, quantity } : i
      )
    }))
  },

  clearCart: () => set({ items: [] }),

  total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
}), {
  name: 'garmops-sample-cart',
  storage: createJSONStorage(() => localStorage),
  partialize: state => ({ items: state.items }),
  skipHydration: true,
}))
