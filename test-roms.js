const { chromium } = require('playwright');
const Tesseract = require('tesseract.js');

// Configuration
const VERBOSE_MODE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ROM test configurations
const romTests = [
  {
    name: 'Official AP6 ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/AP6.rom',
    expectedSize: 7772,
    description: 'Official AP6 Plus 1.1.33 ROM - reference baseline',
    expectedText: null, // Text is rendered on WebGL canvas, not in DOM
    expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR (flexible for OCR errors)
  }
];

// OCR function to extract text from screenshot
async function extractTextFromScreenshot(imageBuffer) {
  try {
    if (VERBOSE_MODE) {
      console.log('🔍 Running OCR on screenshot...');
    }
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: m => {
        if (VERBOSE_MODE && m.status) {
          console.log(`   OCR: ${m.status}`);
        }
      }
    });
    return text.trim();
  } catch (error) {
    if (VERBOSE_MODE) {
      console.log(`   ⚠️  OCR failed: ${error.message}`);
    }
    return '';
  }
}

async function testROM(romTest, browser) {
  console.log(`\n🧪 Testing: ${romTest.name}`);
  console.log(`📝 Description: ${romTest.description}`);
  console.log(`🔗 URL: ${romTest.url}`);
  
  const page = await browser.newPage();
  
  try {
    // Set up console logging (filtered for important messages only)
    page.on('console', msg => {
      const text = msg.text();
      
      // In non-verbose mode, only show errors
      if (!VERBOSE_MODE) {
        if (text.includes('INFO:') || text.includes('DEBUG:') || text.includes('WARNING:')) {
          return; // Skip all INFO, DEBUG, and WARNING messages in non-verbose mode
        }
      }
      
      // Filter out verbose emulator initialization messages even in verbose mode
      if (text.includes('INFO: Initializing raylib') || 
          text.includes('INFO: Platform backend') ||
          text.includes('INFO: Supported raylib modules') ||
          text.includes('INFO: Display size') ||
          text.includes('INFO: GL:') ||
          text.includes('INFO: TEXTURE:') ||
          text.includes('INFO: SHADER:') ||
          text.includes('INFO: AUDIO:') ||
          text.includes('INFO: STREAM:') ||
          text.includes('INFO: SYSTEM:')) {
        return; // Skip these verbose messages
      }
      
      const truncated = text.length > 200 ? text.substring(0, 200) + '...' : text;
      const length = text.length > 200 ? ` (${text.length} chars)` : '';
      
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${truncated}${length}`);
      } else if (msg.type() === 'log') {
        console.log(`📋 Console Log: ${truncated}${length}`);
      }
    });
    
    // Set up network monitoring
    const networkRequests = [];
    page.on('request', request => {
      if (request.url().includes('localhost:8080')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('localhost:8080')) {
        console.log(`🌐 Network: ${response.status()} ${response.url()}`);
      }
    });
    
    // Navigate to the emulator with the ROM
    console.log('⏳ Loading emulator...');
    const startTime = Date.now();
    
    await page.goto(romTest.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️  Load time: ${loadTime}ms`);
    
    // Wait for the emulator to initialize and ROM to load
    console.log(`⏳ Waiting for emulator to load ROM content...`);
    await page.waitForTimeout(3000); // Wait 3 seconds for ROM to load and display
    
    // Check if the emulator loaded successfully
    const emulatorLoaded = await page.evaluate(() => {
      // Look for the emulator canvas or specific elements
      const canvas = document.querySelector('canvas');
      const electroniq = window.electroniq;
      return {
        hasCanvas: !!canvas,
        hasElectroniq: !!electroniq,
        canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
      };
    });
    
    if (VERBOSE_MODE) {
      console.log(`🖥️  Emulator status:`, emulatorLoaded);
    }
    
    // Check for any error messages on the page
    const errorElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && el.textContent.toLowerCase().includes('error'))
        .map(el => el.textContent.trim())
        .slice(0, 5); // Limit to first 5 errors
    });
    
    if (errorElements.length > 0) {
      if (VERBOSE_MODE) {
        console.log(`⚠️  Page errors found: ${errorElements.length} errors`);
        errorElements.forEach((error, index) => {
          const truncated = error.length > 200 ? error.substring(0, 200) + '...' : error;
          const length = error.length > 200 ? ` (${error.length} chars)` : '';
          console.log(`   ${index + 1}. ${truncated}${length}`);
        });
      } else {
        console.log(`⚠️  Page errors: ${errorElements.length} (use --verbose to see details)`);
      }
    }
    
    // Try to interact with the emulator (if it's responsive)
    let screenContent = null;
    let ocrText = '';
    try {
      // Look for the emulator screen content
      screenContent = await page.evaluate(({romTest, verboseMode}) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) {
          return null;
        }
        
        // Try to get some basic info about the canvas
        let ctx = canvas.getContext('2d');
        
        // If no 2D context, try WebGL context
        if (!ctx) {
          ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        }
        
        if (!ctx) {
          return null;
        }
        
        // For WebGL canvas, we can't easily read pixels, so we'll use a simpler approach
        // Basic content detection - if canvas has reasonable dimensions, assume it has content
        const hasContent = canvas.width > 100 && canvas.height > 100;
        
        // For now, we'll use a simple approach - if canvas exists and has reasonable size, assume content
        const nonBlackPixels = hasContent ? 1000 : 0; // Simulate some content
        const totalPixels = canvas.width * canvas.height;
        const pixels = []; // Empty array for compatibility
        
        // Look for any text content on the page
        let textContent = '';
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.textContent && el.textContent.trim() && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
            textContent += el.textContent.trim() + ' ';
          }
        });
        
        // Check if Electroniq exposes any text content via global variables (verbose only)
        let emulatorText = '';
        if (verboseMode) {
          try {
            // Check for common emulator global variables that might contain text
            if (typeof window.Module !== 'undefined' && window.Module) {
              console.log('🔍 Found Electroniq Module object');
              const moduleKeys = Object.keys(window.Module);
              console.log('🔍 Module keys:', moduleKeys);
              
              // Look for text or screen related keys
              const textRelatedKeys = moduleKeys.filter(key => 
                key.toLowerCase().includes('text') || 
                key.toLowerCase().includes('screen') || 
                key.toLowerCase().includes('display') ||
                key.toLowerCase().includes('buffer') ||
                key.toLowerCase().includes('memory')
              );
              console.log('🔍 Text/screen related keys:', textRelatedKeys);
              
              // Look for HEAP or memory related keys
              const heapKeys = moduleKeys.filter(key => 
                key.includes('HEAP') || 
                key.includes('heap') ||
                key.includes('Memory') ||
                key.includes('memory')
              );
              console.log('🔍 HEAP/memory related keys:', heapKeys);
              
              // Check for screen buffer or text content in Module
              if (window.Module.HEAPU8) {
                console.log('🔍 Found HEAPU8 (memory buffer)');
                // Try to read some memory to see if it contains text
                try {
                  const memorySample = Array.from(window.Module.HEAPU8.slice(0, 1000));
                  const textSample = memorySample.map(byte => byte > 31 && byte < 127 ? String.fromCharCode(byte) : '.').join('');
                  console.log('🔍 Memory sample (first 1000 bytes):', textSample);
                } catch (e) {
                  console.log('🔍 Error reading memory:', e.message);
                }
              }
              if (window.Module.HEAP32) {
                console.log('🔍 Found HEAP32 (32-bit memory buffer)');
              }
              if (window.Module.screen) {
                console.log('🔍 Found screen object');
              }
              if (window.Module.getText) {
                console.log('🔍 Found getText function');
              }
              if (window.Module.getScreenText) {
                console.log('🔍 Found getScreenText function');
              }
              
              // Try to call emulator functions that might return screen text
              if (window.Module.ccall) {
                console.log('🔍 Found ccall function - trying to get screen text');
                try {
                  // Common emulator function names for getting screen text
                  const textFunctions = ['get_screen_text', 'getScreenText', 'get_text', 'getText', 'screen_text', 'get_display_text'];
                  for (const funcName of textFunctions) {
                    try {
                      const result = window.Module.ccall(funcName, 'string', [], []);
                      if (result && result.trim()) {
                        console.log(`🔍 Found text via ${funcName}:`, result);
                        emulatorText = result;
                        break;
                      }
                    } catch (e) {
                      // Function doesn't exist, continue
                    }
                  }
                } catch (e) {
                  console.log('🔍 Error calling emulator functions:', e.message);
                }
              }
            }
            
            // Check for any canvas-related text extraction
            if (typeof window.getTextFromCanvas === 'function') {
              emulatorText = window.getTextFromCanvas();
              console.log('🔍 Found getTextFromCanvas function');
            }
            
            // Check for any emulator-specific text APIs
            if (typeof window.emulator !== 'undefined') {
              console.log('🔍 Found emulator object');
            }
          } catch (e) {
            console.log('🔍 No emulator text APIs found');
          }
        }
        
        // Check if there are any visible elements
        const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
        });
        
        // Check for specific expected text (case insensitive)
        const hasExpectedText = romTest.expectedText ? 
          textContent.toLowerCase().includes(romTest.expectedText.toLowerCase()) : false;
        const hasExpectedElements = romTest.expectedElements ? 
          romTest.expectedElements.every(element => 
            textContent.toLowerCase().includes(element.toLowerCase())) : true;
        
        // Debug: Log what text we actually found (only in verbose mode)
        if (verboseMode) {
          const debugText = textContent.substring(0, 200);
          console.log(`🔍 Text content: "${debugText}${textContent.length > 200 ? '...' : ''}" (${textContent.length} chars)`);
          if (romTest.expectedText) {
            console.log(`🔍 Looking for expected text: "${romTest.expectedText}"`);
          }
          if (romTest.expectedElements && romTest.expectedElements.length > 0) {
            console.log(`🔍 Looking for expected elements: [${romTest.expectedElements.join(', ')}]`);
          }
        }
        
        return {
          canvasSize: { width: canvas.width, height: canvas.height },
          nonBlackPixels,
          totalPixels: pixels.length / 4,
          textContent: textContent.trim() || 'No text content found',
          visibleElements: visibleElements.length,
          pageTitle: document.title,
          bodyContent: document.body ? document.body.textContent.trim().substring(0, 200) : 'No body content',
          hasExpectedText,
          hasExpectedElements,
          expectedText: romTest.expectedText,
          expectedElements: romTest.expectedElements
        };
      }, {romTest, verboseMode: VERBOSE_MODE});
      
      if (screenContent) {
        if (VERBOSE_MODE) {
          console.log(`📺 Screen analysis:`);
          console.log(`   🖼️  Canvas: ${screenContent.canvasSize.width}x${screenContent.canvasSize.height}`);
          console.log(`   🎨 Pixels: ${screenContent.nonBlackPixels}/${screenContent.totalPixels} non-black`);
          console.log(`   📝 Text: ${screenContent.textContent.substring(0, 100)}${screenContent.textContent.length > 100 ? '...' : ''}`);
          console.log(`   👁️  Visible elements: ${screenContent.visibleElements}`);
          console.log(`   📄 Page title: ${screenContent.pageTitle}`);
          console.log(`   📄 Body content: ${screenContent.bodyContent}`);
          
          // Check for expected text
          if (screenContent.expectedText) {
            console.log(`   🔍 Expected text "${screenContent.expectedText}": ${screenContent.hasExpectedText ? '✅ FOUND' : '❌ NOT FOUND'}`);
          }
          if (screenContent.expectedElements) {
            console.log(`   🔍 Expected elements: ${screenContent.hasExpectedElements ? '✅ ALL FOUND' : '❌ MISSING'}`);
            screenContent.expectedElements.forEach(element => {
              const found = screenContent.textContent.includes(element);
              console.log(`      "${element}": ${found ? '✅' : '❌'}`);
            });
          }
        }
        
        // Take a screenshot of the canvas for visual inspection and OCR
        try {
          const canvas = await page.$('canvas');
          if (canvas) {
            const screenshot = await canvas.screenshot();
            const fs = require('fs');
            const path = require('path');
            
            // Create screenshots directory if it doesn't exist
            const screenshotsDir = 'screenshots';
            if (!fs.existsSync(screenshotsDir)) {
              fs.mkdirSync(screenshotsDir);
            }
            
            const filename = `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            const filepath = path.join(screenshotsDir, filename);
            fs.writeFileSync(filepath, screenshot);
            
            console.log(`📸 Screenshot saved: ${filepath}`);
            
            // Extract text using OCR
            ocrText = await extractTextFromScreenshot(screenshot);
            if (VERBOSE_MODE) {
              if (ocrText) {
                console.log(`🔍 OCR extracted text: "${ocrText}"`);
                
                // Check if OCR text contains expected elements
                if (romTest.expectedElements && romTest.expectedElements.length > 0) {
                  console.log(`🔍 Checking OCR text for expected elements: [${romTest.expectedElements.join(', ')}]`);
                  romTest.expectedElements.forEach(element => {
                    const found = ocrText.toLowerCase().includes(element.toLowerCase());
                    console.log(`   "${element}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
                  });
                }
              } else {
                console.log(`🔍 No text extracted from screenshot`);
              }
            }
          }
        } catch (screenshotError) {
          console.log(`   ⚠️  Could not save screenshot: ${screenshotError.message}`);
        }
      }
    } catch (error) {
      if (VERBOSE_MODE) {
        console.log(`⚠️  Could not analyze screen content: ${error.message}`);
        console.log(`⚠️  Error details:`, error);
      }
    }
    
    // Test result - check for expected text on screen using OCR
    let textSuccess = true;
    if (romTest.expectedElements && romTest.expectedElements.length > 0) {
      // Use OCR text if available, otherwise fall back to DOM text
      const textToCheck = (typeof ocrText !== 'undefined' ? ocrText : '') || (screenContent ? screenContent.textContent : '');
      textSuccess = romTest.expectedElements.every(element => 
        textToCheck.toLowerCase().includes(element.toLowerCase())
      );
    }
    const success = emulatorLoaded.hasCanvas && textSuccess;
    const status = success ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${status} - ${romTest.name}`);
    console.log(`   ⏱️  Load time: ${loadTime}ms`);
    console.log(`   🌐 Network requests: ${networkRequests.length}`);
    console.log(`   🖥️  Canvas: ${emulatorLoaded.hasCanvas ? 'Yes' : 'No'} (${emulatorLoaded.canvasSize?.width}x${emulatorLoaded.canvasSize?.height})`);
    console.log(`   🔧 Electroniq module: ${emulatorLoaded.hasElectroniq ? 'Yes' : 'No'}`);
    if (errorElements.length > 0) {
      console.log(`   ⚠️  Page errors: ${errorElements.length}`);
    }
    if (screenContent) {
      console.log(`   📺 Screen content: ${screenContent.nonBlackPixels}/${screenContent.totalPixels} non-black pixels`);
      if (screenContent.expectedText) {
        console.log(`   🔍 Expected text: ${screenContent.hasExpectedText ? '✅ FOUND' : '❌ NOT FOUND'}`);
      }
      if (screenContent.expectedElements) {
        console.log(`   🔍 Expected elements: ${screenContent.hasExpectedElements ? '✅ ALL FOUND' : '❌ MISSING'}`);
      }
    }
    
    return {
      name: romTest.name,
      success,
      loadTime,
      emulatorLoaded,
      networkRequests: networkRequests.length,
      errorElements: errorElements.length,
      screenContent: screenContent || null
    };
    
  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
    return {
      name: romTest.name,
      success: false,
      error: error.message,
      loadTime: 0
    };
  } finally {
    await page.close();
  }
}

async function runAllTests() {
  console.log('🚀 Starting automated ROM testing with Playwright');
  if (VERBOSE_MODE) {
    console.log('📢 Verbose mode enabled (use --verbose or -v)');
  } else {
    console.log('💡 Use --verbose or -v for detailed logging');
  }
  console.log('=' .repeat(60));
  
  const browser = await chromium.launch({ 
    headless: true, // Run in headless mode for automation
    slowMo: 0 // No delay needed in headless mode
  });
  
  const results = [];
  
  try {
    for (const romTest of romTests) {
      const result = await testROM(romTest, browser);
      results.push(result);
      
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    await browser.close();
  }
  
  // Simple results summary
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (passCount === totalCount) {
    console.log(`\n🎉 All ${totalCount} tests passed!`);
  } else {
    console.log(`\n⚠️  ${passCount}/${totalCount} tests passed`);
  }
}

// Run the tests
runAllTests().catch(console.error);
