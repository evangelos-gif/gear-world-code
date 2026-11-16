/* Gear World Hub - Retailers (16/11/2026, lessons L166). A code, sale or banner whose last day has passed is hidden at
   once (the day in the UK), even before the pages are built again; when no code or sale is left, the page says so. */
(function () {
  var today;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch (e) {
    today = new Date().toISOString().slice(0, 10);
  }
  var items = document.querySelectorAll('[data-end]');
  for (var i = 0; i < items.length; i++) {
    if (items[i].getAttribute('data-end') < today) items[i].hidden = true;
  }
  var groups = document.querySelectorAll('.rt-offers');
  for (var g = 0; g < groups.length; g++) {
    var left = groups[g].querySelectorAll('.rt-offer:not([hidden])').length;
    var none = groups[g].querySelector('.rt-none');
    if (none && left === 0) none.hidden = false;
  }
})();
