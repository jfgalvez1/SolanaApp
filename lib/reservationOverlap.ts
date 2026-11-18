export const OCCUPYING_STATUSES = ['confirmed', 'reserved'] as const

export type OccupyingStatus = (typeof OCCUPYING_STATUSES)[number]

type OverlapReservation = {
  id: string
  guest_name: string
  check_in: string
  check_out: string
  status: string
}

export function isOccupyingStatus(status: string | null | undefined): status is OccupyingStatus {
  return !!status && (OCCUPYING_STATUSES as readonly string[]).includes(status)
}

function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/**
 * Occupied nights are [check_in, check_out). Checkout morning is free.
 * A same-day stay, such as a day tour, occupies that calendar day.
 */
export function exclusiveStayEnd(checkIn: string, checkOut: string): string {
  if (checkIn && checkOut === checkIn) return addIsoDays(checkIn, 1)
  return checkOut
}

export function occupiesDate(checkIn: string, checkOut: string, dayIso: string): boolean {
  if (!checkIn || !checkOut || !dayIso) return false
  return dayIso >= checkIn && dayIso < exclusiveStayEnd(checkIn, checkOut)
}

export function datesOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string
): boolean {
  const endA = exclusiveStayEnd(checkInA, checkOutA)
  const endB = exclusiveStayEnd(checkInB, checkOutB)
  return checkInA < endB && checkInB < endA
}

export function findOverlappingReservations<T extends OverlapReservation>(
  reservations: T[],
  checkIn: string,
  checkOut: string,
  excludeId?: string | null
): T[] {
  if (!checkIn || !checkOut) return []
  return reservations.filter(res => {
    if (excludeId && res.id === excludeId) return false
    if (!isOccupyingStatus(res.status)) return false
    return datesOverlap(checkIn, checkOut, res.check_in, res.check_out)
  })
}

function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatOverlapError(
  conflicts: Pick<OverlapReservation, 'guest_name' | 'check_in' | 'check_out'>[]
): string {
  const first = conflicts[0]
  const range = `${formatDisplayDate(first.check_in)} – ${formatDisplayDate(first.check_out)}`
  const extra = conflicts.length > 1 ? ` and ${conflicts.length - 1} more` : ''
  return `Cannot add this reservation. ${first.guest_name} is already booked for ${range}${extra}.`
}
