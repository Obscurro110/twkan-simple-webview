(function () {
  "use strict";

  if (!window.TwkanBridge || typeof window.TwkanBridge.toSimplified !== "function") {
    return;
  }

  // Ad Blocker - Remove common ad elements
  function removeAds() {
    // Common ad selectors
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

    adSelectors.forEach(function(selector) {
      try {
        var elements = document.querySelectorAll(selector);
        elements.forEach(function(el) {
          // Check if it looks like an ad (contains ad-related text or is from ad domain)
          var isAd = false;
          if (el.tagName === 'IFRAME') {
            isAd = true;
          } else if (el.offsetHeight > 50 && el.offsetHeight < 300 && el.offsetWidth > 200) {
            // Typical ad dimensions
            var text = el.innerText || '';
            if (text.match(/广告|Advertisement|赞助|Sponsored/i)) {
              isAd = true;
            }
          }
          if (isAd) {
            el.style.display = 'none';
            el.remove();
          }
        });
      } catch (e) {
        // Ignore selector errors
      }
    });

    // Block ad scripts
    var scripts = document.querySelectorAll('script[src]');
    scripts.forEach(function(script) {
      var src = script.src || '';
      if (src.match(/googlesyndication|doubleclick|ads|adservice|advertising/i)) {
        script.remove();
      }
    });
  }

  // Run ad blocker on page load and mutations
  function initAdBlocker() {
    removeAds();
    // Run periodically to catch dynamically loaded ads
    setInterval(removeAds, 2000);
  }

  var CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/;
  var SKIP_TAGS = {
    SCRIPT: true,
    STYLE: true,
    NOSCRIPT: true,
    TEXTAREA: true,
    INPUT: true,
    SELECT: true,
    OPTION: true,
    CODE: true,
    PRE: true,
    SVG: true,
    CANVAS: true
  };
  var ATTRIBUTES = ["title", "aria-label", "alt", "placeholder"];
  var installedKey = "__twkanSimplifierInstalled";
  var runKey = "__twkanSimplifierRun";
  var converting = false;

  function canConvertText(text) {
    return text && CJK_PATTERN.test(text);
  }

  function convert(text) {
    if (!canConvertText(text)) {
      return text;
    }
    try {
      return window.TwkanBridge.toSimplified(text) || text;
    } catch (error) {
      return text;
    }
  }

  function shouldSkipElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }
    if (SKIP_TAGS[element.tagName]) {
      return true;
    }
    return element.isContentEditable === true;
  }

  function hasSkippedParent(node) {
    var current = node.parentElement;
    while (current) {
      if (shouldSkipElement(current)) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function convertTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || hasSkippedParent(node)) {
      return;
    }
    var nextValue = convert(node.nodeValue);
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
    }
  }

  function convertAttributes(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(element)) {
      return;
    }

    for (var i = 0; i < ATTRIBUTES.length; i += 1) {
      var name = ATTRIBUTES[i];
      var value = element.getAttribute(name);
      var nextValue = convert(value);
      if (nextValue !== value) {
        element.setAttribute(name, nextValue);
      }
    }
  }

  function simplify(root) {
    if (!root || converting) {
      return;
    }

    converting = true;
    try {
      if (root.nodeType === Node.TEXT_NODE) {
        convertTextNode(root);
      } else if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
        if (root.nodeType === Node.ELEMENT_NODE) {
          convertAttributes(root);
        }

        var walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: function (node) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                return shouldSkipElement(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
              }
              return hasSkippedParent(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
            }
          }
        );

        var node;
        while ((node = walker.nextNode())) {
          if (node.nodeType === Node.TEXT_NODE) {
            convertTextNode(node);
          } else {
            convertAttributes(node);
          }
        }
      }

      document.title = convert(document.title);
      document.documentElement.setAttribute("lang", "zh-Hans");
    } finally {
      converting = false;
    }
  }

  function schedule(root) {
    window.clearTimeout(schedule.timer);
    schedule.target = root || document.body || document.documentElement;
    schedule.timer = window.setTimeout(function () {
      simplify(schedule.target);
    }, 60);
  }

  window[runKey] = function () {
    schedule(document.body || document.documentElement);
    initAdBlocker();
  };

  if (window[installedKey]) {
    window[runKey]();
    return;
  }
  window[installedKey] = true;

  var observer = new MutationObserver(function (mutations) {
    if (converting) {
      return;
    }

    for (var i = 0; i < mutations.length; i += 1) {
      var mutation = mutations[i];
      if (mutation.type === "characterData") {
        schedule(document.body || document.documentElement);
        return;
      }
      if (mutation.type === "attributes") {
        schedule(document.body || document.documentElement);
        return;
      }
      if (mutation.addedNodes.length > 0) {
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

  // CSS injection to hide common ad patterns
  var style = document.createElement('style');
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
  ].join('\n');
  document.head.appendChild(style);
}());
