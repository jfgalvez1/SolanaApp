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

/** Public rate card: ₱2,500 covers 2 guests, ₱500 for each guest after that, maximum 5. */
export const PUBLIC_STAY_RATE = {
  maxPax: 5,
  includedPax: 2,
  basePrice: 2500,
  extraPaxPrice: 500,
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const [startYear, startMonth, startDay] = checkIn.split('-').map(Number)
  const [endYear, endMonth, endDay] = checkOut.split('-').map(Number)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

export function publicNightlyRate(pax: number): number {
  const extraGuests = Math.max(0, pax - PUBLIC_STAY_RATE.includedPax)
  return PUBLIC_STAY_RATE.basePrice + extraGuests * PUBLIC_STAY_RATE.extraPaxPrice
}

export function extraPaxLabel(pax: number, property: Property): string {
  if (pax <= property.included_pax) return ''
  const extra = (pax - property.included_pax) * property.extra_pax_price
  return `(+₱${extra})`
}
