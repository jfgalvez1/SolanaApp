import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { calculateTotalPrice, guestLimit } from '../../../../lib/pricing'
import { findOverlappingReservations } from '../../../../lib/reservationOverlap'
import { Property } from '../../../../components/PropertyProvider'
import {
  checkoutFollowsCheckIn,
  checkoutOrderMessage,
  DAY_TOUR_STAY,
} from '../../../../lib/stayType'

type FormBookingBody = {
  secret?: string
  property_slug?: string
  guest_name?: string
  check_in?: string
  check_out?: string
  pax?: number | string
  contact_number?: string
  check_in_preference?: string
  stay_type?: string
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Keep a phone number. Ignore the privacy-consent answer, which mentions "contact number". */
function phoneNumber(value: string): string {
  const trimmed = value.trim()
  if (!/\d/.test(trimmed)) return ''
  if (trimmed.length <= 40) return trimmed
  const compact = trimmed.replace(/[^\d+]/g, '')
  return compact.length > 0 && compact.length <= 40 ? compact : ''
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.BOOKING_WEBHOOK_SECRET
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'BOOKING_WEBHOOK_SECRET is not configured on the server' },
        { status: 500 }
      )
    }

    const headerSecret = request.headers.get('x-webhook-secret')
    const body = (await request.json()) as FormBookingBody
    const providedSecret = headerSecret || body.secret

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const guestName = (body.guest_name || '').trim()
    const checkIn = (body.check_in || '').trim()
    const checkOut = (body.check_out || '').trim()
    const propertySlug = (body.property_slug || 'villa-1').trim()
    const pax = Number(body.pax)
    const contactNumber = phoneNumber(body.contact_number || '')
    const checkInPreference = (body.check_in_preference || '').trim()
    let stayType = (body.stay_type || '').trim()

    if (!guestName) {
      return NextResponse.json({ error: 'guest_name is required' }, { status: 400 })
    }
    if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
      return NextResponse.json(
        { error: 'check_in and check_out must be YYYY-MM-DD' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(pax) || pax < 1) {
      return NextResponse.json({ error: 'pax must be a positive number' }, { status: 400 })
    }
    if (propertySlug === 'villa-2' && checkIn && checkOut && checkIn === checkOut && !stayType) {
      stayType = DAY_TOUR_STAY
    }
    if (!checkoutFollowsCheckIn(checkIn, checkOut, stayType)) {
      return NextResponse.json(
        { error: checkoutOrderMessage(stayType) },
        { status: 400 }
      )
    }
    if (checkInPreference.length > 120) {
      return NextResponse.json(
        { error: 'check_in_preference must be 120 characters or fewer' },
        { status: 400 }
      )
    }
    if (stayType.length > 160) {
      return NextResponse.json(
        { error: 'stay_type must be 160 characters or fewer' },
        { status: 400 }
      )
    }

    const admin = createSupabaseAdmin()

    const { data: property, error: propertyError } = await admin
      .from('properties')
      .select('*')
      .eq('slug', propertySlug)
      .maybeSingle()

    if (propertyError) throw propertyError
    if (!property) {
      return NextResponse.json(
        { error: `Property not found for slug: ${propertySlug}` },
        { status: 404 }
      )
    }

    const maxPax = guestLimit(property)
    if (maxPax != null && pax > maxPax) {
      return NextResponse.json(
        { error: `pax cannot exceed ${maxPax}` },
        { status: 400 }
      )
    }

    const { data: existing, error: existingError } = await admin
      .from('reservations')
      .select('id, guest_name, check_in, check_out, status')
      .eq('property_id', property.id)
      .in('status', ['confirmed', 'reserved'])

    if (existingError) throw existingError

    const conflicts = findOverlappingReservations(existing || [], checkIn, checkOut)
    const overlapWarning = conflicts.length
      ? `Overlaps ${conflicts
          .map(c => `${c.guest_name} (${c.check_in}–${c.check_out})`)
          .join('; ')}`
      : null

    const suggestedPrice = calculateTotalPrice(
      checkIn,
      checkOut,
      pax,
      property as Property
    )

    const bookingRow = {
      user_id: property.user_id,
      property_id: property.id,
      guest_name: guestName,
      check_in: checkIn,
      check_out: checkOut,
      pax,
      suggested_price: suggestedPrice,
      status: 'pending' as const,
      overlap_warning: overlapWarning,
      notes: 'Submitted via Google Form',
      contact_number: contactNumber || null,
      check_in_preference: checkInPreference || null,
      stay_type: stayType || null,
    }

    let { data: bookingRequest, error: insertError } = await admin
      .from('booking_requests')
      .insert([bookingRow])
      .select(
        'id, guest_name, check_in, check_out, pax, suggested_price, status, overlap_warning, contact_number, check_in_preference, stay_type'
      )
      .single()

    if (insertError && /stay_type/i.test(insertError.message)) {
      const { stay_type: droppedStay, ...withoutStay } = bookingRow
      const fallback = await admin
        .from('booking_requests')
        .insert([
          {
            ...withoutStay,
            notes: droppedStay
              ? `Submitted via Google Form. Stay: ${droppedStay}`
              : 'Submitted via Google Form',
          },
        ])
        .select(
          'id, guest_name, check_in, check_out, pax, suggested_price, status, overlap_warning, contact_number, check_in_preference'
        )
        .single()
      bookingRequest = fallback.data
        ? { ...fallback.data, stay_type: droppedStay }
        : null
      insertError = fallback.error
    }

    if (insertError) throw insertError

    return NextResponse.json({
      ok: true,
      booking_request: bookingRequest,
      overlap_warning: Boolean(overlapWarning),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('from-form webhook error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
