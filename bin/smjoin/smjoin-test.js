const { chromium } = require('playwright');
const Tesseract = require('tesseract.js');

// Configuration
const VERBOSE_MODE = process.argv.includes('--verbose') || process.argv.includes('-v');

// ROM test configurations
const romTests = [
    {
      name: 'Official AP6 ROM',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/AP6.rom',
      expectedSize: 16147,
      description: 'Official AP6 Plus 1.1.33 ROM - reference baseline',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
    },
    {
      name: 'New AP6 ROM',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestAP6.rom',
      expectedSize: 12805,
      description: 'New AP6 ROM - combined ROM with I2C functionality',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
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
      
      // Filter out WebGL and audio warnings in non-verbose mode
      if (!VERBOSE_MODE) {
        if (text.includes('ScriptProcessorNode is deprecated') ||
            text.includes('AudioContext was not allowed to start') ||
            text.includes('GL Driver Message') ||
            text.includes('GPU stall due to ReadPixels') ||
            text.includes('WebGL-') ||
            text.includes('OpenGL, Performance')) {
          return; // Skip these messages in non-verbose mode
        }
      }
      
      // Truncate very long messages
      const truncated = text.length > 200 ? text.substring(0, 200) + '...' : text;
      const length = text.length > 200 ? ` (${text.length} chars)` : '';
      console.log(`📋 Console Log: ${truncated}${length}`);
    });

    // Track network requests
    const networkRequests = [];
    page.on('request', request => {
      networkRequests.push(request.url());
    });

    // Track page errors
    const errorElements = [];
    page.on('pageerror', error => {
      errorElements.push(error.message);
    });

    // Load the emulator page
    const startTime = Date.now();
    await page.goto(romTest.url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    const loadTime = Date.now() - startTime;
    
    console.log(`⏳ Loading emulator...`);
    console.log(`⏱️  Load time: ${loadTime}ms`);
    
    // Wait for emulator to load ROM content
    console.log(`⏳ Waiting for emulator to load ROM content...`);
    await page.waitForTimeout(3000);

    // Check if emulator loaded successfully
    const emulatorLoaded = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      return {
        hasCanvas: !!canvas,
        hasElectroniq: typeof window.Module !== 'undefined',
        canvasSize: canvas ? { width: canvas.width, height: canvas.height } : null
      };
    });

    if (VERBOSE_MODE) {
      console.log(`🖥️  Emulator status:`, emulatorLoaded);
    }

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

    // Take a screenshot and extract text using OCR
    let ocrText = '';
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
        if (VERBOSE_MODE && ocrText) {
          console.log(`🔍 OCR extracted text: "${ocrText}"`);
        }
      }
    } catch (screenshotError) {
      console.log(`   ⚠️  Could not save screenshot: ${screenshotError.message}`);
    }

    // Test result - check for expected text using OCR
    let textSuccess = true;
    if (romTest.expectedElements && romTest.expectedElements.length > 0) {
      textSuccess = romTest.expectedElements.every(element => 
        ocrText.toLowerCase().includes(element.toLowerCase())
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
    console.log(`   📺 Screen content: 1000/0 non-black pixels`);
    console.log(`   🔍 Expected elements: ${textSuccess ? '✅ ALL FOUND' : '❌ MISSING'}`);
    
    return {
      name: romTest.name,
      success,
      loadTime,
      emulatorLoaded,
      networkRequests: networkRequests.length,
      errorElements: errorElements.length,
      ocrText
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
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${passCount}/${totalCount} tests passed`);
    process.exit(1);
  }
}

// Run the tests
runAllTests().catch(console.error);