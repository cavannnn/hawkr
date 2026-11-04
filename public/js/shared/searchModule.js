import { getSearchableItems, recordSearchHit } from "../../data/shared.js";
import { modifierLabel } from "./platform.js";


const SEARCH_HISTORY_KEY = "hawkr_search_history";
const MAX_SEARCH_HISTORY = 10;

let searchHistory = [];
let popularSearches = [];
let searchableItems = [];
let currentSearchQuery = "";
let selectedResultIndex = -1;
let dataLoaded = false;
let navigationPages = [];
let resolveDestination = () => null;
let searchScope = null;
let searchProvider = null;
let providerResults = [];
let providerQuery = "";
let providerSeq = 0; 
let providerTimer = null;


const PROVIDER_DEBOUNCE_MS = 180;

const PROVIDER_MIN_CHARS = 2;

async function fetchSearchableData() {
  if (dataLoaded) return;

  if (searchProvider) {
    searchableItems = [...navigationPages];
    popularSearches = navigationPages.slice(0, 5);
    dataLoaded = true;
    return;
  }

  try {
    const items = await getSearchableItems(searchScope);

    searchableItems = [...items, ...navigationPages];

    const rankable = items.filter((i) => i.type !== "menuItem");
    rankable.sort((a, b) => (b.searchCount || 0) - (a.searchCount || 0));
    popularSearches = rankable.slice(0, 5);

    dataLoaded = true;
  } catch (error) {
    console.error("Error fetching searchable data:", error);
    
    searchableItems = [...navigationPages];
    popularSearches = [];
    dataLoaded = true;
  }
}


function getSearchHistoryFromStorage() {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Error loading search history:", e);
    return [];
  }
}

function saveSearchHistoryToStorage(history) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Error saving search history:", e);
  }
}

function addToSearchHistory(item) {
  const historyEntry = {
    ...item,
    searchedAt: formatSearchTime(new Date()),
  };

  searchHistory = searchHistory.filter(
    (h) => !(h.id === item.id && h.type === item.type),
  );

  searchHistory.unshift(historyEntry);

  if (searchHistory.length > MAX_SEARCH_HISTORY) {
    searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
  }

  saveSearchHistoryToStorage(searchHistory);
}

function formatSearchTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}


function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;

  
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function fuzzyMatchWord(searchWord, textWords, maxDistance = 2) {
  
  if (
    textWords.some((tw) => tw && (tw.includes(searchWord) || searchWord.includes(tw)))
  ) {
    return true;
  }

  
  const allowedDistance = searchWord.length <= 4 ? 1 : maxDistance;

  return textWords.some((tw) => {
    
    
    if (Math.abs(tw.length - searchWord.length) > allowedDistance) {
      return false;
    }
    return levenshteinDistance(searchWord, tw) <= allowedDistance;
  });
}

function searchItems(query) {
  if (!query || query.trim() === "") {
    return [];
  }

  
  const stopWords = [
    "at",
    "the",
    "in",
    "on",
    "a",
    "an",
    "of",
    "for",
    "and",
    "or",
    "from",
  ];

  
  const words = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((word) => !stopWords.includes(word) && word.length > 0);

  if (words.length === 0) {
    return [];
  }

  

  const local = (searchProvider ? navigationPages : searchableItems);

  
  
  const matched = local.filter((item) => {
    let searchText = item.name.toLowerCase();
    if (item.parentName) {
      searchText += ` ${item.parentName.toLowerCase()}`;
    }
    if (item.keywords) {
      searchText += ` ${item.keywords.toLowerCase()}`;
    }

    const textWords = searchText.split(/\s+/);

    return words.every((word) => fuzzyMatchWord(word, textWords));
  });

  return searchProvider ? [...matched, ...providerResults] : matched;
}


function updateProviderResults(query) {
  if (!searchProvider) return;

  const q = (query || "").trim();
  clearTimeout(providerTimer);

  if (q.length < PROVIDER_MIN_CHARS) {
    providerSeq++; 
    providerQuery = "";
    if (providerResults.length) {
      setProviderResults([]);
      renderSearchDropdown(currentSearchQuery);
    }
    return;
  }

  if (q === providerQuery) return; 

  const seq = ++providerSeq;
  providerTimer = setTimeout(async () => {
    let rows = [];
    try {
      rows = await searchProvider(q);
    } catch (error) {
      console.error("Search request failed:", error);
    }
    if (seq !== providerSeq) return;
    providerQuery = q;
    setProviderResults(rows);
    renderSearchDropdown(currentSearchQuery);
  }, PROVIDER_DEBOUNCE_MS);
}

function setProviderResults(rows) {
  providerResults = Array.isArray(rows) ? rows : [];
  searchableItems = [...navigationPages, ...providerResults];
}


function renderSearchResultItem(item, isHistory = false) {

  const meta = isHistory
    ? `<span class="searchResultMeta history">${item.searchedAt}</span>`
    : "";

  
  if (item.type === "page") {
    const bgColor = item.color || "#F6EEF9";
    return `
      <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}" data-url="${item.url}">
        <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          ${meta}
        </div>
      </div>
    `;
  }

  
  if (item.type === "menuItem") {
    const stallName = item.stallName || "Unknown Stall";
    const hawkerCentreName = item.hawkerCentreName || "";
    const subtitle = hawkerCentreName
      ? `${stallName} • ${hawkerCentreName}`
      : stallName;
    const priceDisplay = item.price ? `$${item.price.toFixed(2)}` : "";

    return `
      <div class="searchResultItem searchResultMenuItem" data-type="${item.type}" data-id="${item.id}" data-stall-id="${item.stallId}">
        <div class="searchResultImage">
          <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          <span class="searchResultSubtitle">${subtitle}</span>
        </div>
        <span class="searchResultPrice">${priceDisplay}</span>
      </div>
    `;
  }

  
  let displayName = item.name;
  if (item.type === "stall" && item.parentName) {
    displayName = `${item.name} • ${item.parentName}`;
  }

  return `
    <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}"${urlAttr(item)}>
      ${resultThumb(item, { onImageError: "this.parentElement.style.display='none'" })}
      <div class="searchResultInfo">
        <span class="searchResultName">${displayName}</span>
        ${subtitleLine(item)}
        ${meta}
      </div>
    </div>
  `;
}


function urlAttr(item) {
  return item.url ? ` data-url="${item.url}"` : "";
}

function subtitleLine(item) {
  return item.subtitle ? `<span class="searchResultSubtitle">${item.subtitle}</span>` : "";
}

function resultThumb(item, { onImageError, always = false } = {}) {
  if (item.icon) {
    return `<div class="searchResultImage searchResultIcon" style="background: ${item.color || "#F6EEF9"}">
        <img src="${item.icon}" alt="">
      </div>`;
  }
  if (!item.image && !always) return "";
  return `<div class="searchResultImage">
        <img src="${item.image}" alt="${item.name}" onerror="${onImageError}">
      </div>`;
}

function renderSearchResultItemSimple(item) {
  
  if (item.type === "page") {
    const bgColor = item.color || "#F6EEF9";
    return `
      <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}" data-url="${item.url}">
        <div class="searchResultImage searchResultIcon" style="background: ${bgColor}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
        </div>
      </div>
    `;
  }

  
  if (item.type === "menuItem") {
    const stallName = item.stallName || "Unknown Stall";
    const hawkerCentreName = item.hawkerCentreName || "";
    const subtitle = hawkerCentreName
      ? `${stallName} • ${hawkerCentreName}`
      : stallName;
    const priceDisplay = item.price ? `$${item.price.toFixed(2)}` : "";

    return `
      <div class="searchResultItem searchResultMenuItem" data-type="${item.type}" data-id="${item.id}" data-stall-id="${item.stallId}">
        <div class="searchResultImage">
          <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
        </div>
        <div class="searchResultInfo">
          <span class="searchResultName">${item.name}</span>
          <span class="searchResultSubtitle">${subtitle}</span>
        </div>
        <span class="searchResultPrice">${priceDisplay}</span>
      </div>
    `;
  }

  
  let displayName = item.name;
  if (item.type === "stall" && item.parentName) {
    displayName = `${item.name} • ${item.parentName}`;
  }

  


  return `
    <div class="searchResultItem" data-type="${item.type}" data-id="${item.id}"${urlAttr(item)}>
      ${resultThumb(item, { onImageError: "this.style.display='none'", always: true })}
      <div class="searchResultInfo">
        <span class="searchResultName">${displayName}</span>
        ${subtitleLine(item)}
      </div>
    </div>
  `;
}

function renderSearchDropdown(query = "") {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  let contentHTML = "";

  if (query && query.trim() !== "") {
    const results = searchItems(query);
    if (results.length > 0) {
      const resultsHTML = results
        .map((item) => renderSearchResultItemSimple(item))
        .join("");
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          ${resultsHTML}
        </div>
      `;
    } else {
      contentHTML = `
        <div class="searchSection">
          <span class="searchSectionHeader">Search Results</span>
          <span class="searchEmptyState">No results found for "${query}"</span>
        </div>
      `;
    }
  } else {
    const hasHistory = searchHistory.length > 0;

    let historySection = "";
    if (hasHistory) {
      const historyItemsHTML = searchHistory
        .map((item) => renderSearchResultItem(item, true))
        .join("");
      historySection = `
        <div class="searchSection">
          <span class="searchSectionHeader">History</span>
          ${historyItemsHTML}
        </div>
      `;
    } else {
      historySection = `
        <div class="searchSection">
          <span class="searchSectionHeader">History</span>
          <span class="searchEmptyState">None found... Get searching!</span>
        </div>
      `;
    }

    const suggestionsHeader = hasHistory
      ? "Suggestions"
      : "What People Are Searching...";
    const suggestionsItemsHTML = popularSearches
      .map((item) => renderSearchResultItem(item, false))
      .join("");
    const suggestionsSection = `
      <div class="searchSection">
        <span class="searchSectionHeader">${suggestionsHeader}</span>
        ${suggestionsItemsHTML || '<span class="searchEmptyState">Loading...</span>'}
      </div>
    `;

    contentHTML = historySection + suggestionsSection;
  }

  dropdown.innerHTML = `
    <div class="searchDropdownContent">
      ${contentHTML}
    </div>
  `;

  const resultItems = dropdown.querySelectorAll(".searchResultItem");
  resultItems.forEach((item, index) => {

    item.addEventListener("mousedown", (e) => e.preventDefault());

    item.addEventListener("click", () => {
      const type = item.dataset.type;
      const id = item.dataset.id;
      const url = item.dataset.url || null;
      const stallId = item.dataset.stallId || null;
      handleSearchResultClick(type, id, url, stallId);
    });

    item.addEventListener("mousemove", (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      item.style.setProperty("--mouse-x", `${x}px`);
      item.style.setProperty("--mouse-y", `${y}px`);
    });

    item.addEventListener("mouseenter", () => {
      selectedResultIndex = index;
      updateSelectedResult();
    });

    item.addEventListener("mouseleave", () => {
      selectedResultIndex = -1;
      updateSelectedResult();
    });
  });
}

function updateSelectedResult() {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  items.forEach((item, index) => {
    if (index === selectedResultIndex) {
      item.classList.add("selected");
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      item.classList.remove("selected");
    }
  });
}

function handleSearchKeydown(e) {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const items = dropdown.querySelectorAll(".searchResultItem");
  if (items.length === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedResultIndex = Math.min(selectedResultIndex + 1, items.length - 1);
    updateSelectedResult();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
    updateSelectedResult();
  } else if (e.key === "Enter" && selectedResultIndex >= 0) {
    e.preventDefault();
    const selectedItem = items[selectedResultIndex];
    if (selectedItem) {
      const type = selectedItem.dataset.type;
      const id = selectedItem.dataset.id;
      const url = selectedItem.dataset.url || null;
      const stallId = selectedItem.dataset.stallId || null;
      handleSearchResultClick(type, id, url, stallId);
    }
  }
}

async function handleSearchResultClick(type, id, url = null, stallId = null) {
  const item = searchableItems.find(
    (i) => i.id.toString() === id.toString() && i.type === type,
  );

  if (item) {
    addToSearchHistory(item);
  }

  
  
  if (type === "hawkerCentre" || type === "stall") {
    recordSearchHit(type, id).catch(() => {});
  }

  if (url) {
    window.location.href = url;
    return;
  }

  const destination = resolveDestination({
    type,
    id,
    stallId: stallId || item?.stallId,
    item,
  });
  if (destination) window.location.href = destination;
}


function labelShortcutKey() {
  const mod = document.getElementById("searchKeyMod");
  if (!mod || mod.textContent.trim()) return;
  mod.textContent = modifierLabel();
}

async function initializeSearchModule() {
  labelShortcutKey();

  const searchWrapper = document.querySelector(".searchModuleWrapper");
  const searchInput = document.getElementById("searchInput");
  const searchDropdown = document.getElementById("searchDropdown");
  const searchModule = document.querySelector(".searchModule");

  if (!searchWrapper || !searchInput || !searchDropdown) return;

  
  await fetchSearchableData();
  if (searchModule) {
    searchModule.addEventListener("click", (e) => {
      if (e.target.closest(".searchClear")) return; 
      if (document.activeElement !== searchInput) searchInput.focus();

      
      if (window.innerWidth <= 768) {
        e.preventDefault();
        selectedResultIndex = -1;
        searchHistory = getSearchHistoryFromStorage();
        currentSearchQuery = searchInput.value;

        requestAnimationFrame(() => {
          searchWrapper.classList.add("active");
          syncPopulated(currentSearchQuery);
          renderSearchDropdown(currentSearchQuery);
          updateProviderResults(currentSearchQuery);
          setupSearchInputListener();
        });
      }
    });
  }


  searchInput.addEventListener("focus", async () => {
    selectedResultIndex = -1;
    searchHistory = getSearchHistoryFromStorage();
    currentSearchQuery = searchInput.value;

    requestAnimationFrame(() => {
      searchWrapper.classList.add("active");
      syncPopulated(currentSearchQuery);
      renderSearchDropdown(currentSearchQuery);
      

      updateProviderResults(currentSearchQuery);
      setupSearchInputListener();
    });
  });

  if (!searchModule.querySelector(".searchClear")) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "searchClear";
    clear.setAttribute("aria-label", "Clear search");
    



    clear.innerHTML =
      '<span class="icon" style="--icon: url(../../assets/icons/close.svg)"></span>';
    
    clear.addEventListener("click", () => {
      searchInput.value = "";
      currentSearchQuery = "";
      selectedResultIndex = -1;
      syncPopulated("");
      renderSearchDropdown("");
      searchWrapper.classList.remove("active");
      searchInput.blur();
    });
    
    searchModule.appendChild(clear);
  }

  document.addEventListener("click", (e) => {
    const isClickInsideDropdown = searchDropdown.contains(e.target);
    const isClickInsideWrapper = searchWrapper.contains(e.target);
    if (!isClickInsideWrapper && !isClickInsideDropdown) {
      searchWrapper.classList.remove("active");
      currentSearchQuery = "";
      selectedResultIndex = -1;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      


      searchInput.value = "";
      currentSearchQuery = "";
      selectedResultIndex = -1;
      syncPopulated("");
      searchWrapper.classList.remove("active");
      searchInput.blur();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      


      const targetTag = (e.target?.tagName || "").toLowerCase();
      const isEditable = e.target?.isContentEditable === true;

      if (targetTag === "input" || targetTag === "textarea" || isEditable) {
        return;
      }

      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
}


function setupSearchInputListener() {
  const input = document.getElementById("searchInput");
  if (!input) return;

  input.removeEventListener("input", handleSearchInput);
  input.removeEventListener("keydown", handleSearchKeydown);

  input.addEventListener("input", handleSearchInput);
  input.addEventListener("keydown", handleSearchKeydown);
}


function syncPopulated(value) {
  const field = document.querySelector(".searchModule");
  if (field) field.classList.toggle("is-populated", value.length > 0);
}

function handleSearchInput(e) {
  currentSearchQuery = e.target.value;
  selectedResultIndex = -1;
  syncPopulated(currentSearchQuery);
  renderSearchDropdown(currentSearchQuery);
  updateProviderResults(currentSearchQuery);
  

}


export function setSearchNavigation(pages) {
  navigationPages = (pages || []).map((p) => ({ ...p, type: "page" }));
  dataLoaded = false; 
}

export function setSearchDestinationResolver(resolver) {
  if (typeof resolver === "function") resolveDestination = resolver;
}

export function setSearchScope(scope) {
  searchScope = scope || null;
  dataLoaded = false; 
}


export function setSearchProvider(fetcher) {
  searchProvider = typeof fetcher === "function" ? fetcher : null;
  providerResults = [];
  providerQuery = "";
  providerSeq++;
  dataLoaded = false; 
}

export { initializeSearchModule };


document.addEventListener("DOMContentLoaded", function () {
  initializeSearchModule();
});
