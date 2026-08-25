import { describe, it, expect } from "vitest"
import { smoothFinancialEase, calculateAdaptiveDuration } from "../src/hooks/useAnimatedCounter"

describe("useAnimatedCounter - smoothFinancialEase", () => {
  it("starts at 0 when t <= 0", () => {
    expect(smoothFinancialEase(0)).toBe(0)
    expect(smoothFinancialEase(-0.5)).toBe(0)
  })

  it("ends at 1 when t >= 1", () => {
    expect(smoothFinancialEase(1)).toBe(1)
    expect(smoothFinancialEase(1.5)).toBe(1)
  })

  it("produces a smooth monotonic progression without overshoot", () => {
    let prev = 0
    for (let step = 1; step <= 20; step++) {
      const t = step / 20
      const val = smoothFinancialEase(t)
      expect(val).toBeGreaterThanOrEqual(prev)
      expect(val).toBeLessThanOrEqual(1)
      prev = val
    }
  })

  it("has higher deceleration near the end than linear", () => {
    const halfVal = smoothFinancialEase(0.5)
    // ease-out should already be well past 0.5 (typically > 0.8) at t = 0.5
    expect(halfVal).toBeGreaterThan(0.8)
  })
})

describe("useAnimatedCounter - calculateAdaptiveDuration", () => {
  it("returns 0 for zero delta", () => {
    expect(calculateAdaptiveDuration(0)).toBe(0)
  })

  it("returns custom duration when explicitly specified", () => {
    expect(calculateAdaptiveDuration(100000, 300)).toBe(300)
    expect(calculateAdaptiveDuration(5000, 800)).toBe(800)
  })

  it("scales adaptively based on magnitude within 400ms - 750ms range", () => {
    const smallDelta = calculateAdaptiveDuration(500)
    const largeDelta = calculateAdaptiveDuration(100000000)

    expect(smallDelta).toBeGreaterThanOrEqual(400)
    expect(largeDelta).toBeLessThanOrEqual(750)
    expect(largeDelta).toBeGreaterThanOrEqual(smallDelta)
  })
})

