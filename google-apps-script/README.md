# Google Form → Reservation sync

Keeps your existing Google Form. When a guest submits, Apps Script posts **guest name, check-in, check-out, pax, contact number, and check-in preference** into the app as a **pending booking request**. Nothing is added to Reservations until you approve it on the **Booking Requests** page. Contact number and check-in preference are optional.

## 1. App env

In `.env.local` (and your host, e.g. Vercel):

```env
SUPABASE_SERVICE_ROLE_KEY=...   # Supabase → Project Settings → API → service_role
BOOKING_WEBHOOK_SECRET=...      # any long random string you invent
```

Restart `npm run dev` after saving.

Webhook URL:

- Local (for testing with a tunnel): `https://YOUR_TUNNEL/api/bookings/from-form`
- Production: `https://YOUR_DOMAIN/api/bookings/from-form`

## 2. Google Apps Script

1. Open the **Sheet** linked to your Form (Responses → spreadsheet).
2. **Extensions → Apps Script**.
3. Paste the contents of `FormToReservation.gs` and save.
4. **Project Settings → Script properties** — add:
   - `WEBHOOK_URL` = your webhook URL
   - `WEBHOOK_SECRET` = same as `BOOKING_WEBHOOK_SECRET`
   - `PROPERTY_SLUG` = `villa-1` (or `villa-2`)
5. **Triggers → Add Trigger**:
   - Function: `onFormSubmit`
   - Event source: From spreadsheet
   - Event type: On form submit

## 3. Question titles

These Form question titles must match exactly (or edit `QUESTION` in the script):

| Form question | Sent as |
|---|---|
| Name of Guest/s* | `guest_name` |
| Number of Guest that will stay* | `pax` |
| Please select your check-in date: | `check_in` |
| Please select your check-out date: | `check_out` |
| Contact number | `contact_number` (optional) |
| Check-in preference* | `check_in_preference` (optional) |
| What type of stay would you like to book? | `stay_type` (optional; Villa 2) |

Villa 2 stay choices:

| Choice | Check-in | Check-out |
|---|---|---|
| Overnight (12:00 PM – 9:00 AM) | 12:00 PM | 9:00 AM the next morning |
| Day Tour (11:00 AM – 9:00 PM) | 11:00 AM | 9:00 PM the same day |

A day tour can use the same date for check-in and check-out. Overnight still needs a later check-out date.

## 4. Database (one-time)

In Supabase → SQL Editor, run `supabase/migrations/002_booking_requests.sql`.

Then run `supabase/migrations/003_contact_number.sql` so the optional contact number can be saved. Use a short-answer question titled **Contact number** (not a number question) so a leading `0` is kept.

Then run `supabase/migrations/004_check_in_preference.sql` so the **Check-in preference*** answer can be saved.

Then run `supabase/migrations/008_stay_type.sql` so the Villa 2 stay type can be saved.

## 5. Test

Submit a test response on the Form. In the app, open **Booking Requests** — you should see a new **pending** row. Review → edit if needed → **Approve** (creates a reservation) or **Reject**.

If dates overlap an existing booking, the request still appears with an overlap warning; approve is blocked until you change the dates.

If the Form says the response was recorded but **Booking Requests** stays empty, open the form’s Apps Script → **Executions**. A failed run shows the error. After editing questions, confirm the **On form submit** trigger for `onFormSubmit` is still there, then paste the latest `FormToReservation.gs` and save. Changing a question does not update the script that is already saved in Google.
