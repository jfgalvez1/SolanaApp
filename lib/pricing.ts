import { Property } from '../components/PropertyProvider'

/**
 * Rate card.
 * Weekdays are Sunday–Thursday. Weekends are Friday–Saturday.
 * Holiday nights use the holiday rate even when they fall on a weekday.
 * ₱2,500 / ₱2,800 covers 2 guests. Each guest after that is ₱500, maximum 5.
 */
export const PUBLIC_STAY_RATE = {
  maxPax: 5,
  includedPax: 2,
  weekdayPrice: 2500,
  weekendPrice: 2800,
  holidayPrice: 2800,
  extraPaxPrice: 500,
}

const FIXED_HOLIDAYS = new Set([
  '01-01', // New Year's Day
  '04-09', // Araw ng Kagitingan
  '05-01', // Labor Day
  '06-12', // Independence Day
  '08-21', // Ninoy Aquino Day
  '11-01', // All Saints' Day
  '11-02', // All Souls' Day
  '11-30', // Bonifacio Day
  '12-08', // Immaculate Conception
  '12-24', // Christmas Eve
  '12-25', // Christmas Day
  '12-30', // Rizal Day
  '12-31', // Last day of the year
])

/** Chinese New Year. Dates follow the lunar calendar. */
const CHINESE_NEW_YEAR = new Set([
  '2026-02-17',
  '2027-02-06',
  '2028-01-26',
  '2029-02-13',
  '2030-02-03',
])

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Anonymous Gregorian computus. Month is 1-based. */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { month, day }
}

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

function lastMondayOfAugust(year: number): string {
  const last = new Date(Date.UTC(year, 7, 31))
  const daysSinceMonday = (last.getUTCDay() + 6) % 7
  return isoDate(year, 8, 31 - daysSinceMonday)
}

/** Regular holidays and special non-working days. EDSA Anniversary stays a working day. */
export function isHoliday(isoDateValue: string): boolean {
  const monthDay = isoDateValue.slice(5)
  if (FIXED_HOLIDAYS.has(monthDay) || CHINESE_NEW_YEAR.has(isoDateValue)) return true

  const year = Number(isoDateValue.slice(0, 4))
  if (!Number.isFinite(year)) return false
  if (isoDateValue === lastMondayOfAugust(year)) return true

  const easter = easterSunday(year)
  const easterIso = isoDate(year, easter.month, easter.day)
  const maundyThursday = shiftIso(easterIso, -3)
  const goodFriday = shiftIso(easterIso, -2)
  const blackSaturday = shiftIso(easterIso, -1)
  return isoDateValue === maundyThursday || isoDateValue === goodFriday || isoDateValue === blackSaturday
}

export type NightKind = 'weekday' | 'weekend' | 'holiday'

export function nightKind(isoDateValue: string): NightKind {
  if (isHoliday(isoDateValue)) return 'holiday'
  const [year, month, day] = isoDateValue.split('-').map(Number)
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return dayOfWeek === 5 || dayOfWeek === 6 ? 'weekend' : 'weekday'
}

export function baseRateForNight(isoDateValue: string): number {
  const kind = nightKind(isoDateValue)
  if (kind === 'holiday') return PUBLIC_STAY_RATE.holidayPrice
  if (kind === 'weekend') return PUBLIC_STAY_RATE.weekendPrice
  return PUBLIC_STAY_RATE.weekdayPrice
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const [startYear, startMonth, startDay] = checkIn.split('-').map(Number)
  const [endYear, endMonth, endDay] = checkOut.split('-').map(Number)
  const start = Date.UTC(startYear, startMonth - 1, startDay)
  const end = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

export function stayNights(checkIn: string, checkOut: string): string[] {
  const count = nightsBetween(checkIn, checkOut)
  if (count <= 0) return []
  const [year, month, day] = checkIn.split('-').map(Number)
  const start = Date.UTC(year, month - 1, day)
  return Array.from({ length: count }, (_, index) =>
    new Date(start + index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  )
}

function extraGuestCharge(pax: number, includedPax: number, extraPaxPrice: number): number {
  return pax > includedPax ? (pax - includedPax) * extraPaxPrice : 0
}

export function calculateNightlyRate(pax: number, property: Property, night?: string): number {
  const base = night ? baseRateForNight(night) : PUBLIC_STAY_RATE.weekdayPrice
  return base + extraGuestCharge(pax, property.included_pax, property.extra_pax_price)
}

export function calculateTotalPrice(
  checkIn: string,
  checkOut: string,
  pax: number,
  property: Property
): number {
  const nights = stayNights(checkIn, checkOut)
  const extra = extraGuestCharge(pax, property.included_pax, property.extra_pax_price)
  if (nights.length === 0) {
    return (checkIn ? baseRateForNight(checkIn) : PUBLIC_STAY_RATE.weekdayPrice) + extra
  }
  return nights.reduce((sum, night) => sum + baseRateForNight(night) + extra, 0)
}

export type StayQuoteLine = {
  kind: NightKind
  nights: number
  rate: number
}

export type StayQuote = {
  nights: number
  lines: StayQuoteLine[]
  extraGuests: number
  extraPerNight: number
  total: number
}

export function quotePublicStay(checkIn: string, checkOut: string, pax: number): StayQuote {
  const nights = stayNights(checkIn, checkOut)
  const counts: Record<NightKind, number> = { weekday: 0, weekend: 0, holiday: 0 }
  for (const night of nights) counts[nightKind(night)] += 1

  const rateFor: Record<NightKind, number> = {
    weekday: PUBLIC_STAY_RATE.weekdayPrice,
    weekend: PUBLIC_STAY_RATE.weekendPrice,
    holiday: PUBLIC_STAY_RATE.holidayPrice,
  }
  const lines = (['weekday', 'weekend', 'holiday'] as NightKind[])
    .filter(kind => counts[kind] > 0)
    .map(kind => ({ kind, nights: counts[kind], rate: rateFor[kind] }))

  const extraGuests = Math.max(0, pax - PUBLIC_STAY_RATE.includedPax)
  const extraPerNight = extraGuests * PUBLIC_STAY_RATE.extraPaxPrice
  const roomTotal = lines.reduce((sum, line) => sum + line.nights * line.rate, 0)

  return {
    nights: nights.length,
    lines,
    extraGuests,
    extraPerNight,
    total: roomTotal + extraPerNight * nights.length,
  }
}

export function extraPaxLabel(pax: number, property: Property): string {
  if (pax <= property.included_pax) return ''
  const extra = (pax - property.included_pax) * property.extra_pax_price
  return `(+₱${extra})`
}
