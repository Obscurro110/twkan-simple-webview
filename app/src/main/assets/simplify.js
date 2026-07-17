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

  function initAdBlocker() {
    removeAds();
    setInterval(removeAds, 2000);
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
  var PREFETCH_AHEAD = 3;
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

  var CONTENT_SELECTORS = [
    "#chaptercontent", "#chapter-content", "#chapterContent",
    "#content", "#BookText", "#booktext",
    ".chapter-content", ".chapterContent", ".read-content",
    ".reading-content", ".article-content", ".novel-content",
    ".book-content", ".entry-content", ".contentbox", ".txtnav",
    "article"
  ];

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
      if (/上一|返回|目录|書目|书目/.test(text)) continue;

      var score = 0;
      if (/^下一[章话話節节篇頁页集卷]$/.test(text)) score += 100;
      else if (/下一[章话話節节篇頁页集卷]/.test(text)) score += 80;
      if (/next\s*chap/i.test(text) || /^next$/i.test(text)) score += 70;
      if (rel === "next") score += 60;
      if (/(^|[-_])next($|[-_])|nextchapter|chapter-next/.test(marker)) score += 45;
      if (/下一/.test(title)) score += 35;
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
        if (directText.length >= 350) return matches[m];
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
      if (text.length < 500) continue;
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
    if (!contentRoot) return false;
    var text = (contentRoot.textContent || "").replace(/\s+/g, "");
    if (text.length < 500) return false;
    var heading = getChapterTitle(doc, contentRoot);
    var chapterSignal = /第.{0,12}[章话話節节篇頁页集卷回]/.test(heading) ||
      (nextInfo && /下一[章话話節节篇集卷回]/.test(nextInfo.text)) ||
      /chapter|read|novel|book/i.test(sourceUrlFor(doc));
    var paragraphSignal = contentRoot.querySelectorAll("p").length >= 3 ||
      contentRoot.querySelectorAll("br").length >= 5;
    return chapterSignal && paragraphSignal;
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
    var cleanText = (clone.textContent || "").replace(/\s+/g, "");
    if (cleanText.length < 300) throw new Error("Chapter body is empty");
    return {
      url: normalizeUrl(url),
      title: title,
      html: clone.innerHTML,
      nextUrl: nextInfo ? normalizeUrl(nextInfo.url) : null,
      titleAlreadyPresent: title && cleanText.indexOf(title.replace(/\s+/g, "")) === 0
    };
  }

  function isCloudflareChallenge(html) {
    return /cf-chl-|challenge-platform|Just a moment|验证您是真人|驗證您是真人/i.test(html || "");
  }

  /** Fetch and parse once; keep the actual chapter in memory, not only HTTP cache. */
  function fetchChapter(url) {
    url = normalizeUrl(url);
    if (!url) return Promise.reject(new Error("Invalid chapter URL"));
    if (chapterCache[url]) return Promise.resolve(chapterCache[url]);
    if (chapterRequests[url]) return chapterRequests[url];

    chapterRequests[url] = fetch(url, {
      credentials: "include",
      cache: "force-cache",
      redirect: "follow"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      })
      .then(function (html) {
        if (isCloudflareChallenge(html)) throw new Error("Cloudflare challenge");
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

    // Ask Android to open this chapter once in a hidden, cookie-sharing WebView.
    // That executes the site's own read-history script without leaving the
    // infinite reader. It is called only when the chapter is actually read.
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

    // The initial page records itself during normal navigation. Returning to it
    // later should still update the record, so notify on every chapter change.
    notifyWebsiteChapterChange(url, title);
  }

  function updateVisibleReadingChapter() {
    if (!infiniteInitialized) return;
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

  function scheduleReadingTracker() {
    if (readingTrackerTimer !== null) return;
    readingTrackerTimer = window.requestAnimationFrame(function () {
      readingTrackerTimer = null;
      updateVisibleReadingChapter();
    });
  }


  function appendNextChapter() {
    if (appendingChapter || noMoreChapters || !nextChapterUrl || !infiniteHost) {
      return Promise.resolve(null);
    }
    var requestedUrl = normalizeUrl(nextChapterUrl);
    if (!requestedUrl || appendedUrls[requestedUrl]) {
      noMoreChapters = true;
      setLoadingState("已到最后一章", false);
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
        body.innerHTML = chapter.html;
        section.appendChild(body);

        // Convert while detached, so raw traditional Chinese is never flashed.
        simplify(section, false);
        infiniteHost.insertBefore(section, loadingIndicator);

        appendedUrls[chapter.url] = true;
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
      .catch(function () {
        appendingChapter = false;
        setLoadingState("下一章加载失败，点这里重试", true);
        return null;
      });
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
    if (infiniteInitialized) return;

    var nextInfo = findNextChapter(document);
    var contentRoot = findContentRoot(document);
    if (!isLikelyChapterPage(document, contentRoot, nextInfo)) return;

    infiniteInitialized = true;
    initialChapterUrl = normalizeUrl(sourceUrlFor(document));
    initialChapterTitle = getChapterTitle(document, contentRoot) || document.title;
    currentReadingUrl = initialChapterUrl;
    nextChapterUrl = normalizeUrl(nextInfo.url);
    appendedUrls[initialChapterUrl] = true;

    // Treat the original chapter as the first tracked section. Its URL remains
    // the real network URL even after history.replaceState changes location.
    contentRoot.setAttribute("data-twkan-reading-chapter", "true");
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
      if (loadingIndicator.classList.contains("twkan-infinite-error")) appendNextChapter();
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
    hideOriginalChapterNavigation(nextInfo.element);

    // Load when the reader is roughly 1.5 screens from the bottom.
    if (typeof IntersectionObserver !== "undefined") {
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            appendNextChapter();
            return;
          }
        }
      }, { root: null, rootMargin: "1600px 0px", threshold: 0 });
      observer.observe(sentinel);
    } else {
      window.addEventListener("scroll", function () {
        if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 1600) {
          appendNextChapter();
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
        appendNextChapter().then(function (section) {
          if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }, true);

    // Fill the 3-chapter memory cache immediately; append only near the bottom.
    prefetchChain(nextChapterUrl, PREFETCH_AHEAD);


    window.addEventListener("scroll", scheduleReadingTracker, { passive: true });
    window.addEventListener("resize", scheduleReadingTracker, { passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) scheduleReadingTracker();
    });
    scheduleReadingTracker();
  }

  // ─── Public run entry ─────────────────────────────────────────────────────
  window[runKey] = function () {
    pageReadySent = false;
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
    '.twkan-infinite-chapter { display: block !important; width: 100% !important; clear: both !important; }',
    '.twkan-chapter-separator { display: block !important; width: 72% !important; height: 1px !important; margin: 48px auto 30px !important; background: rgba(127,127,127,.32) !important; }',
    '.twkan-appended-chapter-title { display: block !important; margin: 0 0 24px !important; padding: 0 12px !important; text-align: center !important; font-size: 1.35em !important; line-height: 1.55 !important; }',
    '.twkan-appended-chapter-body { display: block !important; }',
    '.twkan-appended-chapter-body img { max-width: 100% !important; height: auto !important; }',
    '.twkan-infinite-status { display: block; padding: 24px 12px !important; text-align: center !important; color: #777 !important; font-size: 14px !important; }',
    '.twkan-infinite-error { color: #b85c00 !important; cursor: pointer !important; }',
    '.twkan-infinite-sentinel { display: block !important; width: 1px !important; height: 1px !important; }'
  ].join("\n");
  document.head.appendChild(style);
}());
