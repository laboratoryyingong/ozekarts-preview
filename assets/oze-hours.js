/* OZ EKARTS trading hours + SA school-holiday calendar (shared by Header, Footer, Contact).
   Edit HOURS / HOLIDAY_HOURS / HOLIDAYS here; everything on the site reads from this file.
   Preview override: add ?holiday=1 (or ?holiday=0) to any page URL to force the mode. */
(function () {
  'use strict';
  // index = JS getDay(): 0 Sunday … 6 Saturday
  const HOURS = ['10:00am – 9:00pm', '12:00pm – 9:00pm', 'Closed', '12:00pm – 9:00pm', '12:00pm – 10:00pm', '10:00am – 12:00am', '9:00am – 12:00am'];
  // During SA school holidays the venue opens 7 days. Tuesday hours below are an assumption — confirm with the client.
  const HOLIDAY_HOURS = HOURS.slice(); HOLIDAY_HOURS[2] = '12:00pm – 9:00pm';
  // SA public-school holidays (inclusive). Source: SA Department for Education term dates 2026 / 2027.
  const HOLIDAYS = [
    ['2026-04-11', '2026-04-26'], ['2026-07-04', '2026-07-19'], ['2026-09-26', '2026-10-11'], ['2026-12-12', '2027-01-26'],
    ['2027-04-10', '2027-04-25'], ['2027-07-03', '2027-07-18'], ['2027-09-25', '2027-10-10'], ['2027-12-11', '2028-01-26']
  ];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function isHoliday(date) {
    try { const q = new URLSearchParams(location.search).get('holiday'); if (q === '1') return true; if (q === '0') return false; } catch (e) {}
    const k = ymd(date || new Date());
    return HOLIDAYS.some(([a, b]) => k >= a && k <= b);
  }
  function today(date) {
    const d = date || new Date(), h = isHoliday(d), t = (h ? HOLIDAY_HOURS : HOURS)[d.getDay()];
    return { day: DAYS[d.getDay()], hours: t, closed: t === 'Closed', holiday: h };
  }
  function week(date) {
    const h = isHoliday(date || new Date()), src = h ? HOLIDAY_HOURS : HOURS;
    return { holiday: h, rows: [1, 2, 3, 4, 5, 6, 0].map((i) => ({ d: DAYS[i], t: src[i], closed: src[i] === 'Closed' })) };
  }
  window.OZE = { isHoliday, today, week, HOURS, HOLIDAY_HOURS, HOLIDAYS };
})();
