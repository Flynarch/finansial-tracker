/**
 * Streaming response and function call argument parsers for FinTrack AI.
 */

/**
 * Deep merges streaming functionCall arguments across multiple SSE chunks,
 * ensuring arrays and nested objects are properly accumulated without loss.
 *
 * @param {object} target - Target object to mutate
 * @param {object} source - Delta chunk to merge into target
 * @returns {object} Mutated target object
 */
export function mergeFunctionCallArgs(target, source) {
  if (!source || typeof source !== 'object') return target
  for (const key of Object.keys(source)) {
    const srcVal = source[key]
    const tgtVal = target[key]
    if (Array.isArray(tgtVal) && Array.isArray(srcVal)) {
      const result = [...tgtVal]
      const matchedTgtIndices = new Set()
      for (const sItem of srcVal) {
        let matchIdx = -1
        for (let i = 0; i < tgtVal.length; i++) {
          if (!matchedTgtIndices.has(i) && JSON.stringify(tgtVal[i]) === JSON.stringify(sItem)) {
            matchIdx = i
            break
          }
        }
        if (matchIdx !== -1) {
          matchedTgtIndices.add(matchIdx)
          continue
        }
        const lastIdx = result.length - 1
        const lastItem = result[lastIdx]
        if (
          lastItem &&
          typeof lastItem === 'object' &&
          typeof sItem === 'object' &&
          lastItem !== null &&
          sItem !== null &&
          !Array.isArray(lastItem) &&
          !Array.isArray(sItem) &&
          JSON.stringify(lastItem) !== JSON.stringify(sItem)
        ) {
          const tKeys = Object.keys(lastItem)
          const hasCommonMismatch = tKeys.some((k) => {
            if (sItem[k] === undefined) return false
            const sVal = sItem[k]
            const tVal = lastItem[k]
            if (sVal && tVal && typeof sVal === 'object' && typeof tVal === 'object') {
              return false
            }
            return sVal !== tVal
          })
          if (!hasCommonMismatch) {
            result[lastIdx] = mergeFunctionCallArgs({ ...lastItem }, sItem)
            continue
          }
        }
        result.push(sItem)
      }
      target[key] = result
    } else if (
      srcVal &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      mergeFunctionCallArgs(tgtVal, srcVal)
    } else {
      target[key] = srcVal
    }
  }
  return target
}

/**
 * Processes a single complete SSE event block per W3C EventSource specifications.
 * Gathers all 'data:' lines, joins them with newline, handles '[DONE]', and parses JSON.
 *
 * @param {string} eventBlock - Raw SSE event block string
 * @param {object} state - Stream accumulator state ({ fullText, functionCall })
 * @param {Function} [onStream] - Optional streaming chunk callback
 */
export function processSseEventBlock(eventBlock, state, onStream) {
  if (!eventBlock || !eventBlock.trim()) return
  const lines = eventBlock.split(/\r?\n|\r/)
  const dataLines = []
  for (const rawLine of lines) {
    const line = rawLine.trimStart()
    if (line.startsWith('data:')) {
      const rest = line.slice(5)
      dataLines.push(rest.startsWith(' ') ? rest.slice(1) : rest)
    }
  }
  if (dataLines.length === 0) return

  const dataStr = dataLines.join('\n').trim()
  if (dataStr === '[DONE]' || !dataStr) return

  try {
    const data = JSON.parse(dataStr)
    const parts = data.candidates?.[0]?.content?.parts || []
    for (const p of parts) {
      if (p.text && !p.thought) {
        state.fullText = (state.fullText || '') + p.text
        if (onStream) onStream(p.text)
      }
      if (p.functionCall) {
        const sig =
          p.thought_signature ||
          p.thoughtSignature ||
          p.functionCall.thought_signature ||
          p.functionCall.thoughtSignature ||
          null

        if (!state.functionCall) {
          state.functionCall = {
            name: p.functionCall.name || '',
            args: {},
            thought_signature: sig,
            thoughtSignature: sig,
          }
        } else if (p.functionCall.name && !state.functionCall.name) {
          state.functionCall.name = p.functionCall.name
        }

        if (sig && !state.functionCall.thought_signature) {
          state.functionCall.thought_signature = sig
          state.functionCall.thoughtSignature = sig
        }

        if (p.functionCall.args) {
          mergeFunctionCallArgs(state.functionCall.args, p.functionCall.args)
        }
      } else if (p.thought_signature || p.thoughtSignature) {
        const sig = p.thought_signature || p.thoughtSignature
        if (state.functionCall && !state.functionCall.thought_signature) {
          state.functionCall.thought_signature = sig
          state.functionCall.thoughtSignature = sig
        }
      }
    }
  } catch {
    // ignore malformed SSE json chunk
  }
}
