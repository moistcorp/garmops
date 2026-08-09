import { describe, expect, it } from "vitest";
import { requestIdFrom, withRequestId } from "./requestId";

describe("request IDs", () => {
  it("accepts only format-safe incoming IDs", () => {
    expect(requestIdFrom(new Request("https://garmops.test", { headers: { "x-request-id": "Safe_ID-123" } }))).toBe("Safe_ID-123");
    expect(requestIdFrom(new Request("https://garmops.test", { headers: { "x-request-id": "bad id" } }))).toMatch(/^[A-F0-9]{16}$/);
  });
  it("adds the response correlation header", () => {
    expect(withRequestId(new Response(), "REQUEST123").headers.get("x-request-id")).toBe("REQUEST123");
  });
});
