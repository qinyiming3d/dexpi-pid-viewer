/** Include declared extents and drawable coordinates without rescaling either. */
export function computeDocumentBounds(primitives, extentPoints = [], millimetre = 1) {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  }
  const expand = (point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return
    }
    bounds.minX = Math.min(bounds.minX, point.x)
    bounds.minY = Math.min(bounds.minY, point.y)
    bounds.maxX = Math.max(bounds.maxX, point.x)
    bounds.maxY = Math.max(bounds.maxY, point.y)
  }

  extentPoints.forEach(expand)
  for (const primitive of primitives) {
    if (primitive.points) {
      primitive.points.forEach(expand)
    } else if (primitive.position) {
      expand(primitive.position)
    }
  }
  if (!Number.isFinite(bounds.minX)) {
    Object.assign(bounds, {
      minX: 0,
      minY: 0,
      maxX: 100,
      maxY: 100,
    })
  }
  const degenerateSpan =
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 1e-6 || millimetre
  if (bounds.maxX === bounds.minX) {
    bounds.maxX += degenerateSpan
  }
  if (bounds.maxY === bounds.minY) {
    bounds.maxY += degenerateSpan
  }
  return bounds
}
