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

## 4. Database (one-time)

In Supabase → SQL Editor, run `supabase/migrations/002_booking_requests.sql`.

Then run `supabase/migrations/003_contact_number.sql` so the optional contact number can be saved. Use a short-answer question titled **Contact number** (not a number question) so a leading `0` is kept.

Then run `supabase/migrations/004_check_in_preference.sql` so the **Check-in preference*** answer can be saved.

## 5. Test

Submit a test response on the Form. In the app, open **Booking Requests** — you should see a new **pending** row. Review → edit if needed → **Approve** (creates a reservation) or **Reject**.

If dates overlap an existing booking, the request still appears with an overlap warning; approve is blocked until you change the dates.
