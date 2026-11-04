/* login.js — the login / sign-up entry (#view-login). */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var view = document.getElementById("view-login");
    if (!view) return;

    view.querySelector("[data-login-back]").addEventListener("click", function () {
      history.back();
    });

    view.querySelector("[data-login-guest]").addEventListener("click", function () {
      navigate("home");
    });

  });
})();
