import { villaStaySchedules } from '../lib/stayType'

export default function StayHours({
  slug,
  margin = '0.15rem 0 0',
}: {
  slug?: string | null
  margin?: string
}) {
  const schedules = villaStaySchedules(slug)
  if (schedules.length > 1) {
    return (
      <p style={{ margin, color: 'var(--text-muted)' }}>
        {schedules.map(item => (
          <span key={item.label} style={{ display: 'block' }}>
            <strong style={{ color: 'var(--text-main)' }}>{item.label}:</strong> check-in {item.checkIn}, check-out {item.checkOut}{item.note ? ` ${item.note}` : ''}.
          </span>
        ))}
      </p>
    )
  }

  const times = schedules[0]
  return (
    <p style={{ margin, color: 'var(--text-muted)' }}>
      Check-in is at <strong style={{ color: 'var(--text-main)' }}>{times.checkIn}</strong>. Check-out is at <strong style={{ color: 'var(--text-main)' }}>{times.checkOut}</strong>.
    </p>
  )
}
