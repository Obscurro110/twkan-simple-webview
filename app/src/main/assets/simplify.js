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
    schedule.pendingFirst = isFirstPass;
    schedule.timer = window.setTimeout(function () {
      simplify(schedule.pendingRoot, schedule.pendingFirst);
    }, 60);
  }

  // ─── Chapter Preloader ────────────────────────────────────────────────────
  var PREFETCH_AHEAD = 3;
  // Fix: use typeof check, not truthiness of the Set constructor itself
  var prefetchedUrls = (typeof Set !== "undefined") ? new Set() : null;

  function prefetchedHas(u) {
    return prefetchedUrls ? prefetchedUrls.has(u) : false;
  }
  function prefetchedAdd(u) {
    if (prefetchedUrls) prefetchedUrls.add(u);
  }

  function findNextChapterUrl(doc) {
    var links = doc.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var text = (a.textContent || a.innerText || "").trim();
      var rel  = (a.getAttribute("rel") || "").toLowerCase();
      var href = a.href || a.getAttribute("href") || "";
      if (!href || href === window.location.href) continue;
      if (
        text.match(/下一[章话話節节篇頁页集]/) ||
        rel === "next" ||
        text.match(/next\s*chap/i) ||
        (a.getAttribute("title") || "").match(/下一/)
      ) {
        if (href.charAt(0) === "/") {
          href = window.location.protocol + "//" + window.location.host + href;
        }
        return href;
      }
    }
    return null;
  }

  function prefetchChain(url, depth) {
    if (!url || depth <= 0 || prefetchedHas(url)) return;
    prefetchedAdd(url);
    fetch(url, {
      credentials: "include",
      cache: "force-cache"
    })
      .then(function (res) {
        if (!res.ok || depth <= 1) return null;
        return res.text();
      })
      .then(function (html) {
        if (!html) return;
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, "text/html");
          var nextUrl = findNextChapterUrl(doc);
          if (nextUrl) prefetchChain(nextUrl, depth - 1);
        } catch (e) { /* ignore */ }
      })
      .catch(function () { /* non-fatal */ });
  }

  function initPreloader() {
    // Wait 2s so prefetch doesn't compete with the current page's own requests
    setTimeout(function () {
      var nextUrl = findNextChapterUrl(document);
      if (nextUrl) prefetchChain(nextUrl, PREFETCH_AHEAD);
    }, 2000);
  }

  // ─── Public run entry ─────────────────────────────────────────────────────
  window[runKey] = function () {
    pageReadySent = false; // reset for each new page
    schedule(document.body || document.documentElement, true /* isFirstPass */);
    initAdBlocker();
    initPreloader();
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
    '[id*="banner"] { display: none !important; }'
  ].join("\n");
  document.head.appendChild(style);
}());
