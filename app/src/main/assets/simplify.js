(function () {
  "use strict";

  if (!window.TwkanBridge || typeof window.TwkanBridge.toSimplified !== "function") {
    return;
  }

  // ─── Ad Blocker ───────────────────────────────────────────────────────────
  function removeAds() {
    var adSelectors = [
      'iframe[src*="ads"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
      'div[id*="ad"]',
      'div[class*="ad"]',
      'div[id*="banner"]',
      'div[class*="banner"]',
      'div[id*="sponsor"]',
      'div[class*="sponsor"]',
      'ins.adsbygoogle',
      '[class*="advertisement"]',
      '[id*="advertisement"]',
      'a[href*="/ads/"]',
      'div[style*="display: none"]'
    ];

    adSelectors.forEach(function (selector) {
      try {
        document.querySelectorAll(selector).forEach(function (el) {
          var isAd = false;
          if (el.tagName === "IFRAME") {
            isAd = true;
          } else if (el.offsetHeight > 50 && el.offsetHeight < 300 && el.offsetWidth > 200) {
            var text = el.innerText || "";
            if (text.match(/广告|Advertisement|赞助|Sponsored/i)) {
              isAd = true;
            }
          }
          if (isAd) {
            el.style.display = "none";
            el.remove();
          }
        });
      } catch (e) { /* ignore */ }
    });

    document.querySelectorAll("script[src]").forEach(function (script) {
      if ((script.src || "").match(/googlesyndication|doubleclick|ads|adservice|advertising/i)) {
        script.remove();
      }
    });
  }

  var PROMOTIONAL_TEXT_PATTERN = /记住首发网站域名|記住首發網站域名|本书首发|本書首發|无错章节|無錯章節|无乱序章节|無亂序章節|提供给你无错章节|提供給你無錯章節|记一下我们的域名|記一下我們的域名|希望读者记一下我们的域名|希望讀者記一下我們的域名|希望读者.{0,120}(?:域名|台湾小说网|臺灣小說網)|域名.{0,100}(?:台湾小说网|臺灣小說網|twkan|𝕥𝕨𝕜𝕒𝕟|𝑡𝑤𝑘𝑎𝑛|t̲)|(?:台湾小说网|臺灣小說網).{0,100}(?:域名|twkan|𝕥𝕨𝕜𝕒𝑛|𝑡𝑤𝑘𝑎𝑛|t̲)|首发台湾小说网|首發臺灣小說網/i;

  function removePromotionalText(root) {
    if (!root || !root.querySelectorAll) return;

    var candidates = root.querySelectorAll("p, li, small, footer, div, section, article");
    for (var i = candidates.length - 1; i >= 0; i--) {
      var candidate = candidates[i];
      if (candidate.getAttribute && candidate.getAttribute("data-twkan-reader-ui") === "true") continue;
      var text = (candidate.textContent || "").replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "");
      if (text.length === 0 || text.length > 500 || !PROMOTIONAL_TEXT_PATTERN.test(text)) continue;

      var nestedBlocks = candidate.querySelectorAll("p, li, small, footer, div, section, article");
      var hasMeaningfulNestedBlock = false;
      for (var n = 0; n < nestedBlocks.length; n++) {
        if (nestedBlocks[n] !== candidate &&
            (nestedBlocks[n].textContent || "").replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "").length >= 40) {
          hasMeaningfulNestedBlock = true;
          break;
        }
      }
      if (!hasMeaningfulNestedBlock) candidate.remove();
    }

    var paragraphNodes = root.querySelectorAll("p, li, small");
    for (i = 0; i < paragraphNodes.length; i++) {
      var start = paragraphNodes[i];
      var windowText = "";
      var windowNodes = [];
      for (var w = i; w < paragraphNodes.length && w < i + 4; w++) {
        var candidateNode = paragraphNodes[w];
        if (candidateNode.parentElement && candidateNode.parentElement.closest &&
            candidateNode.parentElement.closest("[data-twkan-reader-ui='true']")) break;
        var candidateText = (candidateNode.textContent || "").replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "");
        if (candidateText.length === 0) continue;
        windowText += candidateText;
        windowNodes.push(candidateNode);
        if (windowText.length > 500) break;
        if (/域名|台湾小说网|臺灣小說網/.test(windowText) &&
            /twkan|𝕥𝕨𝕜𝕒𝕟|𝑡𝑤𝑘𝑎𝑛|t̲/.test(windowText)) {
          for (var removeIndex = 0; removeIndex < windowNodes.length; removeIndex++) {
            if (windowNodes[removeIndex].parentNode) windowNodes[removeIndex].remove();
          }
          break;
        }
      }
    }


    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest &&
          node.parentElement.closest("[data-twkan-reader-ui='true']")) continue;
      var nodeText = (node.nodeValue || "").replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "");
      if (nodeText.length > 0 && PROMOTIONAL_TEXT_PATTERN.test(nodeText)) textNodes.push(node);
    }
    for (i = 0; i < textNodes.length; i++) textNodes[i].remove();
  }


  function initAdBlocker() {
    removeAds();
    removePromotionalText(document.body || document.documentElement);
    setInterval(function () {
      removeAds();
      removePromotionalText(document.body || document.documentElement);
    }, 2000);
  }

  // ─── Constants ────────────────────────────────────────────────────────────
  var CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;
  var SEP = "\u001F";
  var SKIP_TAGS = {
    SCRIPT: true, STYLE: true, NOSCRIPT: true,
    TEXTAREA: true, INPUT: true, SELECT: true, OPTION: true,
    CODE: true, PRE: true, SVG: true, CANVAS: true
  };
  var ATTRIBUTES = ["title", "aria-label", "alt", "placeholder"];
  var installedKey = "__twkanSimplifierInstalled";
  var runKey       = "__twkanSimplifierRun";
  var converting   = false;
  var pageReadySent = false; // only notify Java once per page load
  var READING_SETTINGS_KEY = "twkan:readingSettings";
  var READING_POSITION_KEY = "twkan:readingPosition";
  var CLOUDFLARE_BLOCKED_KEY = "twkan:cloudflareBlocked";


  // ─── Helpers ──────────────────────────────────────────────────────────────
  function canConvertText(text) {
    return text && CJK_PATTERN.test(text);
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (SKIP_TAGS[element.tagName]) return true;
    return element.isContentEditable === true;
  }

  function hasSkippedParent(node) {
    var current = node.parentElement;
    while (current) {
      if (shouldSkipElement(current)) return true;
      current = current.parentElement;
    }
    return false;
  }

  // ─── Batch Conversion ─────────────────────────────────────────────────────
  function simplify(root, isFirstPass) {
    if (!root || converting) return;
    converting = true;

    try {
      var textNodes = [];
      var attrNodes = [];

      if (root.nodeType === Node.TEXT_NODE) {
        if (!hasSkippedParent(root) && canConvertText(root.nodeValue)) {
          textNodes.push(root);
        }
      } else {
        var walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: function (node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return shouldSkipElement(node)
                  ? NodeFilter.FILTER_REJECT
                  : NodeFilter.FILTER_ACCEPT;
              }
              return hasSkippedParent(node)
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        var node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === Node.TEXT_NODE) {
            if (canConvertText(node.nodeValue)) textNodes.push(node);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (var a = 0; a < ATTRIBUTES.length; a++) {
              var val = node.getAttribute(ATTRIBUTES[a]);
              if (canConvertText(val)) {
                attrNodes.push({ element: node, attrName: ATTRIBUTES[a], value: val });
              }
            }
          }
        }

        if (canConvertText(document.title)) {
          attrNodes.push({ element: null, attrName: "__title__", value: document.title });
        }
      }

      var allValues = [];
      for (var i = 0; i < textNodes.length; i++) allValues.push(textNodes[i].nodeValue);
      for (var j = 0; j < attrNodes.length; j++) allValues.push(attrNodes[j].value);

      if (allValues.length === 0) {
        // Nothing to convert – page is ready
        if (isFirstPass) notifyPageReady();
        return;
      }

      var batchOutput;
      try {
        if (typeof window.TwkanBridge.toBatchSimplified === "function") {
          batchOutput = window.TwkanBridge.toBatchSimplified(allValues.join(SEP));
        } else {
          batchOutput = window.TwkanBridge.toSimplified(allValues.join(SEP));
        }
      } catch (e) {
        if (isFirstPass) notifyPageReady();
        return;
      }

      if (!batchOutput) {
        if (isFirstPass) notifyPageReady();
        return;
      }

      var results = batchOutput.split(SEP);

      for (var ti = 0; ti < textNodes.length; ti++) {
        var converted = results[ti];
        if (converted !== undefined && converted !== textNodes[ti].nodeValue) {
          textNodes[ti].nodeValue = converted;
        }
      }
      var offset = textNodes.length;
      for (var ai = 0; ai < attrNodes.length; ai++) {
        var entry = attrNodes[ai];
        var newVal = results[offset + ai];
        if (newVal === undefined || newVal === entry.value) continue;
        if (entry.attrName === "__title__") {
          document.title = newVal;
        } else {
          entry.element.setAttribute(entry.attrName, newVal);
        }
      }

      document.documentElement.setAttribute("lang", "zh-Hans");

      // Tell Java the first pass is done → show the WebView
      if (isFirstPass) notifyPageReady();

    } finally {
      converting = false;
    }
  }

  function notifyPageReady() {
    if (pageReadySent) return;
    pageReadySent = true;
    try {
      if (typeof window.TwkanBridge.onPageReady === "function") {
        window.TwkanBridge.onPageReady();
      }
    } catch (e) { /* ignore */ }
  }

  // ─── Debounced scheduler ──────────────────────────────────────────────────
  function schedule(root, isFirstPass) {
    window.clearTimeout(schedule.timer);
    schedule.pendingRoot = root || document.body || document.documentElement;
    // A mutation caused by script/style injection must not cancel the initial
    // pass, otherwise Java waits for the safety timeout before showing the page.
    schedule.pendingFirst = schedule.pendingFirst === true || isFirstPass === true;
    schedule.timer = window.setTimeout(function () {
      var firstPass = schedule.pendingFirst === true;
      schedule.pendingFirst = false;
      simplify(schedule.pendingRoot, firstPass);
    }, 60);
  }

  // ─── Infinite Chapter Reader + 3-chapter memory prefetch ──────────────────
  var PREFETCH_AHEAD = 0;
  var chapterCache = Object.create(null);
  var chapterRequests = Object.create(null);
  var appendedUrls = Object.create(null);
  var infiniteInitialized = false;
  var infiniteHost = null;
  var loadingIndicator = null;
  var nextChapterUrl = null;
  var appendingChapter = false;
  var noMoreChapters = false;
  var initialChapterUrl = null;
  var initialChapterTitle = null;
  var currentReadingUrl = null;
  var readingTrackerTimer = null;
  var cloudflareBlockedUrl = null;
  var cloudflareBlockedAt = 0;
  // Tracks cleanup callbacks for in-flight hidden-iframe Cloudflare probes,
  // so navigating away from the reader (library/history page, or the whole
  // page unloading) can force-stop any pending polling timers instead of
  // leaking them.
  var activeIframeCleanups = [];

  function cancelActiveIframeProbes() {
    while (activeIframeCleanups.length) {
      var cleanupFn = activeIframeCleanups.pop();
      try { cleanupFn(); } catch (e) { /* ignore */ }
    }
  }

  var readingSettings = {
    fontSize: 20,
    lineHeight: 1.9,
    letterSpacing: 0,
    background: "site"
  };
  var readingSettingsInitialized = false;
  var readingPositionRestoreTimer = null;


  var CONTENT_SELECTORS = [
    "#chaptercontent", "#chapter-content", "#chapterContent",
    "#content", "#BookText", "#booktext",
    ".chapter-content", ".chapterContent", ".read-content",
    ".reading-content", ".read-main", ".readbox", ".txtbox",
    ".article-content", ".novel-content", ".book-content",
    ".entry-content", ".contentbox", ".txtnav", ".txt", "#txt",
    "article"
  ];

  function loadReadingSettings() {
    if (readingSettingsInitialized) return;
    var stored = null;
    try {
      var sessionRaw = sessionStorage.getItem(READING_SETTINGS_KEY);
      if (sessionRaw) stored = JSON.parse(sessionRaw);
    } catch (e) { /* try localStorage */ }
    if (!stored) {
      try {
        var localRaw = localStorage.getItem(READING_SETTINGS_KEY);
        if (localRaw) stored = JSON.parse(localRaw);
      } catch (e) { /* try native state */ }
    }
    if (!stored) {
      try {
        if (typeof window.TwkanBridge.loadReaderState === "function") {
          var nativeRaw = window.TwkanBridge.loadReaderState("settings");
          if (nativeRaw) stored = JSON.parse(nativeRaw);
        }
      } catch (e) { /* use defaults */ }
    }
    if (stored && typeof stored === "object") {
      if (isFinite(Number(stored.fontSize))) readingSettings.fontSize = Math.max(14, Math.min(32, Number(stored.fontSize)));
      if (isFinite(Number(stored.lineHeight))) readingSettings.lineHeight = Math.max(1.3, Math.min(3, Number(stored.lineHeight)));
      if (isFinite(Number(stored.letterSpacing))) readingSettings.letterSpacing = Math.max(-1, Math.min(4, Number(stored.letterSpacing)));
      if (/^(site|white|warm|green|gray|dark)$/.test(stored.background)) readingSettings.background = stored.background;
    }
    readingSettingsInitialized = true;
    if (stored) saveReadingSettings();
  }

  function saveReadingSettings() {
    var payload = {
      version: 1,
      fontSize: readingSettings.fontSize,
      lineHeight: readingSettings.lineHeight,
      letterSpacing: readingSettings.letterSpacing,
      background: readingSettings.background,
      updatedAt: Date.now()
    };
    var serialized = JSON.stringify(payload);
    try { localStorage.setItem(READING_SETTINGS_KEY, serialized); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem(READING_SETTINGS_KEY, serialized); } catch (e) { /* ignore */ }
    try {
      if (typeof window.TwkanBridge.saveReaderState === "function") {
        window.TwkanBridge.saveReaderState("settings", serialized);
      }
    } catch (e) { /* ignore */ }
  }

  function applyReadingSettings() {
    if (!readingSettingsInitialized) loadReadingSettings();
    var root = document.documentElement;
    var body = document.body;
    root.style.setProperty("--twkan-reader-font-size", readingSettings.fontSize + "px");
    root.style.setProperty("--twkan-reader-line-height", readingSettings.lineHeight);
    root.style.setProperty("--twkan-reader-letter-spacing", readingSettings.letterSpacing + "px");

    var colors = {
      site: "#ffffff",
      white: "#ffffff",
      warm: "#f7f0df",
      green: "#dcebdc",
      gray: "#eeeeee",
      dark: "#202124"
    };
    root.style.setProperty("--twkan-reader-background", colors[readingSettings.background] || colors.site);
    var foreground = readingSettings.background === "dark" ? "#f2f2f2" : "#202124";
    root.style.setProperty("--twkan-reader-foreground", foreground);
    root.setAttribute("data-twkan-reader-bg", readingSettings.background);
    if (body) {
      body.setAttribute("data-twkan-reader-bg", readingSettings.background);
      body.style.setProperty("background-color", colors[readingSettings.background] || colors.site, "important");
      body.style.setProperty("color", foreground, "important");
    }

    var controls = document.querySelectorAll("[data-twkan-setting]");
    for (var i = 0; i < controls.length; i++) {
      var key = controls[i].getAttribute("data-twkan-setting");
      if (key === "fontSize") controls[i].value = readingSettings.fontSize;
      if (key === "lineHeight") controls[i].value = readingSettings.lineHeight;
      if (key === "letterSpacing") controls[i].value = readingSettings.letterSpacing;
      if (key === "background") controls[i].value = readingSettings.background;
    }
  }

  function updateReadingSetting(key, value) {
    var numeric;
    if (key === "background") {
      if (/^(site|white|warm|green|gray|dark)$/.test(value)) readingSettings.background = value;
    } else {
      numeric = Number(value);
      if (!isFinite(numeric)) return;
      if (key === "fontSize") readingSettings.fontSize = Math.round(Math.max(14, Math.min(32, numeric)));
      if (key === "lineHeight") readingSettings.lineHeight = Math.round(Math.max(1.3, Math.min(3, numeric)) * 10) / 10;
      if (key === "letterSpacing") readingSettings.letterSpacing = Math.round(Math.max(-1, Math.min(4, numeric)) * 10) / 10;
    }
    saveReadingSettings();
    applyReadingSettings();
  }

  function resetReadingSettings() {
    readingSettings = { fontSize: 20, lineHeight: 1.9, letterSpacing: 0, background: "site" };
    saveReadingSettings();
    applyReadingSettings();
  }


  function saveReadingPosition() {
    if (!infiniteInitialized) return;
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var chapterElement = null;
    var chapters = document.querySelectorAll("[data-twkan-reading-chapter='true']");
    for (var i = 0; i < chapters.length; i++) {
      if (normalizeUrl(chapters[i].getAttribute("data-chapter-url")) === currentReadingUrl) {
        chapterElement = chapters[i];
        break;
      }
    }
    var chapterTop = chapterElement ? chapterElement.getBoundingClientRect().top + scrollY : 0;
    var position = {
      pageUrl: window.location.href.split("#")[0],
      chapterUrl: currentReadingUrl || initialChapterUrl || "",
      scrollY: scrollY,
      chapterOffset: Math.max(0, scrollY - chapterTop),
      updatedAt: Date.now()
    };
    var serialized = JSON.stringify(position);
    try { localStorage.setItem(READING_POSITION_KEY, serialized); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem(READING_POSITION_KEY, serialized); } catch (e) { /* ignore */ }
    try {
      if (typeof window.TwkanBridge.saveReaderState === "function") {
        window.TwkanBridge.saveReaderState("position", serialized);
      }
    } catch (e) { /* ignore */ }
  }

  function loadReadingPosition() {
    var stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(READING_POSITION_KEY) || "null"); } catch (e) { /* ignore */ }
    if (!stored) {
      try { stored = JSON.parse(localStorage.getItem(READING_POSITION_KEY) || "null"); } catch (e) { /* ignore */ }
    }
    if (!stored) {
      try {
        if (typeof window.TwkanBridge.loadReaderState === "function") {
          var nativeRaw = window.TwkanBridge.loadReaderState("position");
          if (nativeRaw) stored = JSON.parse(nativeRaw);
        }
      } catch (e) { /* ignore */ }
    }
    if (!stored || !isFinite(Number(stored.scrollY))) return null;
    if (Date.now() - Number(stored.updatedAt || 0) > 24 * 60 * 60 * 1000) return null;
    return stored;
  }

  function cancelReadingPositionRestore() {
    if (readingPositionRestoreTimer !== null) {
      window.clearTimeout(readingPositionRestoreTimer);
      readingPositionRestoreTimer = null;
    }
  }


  function restoreReadingPosition() {
    var stored = loadReadingPosition();
    if (!stored) return;
    var currentPageUrl = window.location.href.split("#")[0];
    if (stored.pageUrl && stored.pageUrl !== currentPageUrl) return;
    if (stored.chapterUrl && stored.chapterUrl !== initialChapterUrl) return;
    cancelReadingPositionRestore();
    var attempts = 0;
    function restore() {
      attempts++;
      if (stored.chapterUrl && currentReadingUrl && stored.chapterUrl !== currentReadingUrl) {
        if (attempts < 12) readingPositionRestoreTimer = window.setTimeout(restore, 250);
        return;
      }
      var targetY = Math.max(0, Number(stored.scrollY));
      var restoredChapter = document.querySelector("[data-twkan-reading-chapter='true']");
      if (restoredChapter && isFinite(Number(stored.chapterOffset))) {
        var rect = restoredChapter.getBoundingClientRect();
        var top = rect.top + (window.scrollY || window.pageYOffset || 0);
        var maxOffset = Math.max(0, rect.height - Math.min(window.innerHeight * 0.35, rect.height));
        var safeOffset = Math.min(Math.max(0, Number(stored.chapterOffset)), maxOffset);
        targetY = Math.max(0, top + safeOffset);
      }
      window.scrollTo(0, targetY);
      if (attempts < 3) {
        readingPositionRestoreTimer = window.setTimeout(restore, 300);
      } else {
        readingPositionRestoreTimer = null;
      }
    }
    readingPositionRestoreTimer = window.setTimeout(restore, 120);
    window.addEventListener("touchstart", cancelReadingPositionRestore, { once: true, passive: true });
    window.addEventListener("wheel", cancelReadingPositionRestore, { once: true, passive: true });
  }


  function resolveUrl(raw, baseUrl) {
    if (!raw) return null;
    try {
      return new URL(raw, baseUrl || window.location.href).href.split("#")[0];
    } catch (e) {
      var helper = document.createElement("a");
      helper.href = raw;
      return helper.href ? helper.href.split("#")[0] : null;
    }
  }

  function normalizeUrl(url) {
    var result = resolveUrl(url, window.location.href);
    if (!result) return null;
    return result.replace(/\/$/, "");
  }

  function sourceUrlFor(doc) {
    return doc.__twkanSourceUrl || window.location.href;
  }

  var NON_CHAPTER_PATH_PATTERN = /(?:^|\/)(?:bookshelf|bookcase|shelf|reading[-_]?history|history|records?|record|favorites?|bookmarks?|user|member|account|login|register|search|category|categories|sort|list|catalog|directory)(?:[\/?#._-]|$)/i;

  // Library/history pages can contain a "continue reading" link. That link
  // must not be mistaken for the next chapter of the current reader.
  function isLibraryOrHistoryPage(doc) {
    var url = sourceUrlFor(doc);
    var title = (doc.title || "").replace(/\s+/g, "").trim();
    var bodyText = ((doc.body && doc.body.textContent) || "").replace(/\s+/g, "");

    if (/阅读记录是存储在本地的|閱讀記錄是存儲在本地的/.test(bodyText)) return true;
    if (/阅读记录|閱讀記錄|阅读历史|閱讀歷史|我的书架|我的書架/.test(title)) return true;

    try {
      var pathname = new URL(url, window.location.href).pathname || "";
      if (NON_CHAPTER_PATH_PATTERN.test(pathname)) return true;
    } catch (e) { /* ignore malformed URLs */ }

    return false;
  }

  function stopInfiniteReaderOnLibraryPage() {
    if (!infiniteInitialized || !isLibraryOrHistoryPage(document)) return false;

    cancelActiveIframeProbes();

    var managed = document.querySelectorAll("[data-twkan-infinite-managed='true']");
    for (var i = managed.length - 1; i >= 0; i--) managed[i].remove();

    var tracked = document.querySelectorAll("[data-twkan-reading-chapter='true']");
    for (i = 0; i < tracked.length; i++) {
      tracked[i].removeAttribute("data-twkan-reading-chapter");
      tracked[i].removeAttribute("data-chapter-url");
      tracked[i].removeAttribute("data-chapter-title");
    }

    infiniteInitialized = false;
    infiniteHost = null;
    loadingIndicator = null;
    nextChapterUrl = null;
    appendingChapter = false;
    noMoreChapters = false;
    currentReadingUrl = null;
    if (readingTrackerTimer !== null) {
      window.cancelAnimationFrame(readingTrackerTimer);
      readingTrackerTimer = null;
    }
    return true;
  }

  /** Locate the most likely "next chapter" link and resolve it absolutely. */
  function findNextChapter(doc) {
    var links = doc.querySelectorAll("a[href]");
    var baseUrl = sourceUrlFor(doc);
    var best = null;
    var bestScore = -1;

    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var text = (a.textContent || "").replace(/\s+/g, "").trim();
      var title = (a.getAttribute("title") || "").replace(/\s+/g, "").trim();
      var rel = (a.getAttribute("rel") || "").toLowerCase();
      var marker = ((a.id || "") + " " + (a.className || "")).toLowerCase();
      var rawHref = a.getAttribute("href");
      var href = resolveUrl(rawHref, baseUrl);
      if (!href || !/^https?:/i.test(href)) continue;
      if (/上一|返回|目录|書目|书目|首頁|首页/.test(text)) continue;

      var score = 0;
      if (/^下一[章话話節节篇頁页集卷回页頁]$/.test(text)) score += 100;
      else if (/下一[章话話節节篇頁页集卷回页頁]/.test(text)) score += 85;
      if (/^(下页|下頁|继续|繼續|继续阅读|繼續閱讀|继续看|繼續看)$/.test(text)) score += 75;
      if (/next\s*(chap|page)?/i.test(text) || /^(next|continue)$/i.test(text)) score += 70;
      if (rel === "next") score += 60;
      if (/(^|[-_])(next|continue)([-_]|$)|next(chapter|page)|chapter-next|page-next/.test(marker)) score += 45;
      if (/下一|下页|下頁|继续|繼續/.test(title)) score += 35;
      if (href === window.location.href) score = -1;

      if (score > bestScore && score > 0) {
        bestScore = score;
        best = { url: href.split("#")[0], element: a, text: text, score: score };
      }
    }
    return best;
  }

  function findContentRoot(doc) {
    var i;
    for (i = 0; i < CONTENT_SELECTORS.length; i++) {
      var matches = doc.querySelectorAll(CONTENT_SELECTORS[i]);
      for (var m = 0; m < matches.length; m++) {
        var directText = (matches[m].textContent || "").replace(/\s+/g, "");
        // Short notices such as leave announcements can be valid chapters.
        if (directText.length >= 40) return matches[m];
      }
    }

    // Fallback for unknown layouts: choose the large, text-dense block with
    // few links. This keeps the feature resilient if the site changes CSS.
    var candidates = doc.querySelectorAll("main, article, section, div");
    var best = null;
    var bestScore = 0;
    for (i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      var marker = ((el.id || "") + " " + (el.className || "")).toLowerCase();
      if (/nav|menu|header|footer|sidebar|catalog|list|comment|recommend|search|pager|pagination|breadcrumb|toolbar|advert/.test(marker)) {
        continue;
      }
      var text = (el.textContent || "").replace(/\s+/g, "");
      if (text.length < 40) continue;
      var linkText = "";
      var elementLinks = el.querySelectorAll("a");
      for (var l = 0; l < elementLinks.length; l++) {
        linkText += elementLinks[l].textContent || "";
      }
      var linkRatio = linkText.replace(/\s+/g, "").length / text.length;
      if (linkRatio > 0.35) continue;
      var paragraphs = el.querySelectorAll("p").length;
      var breaks = el.querySelectorAll("br").length;
      var score = Math.min(text.length, 30000) + paragraphs * 100 + breaks * 20 - linkRatio * text.length * 2;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  }

  function getChapterTitle(doc, contentRoot) {
    var selectors = [
      ".chapter-title", ".chaptername", ".chapter-name",
      ".article-title", ".entry-title", "h1", "h2"
    ];
    for (var i = 0; i < selectors.length; i++) {
      var heading = doc.querySelector(selectors[i]);
      if (heading) {
        var value = (heading.textContent || "").replace(/\s+/g, " ").trim();
        if (value && value.length <= 160) return value;
      }
    }
    var title = (doc.title || "").replace(/\s+/g, " ").trim();
    if (title) {
      return title.split(/[-_|｜]/)[0].trim();
    }
    var start = (contentRoot.textContent || "").replace(/\s+/g, " ").trim();
    return start.substring(0, 60);
  }

  function isLikelyChapterPage(doc, contentRoot, nextInfo) {
    if (isLibraryOrHistoryPage(doc)) return false;
    if (!contentRoot) return false;
    var text = (contentRoot.textContent || "").replace(/\s+/g, "");
    if (text.length < 20) return false;
    var heading = getChapterTitle(doc, contentRoot);
    var pageText = ((doc.body && doc.body.textContent) || "").replace(/\s+/g, "");
    var shortNotice = /请假|請假|请假条|請假條|公告|通知|停更|暫停更新|暂停更新|休更|断更|斷更|请几天假|請幾天假/.test(
      heading + text.substring(0, 120) + pageText.substring(0, 300)
    );
    var chapterSignal = /第.{0,12}[章话話節节篇頁页集卷回]/.test(heading) ||
      (nextInfo && /下一[章话話節节篇集卷回页頁]|下页|下頁|继续|繼續/.test(nextInfo.text)) ||
      shortNotice ||
      // A URL alone is not enough: history/list pages often contain "read"
      // in their path and also expose a continue-reading link.
      false;
    var paragraphSignal = contentRoot.querySelectorAll("p").length >= 1 ||
      contentRoot.querySelectorAll("br").length >= 2 ||
      /[。！？!?；;]/.test(text);

    // A short notice is still a valid chapter. Ordinary chapters retain a
    // stricter text/paragraph check to avoid selecting menus or footers.
    if (shortNotice) return chapterSignal && text.length >= 20;
    return chapterSignal && (paragraphSignal || text.length >= 120);
  }

  function normalizeChapterText(value) {
    return (value || "").replace(/\s+/g, "").trim();
  }

  function removeDuplicateChapterTitle(root, title) {
    var titleText = normalizeChapterText(title);
    if (!root || titleText.length < 2) return false;

    // Remove a standalone heading supplied by the website. The reader adds a
    // single normalized heading outside the copied body below.
    var headingNodes = root.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, .chapter-title, .chaptername, .chapter-name, " +
      ".article-title, .entry-title, [class*='chapter-title'], [id*='chapter-title']"
    );
    for (var i = headingNodes.length - 1; i >= 0; i--) {
      if (normalizeChapterText(headingNodes[i].textContent) === titleText) {
        headingNodes[i].remove();
      }
    }

    var emptyBlocks = root.querySelectorAll("p, div, section, h1, h2, h3, h4, h5, h6");
    for (i = emptyBlocks.length - 1; i >= 0; i--) {
      var emptyBlock = emptyBlocks[i];
      if (normalizeChapterText(emptyBlock.textContent).length === 0 &&
          !emptyBlock.querySelector("img, br, video, audio, iframe, a")) {
        emptyBlock.remove();
      }
    }


    // Some templates put the same title in the first paragraph or split it
    // across several text nodes. Remove only a leading exact title prefix.
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION)$/.test(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var textNodes = [];
    var combined = "";
    var node;
    while ((node = walker.nextNode())) {
      textNodes.push(node);
      combined += node.nodeValue || "";
    }

    var compact = normalizeChapterText(combined);
    if (compact.indexOf(titleText) !== 0 || compact.length <= titleText.length) return false;

    var matched = 0;
    var startNode = textNodes.length ? textNodes[0] : null;
    var endNode = null;
    var endOffset = 0;
    for (i = 0; i < textNodes.length && matched < titleText.length; i++) {
      var value = textNodes[i].nodeValue || "";
      for (var offset = 0; offset < value.length && matched < titleText.length; offset++) {
        var character = value.charAt(offset);
        if (/\s/.test(character)) continue;
        if (character !== titleText.charAt(matched)) return false;
        matched++;
        if (matched === titleText.length) {
          endNode = textNodes[i];
          endOffset = offset + 1;
          break;
        }
      }
    }

    if (matched !== titleText.length || !endNode || !startNode) return false;
    var range = document.createRange();
    range.setStart(startNode, 0);
    range.setEnd(endNode, endOffset);
    range.deleteContents();
    return true;
  }


  function chapterTextContent(value) {
    return (value || "").replace(/[\s\u00a0\u200b\u200c\u200d\ufeff]/g, "");
  }

  function normalizeChapterLayout(root) {
    if (!root) return root;
    if (root.style) {
      root.style.setProperty("height", "auto", "important");
      root.style.setProperty("min-height", "0", "important");
      root.style.setProperty("max-height", "none", "important");
      root.style.setProperty("margin-top", "0", "important");
      root.style.setProperty("margin-bottom", "0", "important");
      root.style.setProperty("padding-top", "0", "important");
      root.style.setProperty("padding-bottom", "0", "important");
    }

    while (root.firstChild && root.firstChild.nodeType === Node.TEXT_NODE &&
           chapterTextContent(root.firstChild.nodeValue).length === 0) {
      root.firstChild.remove();
    }
    while (root.lastChild && root.lastChild.nodeType === Node.TEXT_NODE &&
           chapterTextContent(root.lastChild.nodeValue).length === 0) {
      root.lastChild.remove();
    }

    while (root.firstChild && root.firstChild.nodeType === Node.ELEMENT_NODE &&
           root.firstChild.tagName === "BR") {
      root.firstChild.remove();
    }
    while (root.lastChild && root.lastChild.nodeType === Node.ELEMENT_NODE &&
           root.lastChild.tagName === "BR") {
      root.lastChild.remove();
    }

    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.style) {
        // Site templates sometimes use spacer styles inside the article.
        // Keep typography, but remove dimensions and vertical layout gaps.
        el.style.setProperty("height", "auto", "important");
        el.style.setProperty("min-height", "0", "important");
        el.style.setProperty("max-height", "none", "important");
        el.style.setProperty("margin-top", "0", "important");
        el.style.setProperty("margin-bottom", "0", "important");
        el.style.setProperty("padding-top", "0", "important");
        el.style.setProperty("padding-bottom", "0", "important");
      }
    }

    var blocks = root.querySelectorAll("p, div, section, article, header, footer, h1, h2, h3, h4, h5, h6");
    for (i = blocks.length - 1; i >= 0; i--) {
      var block = blocks[i];
      if (chapterTextContent(block.textContent).length === 0 &&
          !block.querySelector("img, video, audio, canvas, iframe, object, embed, a")) {
        block.remove();
      }
    }

    // Collapse runs of spacer <br> elements to one line break, even when
    // source formatting inserts whitespace text nodes between them.
    var breaks = root.querySelectorAll("br");
    for (i = breaks.length - 1; i >= 0; i--) {
      var next = breaks[i].nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE && chapterTextContent(next.nodeValue).length === 0) {
        next = next.nextSibling;
      }
      if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === "BR") {
        breaks[i].remove();
      }
    }

    // A leading or trailing break in a block is only a layout spacer. Ignore
    // indentation whitespace while looking for the first/last real child.
    var containers = root.querySelectorAll("p, div, section, article, h1, h2, h3, h4, h5, h6");
    containers = Array.prototype.slice.call(containers);
    containers.push(root);
    for (i = 0; i < containers.length; i++) {
      var container = containers[i];
      var first = container.firstChild;
      while (first && first.nodeType === Node.TEXT_NODE && chapterTextContent(first.nodeValue).length === 0) {
        var nextFirst = first.nextSibling;
        first.remove();
        first = nextFirst;
      }
      while (first && first.nodeType === Node.ELEMENT_NODE && first.tagName === "BR") {
        var afterFirst = first.nextSibling;
        first.remove();
        first = afterFirst;
        while (first && first.nodeType === Node.TEXT_NODE && chapterTextContent(first.nodeValue).length === 0) {
          var afterWhitespace = first.nextSibling;
          first.remove();
          first = afterWhitespace;
        }
      }

      var last = container.lastChild;
      while (last && last.nodeType === Node.TEXT_NODE && chapterTextContent(last.nodeValue).length === 0) {
        var previousLast = last.previousSibling;
        last.remove();
        last = previousLast;
      }
      while (last && last.nodeType === Node.ELEMENT_NODE && last.tagName === "BR") {
        var beforeLast = last.previousSibling;
        last.remove();
        last = beforeLast;
        while (last && last.nodeType === Node.TEXT_NODE && chapterTextContent(last.nodeValue).length === 0) {
          var beforeWhitespace = last.previousSibling;
          last.remove();
          last = beforeWhitespace;
        }
      }
    }

    // Removing <br> can turn a previously non-empty spacer block into an
    // empty paragraph. Run the check once more after break normalization.
    var finalBlocks = root.querySelectorAll("p, div, section, article, header, footer, h1, h2, h3, h4, h5, h6");
    for (i = finalBlocks.length - 1; i >= 0; i--) {
      var finalBlock = finalBlocks[i];
      if (chapterTextContent(finalBlock.textContent).length === 0 &&
          !finalBlock.querySelector("img, video, audio, canvas, iframe, object, embed, a")) {
        finalBlock.remove();
      }
    }

    return root;
  }


  function sanitizeChapterContent(root, baseUrl) {
    var unwanted = root.querySelectorAll(
      "script, style, noscript, iframe, object, embed, form, nav, " +
      ".adsbygoogle, .advertisement, .google-auto-placed, " +
      "[id^='google_ads'], [id*='ad-container'], [class*='ad-container'], " +
      ".pagination, .pager, .page-nav, .chapter-nav, .read-nav, " +
      ".breadcrumb, .comments, .comment, .recommend, .related"
    );
    for (var i = unwanted.length - 1; i >= 0; i--) unwanted[i].remove();

    var all = root.querySelectorAll("*");
    for (i = 0; i < all.length; i++) {
      var el = all[i];
      // Remove inline event handlers from fetched HTML.
      var attrs = Array.prototype.slice.call(el.attributes || []);
      for (var a = 0; a < attrs.length; a++) {
        if (/^on/i.test(attrs[a].name)) el.removeAttribute(attrs[a].name);
      }

      var urlAttrs = ["href", "src", "poster", "data-src", "data-original"];
      for (a = 0; a < urlAttrs.length; a++) {
        var attrName = urlAttrs[a];
        var raw = el.getAttribute(attrName);
        if (raw && !/^(data:|javascript:|mailto:|tel:)/i.test(raw)) {
          var absolute = resolveUrl(raw, baseUrl);
          if (absolute) el.setAttribute(attrName, absolute);
        }
      }
    }

    // Remove compact previous/index/next navigation rows that were nested in
    // the selected content container.
    var navLinks = root.querySelectorAll("a[href]");
    for (i = navLinks.length - 1; i >= 0; i--) {
      var navText = (navLinks[i].textContent || "").replace(/\s+/g, "");
      if (/^(上一|下一|返回|目录|目錄).{0,8}$/.test(navText)) {
        var holder = navLinks[i].closest("p, nav, .pager, .pagination, .chapter-nav, .page-nav");
        if (holder && (holder.textContent || "").length < 250) holder.remove();
      }
    }
    return root;
  }

  function extractChapter(doc, url) {
    var nextInfo = findNextChapter(doc);
    var root = findContentRoot(doc);
    if (!root || !isLikelyChapterPage(doc, root, nextInfo)) {
      throw new Error("Not a recognizable chapter page");
    }
    var title = getChapterTitle(doc, root);
    var clone = sanitizeChapterContent(root.cloneNode(true), url);
    removePromotionalText(clone);
    removeDuplicateChapterTitle(clone, title);
    normalizeChapterLayout(clone);
    var cleanText = (clone.textContent || "").replace(/\s+/g, "");
    if (cleanText.length < 20) throw new Error("Chapter body is empty");
    return {
      url: normalizeUrl(url),
      title: title,
      html: clone.innerHTML,
      nextUrl: nextInfo ? normalizeUrl(nextInfo.url) : null,
      titleAlreadyPresent: false
    };
  }

  function isCloudflareChallenge(html) {
    return /cf-chl-|challenge-platform|Just a moment|验证您是真人|驗證您是真人|Checking your browser|Checking if the site connection is secure|Enable JavaScript and cookies to continue/i.test(html || "");
  }

  function isCloudflareError(error) {
    return /Cloudflare|HTTP (403|429)/i.test(error && error.message || "");
  }

  function setCloudflareBlocked(url) {
    cloudflareBlockedUrl = normalizeUrl(url);
    cloudflareBlockedAt = Date.now();
    try {
      localStorage.setItem(CLOUDFLARE_BLOCKED_KEY, JSON.stringify({
        url: cloudflareBlockedUrl,
        blockedAt: cloudflareBlockedAt
      }));
    } catch (e) { /* ignore */ }
  }

  function loadCloudflareBlocked() {
    try {
      var stored = JSON.parse(localStorage.getItem(CLOUDFLARE_BLOCKED_KEY) || "null");
      if (stored && Date.now() - Number(stored.blockedAt || 0) < 10 * 60 * 1000) {
        cloudflareBlockedUrl = normalizeUrl(stored.url);
        cloudflareBlockedAt = Number(stored.blockedAt);
      } else {
        localStorage.removeItem(CLOUDFLARE_BLOCKED_KEY);
      }
    } catch (e) { /* ignore */ }
  }

  function clearCloudflareBlocked() {
    cloudflareBlockedUrl = null;
    cloudflareBlockedAt = 0;
    try { localStorage.removeItem(CLOUDFLARE_BLOCKED_KEY); } catch (e) { /* ignore */ }
  }


  function openChapterInVisibleReader(url) {
    if (!url) return;
    cancelActiveIframeProbes();
    setCloudflareBlocked(url);
    saveReadingSettings();
    saveReadingPosition();
    setLoadingState("正在打开下一章，请在当前页面完成网站验证…", false);
    window.location.href = url;
  }

  /**
   * fetch() only downloads bytes; it never executes the returned <script>.
   * Cloudflare's non-interactive "Just a moment..." JS challenge only clears
   * once its script actually *runs* in a real page context and sets a pass
   * cookie. That is why a background fetch() to the next chapter fails almost
   * every time a challenge is active, even though a normal page load would
   * pass silently within a few seconds. To avoid surfacing that failure to
   * the user, load the same URL once in a hidden same-origin <iframe> (a real
   * execution context) and poll its document until the challenge markup is
   * gone. This resolves automatically for non-interactive challenges without
   * any visible UI; only challenges that truly require human interaction
   * (slider/captcha) will still time out and fall through to the existing
   * "点击打开下一章" visible-WebView flow.
   */
  function fetchChapterViaHiddenIframe(url) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var pollTimer = null;
      var timeoutTimer = null;
      var iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("tabindex", "-1");
      // Some Cloudflare challenge pages try to bust out of frames
      // ("if (top.location !== self.location) top.location = ...") to force
      // full-page display. Sandboxing without allow-top-navigation blocks
      // that redirect attempt while still letting the challenge script run
      // and access its own same-origin document.
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "1px";
      iframe.style.height = "1px";
      iframe.style.opacity = "0";
      iframe.style.border = "0";
      iframe.style.pointerEvents = "none";

      function cleanup() {
        if (pollTimer !== null) window.clearInterval(pollTimer);
        if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        var idx = activeIframeCleanups.indexOf(cleanupEntry);
        if (idx !== -1) activeIframeCleanups.splice(idx, 1);
      }

      // Registered so a page-level navigation-away event (leaving the
      // reader, or the whole page unloading) can force this probe to stop
      // immediately instead of polling a detached/stale iframe forever.
      function cleanupEntry() {
        fail("Reader navigated away");
      }
      activeIframeCleanups.push(cleanupEntry);

      function finish(html) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(html);
      }

      function fail(reason) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(reason || "Cloudflare challenge"));
      }

      var attempts = 0;
      var maxAttempts = 48; // ~250ms * 48 = 12s, generous for a JS challenge

      pollTimer = window.setInterval(function () {
        attempts++;
        var doc;
        try {
          doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
        } catch (e) {
          fail("Cross-origin iframe");
          return;
        }
        if (!doc || !doc.documentElement || !doc.body || doc.readyState !== "complete") {
          if (attempts >= maxAttempts) fail("Cloudflare challenge timeout");
          return;
        }
        var html = doc.documentElement.outerHTML || "";
        var hasText = doc.body.textContent && doc.body.textContent.trim().length > 40;
        // Guard against a transient redirect/meta-refresh stub page (e.g.
        // "Redirecting...") being mistaken for the final loaded chapter: the
        // iframe's own location should have settled on the requested URL.
        var locationSettled = true;
        try {
          locationSettled = !iframe.contentWindow || !iframe.contentWindow.location ||
            normalizeUrl(iframe.contentWindow.location.href) === url;
        } catch (e) { /* cross-origin during redirect; keep polling */ }
        if (hasText && locationSettled && !isCloudflareChallenge(html)) {
          finish(html);
        } else if (attempts >= maxAttempts) {
          fail("Cloudflare challenge timeout");
        }
      }, 250);

      timeoutTimer = window.setTimeout(function () {
        fail("Cloudflare challenge timeout");
      }, 13000);

      iframe.addEventListener("error", function () {
        fail("Iframe load error");
      });

      iframe.src = url;
      document.body.appendChild(iframe);
    });
  }

  /** Fetch and parse once; keep the actual chapter in memory, not only HTTP cache. */
  function fetchChapter(url) {
    url = normalizeUrl(url);
    if (!url) return Promise.reject(new Error("Invalid chapter URL"));
    if (chapterCache[url]) return Promise.resolve(chapterCache[url]);
    if (chapterRequests[url]) return chapterRequests[url];

    chapterRequests[url] = fetch(url, {
      credentials: "include",
      cache: "default",
      redirect: "follow"
    })
      .then(function (response) {
        if (!response.ok) {
          // Cloudflare sometimes rejects the raw fetch outright (403/429)
          // instead of returning challenge HTML. Try the hidden-iframe
          // fallback in that case too, before giving up.
          if (response.status === 403 || response.status === 429) {
            return fetchChapterViaHiddenIframe(url).catch(function () {
              setCloudflareBlocked(url);
              throw new Error("HTTP " + response.status);
            });
          }
          throw new Error("HTTP " + response.status);
        }
        return response.text();
      })
      .then(function (html) {
        if (!isCloudflareChallenge(html)) return html;
        // Try the silent hidden-iframe fallback before giving up.
        return fetchChapterViaHiddenIframe(url).catch(function () {
          setCloudflareBlocked(url);
          throw new Error("Cloudflare challenge");
        });
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        doc.__twkanSourceUrl = url;
        var chapter = extractChapter(doc, url);
        chapterCache[url] = chapter;
        delete chapterRequests[url];
        return chapter;
      })
      .catch(function (error) {
        delete chapterRequests[url];
        throw error;
      });
    return chapterRequests[url];
  }

  function prefetchChain(url, depth) {
    if (!url || depth <= 0) return Promise.resolve();
    return fetchChapter(url)
      .then(function (chapter) {
        if (chapter.nextUrl && depth > 1) {
          return prefetchChain(chapter.nextUrl, depth - 1);
        }
      })
      .catch(function () { /* prefetch failures must not interrupt reading */ });
  }

  function setLoadingState(text, isError) {
    if (!loadingIndicator) return;
    loadingIndicator.textContent = text || "";
    loadingIndicator.className = "twkan-infinite-status" + (isError ? " twkan-infinite-error" : "");
    loadingIndicator.style.display = text ? "block" : "none";
  }

  function persistLocalReadingProgress(url, title) {
    var progress = {
      url: url,
      title: title || "",
      updatedAt: Date.now()
    };
    var serialized = JSON.stringify(progress);
    try { localStorage.setItem("twkan:lastReadingProgress", serialized); } catch (e) { /* ignore */ }
    try { sessionStorage.setItem("twkan:lastReadingProgress", serialized); } catch (e) { /* ignore */ }
  }

  function notifyWebsiteChapterChange(url, title) {
    var detail = { url: url, title: title || "", source: "twkan-infinite-reader" };
    try {
      window.dispatchEvent(new CustomEvent("twkan:chapterchange", { detail: detail }));
      document.dispatchEvent(new CustomEvent("chapterchange", { detail: detail }));
    } catch (e) { /* old WebView fallback */ }

    // Keep the compatibility bridge call for older app builds. Current Android
    // versions intentionally treat it as a no-op to avoid hidden network loads.
    try {
      if (typeof window.TwkanBridge.syncReadingRecord === "function") {
        window.TwkanBridge.syncReadingRecord(url);
      }
    } catch (e) { /* ignore */ }
  }

  function activateReadingChapter(element, force) {
    if (!element) return;
    var url = normalizeUrl(element.getAttribute("data-chapter-url"));
    if (!url || (!force && url === currentReadingUrl)) return;
    var title = element.getAttribute("data-chapter-title") || initialChapterTitle || document.title;

    currentReadingUrl = url;
    persistLocalReadingProgress(url, title);

    try {
      var oldState = history.state && typeof history.state === "object" ? history.state : {};
      var nextState = {};
      for (var key in oldState) {
        if (Object.prototype.hasOwnProperty.call(oldState, key)) nextState[key] = oldState[key];
      }
      nextState.twkanInfiniteReader = true;
      nextState.twkanChapterUrl = url;
      history.replaceState(nextState, title || document.title, url);
    } catch (e) { /* URL update is best-effort */ }

    if (title) document.title = title;
    document.documentElement.setAttribute("data-current-chapter-url", url);
    saveReadingPosition();

    // The initial page records itself during normal navigation. Returning to it
    // later should still update the record, so notify on every chapter change.
    notifyWebsiteChapterChange(url, title);
  }

  function updateVisibleReadingChapter() {
    if (!infiniteInitialized) return;
    saveReadingPositionSoon();
    var chapters = document.querySelectorAll("[data-twkan-reading-chapter='true']");
    if (!chapters.length) return;
    var readingLine = Math.max(120, window.innerHeight * 0.35);
    var active = chapters[0];

    for (var i = 0; i < chapters.length; i++) {
      var rect = chapters[i].getBoundingClientRect();
      if (rect.top <= readingLine) active = chapters[i];
      if (rect.top <= readingLine && rect.bottom > readingLine) {
        active = chapters[i];
        break;
      }
      if (rect.top > readingLine) break;
    }
    activateReadingChapter(active, false);
  }

  function saveReadingPositionSoon() {
    if (saveReadingPositionSoon.timer) return;
    saveReadingPositionSoon.timer = window.setTimeout(function () {
      saveReadingPositionSoon.timer = null;
      saveReadingPosition();
    }, 500);
  }

  function persistReaderStateNow() {
    if (!infiniteInitialized) return;
    cancelActiveIframeProbes();
    saveReadingSettings();
    saveReadingPosition();
  }


  function scheduleReadingTracker() {
    if (readingTrackerTimer !== null) return;
    readingTrackerTimer = window.requestAnimationFrame(function () {
      readingTrackerTimer = null;
      updateVisibleReadingChapter();
    });
  }


  function appendNextChapter(allowVisibleNavigation) {
    if (appendingChapter || noMoreChapters || !nextChapterUrl || !infiniteHost) {
      return Promise.resolve(null);
    }
    var requestedUrl = normalizeUrl(nextChapterUrl);
    if (!requestedUrl || appendedUrls[requestedUrl]) {
      noMoreChapters = true;
      setLoadingState("已到最后一章", false);
      return Promise.resolve(null);
    }
    if (cloudflareBlockedUrl === requestedUrl && Date.now() - cloudflareBlockedAt < 10 * 60 * 1000) {
      if (allowVisibleNavigation === true) {
        openChapterInVisibleReader(requestedUrl);
      } else {
        setLoadingState("网站要求验证，点这里打开下一章", true);
      }
      return Promise.resolve(null);
    }

    appendingChapter = true;
    setLoadingState("正在加载下一章…", false);

    return fetchChapter(requestedUrl)
      .then(function (chapter) {
        var section = document.createElement("section");
        section.className = "twkan-infinite-chapter";
        section.setAttribute("data-twkan-infinite-managed", "true");
        section.setAttribute("data-twkan-reading-chapter", "true");
        section.setAttribute("data-chapter-url", chapter.url);
        section.setAttribute("data-chapter-title", chapter.title || "");

        var separator = document.createElement("div");
        separator.className = "twkan-chapter-separator";
        separator.setAttribute("aria-hidden", "true");
        section.appendChild(separator);

        if (chapter.title && !chapter.titleAlreadyPresent) {
          var heading = document.createElement("h2");
          heading.className = "twkan-appended-chapter-title";
          heading.textContent = chapter.title;
          section.appendChild(heading);
        }

        var body = document.createElement("div");
        body.className = "twkan-appended-chapter-body";
        body.setAttribute("data-twkan-reader-content", "true");
        body.innerHTML = chapter.html;
        section.appendChild(body);

        // Convert while detached, so raw traditional Chinese is never flashed.
        simplify(section, false);
        infiniteHost.insertBefore(section, loadingIndicator);

        appendedUrls[chapter.url] = true;
        if (cloudflareBlockedUrl === chapter.url) clearCloudflareBlocked();
        nextChapterUrl = chapter.nextUrl;
        appendingChapter = false;

        if (!nextChapterUrl || appendedUrls[nextChapterUrl]) {
          noMoreChapters = true;
          setLoadingState("已到最后一章", false);
        } else {
          setLoadingState("", false);
          prefetchChain(nextChapterUrl, PREFETCH_AHEAD);
        }
        return section;
      })
      .catch(function (error) {
        appendingChapter = false;
        if (isCloudflareError(error)) {
          setCloudflareBlocked(requestedUrl);
          setLoadingState("网站要求验证，点这里打开下一章", true);
        } else {
          setLoadingState("下一章加载失败，点这里重试", true);
        }
        return null;
      });
  }

  function ensureReadingSettingsPanel() {
    if (document.querySelector("[data-twkan-reader-settings='true']")) {
      applyReadingSettings();
      return;
    }
    loadReadingSettings();

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = "Aa";
    toggle.title = "阅读设置";
    toggle.setAttribute("aria-label", "阅读设置");
    toggle.setAttribute("data-twkan-reader-ui", "true");
    toggle.setAttribute("data-twkan-reader-settings-toggle", "true");

    var panel = document.createElement("div");
    panel.setAttribute("data-twkan-reader-ui", "true");
    panel.setAttribute("data-twkan-reader-settings", "true");
    panel.style.display = "none";

    var titleRow = document.createElement("div");
    titleRow.className = "twkan-settings-title-row";
    var title = document.createElement("strong");
    title.textContent = "阅读设置";
    titleRow.appendChild(title);
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.title = "关闭设置";
    close.setAttribute("aria-label", "关闭设置");
    close.className = "twkan-settings-close";
    titleRow.appendChild(close);
    panel.appendChild(titleRow);

    function addRange(key, labelText, min, max, step, unit) {
      var row = document.createElement("div");
      row.className = "twkan-settings-row";
      var caption = document.createElement("span");
      caption.textContent = labelText;
      var controls = document.createElement("div");
      controls.className = "twkan-settings-control";

      var minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "−";
      minus.title = "减小" + labelText;
      minus.setAttribute("aria-label", "减小" + labelText);
      minus.className = "twkan-settings-step";

      var range = document.createElement("input");
      range.type = "range";
      range.min = min;
      range.max = max;
      range.step = step;
      range.setAttribute("data-twkan-setting", key);

      var number = document.createElement("input");
      number.type = "number";
      number.min = min;
      number.max = max;
      number.step = step;
      number.inputMode = "decimal";
      number.setAttribute("data-twkan-setting", key);
      number.setAttribute("aria-label", labelText);
      number.className = "twkan-settings-number";

      var plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";
      plus.title = "增大" + labelText;
      plus.setAttribute("aria-label", "增大" + labelText);
      plus.className = "twkan-settings-step";

      function commit(value) {
        updateReadingSetting(key, value);
      }
      range.addEventListener("input", function () { commit(range.value); });
      number.addEventListener("change", function () { commit(number.value); });
      number.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          commit(number.value);
          number.blur();
        }
      });
      minus.addEventListener("click", function () {
        commit(Number(readingSettings[key]) - Number(step));
      });
      plus.addEventListener("click", function () {
        commit(Number(readingSettings[key]) + Number(step));
      });

      controls.appendChild(minus);
      controls.appendChild(range);
      controls.appendChild(number);
      controls.appendChild(plus);
      row.appendChild(caption);
      row.appendChild(controls);
      panel.appendChild(row);
      return { input: number, range: range };
    }

    var font = addRange("fontSize", "字体大小", 14, 32, 1, "px");
    var line = addRange("lineHeight", "行距", 1.3, 3, 0.1, "");
    var spacing = addRange("letterSpacing", "字间距", -1, 4, 0.1, "px");

    var colorRow = document.createElement("label");
    colorRow.className = "twkan-settings-row";
    var colorLabel = document.createElement("span");
    colorLabel.textContent = "背景色";
    var color = document.createElement("select");
    color.setAttribute("data-twkan-setting", "background");
    var colors = [
      ["site", "跟随网站"], ["white", "白色"], ["warm", "暖色"],
      ["green", "浅绿色"], ["gray", "灰色"], ["dark", "深色"]
    ];
    for (var i = 0; i < colors.length; i++) {
      var option = document.createElement("option");
      option.value = colors[i][0];
      option.textContent = colors[i][1];
      color.appendChild(option);
    }
    color.addEventListener("change", function () { updateReadingSetting("background", color.value); });
    colorRow.appendChild(colorLabel);
    colorRow.appendChild(color);
    panel.appendChild(colorRow);

    var reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "恢复默认";
    reset.className = "twkan-settings-reset";
    reset.addEventListener("click", function () {
      resetReadingSettings();
      updateLabels();
    });
    panel.appendChild(reset);

    toggle.addEventListener("click", function () {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
      applyReadingSettings();
    });
    close.addEventListener("click", function () { panel.style.display = "none"; });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
    applyReadingSettings();

    function updateLabels() {
      font.input.value = readingSettings.fontSize;
      font.range.value = readingSettings.fontSize;
      line.input.value = readingSettings.lineHeight;
      line.range.value = readingSettings.lineHeight;
      spacing.input.value = readingSettings.letterSpacing;
      spacing.range.value = readingSettings.letterSpacing;
      color.value = readingSettings.background;
    }
    updateLabels();
  }


  function hideOriginalChapterNavigation(nextElement) {
    if (!nextElement) return;
    var holder = nextElement.closest("nav, .pager, .pagination, .chapter-nav, .page-nav, .read-nav");
    if (!holder) {
      var parent = nextElement.parentElement;
      if (parent && (parent.textContent || "").replace(/\s+/g, "").length < 180) holder = parent;
    }
    if (holder) holder.style.display = "none";
  }

  function initInfiniteReader() {
    if (stopInfiniteReaderOnLibraryPage()) return;
    if (infiniteInitialized) return;

    var nextInfo = findNextChapter(document);
    var contentRoot = findContentRoot(document);
    if (!contentRoot || !isLikelyChapterPage(document, contentRoot, nextInfo)) return;

    infiniteInitialized = true;
    initialChapterUrl = normalizeUrl(sourceUrlFor(document));
    initialChapterTitle = getChapterTitle(document, contentRoot) || document.title;
    removePromotionalText(contentRoot);

    normalizeChapterLayout(contentRoot);
    currentReadingUrl = initialChapterUrl;
    nextChapterUrl = nextInfo ? normalizeUrl(nextInfo.url) : null;
    appendedUrls[initialChapterUrl] = true;
    loadCloudflareBlocked();
    if (cloudflareBlockedUrl && cloudflareBlockedUrl !== nextChapterUrl) clearCloudflareBlocked();

    // Treat the original chapter as the first tracked section. Its URL remains
    // the real network URL even after history.replaceState changes location.
    contentRoot.setAttribute("data-twkan-reading-chapter", "true");
    contentRoot.setAttribute("data-twkan-reader-content", "true");
    var surface = contentRoot.parentElement;
    while (surface && surface !== document.body) {
      surface.setAttribute("data-twkan-reader-surface", "true");
      surface = surface.parentElement;
    }
    document.body.setAttribute("data-twkan-reader-active", "true");
    contentRoot.setAttribute("data-chapter-url", initialChapterUrl);
    contentRoot.setAttribute("data-chapter-title", initialChapterTitle || "");
    persistLocalReadingProgress(initialChapterUrl, initialChapterTitle);

    infiniteHost = document.createElement("div");
    infiniteHost.className = "twkan-infinite-host";
    infiniteHost.setAttribute("data-twkan-infinite-managed", "true");

    loadingIndicator = document.createElement("div");
    loadingIndicator.className = "twkan-infinite-status";
    loadingIndicator.style.display = "none";
    loadingIndicator.addEventListener("click", function () {
      if (!loadingIndicator.classList.contains("twkan-infinite-error")) return;
      if (cloudflareBlockedUrl) {
        openChapterInVisibleReader(cloudflareBlockedUrl);
        return;
      }
      appendNextChapter(true);
    });
    infiniteHost.appendChild(loadingIndicator);

    var sentinel = document.createElement("div");
    sentinel.className = "twkan-infinite-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    infiniteHost.appendChild(sentinel);

    if (contentRoot === document.body || contentRoot === document.documentElement || !contentRoot.parentNode) {
      document.body.appendChild(infiniteHost);
    } else {
      contentRoot.parentNode.insertBefore(infiniteHost, contentRoot.nextSibling);
    }
    hideOriginalChapterNavigation(nextInfo && nextInfo.element);
    ensureReadingSettingsPanel();
    restoreReadingPosition();
    if (cloudflareBlockedUrl === nextChapterUrl) {
      setLoadingState("网站要求验证，点这里打开下一章", true);
    }

    // Load when the reader is roughly 1.5 screens from the bottom.
    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            appendNextChapter(false);
            return;
          }
        }
      }, { root: null, rootMargin: "1600px 0px", threshold: 0 });
      observer.observe(sentinel);
    } else {
      window.addEventListener("scroll", function () {
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 1600) {
          appendNextChapter(false);
        }
      }, { passive: true });
    }

    // Clicking the site's old "next chapter" link appends instead of navigating.
    document.addEventListener("click", function (event) {
      var target = event.target;
      var anchor = target && target.closest ? target.closest("a[href]") : null;
      if (!anchor || !nextChapterUrl) return;
      var clickedUrl = normalizeUrl(anchor.getAttribute("href"));
      if (clickedUrl === normalizeUrl(nextChapterUrl)) {
        event.preventDefault();
        appendNextChapter(true).then(function (section) {
          if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }, true);

    // Fill the 3-chapter memory cache immediately; append only near the bottom.
    if (nextChapterUrl) prefetchChain(nextChapterUrl, PREFETCH_AHEAD);


    window.addEventListener("scroll", scheduleReadingTracker, { passive: true });
    window.addEventListener("resize", scheduleReadingTracker, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        persistReaderStateNow();
      } else {
        scheduleReadingTracker();
      }
    });
    window.addEventListener("pagehide", persistReaderStateNow);
    window.addEventListener("beforeunload", persistReaderStateNow);
    scheduleReadingTracker();
  }

  // ─── Public run entry ─────────────────────────────────────────────────────
  window[runKey] = function () {
    pageReadySent = false;
    loadReadingSettings();
    schedule(document.body || document.documentElement, true /* isFirstPass */);
    initAdBlocker();
    setTimeout(initInfiniteReader, 500);
  };

  if (window[installedKey]) {
    window[runKey]();
    return;
  }
  window[installedKey] = true;

  // ─── MutationObserver (subsequent updates, not first pass) ────────────────
  var observer = new MutationObserver(function (mutations) {
    if (converting) return;
    if (stopInfiniteReaderOnLibraryPage()) return;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      var target = m.target && m.target.nodeType === Node.ELEMENT_NODE
        ? m.target
        : (m.target ? m.target.parentElement : null);
      // Infinite-reader chapters are converted while detached. Ignore their
      // insertion/status mutations to avoid reconverting the entire novel.
      if (target && target.closest && target.closest("[data-twkan-infinite-managed='true']")) {
        continue;
      }
      if (m.type === "characterData" || m.type === "attributes" || m.addedNodes.length > 0) {
        schedule(document.body || document.documentElement, false);
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES
  });

  window[runKey]();

  // ─── CSS: hide common ad patterns ────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    '[class*="ad-"] { display: none !important; }',
    '[id*="ad-"] { display: none !important; }',
    '[class*="advertisement"] { display: none !important; }',
    '[id*="advertisement"] { display: none !important; }',
    'ins.adsbygoogle { display: none !important; }',
    'iframe[src*="ads"] { display: none !important; }',
    'iframe[src*="doubleclick"] { display: none !important; }',
    'iframe[src*="googlesyndication"] { display: none !important; }',
    '[class*="banner"] { display: none !important; }',
    '[id*="banner"] { display: none !important; }',
    '.twkan-infinite-host { display: block !important; width: 100% !important; clear: both !important; }',
    'html[data-twkan-reader-bg], body[data-twkan-reader-bg] { background-color: var(--twkan-reader-background) !important; color: var(--twkan-reader-foreground) !important; }',
    '[data-twkan-reader-surface="true"] { background-color: var(--twkan-reader-background) !important; color: var(--twkan-reader-foreground) !important; }',
    '[data-twkan-reading-chapter="true"], [data-twkan-reading-chapter="true"] *:not(img), .twkan-appended-chapter-body, .twkan-appended-chapter-body *:not(img) { background-color: var(--twkan-reader-background) !important; color: var(--twkan-reader-foreground) !important; opacity: 1 !important; }',
    '[data-twkan-reading-chapter="true"] img, .twkan-appended-chapter-body img { background-color: transparent !important; }',
    '[data-twkan-reading-chapter="true"] * { box-sizing: border-box; }',
    '[data-twkan-reader-ui="true"] { font-family: sans-serif !important; letter-spacing: normal !important; line-height: normal !important; }',
    '[data-twkan-reader-settings-toggle="true"] { position: fixed !important; right: 16px !important; bottom: 32px !important; z-index: 2147483000 !important; width: 48px !important; height: 48px !important; padding: 0 !important; border: 0 !important; border-radius: 10px !important; background: #ffffff !important; color: #202124 !important; box-shadow: 0 2px 10px rgba(0,0,0,.22) !important; font-size: 18px !important; font-weight: 700 !important; }',
    '[data-twkan-reader-settings="true"] { position: fixed !important; right: 16px !important; bottom: 96px !important; z-index: 2147482999 !important; width: min(310px, calc(100vw - 24px)) !important; max-height: calc(100vh - 120px) !important; overflow: auto !important; padding: 14px !important; border-radius: 10px !important; border: 1px solid rgba(0,0,0,.14) !important; background: var(--twkan-reader-background) !important; color: var(--twkan-reader-foreground) !important; opacity: 1 !important; box-shadow: 0 4px 18px rgba(0,0,0,.28) !important; font-family: sans-serif !important; font-size: 14px !important; }',
    '.twkan-settings-title-row { display: flex !important; align-items: center !important; justify-content: space-between !important; margin-bottom: 10px !important; }',
    '.twkan-settings-close { border: 0 !important; background: transparent !important; padding: 0 5px !important; font-size: 24px !important; line-height: 1 !important; color: #555 !important; }',
    '.twkan-settings-row { display: grid !important; grid-template-columns: 76px minmax(0, 1fr) !important; align-items: center !important; gap: 7px !important; margin: 10px 0 !important; }',
    '.twkan-settings-control { display: grid !important; grid-template-columns: 30px minmax(40px, 1fr) 62px 30px !important; align-items: center !important; gap: 4px !important; min-width: 0 !important; }',
    '.twkan-settings-step { width: 30px !important; height: 30px !important; padding: 0 !important; border: 1px solid #aaa !important; border-radius: 5px !important; background: rgba(255,255,255,.7) !important; color: #222 !important; font-size: 20px !important; line-height: 28px !important; }',
    '.twkan-settings-control input[type="range"] { width: 100% !important; min-width: 40px !important; }',
    '.twkan-settings-number { width: 62px !important; min-width: 0 !important; padding: 5px 3px !important; border: 1px solid #aaa !important; border-radius: 5px !important; background: rgba(255,255,255,.82) !important; color: #222 !important; text-align: center !important; font-size: 13px !important; }',
    '.twkan-settings-row select { grid-column: 2 !important; min-width: 0 !important; width: 100% !important; padding: 5px !important; }',
    '.twkan-settings-value { text-align: right !important; color: #666 !important; font-variant-numeric: tabular-nums !important; }',
    '.twkan-settings-reset { width: 100% !important; margin-top: 8px !important; padding: 8px !important; border: 1px solid #bbb !important; border-radius: 6px !important; background: #f5f5f5 !important; color: #222 !important; }',

    '.twkan-infinite-chapter { display: block !important; width: 100% !important; clear: both !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; }',
    '.twkan-chapter-separator { display: block !important; width: 72% !important; height: 1px !important; margin: 28px auto 18px !important; background: rgba(127,127,127,.32) !important; }',
    '[data-twkan-reading-chapter="true"] { height: auto !important; min-height: 0 !important; max-height: none !important; overflow: visible !important; font-size: var(--twkan-reader-font-size) !important; line-height: var(--twkan-reader-line-height) !important; letter-spacing: var(--twkan-reader-letter-spacing) !important; background-color: var(--twkan-reader-background) !important; color: var(--twkan-reader-foreground) !important; }',
    '[data-twkan-reading-chapter="true"] > h1, [data-twkan-reading-chapter="true"] > h2, [data-twkan-reading-chapter="true"] > h3 { margin-top: 0 !important; margin-bottom: 6px !important; padding-top: 0 !important; padding-bottom: 0 !important; height: auto !important; min-height: 0 !important; font-size: calc(var(--twkan-reader-font-size) * 1.35) !important; line-height: 1.55 !important; letter-spacing: var(--twkan-reader-letter-spacing) !important; color: var(--twkan-reader-foreground) !important; }',
    '[data-twkan-reading-chapter="true"] p { margin-top: 0 !important; margin-bottom: 1em !important; }',
    '[data-twkan-reading-chapter="true"] p, [data-twkan-reading-chapter="true"] div, [data-twkan-reading-chapter="true"] span { font-size: inherit !important; line-height: inherit !important; letter-spacing: inherit !important; color: inherit !important; }',
    '.twkan-appended-chapter-title { display: block !important; margin: 0 0 6px !important; padding: 0 12px !important; text-align: center !important; font-size: calc(var(--twkan-reader-font-size) * 1.35) !important; line-height: 1.55 !important; letter-spacing: var(--twkan-reader-letter-spacing) !important; color: var(--twkan-reader-foreground) !important; }',
    '.twkan-appended-chapter-body { display: block !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }',
    '.twkan-appended-chapter-body > *:first-child { margin-top: 0 !important; padding-top: 0 !important; }',
    '.twkan-appended-chapter-body img { max-width: 100% !important; height: auto !important; }',
    '.twkan-infinite-status { display: block; padding: 24px 12px !important; text-align: center !important; color: #777 !important; font-size: 14px !important; }',
    '.twkan-infinite-error { color: #b85c00 !important; cursor: pointer !important; }',
    '.twkan-infinite-sentinel { display: block !important; width: 1px !important; height: 1px !important; }'
  ].join("\n");
  document.head.appendChild(style);
}());
