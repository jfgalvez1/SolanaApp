export const OVERNIGHT_STAY = 'Overnight (12:00 PM – 9:00 AM)'
export const DAY_TOUR_STAY = 'Day Tour (11:00 AM – 9:00 PM)'

export const STAY_TYPE_OPTIONS = [OVERNIGHT_STAY, DAY_TOUR_STAY] as const

export const OVERNIGHT_TIMES = { checkIn: '12:00 PM', checkOut: '9:00 AM' }
export const DAY_TOUR_TIMES = { checkIn: '11:00 AM', checkOut: '9:00 PM' }
export const VILLA_1_TIMES = { checkIn: '2:00 PM', checkOut: '11:00 AM' }

export type StaySchedule = { label: string; checkIn: string; checkOut: string; note?: string }

export function isDayTour(value: string | null | undefined): boolean {
  return /day\s*tour/i.test(value || '')
}

/** "Day Tour" or "Overnight". The hours are shown on the check-in and check-out lines. */
export function stayTypeLabel(value: string | null | undefined): string {
  const text = (value || '').trim()
  if (!text) return ''
  if (isDayTour(text)) return 'Day Tour'
  if (/overnight/i.test(text)) return 'Overnight'
  return text.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

export function stayTypeOptions(current: string): string[] {
  const trimmed = current.trim()
  if (trimmed && !STAY_TYPE_OPTIONS.includes(trimmed as (typeof STAY_TYPE_OPTIONS)[number])) {
    return [trimmed, ...STAY_TYPE_OPTIONS]
  }
  return [...STAY_TYPE_OPTIONS]
}

/** Prefer the stay_type column. Fall back to a note written before that column existed. */
export function readStayType(record?: { stay_type?: string | null; notes?: string | null } | null): string {
  const direct = (record?.stay_type || '').trim()
  if (direct) return direct
  const match = (record?.notes || '').match(/Stay:\s*(.+)$/m)
  return match ? match[1].trim() : ''
}

export function checkoutFollowsCheckIn(
  checkIn: string,
  checkOut: string,
  stayType?: string | null
): boolean {
  if (!checkIn || !checkOut) return false
  if (isDayTour(stayType)) return checkOut >= checkIn
  return checkOut > checkIn
}

export function checkoutOrderMessage(stayType?: string | null): string {
  if (isDayTour(stayType)) return 'Check-out cannot be before the check-in date.'
  return 'Check-out must be after check-in'
}

export function stayTimesFor(slug?: string | null, stayType?: string | null) {
  if (slug === 'villa-2') return isDayTour(stayType) ? DAY_TOUR_TIMES : OVERNIGHT_TIMES
  return VILLA_1_TIMES
}

export function villaStaySchedules(slug?: string | null): StaySchedule[] {
  if (slug === 'villa-2') {
    return [
      { label: 'Overnight', ...OVERNIGHT_TIMES, note: 'the next morning' },
      { label: 'Day Tour', ...DAY_TOUR_TIMES, note: 'the same day' },
    ]
  }
  return [{ label: '', ...VILLA_1_TIMES }]
}
