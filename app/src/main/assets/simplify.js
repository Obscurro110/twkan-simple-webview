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
  var SEP = "\u001F"; // Unit Separator – used as batch delimiter
  var SKIP_TAGS = {
    SCRIPT: true, STYLE: true, NOSCRIPT: true,
    TEXTAREA: true, INPUT: true, SELECT: true, OPTION: true,
    CODE: true, PRE: true, SVG: true, CANVAS: true
  };
  var ATTRIBUTES = ["title", "aria-label", "alt", "placeholder"];
  var installedKey = "__twkanSimplifierInstalled";
  var runKey = "__twkanSimplifierRun";
  var converting = false;

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

  // ─── Batch Conversion (core optimisation) ─────────────────────────────────
  // Collect ALL text nodes and attribute values first, join them with SEP,
  // call the Bridge exactly ONCE, then write results back.
  // This reduces hundreds of JS→Java round-trips to a single call.
  function simplify(root) {
    if (!root || converting) return;
    converting = true;

    try {
      // 1. Collect nodes that need conversion
      var textNodes = [];   // DOM text nodes
      var attrNodes = [];   // { element, attrName, value }

      var startNodes = (root.nodeType === Node.TEXT_NODE) ? [root] : [];

      if (root.nodeType === Node.TEXT_NODE) {
        if (!hasSkippedParent(root) && canConvertText(root.nodeValue)) {
          textNodes.push(root);
        }
      } else {
        // Walk the tree
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
            if (canConvertText(node.nodeValue)) {
              textNodes.push(node);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            for (var a = 0; a < ATTRIBUTES.length; a++) {
              var val = node.getAttribute(ATTRIBUTES[a]);
              if (canConvertText(val)) {
                attrNodes.push({ element: node, attrName: ATTRIBUTES[a], value: val });
              }
            }
          }
        }

        // Title
        if (canConvertText(document.title)) {
          attrNodes.push({ element: null, attrName: "__title__", value: document.title });
        }
      }

      // 2. Build a single batch string
      var allValues = [];
      for (var i = 0; i < textNodes.length; i++) allValues.push(textNodes[i].nodeValue);
      for (var j = 0; j < attrNodes.length; j++) allValues.push(attrNodes[j].value);

      if (allValues.length === 0) return;

      var batchInput = allValues.join(SEP);

      // 3. Single Bridge call (use batch API if available, fall back to single)
      var batchOutput;
      try {
        if (typeof window.TwkanBridge.toBatchSimplified === "function") {
          batchOutput = window.TwkanBridge.toBatchSimplified(batchInput);
        } else {
          // Fallback: old single-call API
          batchOutput = window.TwkanBridge.toSimplified(batchInput);
        }
      } catch (e) {
        return;
      }

      if (!batchOutput) return;
      var results = batchOutput.split(SEP);

      // 4. Write results back
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

    } finally {
      converting = false;
    }
  }

  // ─── Debounced scheduler ──────────────────────────────────────────────────
  function schedule(root) {
    window.clearTimeout(schedule.timer);
    schedule.target = root || document.body || document.documentElement;
    schedule.timer = window.setTimeout(function () {
      simplify(schedule.target);
    }, 60);
  }

  // ─── Public run entry ─────────────────────────────────────────────────────
  window[runKey] = function () {
    schedule(document.body || document.documentElement);
    initAdBlocker();
  };

  if (window[installedKey]) {
    window[runKey]();
    return;
  }
  window[installedKey] = true;

  // ─── MutationObserver ────────────────────────────────────────────────────
  var observer = new MutationObserver(function (mutations) {
    if (converting) return;
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === "characterData" || m.type === "attributes" || m.addedNodes.length > 0) {
        schedule(document.body || document.documentElement);
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
