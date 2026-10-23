/** Labels must match the Google Form radio options exactly. */
export const CHECK_IN_PREFERENCES = [
  'Self check-in',
  'Check-in w/ assistance',
] as const

export function checkInPreferenceOptions(current: string): string[] {
  const trimmed = current.trim()
  if (trimmed && !CHECK_IN_PREFERENCES.includes(trimmed as (typeof CHECK_IN_PREFERENCES)[number])) {
    return [trimmed, ...CHECK_IN_PREFERENCES]
  }
  return [...CHECK_IN_PREFERENCES]
}
