/**
 * Puppeteer Detection Signal Research Script
 *
 * Launches a real Puppeteer browser and checks what automation signals
 * are detectable from within the page context. Used to verify that
 * AI Browser Guard detection code catches real Puppeteer instances.
 */

import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  // --- In-page detection signals via page.evaluate() ---
  const inPageSignals = await page.evaluate(() => {
    const results = {};

    // (a) Stack trace analysis
    try {
      const err = new Error('stack-probe');
      results.stackTrace = {
        raw: err.stack,
        containsPuppeteer: /puppeteer/i.test(err.stack),
        containsDevtools: /devtools/i.test(err.stack),
        containsExtension: /extension/i.test(err.stack),
        containsCDP: /cdp/i.test(err.stack),
      };
    } catch (e) {
      results.stackTrace = { error: e.message };
    }

    // (b) navigator.webdriver
    results.navigatorWebdriver = navigator.webdriver;

    // (c) __puppeteer* window globals
    const puppeteerGlobals = [];
    for (const key of Object.getOwnPropertyNames(window)) {
      if (/^__puppeteer/i.test(key)) {
        puppeteerGlobals.push(key);
      }
    }
    results.puppeteerGlobals = puppeteerGlobals;

    // Also check broader automation globals
    const automationGlobals = [];
    const automationPatterns = [
      /^__selenium/i, /^__webdriver/i, /^__driver/i,
      /^__fxdriver/i, /^_phantom/i, /^callPhantom/i,
      /^_selenium/i, /^calledSelenium/i, /^webdriver/i,
      /^domAutomation/i, /^domAutomationController/i,
    ];
    for (const key of Object.getOwnPropertyNames(window)) {
      for (const pat of automationPatterns) {
        if (pat.test(key)) {
          automationGlobals.push(key);
          break;
        }
      }
    }
    results.automationGlobals = automationGlobals;

    // (d) $cdc_* document properties (ChromeDriver markers)
    const cdcProps = [];
    for (const key of Object.getOwnPropertyNames(document)) {
      if (/^\$cdc_/i.test(key)) {
        cdcProps.push(key);
      }
    }
    results.cdcDocumentProps = cdcProps;

    // (e) CDP markers on window
    const cdpMarkers = [];
    for (const key of Object.getOwnPropertyNames(window)) {
      if (/^__cdp_/i.test(key) || /^__chromium_/i.test(key)) {
        cdpMarkers.push(key);
      }
    }
    results.cdpMarkers = cdpMarkers;

    // (f) navigator.plugins and navigator.languages
    results.navigatorPlugins = {
      length: navigator.plugins.length,
      list: Array.from(navigator.plugins).map(p => p.name),
    };
    results.navigatorLanguages = navigator.languages;
    results.navigatorLanguage = navigator.language;

    // (g) window dimensions
    results.windowDimensions = {
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenWidth: screen.width,
      screenHeight: screen.height,
      devicePixelRatio: window.devicePixelRatio,
    };

    // (h) chrome.loadTimes and chrome.csi
    results.chromeAPIs = {
      chromeExists: typeof window.chrome !== 'undefined',
      loadTimesExists: typeof window.chrome !== 'undefined' && typeof window.chrome.loadTimes === 'function',
      csiExists: typeof window.chrome !== 'undefined' && typeof window.chrome.csi === 'function',
      runtimeExists: typeof window.chrome !== 'undefined' && typeof window.chrome.runtime !== 'undefined',
      appExists: typeof window.chrome !== 'undefined' && typeof window.chrome.app !== 'undefined',
    };

    // (i) WebGL renderer
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        results.webgl = {
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
          unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
        };
      } else {
        results.webgl = { error: 'WebGL not available' };
      }
    } catch (e) {
      results.webgl = { error: e.message };
    }

    // Additional: check for Permissions API anomalies
    results.permissionsAnomaly = null;
    try {
      // In headless, notification permission is often 'denied' by default
      const notifPerm = Notification.permission;
      results.permissionsNotification = notifPerm;
    } catch (e) {
      results.permissionsNotification = 'error: ' + e.message;
    }

    // Check User-Agent for headless indicators
    results.userAgent = navigator.userAgent;
    results.userAgentContainsHeadless = /headless/i.test(navigator.userAgent);
    results.userAgentContainsChrome = /chrome/i.test(navigator.userAgent);

    // Check navigator properties
    results.hardwareConcurrency = navigator.hardwareConcurrency;
    results.maxTouchPoints = navigator.maxTouchPoints;
    results.platform = navigator.platform;
    results.vendor = navigator.vendor;
    results.connection = navigator.connection ? {
      effectiveType: navigator.connection.effectiveType,
      rtt: navigator.connection.rtt,
    } : null;

    return results;
  });

  // --- Outside-page signals (Node.js context) ---
  const outsideSignals = {};

  // (4) CDP target info
  try {
    const cdpSession = await page.createCDPSession();
    const targets = await cdpSession.send('Target.getTargets');
    outsideSignals.cdpTargets = targets.targetInfos.map(t => ({
      type: t.type,
      title: t.title,
      url: t.url,
      attached: t.attached,
      browserContextId: t.browserContextId,
    }));
    await cdpSession.detach();
  } catch (e) {
    outsideSignals.cdpTargets = { error: e.message };
  }

  // Browser version info
  outsideSignals.browserVersion = await browser.version();

  // Check browser user agent from protocol
  try {
    const cdpSession = await page.createCDPSession();
    const { userAgent } = await cdpSession.send('Browser.getVersion');
    outsideSignals.protocolUserAgent = userAgent;
    await cdpSession.detach();
  } catch (e) {
    outsideSignals.protocolUserAgent = { error: e.message };
  }

  const fullReport = {
    timestamp: new Date().toISOString(),
    puppeteerVersion: (await import('puppeteer/package.json', { with: { type: 'json' } })).default.version,
    inPageSignals,
    outsideSignals,
    summary: {
      detectable: [],
      notDetectable: [],
    },
  };

  // Build summary
  if (inPageSignals.navigatorWebdriver === true) {
    fullReport.summary.detectable.push('navigator.webdriver = true');
  } else {
    fullReport.summary.notDetectable.push('navigator.webdriver is not true');
  }

  if (inPageSignals.puppeteerGlobals.length > 0) {
    fullReport.summary.detectable.push(`__puppeteer* globals: ${inPageSignals.puppeteerGlobals.join(', ')}`);
  } else {
    fullReport.summary.notDetectable.push('No __puppeteer* globals found');
  }

  if (inPageSignals.cdcDocumentProps.length > 0) {
    fullReport.summary.detectable.push(`$cdc_* props: ${inPageSignals.cdcDocumentProps.join(', ')}`);
  } else {
    fullReport.summary.notDetectable.push('No $cdc_* document props found');
  }

  if (inPageSignals.cdpMarkers.length > 0) {
    fullReport.summary.detectable.push(`CDP markers: ${inPageSignals.cdpMarkers.join(', ')}`);
  } else {
    fullReport.summary.notDetectable.push('No __cdp_*/__chromium_* markers found');
  }

  if (inPageSignals.navigatorPlugins.length === 0) {
    fullReport.summary.detectable.push('navigator.plugins.length = 0 (suspicious)');
  }

  if (inPageSignals.windowDimensions.outerWidth === 0 && inPageSignals.windowDimensions.outerHeight === 0) {
    fullReport.summary.detectable.push('outerWidth/outerHeight = 0 (headless indicator)');
  }

  if (inPageSignals.userAgentContainsHeadless) {
    fullReport.summary.detectable.push('User-Agent contains "Headless"');
  } else {
    fullReport.summary.notDetectable.push('User-Agent does not contain "Headless"');
  }

  if (inPageSignals.webgl?.unmaskedRenderer && /swiftshader|mesa|llvmpipe/i.test(inPageSignals.webgl.unmaskedRenderer)) {
    fullReport.summary.detectable.push(`WebGL renderer: ${inPageSignals.webgl.unmaskedRenderer} (software renderer = headless indicator)`);
  }

  if (!inPageSignals.chromeAPIs.loadTimesExists) {
    fullReport.summary.detectable.push('chrome.loadTimes missing');
  }

  if (!inPageSignals.chromeAPIs.csiExists) {
    fullReport.summary.detectable.push('chrome.csi missing');
  }

  if (inPageSignals.automationGlobals.length > 0) {
    fullReport.summary.detectable.push(`Automation globals: ${inPageSignals.automationGlobals.join(', ')}`);
  }

  console.log(JSON.stringify(fullReport, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
