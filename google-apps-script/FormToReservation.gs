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

  var answers = readAnswers(e);
  var payload = {
    property_slug: propertySlug,
    guest_name: answers.guestName,
    pax: parseInt(String(answers.pax).replace(/[^\d]/g, ''), 10),
    check_in: toIsoDate(answers.checkIn),
    check_out: toIsoDate(answers.checkOut),
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

/** Supports Form-bound (e.response) and Sheet-bound (e.namedValues) triggers */
function readAnswers(e) {
  if (e && e.namedValues) {
    return {
      guestName: firstValue(e.namedValues[QUESTION.guestName]),
      pax: firstValue(e.namedValues[QUESTION.pax]),
      checkIn: firstValue(e.namedValues[QUESTION.checkIn]),
      checkOut: firstValue(e.namedValues[QUESTION.checkOut]),
    };
  }

  if (e && e.response) {
    var map = {};
    var items = e.response.getItemResponses();
    for (var i = 0; i < items.length; i++) {
      map[items[i].getItem().getTitle()] = String(items[i].getResponse()).trim();
    }
    return {
      guestName: map[QUESTION.guestName] || '',
      pax: map[QUESTION.pax] || '',
      checkIn: map[QUESTION.checkIn] || '',
      checkOut: map[QUESTION.checkOut] || '',
    };
  }

  throw new Error('Unsupported form submit event. Use On form submit trigger.');
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
