/**
 * Paste into Apps Script on either:
 *   - the Google Form, or
 *   - the linked response Sheet
 *
 * Trigger → Add Trigger:
 *   Function: onFormSubmit
 *   Event source: From form  (if script is on the Form)
 *              OR From spreadsheet (if script is on the Sheet)
 *   Event type: On form submit
 *
 * Script Properties (Project Settings → Script properties):
 *   WEBHOOK_URL     = https://YOUR_DOMAIN/api/bookings/from-form
 *   WEBHOOK_SECRET  = same value as BOOKING_WEBHOOK_SECRET
 *   PROPERTY_SLUG   = villa-1   (optional; defaults to villa-1)
 *                   = villa-2   for the Solana Villa 2 form
 *
 * Question titles are matched loosely. Required:
 *   Name of Guest/s*
 *   Number of Guest that will stay*
 *   Please select your check-in date:
 *   Please select your check-out date:
 * Optional:
 *   Contact number
 *   Check-in preference*
 *   What type of stay would you like to book?
 *     Overnight (12:00 PM – 9:00 AM)
 *     Day Tour (11:00 AM – 9:00 PM)
 * A day tour may use the same check-in and check-out date.
 */

var QUESTION = {
  guestName: ['name of guest'],
  pax: ['number of guest'],
  checkIn: ['check-in date', 'check in date'],
  checkOut: ['check-out date', 'check out date'],
  contactNumber: ['contact number'],
  checkInPreference: ['check-in preference', 'check in preference'],
  stayType: ['type of stay'],
};

function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var webhookSecret = props.getProperty('WEBHOOK_SECRET');
  var propertySlug = props.getProperty('PROPERTY_SLUG') || 'villa-1';

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Script properties');
  }

  var answers = readAnswers(e);
  var payload = {
    property_slug: propertySlug,
    guest_name: answers.guestName,
    pax: parseInt(String(answers.pax).replace(/[^\d]/g, ''), 10),
    check_in: toIsoDate(answers.checkIn),
    check_out: toIsoDate(answers.checkOut),
    contact_number: answers.contactNumber,
    check_in_preference: answers.checkInPreference,
    stay_type: answers.stayType,
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

  console.log('Booking request created', body);
}

/** Supports Form-bound (e.response) and Sheet-bound (e.namedValues) triggers */
function readAnswers(e) {
  var map = answersMap(e);
  return {
    guestName: requireAnswer(map, QUESTION.guestName, 'guest name'),
    pax: requireAnswer(map, QUESTION.pax, 'number of guests'),
    checkIn: requireAnswer(map, QUESTION.checkIn, 'check-in date'),
    checkOut: requireAnswer(map, QUESTION.checkOut, 'check-out date'),
    contactNumber: findAnswer(map, QUESTION.contactNumber),
    checkInPreference: findAnswer(map, QUESTION.checkInPreference),
    stayType: findAnswer(map, QUESTION.stayType),
  };
}

function answersMap(e) {
  var map = {};
  if (e && e.namedValues) {
    var namedKeys = Object.keys(e.namedValues);
    for (var n = 0; n < namedKeys.length; n++) {
      map[namedKeys[n]] = firstValue(e.namedValues[namedKeys[n]]);
    }
    return map;
  }

  if (e && e.response) {
    var items = e.response.getItemResponses();
    for (var i = 0; i < items.length; i++) {
      map[items[i].getItem().getTitle()] = String(items[i].getResponse()).trim();
    }
    return map;
  }

  throw new Error('Unsupported form submit event. Use On form submit trigger.');
}

function firstValue(values) {
  if (!values || !values.length) return '';
  return String(values[0]).trim();
}

function normalizeTitle(title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .replace(/\*+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAnswer(map, needles) {
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    var normalized = normalizeTitle(keys[i]);
    for (var j = 0; j < needles.length; j++) {
      if (normalized.indexOf(needles[j]) === -1) continue;
      var value = String(map[keys[i]] || '').trim();
      if (value) return value;
    }
  }
  return '';
}

function requireAnswer(map, needles, label) {
  var value = findAnswer(map, needles);
  if (value) return value;
  throw new Error(
    'Could not find ' + label + '. Questions received: ' + Object.keys(map).join(' | ')
  );
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
