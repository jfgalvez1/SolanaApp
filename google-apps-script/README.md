# Google Form → Reservation sync

Keeps your existing Google Form. When a guest submits, Apps Script posts **guest name, check-in, check-out, and pax** into the app as a `reserved` booking.

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

## 4. Test

Submit a test response on the Form. In the app (logged in), open **Reservations** — you should see a new **reserved** row with price calculated from the villa’s rates.

If dates overlap an existing booking, the reservation is still created and `notes` includes an overlap warning.
