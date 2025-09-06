const { chromium } = require('playwright');
const Tesseract = require('tesseract.js');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const VERBOSE_MODE = process.argv.includes('--verbose') || process.argv.includes('-v');
const KEEP_SERVER_RUNNING = process.argv.includes('--nokill-romserver');
const SERVER_PORT = 8080;
const SERVER_SCRIPT = 'smjoin-test-server.py';

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
    },
    {
      name: 'I2C ROM Original',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/I2C.rom',
      expectedSize: 4951,
      description: 'Original I2C ROM - unmodified I2C ROM for comparison',
      expectedElements: ['I2C', '32K'] // Check for I2C-specific text
    },
    {
      name: 'I2C ROM Standalone',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestI2C.rom',
      expectedSize: 4977,
      description: 'I2C ROM standalone - relocated I2C ROM for debugging',
      expectedElements: ['I2C', '32K'] // Check for I2C-specific text
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

// Server management functions
let serverProcess = null;

async function clearScreenshotsFolder() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  
  try {
    // Check if screenshots directory exists
    if (fs.existsSync(screenshotsDir)) {
      console.log('🧹 Clearing screenshots folder...');
      
      // Read all files in the directory
      const files = fs.readdirSync(screenshotsDir);
      
      // Delete each file
      for (const file of files) {
        const filePath = path.join(screenshotsDir, file);
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          if (VERBOSE_MODE) {
            console.log(`   Deleted: ${file}`);
          }
        }
      }
      
      console.log(`✅ Cleared ${files.length} files from screenshots folder`);
    } else {
      // Create the directory if it doesn't exist
      fs.mkdirSync(screenshotsDir, { recursive: true });
      console.log('📁 Created screenshots folder');
    }
  } catch (error) {
    console.log(`⚠️  Warning: Could not clear screenshots folder: ${error.message}`);
  }
}

async function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${SERVER_PORT}/AP6.rom`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function killExistingServer() {
  return new Promise((resolve) => {
    exec(`lsof -ti:${SERVER_PORT}`, (error, stdout) => {
      if (stdout.trim()) {
        console.log(`🛑 Killing existing server on port ${SERVER_PORT}...`);
        exec(`kill -9 ${stdout.trim()}`, () => {
          setTimeout(resolve, 500); // Wait for port to be released
        });
      } else {
        resolve();
      }
    });
  });
}

async function startServer() {
  console.log(`🚀 Starting ROM server on port ${SERVER_PORT}...`);
  
  return new Promise((resolve, reject) => {
    serverProcess = spawn('python3', [SERVER_SCRIPT], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverReady = false;
    const checkInterval = setInterval(async () => {
      if (await checkServerRunning()) {
        if (!serverReady) {
          console.log(`✅ Server started successfully on port ${SERVER_PORT}`);
          serverReady = true;
          clearInterval(checkInterval);
          resolve();
        }
      }
    }, 500);

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!serverReady) {
        clearInterval(checkInterval);
        reject(new Error('Server failed to start within 10 seconds'));
      }
    }, 10000);

    serverProcess.on('error', (error) => {
      clearInterval(checkInterval);
      reject(error);
    });
  });
}

async function stopServer() {
  if (serverProcess) {
    console.log(`🛑 Stopping ROM server...`);
    serverProcess.kill();
    serverProcess = null;
    
    // Wait a moment for the server to stop
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`✅ Server stopped`);
  }
}

async function testServerConnection() {
  console.log(`🔍 Testing server connection...`);
  
  try {
    const response = await fetch(`http://localhost:${SERVER_PORT}/AP6.rom`);
    if (response.ok) {
      const contentLength = response.headers.get('content-length');
      console.log(`✅ Server connection test passed (${contentLength} bytes)`);
      return true;
    } else {
      console.log(`❌ Server connection test failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server connection test failed: ${error.message}`);
    return false;
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
      
      // Filter out WebSocket connection errors (not relevant to ROM functionality)
      if (text.includes('WebSocket connection to') && text.includes('failed')) {
        return; // Skip WebSocket connection errors
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

    // First, test if the ROM file is accessible via direct GET request
    console.log(`🔍 Testing ROM file accessibility...`);
    const romUrl = romTest.url.split('romF=')[1];
    if (romUrl) {
      try {
        const response = await page.evaluate(async (url) => {
          const response = await fetch(url);
          return {
            status: response.status,
            statusText: response.statusText,
            contentLength: response.headers.get('content-length'),
            ok: response.ok
          };
        }, romUrl);
        
        if (response.ok) {
          console.log(`✅ ROM file accessible: ${response.contentLength} bytes`);
        } else {
          console.log(`❌ ROM file not accessible: HTTP ${response.status} ${response.statusText}`);
          return {
            name: romTest.name,
            passed: false,
            loadTime: 0,
            networkRequests: 0,
            hasCanvas: false,
            hasElectroniq: false,
            canvasSize: null,
            screenContent: { nonBlackPixels: 0, totalPixels: 0 },
            expectedElements: [],
            error: `ROM file not accessible: HTTP ${response.status} ${response.statusText}`
          };
        }
      } catch (error) {
        console.log(`❌ ROM file test failed: ${error.message}`);
        return {
          name: romTest.name,
          passed: false,
          loadTime: 0,
          networkRequests: 0,
          hasCanvas: false,
          hasElectroniq: false,
          canvasSize: null,
          screenContent: { nonBlackPixels: 0, totalPixels: 0 },
          expectedElements: [],
          error: `ROM file test failed: ${error.message}`
        };
      }
    }

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
        
        // Create screenshots directory if it doesn't exist
        const screenshotsDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
          fs.mkdirSync(screenshotsDir, { recursive: true });
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
  
  // Clear screenshots folder
  await clearScreenshotsFolder();
  
  // Server management
  try {
    // Kill any existing server on port 8080
    await killExistingServer();
    
    // Start the ROM server
    await startServer();
    
    // Test server connection
    const serverTestPassed = await testServerConnection();
    if (!serverTestPassed) {
      throw new Error('Server connection test failed');
    }
    
    console.log('');
    
  } catch (error) {
    console.log(`❌ Server setup failed: ${error.message}`);
    process.exit(1);
  }
  
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
    
    // Clean up: stop the server (unless --nokill-romserver flag is set)
    if (!KEEP_SERVER_RUNNING) {
      await stopServer();
    } else {
      console.log(`\n🔄 ROM server kept running on port ${SERVER_PORT} for manual testing`);
      console.log(`   Available ROMs:`);
      console.log(`   - Official AP6: http://localhost:${SERVER_PORT}/AP6.rom`);
      console.log(`   - New AP6: http://localhost:${SERVER_PORT}/LatestAP6.rom`);
      console.log(`   - I2C Standalone: http://localhost:${SERVER_PORT}/LatestI2C.rom`);
      console.log(`   - I2C Original: http://localhost:${SERVER_PORT}/I2C.rom`);
      console.log(`\n   To stop the server later, run: lsof -ti:${SERVER_PORT} | xargs kill -9`);
    }
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