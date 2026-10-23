import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdmin } from '../../../../lib/supabaseAdmin'
import { calculateTotalPrice } from '../../../../lib/pricing'
import { findOverlappingReservations } from '../../../../lib/reservationOverlap'
import { Property } from '../../../../components/PropertyProvider'

type FormBookingBody = {
  secret?: string
  property_slug?: string
  guest_name?: string
  check_in?: string
  check_out?: string
  pax?: number | string
  contact_number?: string
  check_in_preference?: string
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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
    const contactNumber = (body.contact_number || '').trim()
    const checkInPreference = (body.check_in_preference || '').trim()

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
    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: 'check_out must be after check_in' },
        { status: 400 }
      )
    }
    if (contactNumber.length > 40) {
      return NextResponse.json(
        { error: 'contact_number must be 40 characters or fewer' },
        { status: 400 }
      )
    }
    if (checkInPreference.length > 120) {
      return NextResponse.json(
        { error: 'check_in_preference must be 120 characters or fewer' },
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

    if (pax > property.max_pax) {
      return NextResponse.json(
        { error: `pax cannot exceed ${property.max_pax}` },
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

    const { data: bookingRequest, error: insertError } = await admin
      .from('booking_requests')
      .insert([
        {
          user_id: property.user_id,
          property_id: property.id,
          guest_name: guestName,
          check_in: checkIn,
          check_out: checkOut,
          pax,
          suggested_price: suggestedPrice,
          status: 'pending',
          overlap_warning: overlapWarning,
          notes: 'Submitted via Google Form',
          contact_number: contactNumber || null,
          check_in_preference: checkInPreference || null,
        },
      ])
      .select(
        'id, guest_name, check_in, check_out, pax, suggested_price, status, overlap_warning, contact_number, check_in_preference'
      )
      .single()

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
