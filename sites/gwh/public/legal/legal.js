// Gear World Hub - legal pages: footer year and the analytics choice on /cookies/.
(function () {
  "use strict";
  var KEY = "gwh_analytics_consent";
  var y = document.getElementById("lgYear");
  if (y) y.textContent = String(new Date().getFullYear());
  var status = document.getElementById("gwhAnalyticsStatus");
  var button = document.getElementById("gwhAnalyticsReset");
  if (!status || !button) return;
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function show() {
    var v = read();
    status.textContent = v === "granted" ? "Your choice: analytics allowed."
      : v === "denied" ? "Your choice: analytics rejected."
      : "You have not made a choice yet. The Hub will ask you on the home page.";
  }
  function dropGaCookies() {
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!/^_ga/.test(name)) return;
      ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }
  button.hidden = false;
  button.addEventListener("click", function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    dropGaCookies();
    status.textContent = "Your choice has been reset. The Hub will ask you again on the home page.";
  });
  show();
})();
