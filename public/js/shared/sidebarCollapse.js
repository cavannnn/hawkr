(function () {
  function init() {
    var hamburger = document.querySelector(".sidebarHamburger");
    var sidebar = document.querySelector(".sidebar");
    var main = document.querySelector(".mainContent");
    if (!hamburger || !sidebar || !main) return;

    function isMobile() {
      var bp = getComputedStyle(document.documentElement).getPropertyValue("--bp-mobile").trim() || "768px";
      return window.matchMedia("(max-width: " + bp + ")").matches;
    }

    var collapsed = localStorage.getItem("sidebarCollapsed") === "true";

    function apply() {
      var effective = collapsed && !isMobile();
      sidebar.classList.toggle("isCollapsed", effective);
      main.classList.toggle("isCollapsed", effective);
      hamburger.setAttribute("aria-expanded", effective ? "false" : "true");
    }
    apply();

    hamburger.addEventListener("click", function () {
      if (isMobile()) return;
      collapsed = !collapsed;
      localStorage.setItem("sidebarCollapsed", collapsed);
      apply();
    });

    window.addEventListener("resize", apply);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
