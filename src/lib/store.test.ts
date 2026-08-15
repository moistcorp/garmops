import { describe, expect, it } from "vitest"
import { resolveSampleProductSlug } from "./store"

describe("sample cart product identity", () => {
  it("migrates a known legacy numeric id to the canonical product slug", () => {
    expect(resolveSampleProductSlug({ id: 1 })).toBe("regular-fit-tee-200gsm")
  })

  it("rejects arbitrary numeric ids and unknown slugs", () => {
    expect(resolveSampleProductSlug({ id: 999 })).toBeNull()
    expect(resolveSampleProductSlug({ productSlug: "1" })).toBeNull()
  })
})
