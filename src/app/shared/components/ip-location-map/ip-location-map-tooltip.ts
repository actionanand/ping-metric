/** Read only the hovered renderer data point, never Chart.js's formatted label. */
export function tooltipFeatureName(
  point: unknown,
  mode: 'india' | 'world',
  interactionsAllowed = true,
): string {
  if (!interactionsAllowed || typeof point !== 'object' || point === null) return '';
  const feature = (point as Record<string, unknown>)['feature'];
  if (typeof feature !== 'object' || feature === null) return '';
  const properties = (feature as Record<string, unknown>)['properties'];
  if (typeof properties !== 'object' || properties === null) return '';
  const value = (properties as Record<string, unknown>)[mode === 'india' ? 'state_name' : 'name'];
  if (typeof value !== 'string') return '';
  const name = value.trim();
  return !name || ['undefined', 'null', '[object object]'].includes(name.toLowerCase()) ? '' : name;
}
