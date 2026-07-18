const COINGECKO_API_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=idr,usd";
const EXCHANGE_RATE_API_BASE_URL = "https://v6.exchangerate-api.com/v6";
const GOLD_SPOT_TTL_MS = 2 * 60 * 1000;

let goldSpotInFlight = null;
let goldSpotCooldownUntil = 0;
const GOLD_PRICE_HISTORY_KEY = "gold_price_history";
const GOLD_HISTORY_MIGRATED_KEY = "gold_history_migrated";
const GOLD_SPOT_SAMPLES_LEGACY_KEY = "gold-spot-samples-v2";
const USD_IDR_FALLBACK_CACHE_KEY = "usd-idr-fallback-v1";
const USD_IDR_FALLBACK_TTL_MS = 6 * 60 * 60 * 1000;

async function fetchJsonWithTimeout(url, timeoutMs, init = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfterSec = Number.isFinite(retryAfter) ? retryAfter : null;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function readJsonCache(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonCache(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

async function fetchUsdIdrFallbackRate() {
  const cached = readJsonCache(USD_IDR_FALLBACK_CACHE_KEY);
  const now = Date.now();
  if (
    cached?.savedAt &&
    now - Number(cached.savedAt) < USD_IDR_FALLBACK_TTL_MS &&
    Number.isFinite(Number(cached.rate)) &&
    Number(cached.rate) > 0
  ) {
    return Number(cached.rate);
  }

  // Fallback endpoint without API key requirement.
  const payload = await fetchJsonWithTimeout("https://open.er-api.com/v6/latest/USD", 3500);
  const rate = Number(payload?.rates?.IDR);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Fallback USD->IDR rate unavailable");
  }
  writeJsonCache(USD_IDR_FALLBACK_CACHE_KEY, { savedAt: now, rate });
  return rate;
}

function migrateGoldHistory() {
  if (typeof window === "undefined") return;

  const already = window.localStorage.getItem(GOLD_HISTORY_MIGRATED_KEY);
  if (already) return;

  const old = window.localStorage.getItem(GOLD_SPOT_SAMPLES_LEGACY_KEY);
  if (!old) {
    window.localStorage.setItem(GOLD_HISTORY_MIGRATED_KEY, "1");
    return;
  }

  try {
    const parsed = JSON.parse(old);
    const legacyRows = Array.isArray(parsed?.data) ? parsed.data : Array.isArray(parsed) ? parsed : [];
    const normalized = legacyRows
      .map((d) => ({
        time: Number(d?.time ?? d?.timestamp ?? d?.t),
        price: Number(d?.price ?? d?.p ?? d?.value),
      }))
      .filter((d) => Number.isFinite(d.time) && Number.isFinite(d.price) && d.price > 0)
      .slice(-200);

    const existing = readJsonCache(GOLD_PRICE_HISTORY_KEY);
    const existingRows = Array.isArray(existing)
      ? existing
          .map((d) => ({ time: Number(d?.time), price: Number(d?.price) }))
          .filter((d) => Number.isFinite(d.time) && Number.isFinite(d.price) && d.price > 0)
      : [];

    const byTime = new Map();
    [...normalized, ...existingRows].forEach((item) => {
      byTime.set(item.time, item);
    });

    const merged = Array.from(byTime.values())
      .sort((a, b) => a.time - b.time)
      .slice(-200);

    writeJsonCache(GOLD_PRICE_HISTORY_KEY, merged);
    window.localStorage.setItem(GOLD_HISTORY_MIGRATED_KEY, "1");
  } catch {
    window.localStorage.setItem(GOLD_HISTORY_MIGRATED_KEY, "1");
  }
}

migrateGoldHistory();

function appendGoldPriceHistory(pricePerGramIdr) {
  if (typeof window === "undefined") return;
  const numeric = Number(pricePerGramIdr);
  if (!Number.isFinite(numeric) || numeric <= 0) return;
  const existing = readJsonCache(GOLD_PRICE_HISTORY_KEY);
  const rows = Array.isArray(existing) ? existing : [];
  const next = [...rows, { time: Date.now(), price: numeric }].slice(-200);
  writeJsonCache(GOLD_PRICE_HISTORY_KEY, next);
}

export function getGoldPriceHistory() {
  const cached = readJsonCache(GOLD_PRICE_HISTORY_KEY);
  const rows = Array.isArray(cached) ? cached : [];
  return rows
    .map((row) => ({ time: Number(row?.time), price: Number(row?.price) }))
    .filter(
      (row) =>
        Number.isFinite(row.time) &&
        Number.isFinite(row.price) &&
        row.price > 0,
    )
    .sort((a, b) => a.time - b.time);
}

export function generateGoldHistory(range = "1M", currentPriceIDR = 0) {
  const rangeKey = String(range || "1M").toUpperCase();
  const config = {
    "7D": { count: 7, stepMs: 24 * 60 * 60 * 1000, volatility: 0.005 },
    "1M": { count: 30, stepMs: 24 * 60 * 60 * 1000, volatility: 0.008 },
    "3M": { count: 90, stepMs: 24 * 60 * 60 * 1000, volatility: 0.01 },
    "6M": { count: 180, stepMs: 24 * 60 * 60 * 1000, volatility: 0.012 },
    "1Y": { count: 365, stepMs: 24 * 60 * 60 * 1000, volatility: 0.014 },
  };
  const selected = config[rangeKey] || config["1M"];
  const base = Number(currentPriceIDR);
  if (!Number.isFinite(base) || base <= 0) return [];

  const now = Date.now();
  const backward = [{ time: now, price: Math.round(base) }];
  let price = base;

  // Build backward from current price so last point is always "now".
  for (let i = 1; i <= selected.count; i += 1) {
    const noise = (Math.random() - 0.5) * selected.volatility * 2;
    const minStep = selected.volatility * 0.18;
    const signedNoise =
      Math.abs(noise) < minStep ? (noise >= 0 ? minStep : -minStep) : noise;
    const factor = 1 + signedNoise;
    price = price / Math.max(0.8, factor);
    backward.push({
      time: now - i * selected.stepMs,
      price: Math.max(1, Math.round(price)),
    });
  }

  return backward.sort((a, b) => a.time - b.time);
}

function parseGoldPrice(payload) {
  const numeric =
    Number(payload?.price) ||
    Number(payload?.data?.price) ||
    Number(payload?.value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Invalid gold price payload");
  }
  return numeric;
}

export async function fetchGoldPrice() {
  // Primary provider: CORS-friendly and no API key.
  try {
    const primary = await fetchJsonWithTimeout("https://api.gold-api.com/price/XAU", 5000);
    const primaryPrice = Number(primary?.price);
    const primaryCurrency = String(primary?.currency || "USD").toUpperCase();
    if (Number.isFinite(primaryPrice) && primaryPrice > 0) {
      return { price: primaryPrice, currency: primaryCurrency };
    }
    throw new Error("Invalid gold-api payload");
  } catch (primaryErr) {
    // Fallback legacy provider (kept as backup).
    const data = await fetchJsonWithTimeout("https://metals.live/api/v1/spot", 5000);
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`Gold providers failed: ${primaryErr?.message || "primary unavailable"}`, {
        cause: primaryErr,
      });
    }
    const goldUsdPerOz = Number(data[0]?.gold);
    if (!Number.isFinite(goldUsdPerOz) || goldUsdPerOz <= 0) {
      throw new Error("Invalid metals.live gold spot payload", { cause: primaryErr });
    }
    return { price: goldUsdPerOz, currency: "USD" };
  }
}

async function fetchGoldPricePerGramIDRInternal() {
  const now = Date.now();
  if (goldSpotCooldownUntil && now < goldSpotCooldownUntil) {
    const seconds = Math.ceil((goldSpotCooldownUntil - now) / 1000);
    throw new Error(`Gold API rate-limited. Retry in ~${seconds}s`);
  }

  try {
    const goldResponse = await fetchGoldPrice();
    const ouncePrice = parseGoldPrice(goldResponse);

    const currency =
      String(goldResponse?.currency || goldResponse?.curr || goldResponse?.data?.currency || "")
        .toUpperCase()
        .trim() || "IDR";

    if (currency === "IDR") return ouncePrice / 31.1034768;

    if (currency === "USD") {
      let idrRate = 0;
      try {
        const rates = await fetchCurrencyRates("USD");
        idrRate = Number(rates?.IDR);
      } catch {
        idrRate = await fetchUsdIdrFallbackRate();
      }
      if (!Number.isFinite(idrRate) || idrRate <= 0) {
        idrRate = await fetchUsdIdrFallbackRate();
      }
      return (ouncePrice * idrRate) / 31.1034768;
    }

    throw new Error(`Unsupported gold quote currency: ${currency}`);
  } catch (error) {
    if (error?.status === 429) {
      const retrySec = error.retryAfterSec ?? 90;
      goldSpotCooldownUntil = Date.now() + retrySec * 1000;
      throw new Error("Gold API rate-limited (HTTP 429). Please wait a bit.", {
        cause: error,
      });
    }
    throw error;
  }
}

export async function fetchGoldPricePerGramIDR(options = {}) {
  const { forceRefresh = false } = options;
  const cacheKey = "gold-spot-1g-idr";
  const now = Date.now();

  if (!forceRefresh) {
    const cached = readJsonCache(cacheKey);
    if (cached?.savedAt && now - cached.savedAt < GOLD_SPOT_TTL_MS) {
      const cachedPrice = Number(cached?.value);
      if (Number.isFinite(cachedPrice) && cachedPrice > 0) {
        appendGoldPriceHistory(cachedPrice);
        return cachedPrice;
      }
    }
  }

  if (!goldSpotInFlight) {
    goldSpotInFlight = fetchGoldPricePerGramIDRInternal()
      .then((result) => {
        writeJsonCache(cacheKey, { savedAt: Date.now(), value: result });
        appendGoldPriceHistory(result);
        return result;
      })
      .finally(() => {
        goldSpotInFlight = null;
      });
  }
  return await goldSpotInFlight;
}

export async function fetchCryptoPrice() {
  const response = await fetch(COINGECKO_API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch crypto prices");
  }
  return response.json();
}

export function getCachedCurrencyRates(baseCurrency = "USD") {
  try {
    const cached = localStorage.getItem(`ft_rates_${baseCurrency}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.rates) return parsed.rates;
    }
  } catch {
    // Ignore errors
  }
  return null; // Return null so callers know to fallback to FALLBACK_EXCHANGE_RATES if needed
}

export async function fetchCurrencyRates(baseCurrency = "USD") {
  const apiKey = import.meta.env.VITE_EXCHANGERATE_API_KEY;
  const normalizedBase = String(baseCurrency || "USD").toUpperCase();

  // Primary provider (requires API key)
  if (apiKey) {
    try {
      const response = await fetch(
        `${EXCHANGE_RATE_API_BASE_URL}/${apiKey}/latest/${normalizedBase}`,
      );
      if (response.ok) {
        const payload = await response.json();
        if (payload.result === "success" && payload.conversion_rates) {
          localStorage.setItem(`ft_rates_${normalizedBase}`, JSON.stringify({
            timestamp: Date.now(),
            rates: payload.conversion_rates
          }));
          return payload.conversion_rates;
        }
      }
    } catch {
      // Continue to fallback provider below.
    }
  }

  // Fallback provider (no API key)
  const fallbackPayload = await fetchJsonWithTimeout(
    `https://open.er-api.com/v6/latest/${normalizedBase}`,
    4500,
  );
  if (fallbackPayload?.result !== "success" || !fallbackPayload?.rates) {
    throw new Error("Currency rate API unavailable");
  }
  localStorage.setItem(`ft_rates_${normalizedBase}`, JSON.stringify({
    timestamp: Date.now(),
    rates: fallbackPayload.rates
  }));
  return fallbackPayload.rates;
}
