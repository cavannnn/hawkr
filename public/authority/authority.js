import { initLiquidGlass, makeLiquidGlass } from "../assets/js/liquidGlass.js";
import { initLiquidGlassToggle, setToggleState } from "../assets/js/liquidGlassToggle.js";
import { signOut as endSession } from "../data/session.js";
window.initLiquidGlass = initLiquidGlass;
window.makeLiquidGlass = makeLiquidGlass;

/* authority.js — the NEA officer's desk (#view-authority). */
(function (global, doc) {
  "use strict";

  var REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TOKEN_KEY = "authToken";
  var LOGIN_URL = "../auth/login.html";
  var MAX_REMARKS = 1000;
  var STATUS_IN_PROGRESS = "In Progress";
  var STATUS_COMPLETED = "Completed";
  var RECOVERY_CLEAN_INSPECTIONS = 5;
  var RECOVERY_MONTHS = 12;

  function officerId() {
    var stored = localStorage.getItem("userId");
    return stored == null ? null : Number(stored);
  }

  function signOut() {
    endSession(LOGIN_URL);
  }

  function api(path, options) {
    var opts = options || {};
    opts.headers = opts.headers || {};
    opts.headers.Authorization = "Bearer " + (localStorage.getItem(TOKEN_KEY) || "");
    return fetch(path, opts).then(function (res) {
      if (res.status === 401) {
        signOut();
        return Promise.reject(new Error("Not signed in."));
      }
      return res.json().then(function (body) {
        if (res.status === 403 && !body.error) {
          signOut();
          return Promise.reject(new Error(body.message || "Not signed in."));
        }
        if (!res.ok) return Promise.reject(new Error(body.error || body.message || "Request failed."));
        return body;
      });
    });
  }

  function loadData() {
    return Promise.all([
      api("/stalls"), api("/inspections"), api("/inspections/completed"), api("/stalls/unassigned")
    ]).then(function (r) {
      STALLS = r[0];
      INSPECTIONS = r[1].concat(r[2]);
      UNASSIGNED = r[3];
      HISTORY = {};
      if (selectedStallId === null && STALLS.length) selectedStallId = STALLS[0].stallId;
      return Promise.all(STALLS.map(function (s) {
        return api("/stalls/" + s.stallId + "/grade-history").then(function (h) {
          HISTORY[s.stallId] = h;
        });
      }));
    });
  }

  var STALLS = [];
  var INSPECTIONS = [];
  var HISTORY = {};
  var UNASSIGNED = [];

  function view() { return doc.getElementById("view-authority"); }
  function stall(id) { return STALLS.filter(function (s) { return s.stallId === id; })[0] || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  }); }
  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtMonthYear(iso) {
    return new Date(iso).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
  }
  function fmtDayMonth(iso) {
    return new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
  }
  function fmtWeekday(iso) {
    return new Date(iso).toLocaleDateString("en-SG", { weekday: "long" });
  }
  function pillClass(status) {
    return status === "Completed" ? "statusPill--done"
         : status === "In Progress" ? "statusPill--active" : "statusPill--waiting";
  }
  function gradeClass(g) {
    var k = String(g || "").toLowerCase();
    return ["a", "b", "c"].indexOf(k) > -1 ? "sf-grade--" + k : "sf-grade--new";
  }
  function pendingInspectionsFor(stallId) {
    return INSPECTIONS.filter(function (i) { return i.stallId === stallId && i.status !== "Completed"; })
      .sort(function (a, b) {
        return (new Date(a.inspectionDate) - new Date(b.inspectionDate))
          || (a.inspectionId - b.inspectionId);
      });
  }
  function transcriptEvents(stallId) {
    var events = [];
    INSPECTIONS.forEach(function (i) {
      if (i.stallId !== stallId) return;
      events.push({ kind: "schedule", rank: 0, at: i.createdAt || i.inspectionDate, row: i });
    });
    (HISTORY[stallId] || []).forEach(function (h) {
      events.push({ kind: "grade", rank: 1, at: h.inspectionDate || h.effectiveDate, row: h });
      if (h.isRevised && h.revisedAt) {
        events.push({ kind: "revision", rank: 2, at: h.revisedAt, row: h });
      }
    });
    return events.sort(function (a, b) {
      var d = dayOf(a.at).localeCompare(dayOf(b.at));
      if (d !== 0) return d;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return seqOf(a) - seqOf(b);
    });
  }

  function seqOf(event) {
    return Number((event.kind === "schedule" ? event.row.inspectionId : event.row.historyId) || 0);
  }

  function editableInspectionFor(stallId) {
    return INSPECTIONS.filter(function (i) {
      return i.stallId === stallId && i.isLatestCompletedAssessment;
    })[0] || null;
  }

  function gradedByOfficer(gradeRow) {
    return gradeRow.officerId != null && Number(gradeRow.officerId) === officerId();
  }

  /* ---------------- state ---------------- */
  var selectedStallId = null;
  var editing = null;      // the inspection open in the assessment modal
  var scheduling = null;   // { stallId, inspectionId|null } open in the schedule modal

  /* ---------------- render: home ---------------- */
  function isoLocal(d) { return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); }

  function renderHome() {
    var v = view(); if (!v) return;
    var today = isoLocal(new Date());

    var inProgress = INSPECTIONS.filter(function (i) { return i.status === STATUS_IN_PROGRESS; });
    var todayList = inProgress.filter(function (i) { return dayOf(i.inspectionDate) === today; });
    var overdue = inProgress
      .filter(function (i) { return dayOf(i.inspectionDate) < today; })
      .sort(function (a, b) { return new Date(a.inspectionDate) - new Date(b.inspectionDate); });

    var waiting = UNASSIGNED.slice().sort(function (a, b) {
      return new Date(approvedOn(a)) - new Date(approvedOn(b));
    });

    fill(v, "[data-authority-unassigned]", waiting.map(unassignedDashRow),
      "Every store has had its first inspection.");
    fill(v, "[data-authority-today]", todayList.map(function (i) { return dashRow(i, null); }),
      "Nothing due today.");
    fill(v, "[data-authority-overdue]", overdue.map(function (i) { return dashRow(i, "overdue"); }),
      "Nothing left unassessed.");

    renderDashCalendar(v);
  }

  var dashCalYear, dashCalMonth;

  function inspectionsByDay() {
    var counts = {};
    INSPECTIONS.forEach(function (i) {
      var d = dayOf(i.inspectionDate);
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }

  function renderDashCalendar(v) {
    var grid = v.querySelector("[data-dashcal-grid]"); if (!grid) return;
    var now = new Date();
    if (dashCalYear === undefined) { dashCalYear = now.getFullYear(); dashCalMonth = now.getMonth(); }

    v.querySelector("[data-dashcal-month]").textContent =
      new Date(dashCalYear, dashCalMonth, 1).toLocaleDateString("en-SG", { month: "long" });
    v.querySelector("[data-dashcal-year]").textContent = dashCalYear;

    var counts = inspectionsByDay();
    var today = isoLocal(now);
    var lead = startCol(dashCalYear, dashCalMonth);
    var total = daysInMonth(dashCalYear, dashCalMonth);
    var cells = "";

    for (var n = 0; n < 42; n++) {
      var day = n - lead + 1;
      if (day < 1 || day > total) {
        cells += '<span class="sf-dashCal__cell sf-dashCal__cell--blank"></span>';
        continue;
      }
      var iso = isoOf(dashCalYear, dashCalMonth, day);
      var count = counts[iso] || 0;
      cells += '<span class="sf-dashCal__cell' +
          (iso === today ? " is-today" : "") + (count ? " has-work" : "") + '">' +
        '<span class="sf-dashCal__n">' + day + "</span>" +
        (count ? '<span class="sf-dashCal__count">' + count + "</span>" : "") +
      "</span>";
    }
    grid.innerHTML = cells;
  }

  function stepDashCal(months, years) {
    var d = new Date(dashCalYear, dashCalMonth + months, 1);
    dashCalYear = d.getFullYear() + (years || 0);
    dashCalMonth = d.getMonth();
    renderDashCalendar(view());
  }

  function fill(v, sel, rows, emptyText) {
    var el = v.querySelector(sel); if (!el) return;
    el.innerHTML = rows.length ? rows.join("") : '<p class="sf-empty">' + emptyText + "</p>";
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(el);
  }

  function dayOf(value) { return String(value).slice(0, 10); }

  function photoHtml(s) {
    return s && s.imageUrl
      ? '<img class="sf-dashRow__photo" src="' + esc(s.imageUrl) + '" alt="">'
      : '<div class="sf-dashRow__photo" aria-hidden="true"></div>';
  }

  function directionsUrl(s) {
    if (!s) return "";
    var q = (s.centreName || "") + (s.postalCode ? ", Singapore " + s.postalCode : " " + (s.address || ""));
    q = q.trim();
    return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : "";
  }

  function directionsHtml(s) {
    if (!s || !s.address) return "";
    var url = directionsUrl(s);
    return '<span class="sf-directions liquid-glass" data-liquid-glass="drag"' +
      (url ? ' data-directions="' + esc(url) + '"' : '') + '>' +
      '<img class="sf-directions__icon" src="../images/loc-arrow.svg" alt="">' +
      '<span class="sf-directions__text">' +
        '<span class="sf-directions__label">Get directions:</span>' +
        '<span class="sf-directions__value">' + esc(s.address) + "</span>" +
      "</span>" +
    "</span>";
  }

  function dashRow(i, flag) {
    var s = stall(i.stallId);
    return '<button class="sf-dashRow" type="button" data-inspection="' + i.inspectionId + '">' +
      photoHtml(s) +
      '<span class="sf-dashRow__main">' +
        '<span class="sf-dashRow__name">' + esc(s ? s.stallName : "Stall " + i.stallId) + "</span>" +
        '<span class="sf-dashRow__meta">@ ' + esc(s ? s.centreName : "") + "</span>" +
        (flag === "overdue"
          ? '<span class="sf-dashRow__flag">Due ' + fmtDayMonth(i.inspectionDate) + "</span>"
          : "") +
      "</span>" +
      directionsHtml(s) +
    "</button>";
  }

  function daysBetween(isoFrom, isoTo) {
    var a = partsOfISO(dayOf(isoFrom));
    var b = partsOfISO(dayOf(isoTo));
    return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 86400000);
  }

  function waitingLabel(since) {
    var n = daysBetween(since, isoLocal(new Date()));
    if (n <= 0) return "Approved today";
    return "Waiting " + n + (n === 1 ? " day" : " days") + " · Since " + fmtDayMonth(since);
  }

  function unassignedDashRow(u) {
    var s = stall(u.stallId);
    var since = approvedOn(u);
    return '<button class="sf-dashRow" type="button" data-unassigned="' + u.stallId + '">' +
      photoHtml(s) +
      '<span class="sf-dashRow__main">' +
        '<span class="sf-dashRow__name">' + esc(u.stallName) + "</span>" +
        '<span class="sf-dashRow__meta">@ ' + esc(u.centreName) + "</span>" +
        (since ? '<span class="sf-dashRow__flag">' + waitingLabel(since) + "</span>" : "") +
      "</span>" +
      directionsHtml(u.address ? u : s) +
    "</button>";
  }

  function approvedOn(u) {
    var s = stall(u.stallId);
    return (s && s.performanceStartDate) || u.performanceStartDate || null;
  }

  function unassignedRow(u) {
    var since = approvedOn(u);
    return '<button class="listRow" type="button" data-unassigned="' + u.stallId + '">' +
      '<span class="statusPill statusPill--waiting">Ungraded</span>' +
      '<span class="listRowMain">' +
        '<span class="listRowName">' + esc(u.stallName) + "</span>" +
        '<span class="listRowMeta">' + esc(u.centreName) + "</span>" +
      "</span>" +
      '<span class="listRowWhen">' + (since ? "Approved " + fmtDayMonth(since) : "") + "</span>" +
    "</button>";
  }

  function inspectionRow(i) {
    var s = stall(i.stallId);
    return '<button class="listRow" type="button" data-inspection="' + i.inspectionId + '">' +
      '<span class="statusPill ' + pillClass(i.status) + '">' + esc(i.status) + "</span>" +
      '<span class="listRowMain">' +
        '<span class="listRowName">' + esc(s ? s.stallName : "Stall " + i.stallId) + "</span>" +
        '<span class="listRowMeta">' + esc(s ? s.centreName : "") + "</span>" +
      "</span>" +
      '<span class="listRowWhen">' + fmtDate(i.inspectionDate) + "</span>" +
    "</button>";
  }

  function renderInspections() {
    var v = view(); if (!v) return;
    var seg = v.querySelector(".sf-seg");
    var list = v.querySelector("[data-authority-inspections]");
    if (!seg || !list) return;
    var status = seg.dataset.status;
    var rows = INSPECTIONS.filter(function (i) { return i.status === status; });
    list.innerHTML = rows.length
      ? rows.map(inspectionRow).join("")
      : '<p class="sf-empty">No ' + esc(status.toLowerCase()) + " inspections.</p>";
  }

  /* ---------------- render: the rail (History) ---------------- */
  function renderHistory() {
    var v = view(); if (!v) return;
    var el = v.querySelector("[data-authority-history]"); if (!el) return;
    el.innerHTML = STALLS.map(function (s) {
      return '<button class="sf-railRow" type="button" role="option" data-stall="' + s.stallId + '"' +
        ' aria-selected="' + (s.stallId === selectedStallId ? "true" : "false") + '">' +
        esc(s.stallName) + " @ " + esc(s.centreName) +
        "</button>";
    }).join("");
  }

  function selectStall(id) {
    if (!stall(id)) return;
    selectedStallId = id;
    var v = view(); if (!v) return;
    v.querySelectorAll(".sf-railRow").forEach(function (b) {
      b.setAttribute("aria-selected", String(Number(b.dataset.stall) === id));
    });
    renderTranscript();
    setPanel("stores");
  }

  /* ---------------- render: the transcript (Authority — Child, 785:1323) ---------------- */
  function gradeState(s) {
    if (!s) return null;
    if (s.probationStartDate) {
      return {
        since: "On probation since " + fmtDate(s.probationStartDate),
        caption: "Returns to " + (s.preIssueGrade || "NEW") + " after " +
          RECOVERY_CLEAN_INSPECTIONS + " clean inspections or " + RECOVERY_MONTHS + " months"
      };
    }
    return {
      since: "Clean since " + fmtMonthYear(s.performanceStartDate),
      caption: "Graded under the SAFE framework"
    };
  }

  function gradeCardHtml(letter, state, chip) {
    var chipRow = chip ? (
      '<div class="sf-gradeCard__chiprow">' +
        '<span class="sf-gradeCard__tag liquid-glass" data-liquid-glass="drag"><img class="icon-img" src="../assets/icons/' + chip.icon + '.svg" alt="">' + esc(chip.label) + '</span>' +
        (chip.editInspectionId != null
          ? '<button class="sf-cardEdit liquid-glass" type="button" data-liquid-glass="drag" data-history-edit="' + chip.editInspectionId + '">Edit</button>'
          : '') +
      '</div>'
    ) : '';
    return '<div class="sf-gradeCard">' + chipRow +
      '<p class="sf-gradeCard__letter">' + esc(letter) + '</p>' +
      '<hr class="sf-gradeCard__rule">' +
      (state ? '<p class="sf-gradeCard__since">' + esc(state.since) + '</p>' : '') +
      '<p class="sf-gradeCard__caption">' + esc(state ? state.caption : "Graded under the SAFE framework") + '</p>' +
    '</div>';
  }

  function scheduleCardHtml(insp, s, preview) {
    var done = insp.status === STATUS_COMPLETED;
    var action = preview
      ? ''
      : done
        ? '<button class="sf-cardEdit liquid-glass" type="button" data-liquid-glass="drag" data-see-grade="' + insp.inspectionId + '">See grade</button>'
        : '<button class="sf-cardEdit liquid-glass" type="button" data-liquid-glass="drag" data-schedule-edit="' + insp.inspectionId + '">Edit</button>';
    return '<div class="sf-gradeCard sf-gradeCard--schedule' + (done ? ' is-done' : '') + '">' +
      '<div class="sf-gradeCard__chiprow">' +
        '<span class="sf-gradeCard__tag liquid-glass" data-liquid-glass="drag"><img class="icon-img" src="../assets/icons/schedule.svg" alt="">' +
          (insp.isAutoScheduled ? "Auto-scheduled" : "You scheduled") + '</span>' +
        action +
      '</div>' +
      '<p class="sf-gradeCard__date">' + fmtDayMonth(insp.inspectionDate) + '</p>' +
      '<p class="sf-gradeCard__day">' + fmtWeekday(insp.inspectionDate) + '</p>' +
      '<hr class="sf-gradeCard__rule">' +
      '<a class="sf-directions liquid-glass" data-liquid-glass="drag" target="_blank" rel="noopener noreferrer"' +
        ' href="' + esc(directionsUrl(s)) + '">' +
        '<img class="sf-directions__icon" src="../images/loc-arrow.svg" alt="">' +
        '<span class="sf-directions__text">' +
          '<span class="sf-directions__label">Get directions:</span>' +
          '<span class="sf-directions__value">' + esc(s.address) + '</span>' +
        '</span>' +
      '</a>' +
    '</div>';
  }

  function revisionCardHtml(h) {
    var link = h.inspectionId == null
      ? ''
      : '<button class="sf-cardEdit liquid-glass" type="button" data-liquid-glass="drag" data-see-grade="' + h.inspectionId + '">See grade</button>';
    return '<div class="sf-gradeCard sf-gradeCard--revision">' +
      '<div class="sf-gradeCard__chiprow">' +
        '<span class="sf-gradeCard__tag liquid-glass" data-liquid-glass="drag"><img class="icon-img" src="../assets/icons/edit.svg" alt="">Assessment updated</span>' +
        link +
      '</div>' +
      '<p class="sf-gradeCard__date">' + fmtDayMonth(h.revisedAt) + '</p>' +
      '<p class="sf-gradeCard__day">' + fmtWeekday(h.revisedAt) + '</p>' +
      '<hr class="sf-gradeCard__rule">' +
      '<p class="sf-gradeCard__caption">Grade ' + esc(h.grade) + ' from the visit on ' +
        esc(fmtDate(h.inspectionDate || h.effectiveDate)) + '</p>' +
    '</div>';
  }

  function setupHeadMarquee(el) {
    var text = el.querySelector(".sf-stallHead__text");
    if (!text) return;
    var name = text.querySelector(".sf-stallHead__name");
    var centre = text.querySelector(".sf-stallHead__centre");
    var overflow = Math.max(
      name.scrollWidth - text.clientWidth,
      centre.scrollWidth - text.clientWidth,
      0
    );
    text.classList.toggle("sf-marquee", overflow > 0);
    text.style.setProperty("--sf-marquee-dist", overflow > 0 ? "-" + overflow + "px" : "0px");
  }

  function renderTranscript() {
    var v = view(); if (!v) return;
    var el = v.querySelector("[data-authority-transcript]"); if (!el) return;
    var s = stall(selectedStallId);
    if (!s) { el.innerHTML = '<p class="sf-empty">Select a stall from History.</p>'; return; }

    var pendingList = pendingInspectionsFor(s.stallId);
    var assessable = pendingList.filter(function (p) { return p.status === STATUS_IN_PROGRESS; })[0];
    var editTarget = editableInspectionFor(s.stallId);
    var events = transcriptEvents(s.stallId);
    var newestGrade = null;
    events.forEach(function (e) { if (e.kind === "grade") newestGrade = e; });
    var marks = [];
    var cards = "";

    if (!newestGrade && s.currentGrade === "NEW") {
      cards += '<p class="sf-empty">No grade recorded yet — ' + esc(s.stallName) + ' is trading under a year.</p>';
    }

    events.forEach(function (e, i) {
      if (e.kind === "grade") {
        var isNewest = e === newestGrade;
        var mine = gradedByOfficer(e.row);
        var chip = isNewest ? {
          label: mine ? "You graded" : "Another officer graded",
          icon: "check",
          editInspectionId: mine && editTarget ? editTarget.inspectionId : null
        } : null;
        cards += '<div class="sf-entry" data-entry data-grade-for="' + (e.row.inspectionId == null ? "" : e.row.inspectionId) + '">' +
          gradeCardHtml(e.row.grade, isNewest ? gradeState(s) : null, chip) +
          '<p class="sf-entry__stamp">' + fmtDate(e.at) + '</p>' +
        '</div>';
      } else if (e.kind === "revision") {
        cards += '<div class="sf-entry" data-entry data-revision-for="' + (e.row.inspectionId == null ? "" : e.row.inspectionId) + '">' +
          revisionCardHtml(e.row) +
          '<p class="sf-entry__stamp">' + fmtDate(e.at) + '</p>' +
        '</div>';
      } else {
        cards += '<div class="sf-entry" data-entry data-inspection-id="' + e.row.inspectionId + '">' +
          scheduleCardHtml(e.row, s) +
          '<p class="sf-entry__stamp">' + fmtDate(e.at) + '</p>' +
        '</div>';
      }
      marks.push(i === events.length - 1);
    });

    var timeline = marks.map(function (current, i) {
      return '<button class="sf-timelineMark' + (current ? ' sf-timelineMark--current' : '') + '" type="button" ' +
        'data-jump="' + i + '" aria-label="Jump to entry ' + (i + 1) + '"></button>';
    }).join("");

    var photo = s.imageUrl
      ? '<img class="sf-stallHead__photo" src="' + esc(s.imageUrl) + '" alt="">'
      : '<div class="sf-stallHead__photo" aria-hidden="true"></div>';

    el.innerHTML =
      '<div class="sf-transcript__col">' +
        '<header class="sf-stallHead" role="button" tabindex="0" data-stall-settings-open="' + s.stallId + '"' +
          ' aria-label="Auto-schedule settings for ' + esc(s.stallName) + '">' +
          '<div class="frost sf-stallHead__frost" aria-hidden="true"></div>' +
          '<div class="sf-stallHead__id">' +
            '<button class="sf-menuBtn liquid-glass" type="button" data-liquid-glass="drag" aria-label="Toggle menu" aria-expanded="false">' +
              '<span class="icon icon--lg" style="--icon: url(../assets/icons/sidebar.svg)"></span></button>' +
            photo +
            '<div class="sf-stallHead__text">' +
              '<h1 class="sf-stallHead__name">' + esc(s.stallName) + '</h1>' +
              '<p class="sf-stallHead__centre">@ ' + esc(s.centreName) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="sf-stallHead__actions">' +
            '<button class="sf-actionPill liquid-glass" type="button" data-liquid-glass="drag" data-schedule-open aria-label="Schedule">' +
              '<span class="icon icon--lg" style="--icon: url(../assets/icons/schedule.svg)"></span>' +
              '<span class="sf-actionPill__label">Schedule</span></button>' +
            '<button class="sf-actionPill sf-actionPill--primary liquid-glass" type="button" data-liquid-glass="drag"' +
              (assessable
                ? ' data-assess-open="' + assessable.inspectionId + '"'
                : ' data-assess-now="' + s.stallId + '"') +
              ' aria-label="' + (assessable ? "Assess" : "Assess now") + '">' +
              '<span class="icon icon--lg" style="--icon: url(../assets/icons/assess.svg)"></span>' +
              '<span class="sf-actionPill__label">' + (assessable ? "Assess" : "Assess now") + '</span></button>' +
          '</div>' +
        '</header>' +
        cards +
      '</div>' +
      (timeline
        ? '<div class="sf-timeline" style="--mark-count: ' + marks.length + '">' + timeline + '</div>'
        : '');

    var entries = el.querySelectorAll("[data-entry]");
    el.querySelectorAll("[data-jump]").forEach(function (m) {
      m.addEventListener("click", function () {
        var target = entries[Number(m.dataset.jump)];
        if (target) target.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "center" });
      });
    });

    el.querySelectorAll("[data-see-grade]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = el.querySelector('[data-grade-for="' + b.dataset.seeGrade + '"]');
        if (target) target.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "center" });
      });
    });

    setupHeadMarquee(el);
    bindTimelineScroll(el);

    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(el);
  }

  var timelineBound = false;
  function bindTimelineScroll(el) {
    var main = view().querySelector(".sf-main");
    if (!main) return;
    syncTimeline(el, main);
    if (timelineBound) return;
    timelineBound = true;
    var queued = false;
    function run() {
      var live = view().querySelector("[data-authority-transcript]");
      if (live) syncTimeline(live, main);
    }
    main.addEventListener("scroll", function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; run(); });
    }, { passive: true });
    main.addEventListener("scrollend", run, { passive: true });
  }

  function syncTimeline(el, main) {
    var entries = el.querySelectorAll("[data-entry]");
    var marks = el.querySelectorAll("[data-jump]");
    if (!entries.length || !marks.length) return;
    var max = main.scrollHeight - main.clientHeight;
    var best = 0;
    if (main.scrollTop <= 2) {
      best = 0;
    } else if (main.scrollTop >= max - 2) {
      best = entries.length - 1;
    } else {
      var line = main.getBoundingClientRect().top + main.clientHeight * 0.4;
      var bestDist = Infinity;
      entries.forEach(function (entry, i) {
        var dist = Math.abs(entry.getBoundingClientRect().top - line);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
    }
    marks.forEach(function (m, i) {
      m.classList.toggle("sf-timelineMark--current", i === best);
      m.setAttribute("aria-current", i === best ? "true" : "false");
    });
  }

  function renderAll() { renderHome(); renderInspections(); renderHistory(); renderTranscript(); }

  /* ---------------- assessment ---------------- */
  function openAssessment(inspectionId) {
    var v = view();
    var i = INSPECTIONS.filter(function (x) { return x.inspectionId === inspectionId; })[0];
    if (!i) return;
    editing = i;
    var s = stall(i.stallId);
    var m = v.querySelector("[data-assessment]");
    m.querySelector("[data-assessment-stall]").textContent =
      (s ? s.stallName + " · " + s.centreName : "Stall " + i.stallId) + " · " + fmtDate(i.inspectionDate);
    var scores = m.querySelector("[data-assessment-scores]");
    scores.innerHTML = [1, 2, 3, 4, 5].map(function (n) {
      return '<button class="sf-score" type="button" data-liquid-glass="drag" data-score="' +
        n + '" aria-pressed="' + (i.hygieneScore === n) +
        '"><span class="sf-score__n">' + n + "</span></button>";
    }).join("");
    /* Rendered after load, so the glass is NOT wired automatically. */
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(scores);
    var answered = i.status === STATUS_COMPLETED;
    var saveBtn = m.querySelector("[data-assessment-save]");
    if (saveBtn) saveBtn.textContent = answered ? "Save changes" : "Complete inspection";
    SEG_KEYS.forEach(function (k) { setSegValue(m, k, answered ? !!i[k] : null); });
    m.querySelector('[data-assess="isMajorIssue"]').checked = answered ? !!i.isMajorIssue : false;
    m.querySelector('[data-assess="remarks"]').value = i.remarks || "";
    m.hidden = false;
    syncAssessmentValidity();
  }
  function closeAssessment() { var m = view().querySelector("[data-assessment]"); if (m) m.hidden = true; editing = null; }

  function startWalkIn(stallId) {
    return api("/stalls/" + stallId + "/assess-now", { method: "POST" })
      .then(function (created) {
        return loadData().then(function () {
          selectedStallId = stallId;
          renderAll();
          openAssessment(created.inspectionId);
        });
      })
      .catch(function (err) { global.alert(err.message); });
  }

  var pendingResult = null;
  var resultAskAnswered = false;

  function wireToggle(el, onChange, on) {
    if (!el) return;
    initLiquidGlassToggle(el, onChange);
    setToggleState(el, on);
  }

  function writeAutoSchedule(stallId, on) {
    if (stallId == null) return Promise.resolve();
    return api("/stalls/" + stallId + "/auto-schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSchedule: on })
    }).then(loadData).then(renderAll).catch(function (err) { global.alert(err.message); });
  }

  function openResult(result) {
    var v = view(); if (!v) return;
    var m = v.querySelector("[data-result]"); if (!m) return;
    pendingResult = result;
    var s = stall(result.stallId);

    m.querySelector("[data-result-sub]").textContent =
      (s ? s.stallName + " · " + s.centreName : "Stall " + result.stallId) + " · now grade " + result.newGrade;

    m.querySelector("[data-result-preview]").innerHTML =
      gradeCardHtml(result.newGrade, gradeState(s),
        { label: "You graded", icon: "check", editInspectionId: result.inspectionId });

    var asking = result.autoSchedule === null || result.autoSchedule === undefined;
    var ask = m.querySelector("[data-result-ask]");
    ask.hidden = !asking;
    m.querySelector("[data-result-ask-hint]").hidden = !asking;
    resultAskAnswered = !asking;

    m.querySelector("[data-result-schedule]").hidden = !!result.autoScheduled;

    m.hidden = false;
    wireToggle(m.querySelector("[data-result-auto-toggle]"), function (on) {
      resultAskAnswered = true;
      writeAutoSchedule(pendingResult ? pendingResult.stallId : null, on);
    }, false);
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(m);
  }

  function closeResult() {
    var m = view().querySelector("[data-result]");
    var stallId = pendingResult ? pendingResult.stallId : null;
    var unanswered = !resultAskAnswered;
    if (m) m.hidden = true;
    pendingResult = null;
    resultAskAnswered = false;
    if (unanswered && stallId != null) writeAutoSchedule(stallId, false);
  }

  var settingsStallId = null;

  function openStallSettings(stallId) {
    var v = view(); if (!v) return;
    var m = v.querySelector("[data-stall-settings]"); if (!m) return;
    var s = stall(stallId); if (!s) return;
    settingsStallId = stallId;

    m.querySelector("[data-stall-settings-sub]").textContent = s.stallName + " · " + s.centreName;
    m.querySelector("[data-stall-settings-state]").textContent =
      (s.autoSchedule === null || s.autoSchedule === undefined)
        ? "Not set for this stall yet — you will be asked the next time you complete an assessment here."
        : "";

    m.hidden = false;
    wireToggle(m.querySelector("[data-stall-settings-toggle]"), function (on) {
      var state = m.querySelector("[data-stall-settings-state]");
      if (state) state.textContent = "";
      writeAutoSchedule(settingsStallId, on);
    }, s.autoSchedule === true);
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(m);
  }

  function closeStallSettings() {
    var m = view().querySelector("[data-stall-settings]");
    if (m) m.hidden = true;
    settingsStallId = null;
  }

  var SEG_KEYS = ["personalHygiene", "foodStorage", "pestControl"];

  function segValue(m, key) {
    var picked = m.querySelector('[data-assess-seg="' + key + '"] [role="radio"][aria-checked="true"]');
    return picked ? picked.dataset.assessValue === "true" : null;
  }

  function setSegValue(m, key, value) {
    var group = m.querySelector('[data-assess-seg="' + key + '"]');
    if (!group) return;
    group.querySelectorAll('[role="radio"]').forEach(function (b) {
      b.setAttribute("aria-checked", String(value !== null && (b.dataset.assessValue === "true") === value));
    });
  }

  function assessmentProblem(m) {
    if (!m.querySelector(".sf-score[aria-pressed='true']")) return "Pick a hygiene score.";
    for (var n = 0; n < SEG_KEYS.length; n++) {
      if (segValue(m, SEG_KEYS[n]) === null) return "Answer every check — pass or fail.";
    }
    var major = m.querySelector('[data-assess="isMajorIssue"]').checked;
    var remarks = m.querySelector('[data-assess="remarks"]').value.trim();
    if (major && !remarks) return "Remarks are required when a major issue is found.";
    if (remarks.length > MAX_REMARKS) return "Remarks cannot be longer than " + MAX_REMARKS + " characters.";
    return null;
  }

  function syncAssessmentValidity() {
    var v = view(); if (!v) return;
    var m = v.querySelector("[data-assessment]");
    if (!m || m.hidden) return;
    var problem = assessmentProblem(m);
    var save = m.querySelector("[data-assessment-save]");
    var hint = m.querySelector("[data-assessment-hint]");
    if (save) save.disabled = !!problem;
    if (hint) hint.textContent = problem || "";
  }

  function completeAssessment() {
    if (!editing) return;
    var v = view(), m = v.querySelector("[data-assessment]");
    var picked = m.querySelector(".sf-score[aria-pressed='true']");

    var body = {
      hygieneScore: picked ? Number(picked.dataset.score) : null,
      remarks: m.querySelector('[data-assess="remarks"]').value.trim(),
      isMajorIssue: m.querySelector('[data-assess="isMajorIssue"]').checked
    };
    SEG_KEYS.forEach(function (k) { body[k] = segValue(m, k); });

    var assessedStallId = editing.stallId;

    var isEdit = editing.status === STATUS_COMPLETED;

    api("/inspections/" + editing.inspectionId + (isEdit ? "/assessment" : "/complete"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (result) {
      closeAssessment();
      return loadData().then(function () { return result; });
    }).then(function (result) {
      selectedStallId = assessedStallId; // land on the stall just assessed, not whichever was selected before
      renderAll();
      setPanel("stores"); // land on the consequence, not back on the list

      if (!isEdit && result) openResult(result);
    }).catch(function (err) {
      global.alert(err.message);
    });
  }

  /* ---------------- schedule ---------------- */
  function openSchedule(stallId, existingInspectionId, triggerEl) {
    var s = stall(stallId); if (!s) return;
    scheduling = { stallId: stallId, inspectionId: existingInspectionId || null };
    var existing = existingInspectionId
      ? INSPECTIONS.filter(function (i) { return i.inspectionId === existingInspectionId; })[0]
      : null;
    openCalendar(existing ? existing.inspectionDate : null, triggerEl);
  }

  function saveSchedule() {
    if (!scheduling || !calendarSelectedISO) return Promise.resolve(null);
    var date = calendarSelectedISO;
    var stallId = scheduling.stallId;
    var existingId = scheduling.inspectionId;
    scheduling = null;

    var write = existingId
      ? api("/inspections/" + existingId, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: date })
        }).then(function () { return existingId; })
      : api("/inspections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stallId: stallId, date: date })
        }).then(function (created) { return created.id; });

    return write.then(function (touchedId) {
      return api("/inspections/promote", { method: "POST" })
        .catch(function () { return null; })
        .then(loadData)
        .then(function () {
          selectedStallId = stallId;
          renderAll();
          return touchedId;
        });
    });
  }

  /* ---------------- calendar (807:241, "August 2026 Calendar") ---------------- */
  var calendarYear, calendarMonth, calendarSelectedISO, calendarPrevFocus, calendarActiveISO;

  function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
  function startCol(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; } // 0 = Mon
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function isoOf(year, month, day) { return year + "-" + pad2(month + 1) + "-" + pad2(day); }
  function partsOfISO(iso) {
    var p = iso.split("-");
    return { y: Number(p[0]), m: Number(p[1]) - 1, d: Number(p[2]) };
  }
  function todayMidnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isFullyPastMonth(year, month, today) {
    return year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  }
  function fmtCalendarDetail(iso) {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-SG", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  function calendarEls(v) {
    return {
      overlay: v.querySelector("[data-calendar-overlay]"),
      stage: v.querySelector("[data-calendar-stage]"),
      grid: v.querySelector("[data-calendar-grid]"),
      month: v.querySelector("[data-calendar-month]"),
      year: v.querySelector("[data-calendar-year]"),
      prevMonth: v.querySelector("[data-calendar-prev-month]"),
      nextMonth: v.querySelector("[data-calendar-next-month]"),
      prevYear: v.querySelector("[data-calendar-prev-year]"),
      nextYear: v.querySelector("[data-calendar-next-year]"),
      next: v.querySelector("[data-calendar-next]"),
      del: v.querySelector("[data-calendar-delete]"),
      confirmPanel: v.querySelector(".sf-calendarOverlay__panel--confirm"),
      preview: v.querySelector("[data-calendar-preview]"),
    };
  }

  function renderCalendar() {
    var v = view(); if (!v) return;
    var els = calendarEls(v);
    if (!els.grid) return;
    var today = todayMidnight();
    var todayISO = isoOf(today.getFullYear(), today.getMonth(), today.getDate());

    els.month.textContent = new Date(calendarYear, calendarMonth, 1).toLocaleDateString("en-SG", { month: "long" });
    els.year.textContent = String(calendarYear);

    var prevMonthDest = calendarMonth === 0 ? { y: calendarYear - 1, m: 11 } : { y: calendarYear, m: calendarMonth - 1 };
    els.prevMonth.disabled = isFullyPastMonth(prevMonthDest.y, prevMonthDest.m, today);
    els.prevYear.disabled = isFullyPastMonth(calendarYear - 1, calendarMonth, today);

    var lead = startCol(calendarYear, calendarMonth);
    var total = daysInMonth(calendarYear, calendarMonth);
    var trail = 42 - lead - total;
    var prevM = calendarMonth === 0 ? 11 : calendarMonth - 1;
    var prevY = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
    var prevTotal = daysInMonth(prevY, prevM);
    var nextM = calendarMonth === 11 ? 0 : calendarMonth + 1;
    var nextY = calendarMonth === 11 ? calendarYear + 1 : calendarYear;

    var cells = [];
    for (var i = 0; i < lead; i++) {
      var leadDay = prevTotal - lead + 1 + i;
      cells.push({ day: leadDay, iso: isoOf(prevY, prevM, leadDay), outside: true });
    }
    for (var d = 1; d <= total; d++) cells.push({ day: d, iso: isoOf(calendarYear, calendarMonth, d), outside: false });
    for (var j = 1; j <= trail; j++) cells.push({ day: j, iso: isoOf(nextY, nextM, j), outside: true });

    if (global.console && console.assert) {
      console.assert(cells.length === 42, "[calendar] expected 42 cells, got " + cells.length);
      var monthDays = cells.filter(function (c) { return !c.outside; }).map(function (c) { return c.day; });
      for (var check = 1; check <= total; check++) {
        console.assert(monthDays.indexOf(check) > -1, "[calendar] missing day " + check + " of " + total + " for " + calendarYear + "-" + pad2(calendarMonth + 1));
      }
    }

    els.grid.innerHTML = "";
    for (var row = 0; row < 6; row++) {
      var rowEl = doc.createElement("div");
      rowEl.className = "sf-calendar__row";
      rowEl.setAttribute("role", "row");
      for (var col = 0; col < 7; col++) {
        var c = cells[row * 7 + col];
        var selectable = !c.outside && new Date(c.iso + "T00:00:00") >= today;
        var btn = doc.createElement("button");
        btn.type = "button";
        btn.setAttribute("role", "gridcell");
        btn.className = "sf-calendar__day" + (c.outside ? " sf-calendar__day--outside" : "");
        btn.textContent = String(c.day);
        btn.dataset.date = c.iso;
        btn.tabIndex = -1;
        btn.setAttribute("aria-label", fmtCalendarDetail(c.iso));
        if (!selectable) {
          btn.disabled = true;
          if (c.outside) btn.setAttribute("aria-hidden", "true");
          else btn.setAttribute("aria-disabled", "true"); // a real day, just not one you can pick
        }
        if (!c.outside && c.iso === todayISO) btn.setAttribute("data-today", "");
        if (!c.outside && c.iso === calendarSelectedISO) btn.setAttribute("aria-selected", "true");
        rowEl.appendChild(btn);
      }
      els.grid.appendChild(rowEl);
    }

    var selectedBtn = calendarSelectedISO && els.grid.querySelector('[data-date="' + calendarSelectedISO + '"]:not(:disabled)');
    var todayBtn = els.grid.querySelector('[data-today]:not(:disabled)');
    var firstBtn = els.grid.querySelector(".sf-calendar__day:not(:disabled)");
    var active = selectedBtn || todayBtn || firstBtn;
    if (active) { active.tabIndex = 0; calendarActiveISO = active.dataset.date; }

    if (els.next) els.next.disabled = !calendarSelectedISO;
  }

  function renderConfirmPreview(v) {
    if (!calendarSelectedISO || !scheduling) return;
    var els = calendarEls(v);
    var s = stall(scheduling.stallId);
    var previewInsp = { inspectionId: scheduling.inspectionId || 0, inspectionDate: calendarSelectedISO, isAutoScheduled: false };
    els.preview.innerHTML = scheduleCardHtml(previewInsp, s, true);
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(els.preview);
  }

  function calendarStep(months) {
    var d = new Date(calendarYear, calendarMonth + months, 1);
    calendarYear = d.getFullYear();
    calendarMonth = d.getMonth();
    renderCalendar();
  }

  function openCalendar(seedISO, triggerEl) {
    var v = view(); if (!v) return;
    var els = calendarEls(v);
    if (!els.overlay) return;
    calendarPrevFocus = triggerEl || doc.activeElement;
    var today = todayMidnight();
    var seed = partsOfISO(seedISO || isoOf(today.getFullYear(), today.getMonth(), today.getDate()));
    calendarYear = seed.y; calendarMonth = seed.m;
    calendarSelectedISO = null;
    els.stage.dataset.calendarStage = "pick"; // always reopens on the grid, never mid-confirm from a stale prior session
    if (els.del) els.del.hidden = !(scheduling && scheduling.inspectionId);
    els.overlay.hidden = false;
    renderCalendar();
    var active = els.grid.querySelector('[tabindex="0"]');
    if (active) active.focus({ preventScroll: true });
  }
  function closeCalendar(cancelled) {
    var v = view(); if (!v) return;
    var els = calendarEls(v);
    if (!els.overlay || els.overlay.hidden) return;
    els.overlay.hidden = true;
    if (cancelled) scheduling = null;
    if (calendarPrevFocus) calendarPrevFocus.focus({ preventScroll: true });
  }
  function pickCalendarDate(iso) {
    var v = view(); if (!v) return;
    calendarSelectedISO = iso;
    renderCalendar();
    var next = calendarEls(v).next;
    if (next) next.focus({ preventScroll: true });
  }
  function advanceToConfirm() {
    if (!calendarSelectedISO) return;
    var v = view(); if (!v) return;
    renderConfirmPreview(v);
    var els = calendarEls(v);
    els.stage.dataset.calendarStage = "confirm";
    var confirmBtn = els.confirmPanel.querySelector("[data-calendar-confirm]");
    if (confirmBtn) confirmBtn.focus({ preventScroll: true });
  }
  function backToPick() {
    var v = view(); if (!v) return;
    var els = calendarEls(v);
    els.stage.dataset.calendarStage = "pick";
    var active = els.grid.querySelector('[tabindex="0"]');
    if (active) active.focus({ preventScroll: true });
  }
  function confirmCalendarPick() {
    if (!calendarSelectedISO) return;
    var v = view(); if (!v) return;
    calendarEls(v).overlay.hidden = true;
    saveSchedule().then(function (touchedId) {
      var opener = v.querySelector("[data-schedule-open]");
      if (opener) opener.focus({ preventScroll: true });
      animateScheduleDrop(v, touchedId);
    }).catch(function (err) {
      global.alert(err.message);
    });
  }
  function deleteSchedule() {
    if (!scheduling || !scheduling.inspectionId) return;
    if (!global.confirm("Delete this scheduled inspection? The stall will be notified that it is cancelled.")) return;
    var v = view(); if (!v) return;
    var stallId = scheduling.stallId;
    var inspectionId = scheduling.inspectionId;
    scheduling = null;
    calendarEls(v).overlay.hidden = true;
    api("/inspections/" + inspectionId, { method: "DELETE" })
      .then(loadData)
      .then(function () {
        selectedStallId = stallId;
        renderAll();
        var opener = v.querySelector("[data-schedule-open]");
        if (opener) opener.focus({ preventScroll: true });
      })
      .catch(function (err) { global.alert(err.message); });
  }

  function animateScheduleDrop(v, inspectionId) {
    if (REDUCE_MOTION || !inspectionId) return;
    var entry = v.querySelector('[data-entry][data-inspection-id="' + inspectionId + '"]');
    if (!entry) return;
    entry.classList.add("sf-entry--drop");
    entry.addEventListener("animationend", function done() {
      entry.classList.remove("sf-entry--drop");
      entry.removeEventListener("animationend", done);
    });
  }

  function moveCalendarFocus(delta) {
    var v = view(); if (!v) return;
    var grid = calendarEls(v).grid;
    var all = Array.prototype.slice.call(grid.querySelectorAll(".sf-calendar__day"));
    var from = all.findIndex(function (b) { return b.dataset.date === calendarActiveISO; });
    if (from === -1) return;
    var to = from + delta;
    while (to >= 0 && to < all.length && all[to].disabled) to += delta;
    if (to < 0 || to >= all.length) return;
    all[from].tabIndex = -1;
    all[to].tabIndex = 0;
    calendarActiveISO = all[to].dataset.date;
    all[to].focus({ preventScroll: true });
  }

  /* ---------------- search overlay (862:1306) ---------------- */
  function openSearchOverlay() {
    var v = view(); var el = v.querySelector("[data-search-overlay]"); if (!el) return;
    el.hidden = false;
    var input = el.querySelector("[data-authority-search]");
    if (input) { input.value = ""; input.focus(); }
    renderSearchResults("");
  }
  function closeSearchOverlay() {
    var v = view(); var el = v.querySelector("[data-search-overlay]"); if (!el) return;
    el.hidden = true;
    syncDockTo(v.dataset.panel);
  }
  function renderSearchResults(query) {
    var v = view(); var el = v.querySelector("[data-authority-results]"); if (!el) return;
    var q = query.trim().toLowerCase();
    var rows = STALLS.filter(function (s) {
      return !q || s.stallName.toLowerCase().indexOf(q) > -1 || s.centreName.toLowerCase().indexOf(q) > -1;
    });
    el.innerHTML = rows.length ? rows.map(function (s) {
      return '<button class="listRow" type="button" data-search-result="' + s.stallId + '">' +
        '<span class="sf-grade ' + gradeClass(s.currentGrade) + '">' + esc(s.currentGrade) + '</span>' +
        '<span class="listRowMain">' +
          '<span class="listRowName">' + esc(s.stallName) + '</span>' +
          '<span class="listRowMeta">' + esc(s.centreName) + '</span>' +
        '</span>' +
      '</button>';
    }).join("") : '<p class="sf-empty">No stores match &quot;' + esc(query) + '&quot;.</p>';
  }

  /* ---------------- panels ---------------- */
  function showPanel(name) {
    var v = view(); if (!v) return;
    v.dataset.panel = name;
  }
  function syncDockTo(name) {
    var v = view(); if (!v) return;
    var target = v.querySelector('[data-panel-go="' + name + '"]');
    if (target) target.click();
  }
  function setPanel(name) {
    showPanel(name);
    syncDockTo(name);
  }

  /* ---------------- mobile drawer (the rail, opened via .sf-menuBtn) ---------------- */
  function initDrawer() {
    var v = view(); if (!v) return;
    var overlay = v.querySelector(".sf-drawerOverlay");
    var rail = v.querySelector(".sf-rail");
    var shell = v.querySelector(".sf-shell");
    if (!overlay || !rail || !shell) return;
    var menuBtn = function () { return v.querySelector(".sf-menuBtn"); };

    var MOBILE = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bp-mobile")) || 768;
    var isMobile = function () { return window.innerWidth <= MOBILE; };
    var isOpen = function () { return v.classList.contains("sf-drawerOpen"); };
    var shiftPx = function () {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sf-drawer-shift")) || 280;
    };
    var radiusPx = function () {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sf-drawer-radius")) || 32;
    };
    var band = function (val, cap) { return cap * Math.tanh(val / cap); };

    var openShift = 0, curX = 0, suppressClick = false;

    function paint(x) {
      curX = x;
      var p = openShift > 0 ? (openShift - x) / openShift : 0;
      shell.style.transform = "translateX(" + x.toFixed(1) + "px)";
      shell.style.borderRadius = (radiusPx() * (1 - p)).toFixed(1) + "px";
      overlay.style.transform = shell.style.transform;
      overlay.style.borderRadius = shell.style.borderRadius;
      overlay.style.opacity = (1 - p).toFixed(3);
    }
    function clearInline() {
      shell.style.transform = ""; shell.style.borderRadius = "";
      overlay.style.transform = ""; overlay.style.borderRadius = ""; overlay.style.opacity = "";
    }
    function finish(open) {
      v.classList.toggle("sf-drawerOpen", open);
      clearInline();
      v.classList.remove("sf-drawerDragging");
      rail.setAttribute("aria-hidden", open || !isMobile() ? "false" : "true");
      var btn = menuBtn(); if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function settle(target, v0) {
      var open = target > 0;
      if (REDUCE_MOTION) { finish(open); return; }
      var x = curX, vv = v0 * 16.67, K = 0.16, D = 0.62;
      (function tick() {
        vv = (vv + (target - x) * K) * D; x += vv;
        if (Math.abs(target - x) < 0.5 && Math.abs(vv) < 0.4) { finish(open); return; }
        paint(x); requestAnimationFrame(tick);
      })();
    }
    function animateOpen() {
      if (isOpen() || !isMobile()) return;
      openShift = shiftPx();
      v.classList.add("sf-drawerDragging");
      paint(0);
      v.classList.add("sf-drawerOpen");
      rail.setAttribute("aria-hidden", "false");
      settle(openShift, 0);
    }
    function animateClose() {
      if (!isOpen()) return;
      openShift = shiftPx();
      curX = openShift;
      v.classList.add("sf-drawerDragging");
      settle(0, 0);
    }

    v.addEventListener("click", function (e) { if (e.target.closest(".sf-menuBtn")) isOpen() ? animateClose() : animateOpen(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) animateClose(); });

    /* ---- drag the shoved shell left to close ---- */
    var d = { down: false, engaged: false, pid: null, sx: 0, sy: 0, lx: 0, lt: 0, v: 0 };
    overlay.addEventListener("pointerdown", function (e) {
      if (!isOpen() || !isMobile()) return;
      d.down = true; d.engaged = false; d.pid = e.pointerId;
      d.sx = d.lx = e.clientX; d.sy = e.clientY; d.lt = e.timeStamp; d.v = 0;
      openShift = shiftPx(); curX = openShift;
    });
    overlay.addEventListener("pointermove", function (e) {
      if (!d.down) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.engaged) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dx) <= Math.abs(dy)) { d.down = false; return; }
        d.engaged = true;
        v.classList.add("sf-drawerDragging");
        try { overlay.setPointerCapture(d.pid); } catch (_) {}
      }
      var dt = e.timeStamp - d.lt;
      if (dt > 0) { d.v = d.v * 0.7 + ((e.clientX - d.lx) / dt) * 0.3; d.lx = e.clientX; d.lt = e.timeStamp; }
      var x = openShift + dx;
      if (x > openShift) x = openShift + band(x - openShift, 60);
      else if (x < 0) x = 0;
      paint(x);
    });
    function release() {
      if (!d.down) return;
      d.down = false;
      if (d.pid != null) { try { overlay.releasePointerCapture(d.pid); } catch (_) {} d.pid = null; }
      if (!d.engaged) return;
      suppressClick = true;
      var projected = curX + d.v * 100;
      settle(projected < openShift * 0.5 ? 0 : openShift, d.v);
    }
    overlay.addEventListener("pointerup", release);
    overlay.addEventListener("pointercancel", release);
    overlay.addEventListener("lostpointercapture", release);
    overlay.addEventListener("click", function () {
      if (suppressClick) { suppressClick = false; return; }
      animateClose();
    });

    var edge = doc.createElement("div");
    edge.className = "sf-drawerEdge";
    edge.setAttribute("aria-hidden", "true");
    v.appendChild(edge);
    var o = { down: false, engaged: false, pid: null, sx: 0, sy: 0, lx: 0, lt: 0, v: 0 };
    edge.addEventListener("pointerdown", function (e) {
      if (isOpen() || !isMobile() || v.dataset.panel !== "stores") return;
      o.down = true; o.engaged = false; o.pid = e.pointerId;
      o.sx = o.lx = e.clientX; o.sy = e.clientY; o.lt = e.timeStamp; o.v = 0;
      openShift = shiftPx();
    });
    edge.addEventListener("pointermove", function (e) {
      if (!o.down) return;
      var dx = e.clientX - o.sx, dy = e.clientY - o.sy;
      if (!o.engaged) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (dx <= Math.abs(dy)) { o.down = false; return; }
        o.engaged = true;
        v.classList.add("sf-drawerDragging");
        v.classList.add("sf-drawerOpen");
        rail.setAttribute("aria-hidden", "false");
        try { edge.setPointerCapture(o.pid); } catch (_) {}
      }
      var dt = e.timeStamp - o.lt;
      if (dt > 0) { o.v = o.v * 0.7 + ((e.clientX - o.lx) / dt) * 0.3; o.lx = e.clientX; o.lt = e.timeStamp; }
      var x = dx;
      if (x < 0) x = 0;
      else if (x > openShift) x = openShift + band(x - openShift, 60);
      paint(x);
    });
    function orelease(e) {
      if (!o.down) return;
      o.down = false;
      if (o.pid != null) { try { edge.releasePointerCapture(o.pid); } catch (_) {} o.pid = null; }
      if (!o.engaged) {
        if (e && e.type === "pointerup") {
          edge.style.pointerEvents = "none";
          var under = doc.elementFromPoint(e.clientX, e.clientY);
          edge.style.pointerEvents = "";
          if (under && under.click) under.click();
        }
        return;
      }
      var projected = curX + o.v * 100;
      settle(projected > openShift * 0.5 ? openShift : 0, o.v);
    }
    edge.addEventListener("pointerup", orelease);
    edge.addEventListener("pointercancel", orelease);
    edge.addEventListener("lostpointercapture", orelease);

    v.addEventListener("click", function (e) {
      if (isMobile() && isOpen() && e.target.closest(".sf-railRow")) animateClose();
    });

    global.addEventListener("resize", function () {
      if (!isMobile() && isOpen()) finish(false);
    });

    rail.setAttribute("aria-hidden", isMobile() ? "true" : "false");
  }

  doc.addEventListener("DOMContentLoaded", function () {
    var v = view(); if (!v) return;

    v.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-panel-go]");
      if (nav) {
        if (nav.dataset.panelGo === "search") { openSearchOverlay(); return; }
        showPanel(nav.dataset.panelGo); // NOT setPanel — this IS the real dock click
                                          // bottomNav.js's own listener is already handling
        return;
      }

      var dashNav = e.target.closest("[data-dashcal-prev-month], [data-dashcal-next-month], [data-dashcal-prev-year], [data-dashcal-next-year]");
      if (dashNav) {
        if (dashNav.hasAttribute("data-dashcal-prev-month")) stepDashCal(-1, 0);
        else if (dashNav.hasAttribute("data-dashcal-next-month")) stepDashCal(1, 0);
        else if (dashNav.hasAttribute("data-dashcal-prev-year")) stepDashCal(0, -1);
        else stepDashCal(0, 1);
        return;
      }

      var seg = e.target.closest("[data-status-go]");
      if (seg) {
        var wrap = v.querySelector(".sf-seg");
        if (!wrap) return;
        wrap.dataset.status = seg.dataset.statusGo;
        wrap.querySelectorAll("[data-status-go]").forEach(function (b) {
          b.setAttribute("aria-checked", String(b === seg));
        });
        renderInspections();
        return;
      }

      var score = e.target.closest("[data-score]");
      if (score) {
        // single-select, expressed on the buttons themselves
        score.closest(".sf-scores").querySelectorAll(".sf-score").forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === score));
        });
        syncAssessmentValidity();
        return;
      }

      var segBtn = e.target.closest("[data-assess-value]");
      if (segBtn) {
        segBtn.closest("[data-assess-seg]").querySelectorAll('[role="radio"]').forEach(function (b) {
          b.setAttribute("aria-checked", String(b === segBtn));
        });
        syncAssessmentValidity();
        return;
      }

      if (e.target.closest("[data-stall-settings-close]")) { closeStallSettings(); return; }

      if (e.target.closest("[data-result-close]")) { closeResult(); return; }

      if (e.target.closest("[data-result-schedule]")) {
        var booked = pendingResult;
        closeResult();
        if (booked) {
          scheduling = { stallId: booked.stallId, inspectionId: null };
          openCalendar(booked.suggestedNextDate || null, v.querySelector("[data-schedule-open]"));
        }
        return;
      }

      if (e.target.closest("[data-assessment-close]")) { closeAssessment(); return; }
      if (e.target.closest("[data-assessment-save]")) { completeAssessment(); return; }

      var directions = e.target.closest("[data-directions]");
      if (directions) {
        e.stopPropagation();
        global.open(directions.dataset.directions, "_blank", "noopener");
        return;
      }

      var insp = e.target.closest("[data-inspection]");
      if (insp) { openAssessment(Number(insp.dataset.inspection)); return; }

      var assessOpen = e.target.closest("[data-assess-open]");
      if (assessOpen) { openAssessment(Number(assessOpen.dataset.assessOpen)); return; }

      var assessNow = e.target.closest("[data-assess-now]");
      if (assessNow) { startWalkIn(Number(assessNow.dataset.assessNow)); return; }

      var unassigned = e.target.closest("[data-unassigned]");
      if (unassigned) {
        selectStall(Number(unassigned.dataset.unassigned));
        setPanel("stores");
        return;
      }

      var headOpen = e.target.closest("[data-stall-settings-open]");
      if (headOpen && !e.target.closest("button")) {
        openStallSettings(Number(headOpen.dataset.stallSettingsOpen));
        return;
      }

      var scheduleOpen = e.target.closest("[data-schedule-open]");
      if (scheduleOpen) { openSchedule(selectedStallId, null, scheduleOpen); return; }
      var historyEdit = e.target.closest("[data-history-edit]");
      if (historyEdit) { openAssessment(Number(historyEdit.dataset.historyEdit)); return; }
      var scheduleEdit = e.target.closest("[data-schedule-edit]");
      if (scheduleEdit) { openSchedule(selectedStallId, Number(scheduleEdit.dataset.scheduleEdit), scheduleEdit); return; }

      if (e.target.closest("[data-calendar-dismiss]")) { closeCalendar(true); return; }
      if (e.target.closest("[data-calendar-prev-month]")) { calendarStep(-1); return; }
      if (e.target.closest("[data-calendar-next-month]")) { calendarStep(1); return; }
      if (e.target.closest("[data-calendar-prev-year]")) { calendarStep(-12); return; }
      if (e.target.closest("[data-calendar-next-year]")) { calendarStep(12); return; }
      if (e.target.closest("[data-calendar-next]")) { advanceToConfirm(); return; }
      if (e.target.closest("[data-calendar-back]")) { backToPick(); return; }
      if (e.target.closest("[data-calendar-confirm]")) { confirmCalendarPick(); return; }
      if (e.target.closest("[data-calendar-delete]")) { deleteSchedule(); return; }

      if (e.target.closest("[data-logout]")) { signOut(); return; }
      var calDay = e.target.closest(".sf-calendar__day");
      if (calDay && !calDay.disabled) { pickCalendarDate(calDay.dataset.date); return; }

      if (e.target.closest("[data-search-dismiss]")) { closeSearchOverlay(); return; }
      var result = e.target.closest("[data-search-result]");
      if (result) {
        selectStall(Number(result.dataset.searchResult));
        closeSearchOverlay();
        return;
      }

      var railRow = e.target.closest(".sf-railRow");
      if (railRow) { selectStall(Number(railRow.dataset.stall)); return; }
    });

    doc.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      var cal = v.querySelector("[data-calendar-overlay]");
      if (cal && !cal.hidden) { closeCalendar(true); return; }
      var assess = v.querySelector("[data-assessment]");
      if (assess && !assess.hidden) { closeAssessment(); return; }
      var overlay = v.querySelector("[data-search-overlay]");
      if (overlay && !overlay.hidden) { closeSearchOverlay(); }
    });

    v.addEventListener("keydown", function (e) {
      if (!e.target.classList || !e.target.classList.contains("sf-calendar__day")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveCalendarFocus(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveCalendarFocus(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveCalendarFocus(-7); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveCalendarFocus(7); }
      else if (e.key === "Enter" && !e.target.disabled) { e.preventDefault(); pickCalendarDate(e.target.dataset.date); }
    });

    v.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var head = e.target.closest("[data-stall-settings-open]");
      if (!head || e.target !== head) return;
      e.preventDefault();
      openStallSettings(Number(head.dataset.stallSettingsOpen));
    });

    var assessModal = v.querySelector("[data-assessment]");
    if (assessModal) {
      assessModal.addEventListener("change", syncAssessmentValidity);
      assessModal.addEventListener("input", syncAssessmentValidity);
    }

    var overlaySearch = v.querySelector("[data-search-overlay] [data-authority-search]");
    if (overlaySearch) overlaySearch.addEventListener("input", function () { renderSearchResults(overlaySearch.value); });

    var dock = v.querySelector("[data-bottom-nav]");
    if (dock) {
      var dockLastSeen = null;
      new MutationObserver(function () {
        var cur = dock.querySelector('[aria-current="true"]');
        if (!cur || cur === dockLastSeen) return;
        dockLastSeen = cur;
        if (cur.dataset.panelGo === "search") {
          var overlay = v.querySelector("[data-search-overlay]");
          if (overlay && overlay.hidden) openSearchOverlay();
        } else {
          showPanel(cur.dataset.panelGo);
        }
      }).observe(dock, { attributes: true, attributeFilter: ["aria-current"], subtree: true });
    }

    initDrawer();

    global.addEventListener("resize", function () {
      if (doc.body.dataset.view !== "authority") return;
      var el = v.querySelector("[data-authority-transcript]");
      if (el) setupHeadMarquee(el);
    });

    if (!localStorage.getItem(TOKEN_KEY)) {
      global.location.href = LOGIN_URL;
      return;
    }

    api("/inspections/promote", { method: "POST" })
      .catch(function () { return null; })
      .then(loadData)
      .then(renderAll)
      .catch(function (err) {
        console.error("Failed to load inspection data:", err);
      });
  });
})(window, document);
