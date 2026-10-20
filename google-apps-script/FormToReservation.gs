/**
 * Paste this into the Google Sheet linked to your Form:
 * Extensions → Apps Script
 *
 * Then: Triggers (clock icon) → Add Trigger
 *   Function: onFormSubmit
 *   Event source: From spreadsheet
 *   Event type: On form submit
 *
 * Script Properties (Project Settings → Script properties):
 *   WEBHOOK_URL     = https://YOUR_DOMAIN/api/bookings/from-form
 *   WEBHOOK_SECRET  = same value as BOOKING_WEBHOOK_SECRET in .env.local
 *   PROPERTY_SLUG   = villa-1   (optional; defaults to villa-1)
 *
 * Form question titles must match EXACTLY (or edit the keys below):
 *   Name of Guest/s*
 *   Number of Guest that will stay*
 *   Please select your check-in date:
 *   Please select your check-out date:
 */

var QUESTION = {
  guestName: 'Name of Guest/s*',
  pax: 'Number of Guest that will stay*',
  checkIn: 'Please select your check-in date:',
  checkOut: 'Please select your check-out date:',
};

function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var webhookSecret = props.getProperty('WEBHOOK_SECRET');
  var propertySlug = props.getProperty('PROPERTY_SLUG') || 'villa-1';

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Script properties');
  }

  var named = e.namedValues;
  var guestName = firstValue(named[QUESTION.guestName]);
  var paxRaw = firstValue(named[QUESTION.pax]);
  var checkInRaw = firstValue(named[QUESTION.checkIn]);
  var checkOutRaw = firstValue(named[QUESTION.checkOut]);

  var payload = {
    property_slug: propertySlug,
    guest_name: guestName,
    pax: parseInt(String(paxRaw).replace(/[^\d]/g, ''), 10),
    check_in: toIsoDate(checkInRaw),
    check_out: toIsoDate(checkOutRaw),
  };

  var response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-webhook-secret': webhookSecret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code < 200 || code >= 300) {
    console.error('Webhook failed', code, body, payload);
    throw new Error('Webhook failed (' + code + '): ' + body);
  }

  console.log('Reservation created', body);
}

function firstValue(values) {
  if (!values || !values.length) return '';
  return String(values[0]).trim();
}

/** Converts Google Form / Sheets date values to YYYY-MM-DD */
function toIsoDate(value) {
  if (!value) throw new Error('Missing date value');

  var text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  var parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    throw new Error('Could not parse date: ' + text);
  }

  var year = parsed.getFullYear();
  var month = String(parsed.getMonth() + 1).padStart(2, '0');
  var day = String(parsed.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}
