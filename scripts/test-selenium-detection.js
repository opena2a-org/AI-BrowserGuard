/**
 * Selenium WebDriver Detection Signal Test
 *
 * Launches a real Chrome instance via Selenium WebDriver and checks
 * every detection signal that AI Browser Guard monitors.
 *
 * Usage: node scripts/test-selenium-detection.js
 */

import { Builder, Browser } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

async function main() {
  console.log('--- Selenium WebDriver Detection Signal Test ---\n');

  const options = new chrome.Options();
  options.addArguments('--no-sandbox');
  options.addArguments('--disable-gpu');

  let driver;
  try {
    driver = await new Builder()
      .forBrowser(Browser.CHROME)
      .setChromeOptions(options)
      .build();

    console.log('Chrome launched via Selenium WebDriver.');
    console.log('Navigating to https://example.com ...\n');
    await driver.get('https://example.com');

    const results = await driver.executeScript(() => {
      const out = {};

      // 1. navigator.webdriver
      out['navigator.webdriver'] = navigator.webdriver;

      // 2. Error stack trace
      try {
        out['Error.stack (first 500 chars)'] = new Error('probe').stack.substring(0, 500);
      } catch (e) {
        out['Error.stack'] = 'ERROR: ' + e.message;
      }

      // 3. Window globals: $cdc_*, $wdc_*, __selenium*, callSelenium, _Selenium_IDE_Recorder
      const windowGlobals = {};
      const seleniumPatterns = [
        /^\$cdc_/,
        /^\$wdc_/,
        /^__selenium/,
        /^callSelenium$/,
        /^_Selenium_IDE_Recorder$/,
        /^_selenium$/,
        /^calledSelenium$/,
        /^driver-evaluate$/,
        /^webdriver-evaluate$/,
      ];
      for (const key of Object.getOwnPropertyNames(window)) {
        for (const pat of seleniumPatterns) {
          if (pat.test(key)) {
            windowGlobals[key] = typeof window[key];
          }
        }
      }
      // Also check common cdc variable pattern used by chromedriver
      for (const key of Object.keys(document)) {
        if (/^\$cdc_|^\$wdc_/.test(key)) {
          windowGlobals['document.' + key] = typeof document[key];
        }
      }
      out['Selenium/ChromeDriver window globals'] = Object.keys(windowGlobals).length > 0
        ? windowGlobals
        : '(none found)';

      // 4. Document properties: $cdc_*, $wdc_*
      const docProps = {};
      for (const key of Object.getOwnPropertyNames(document)) {
        if (/^\$cdc_|^\$wdc_/.test(key)) {
          docProps[key] = typeof document[key];
        }
      }
      out['Document $cdc_/$wdc_ properties'] = Object.keys(docProps).length > 0
        ? docProps
        : '(none found on Object.getOwnPropertyNames)';

      // 5. navigator.plugins.length
      out['navigator.plugins.length'] = navigator.plugins.length;

      // 6. navigator.languages
      out['navigator.languages'] = JSON.parse(JSON.stringify(navigator.languages));

      // 7. window.outerWidth vs innerWidth
      out['window.outerWidth'] = window.outerWidth;
      out['window.innerWidth'] = window.innerWidth;
      out['outerWidth === innerWidth'] = window.outerWidth === window.innerWidth;
      out['window.outerHeight'] = window.outerHeight;
      out['window.innerHeight'] = window.innerHeight;

      // 8. chrome.loadTimes / chrome.csi
      out['chrome.loadTimes exists'] = typeof chrome !== 'undefined' && typeof chrome.loadTimes === 'function';
      out['chrome.csi exists'] = typeof chrome !== 'undefined' && typeof chrome.csi === 'function';

      // 9. User agent
      out['navigator.userAgent'] = navigator.userAgent;

      // 10. WebGL renderer
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            out['WebGL vendor'] = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            out['WebGL renderer'] = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          } else {
            out['WebGL renderer'] = '(WEBGL_debug_renderer_info not available)';
          }
        } else {
          out['WebGL renderer'] = '(WebGL not available)';
        }
      } catch (e) {
        out['WebGL renderer'] = 'ERROR: ' + e.message;
      }

      // Bonus: check if the webdriver property descriptor is configurable
      try {
        const desc = Object.getOwnPropertyDescriptor(navigator, 'webdriver');
        out['navigator.webdriver descriptor'] = desc ? JSON.parse(JSON.stringify({
          configurable: desc.configurable,
          enumerable: desc.enumerable,
          value: desc.value,
          writable: desc.writable,
        })) : 'no own property descriptor (inherited from prototype)';
      } catch (e) {
        out['navigator.webdriver descriptor'] = 'ERROR: ' + e.message;
      }

      // Bonus: check Navigator prototype
      try {
        const protoDesc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver');
        out['Navigator.prototype.webdriver descriptor'] = protoDesc ? {
          configurable: protoDesc.configurable,
          enumerable: protoDesc.enumerable,
          get: protoDesc.get ? protoDesc.get.toString().substring(0, 100) : undefined,
          set: protoDesc.set ? protoDesc.set.toString().substring(0, 100) : undefined,
        } : '(not found)';
      } catch (e) {
        out['Navigator.prototype.webdriver descriptor'] = 'ERROR: ' + e.message;
      }

      return out;
    });

    console.log('=== DETECTION SIGNAL RESULTS ===\n');
    for (const [key, value] of Object.entries(results)) {
      if (typeof value === 'object' && value !== null) {
        console.log(`${key}:`);
        console.log(`  ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')}`);
      } else {
        console.log(`${key}: ${value}`);
      }
      console.log();
    }

    // Summary
    console.log('=== DETECTION SUMMARY ===\n');
    const detectable = [];
    const notDetectable = [];

    if (results['navigator.webdriver'] === true) {
      detectable.push('navigator.webdriver = true');
    } else {
      notDetectable.push('navigator.webdriver is not true');
    }

    const globals = results['Selenium/ChromeDriver window globals'];
    if (typeof globals === 'object') {
      detectable.push(`Window globals found: ${Object.keys(globals).join(', ')}`);
    } else {
      notDetectable.push('No Selenium window globals found');
    }

    const docP = results['Document $cdc_/$wdc_ properties'];
    if (typeof docP === 'object') {
      detectable.push(`Document properties found: ${Object.keys(docP).join(', ')}`);
    } else {
      notDetectable.push('No $cdc_/$wdc_ document properties found');
    }

    if (results['navigator.plugins.length'] === 0) {
      detectable.push('navigator.plugins.length = 0 (suspicious)');
    } else {
      notDetectable.push(`navigator.plugins.length = ${results['navigator.plugins.length']}`);
    }

    if (results['outerWidth === innerWidth']) {
      detectable.push('outerWidth === innerWidth (possible headless/automated)');
    }

    console.log('DETECTABLE signals:');
    detectable.forEach(s => console.log(`  [DETECTED] ${s}`));
    if (detectable.length === 0) console.log('  (none)');

    console.log('\nNot detected / normal signals:');
    notDetectable.forEach(s => console.log(`  [OK] ${s}`));
    if (notDetectable.length === 0) console.log('  (none)');

    console.log(`\nTotal detectable: ${detectable.length}`);

  } catch (err) {
    console.error('FATAL:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    if (driver) {
      await driver.quit();
      console.log('\nBrowser closed.');
    }
  }
}

main();
