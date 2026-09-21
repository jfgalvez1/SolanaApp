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

/** Occupied nights are [check_in, check_out). Checkout day is free for the next guest. */
export function datesOverlap(
  checkInA: string,
  checkOutA: string,
  checkInB: string,
  checkOutB: string
): boolean {
  return checkInA < checkOutB && checkInB < checkOutA
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
