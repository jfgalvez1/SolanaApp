import { Property } from '../components/PropertyProvider'

export function calculateNightlyRate(pax: number, property: Property): number {
  const extra = pax > property.included_pax
    ? (pax - property.included_pax) * property.extra_pax_price
    : 0
  return property.base_price + extra
}

export function calculateTotalPrice(
  checkIn: string,
  checkOut: string,
  pax: number,
  property: Property
): number {
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const timeDiff = end.getTime() - start.getTime()
  const days = timeDiff > 0 ? Math.ceil(timeDiff / (1000 * 3600 * 24)) : 1
  return calculateNightlyRate(pax, property) * days
}

export function extraPaxLabel(pax: number, property: Property): string {
  if (pax <= property.included_pax) return ''
  const extra = (pax - property.included_pax) * property.extra_pax_price
  return `(+₱${extra})`
}
