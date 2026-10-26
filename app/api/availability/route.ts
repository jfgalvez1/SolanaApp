import { NextResponse } from 'next/server'
import { createSupabaseAdmin } from '../../../lib/supabaseAdmin'

/** Public date grid. Returns occupying stays only — no guest, price, or contact fields. */
export async function GET() {
  try {
    const admin = createSupabaseAdmin()

    const { data: properties, error: propertyError } = await admin
      .from('properties')
      .select('id, name, slug')
      .order('slug', { ascending: true })

    if (propertyError) throw propertyError

    const { data: reservations, error: reservationError } = await admin
      .from('reservations')
      .select('id, property_id, check_in, check_out, status')
      .in('status', ['confirmed', 'reserved'])

    if (reservationError) throw reservationError

    const stays = reservations || []

    return NextResponse.json(
      {
        properties: (properties || []).map(property => ({
          id: property.id,
          name: property.name,
          slug: property.slug,
          reservations: stays
            .filter(stay => stay.property_id === property.id)
            .map(stay => ({
              id: stay.id,
              check_in: stay.check_in,
              check_out: stay.check_out,
              status: stay.status,
            })),
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('availability error:', message)
    return NextResponse.json({ error: 'Could not load availability' }, { status: 500 })
  }
}
