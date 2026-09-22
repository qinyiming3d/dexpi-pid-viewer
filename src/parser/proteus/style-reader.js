import {
  attr,
  direct,
  numberAttr,
} from '../xml/xml-utils.js'

function rgbColor(channels) {
  return '#' + channels.map((value) => {
    return Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, '0')
  }).join('')
}

export function styleOf(element, defaultLineWeight = 0.25) {
  const presentation = direct(element, 'Presentation')
  const channels = ['R', 'G', 'B'].map((channel) => numberAttr(presentation, channel))
  const color = channels.every(Number.isFinite)
    ? rgbColor(channels)
    : attr(presentation, 'Color') || '#263945'
  return {
    color,
    lineWeight: numberAttr(presentation, 'LineWeight', defaultLineWeight),
    lineType: attr(presentation, 'LineType'),
    layer: attr(presentation, 'Layer'),
  }
}
