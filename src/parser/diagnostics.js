/** Each import owns its warnings; repeated messages retain first-seen order. */
export function createDiagnostics() {
  const warnings = []
  const seen = new Set()

  function warn(message) {
    if (seen.has(message)) {
      return
    }
    seen.add(message)
    warnings.push(message)
  }

  return {
    warnings,
    warn,
  }
}
