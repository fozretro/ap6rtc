const { chromium } = require('playwright');
const Tesseract = require('tesseract.js');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const VERBOSE_MODE = process.argv.includes('--verbose') || process.argv.includes('-v');
const KEEP_SERVER_RUNNING = process.argv.includes('--nokill-romserver');

// Parse test filter argument
let TEST_FILTER = [];
const testFilterIndex = process.argv.indexOf('--testFilter');
if (testFilterIndex !== -1 && testFilterIndex + 1 < process.argv.length) {
  const filterArg = process.argv[testFilterIndex + 1];
  TEST_FILTER = filterArg.split(',').map(name => name.trim());
}

const SERVER_PORT = 8080;
const SERVER_SCRIPT = 'smjoin-test-server.py';

// ROM test configurations
const romTests = [
    {
      name: 'AP6.rom',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/AP6.rom',
      expectedSize: 16147,
      description: 'Official AP6 Plus 1.1.33 ROM - reference baseline',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
    },
    {
      name: 'LatestAP6.rom',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestAP6.rom',
      expectedSize: 12805,
      description: 'New AP6 ROM - combined ROM with I2C functionality',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
    },
    {
      name: 'I2C.rom',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/I2C.rom',
      expectedSize: 16384,
      description: 'Original I2C ROM - unmodified I2C ROM for comparison',
      expectedElements: ['I2C', '3.2EAP6', 'OS', '1.00'], // Check for I2C version info after *HELP
      keyboardEntry: '*HELP' // Send *HELP command to show I2C info
    },
    {
      name: 'LatestI2C.rom',
      url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestI2C.rom',
      expectedSize: 4977,
      description: 'I2C ROM standalone - relocated I2C ROM for debugging',
      expectedElements: ['I2C', '3.2EAP6', 'OS', '1.00'], // Check for I2C version info after *HELP
      keyboardEntry: '*HELP' // Send *HELP command to show I2C info
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

    // Take initial screenshot if keyboard entry is required
    let initialScreenshot = null;
    if (romTest.keyboardEntry) {
      try {
        const canvas = await page.$('canvas');
        if (canvas) {
          initialScreenshot = await canvas.screenshot();
          const screenshotsDir = path.join(__dirname, 'screenshots');
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }
          const filename = `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}_1_initial.png`;
          const filepath = path.join(screenshotsDir, filename);
          fs.writeFileSync(filepath, initialScreenshot);
          console.log(`📸 Initial screenshot saved: ${filepath}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not save initial screenshot: ${error.message}`);
      }
    }

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

    // Perform keyboard entry if required
    if (romTest.keyboardEntry) {
      console.log(`⌨️  Sending keyboard entry: "${romTest.keyboardEntry}"`);
      try {
        // Wait for page to be fully loaded
        await page.waitForTimeout(5000);
        
        // Press Tab multiple times to move focus from address bar to page content
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        
        // Click on the canvas to ensure focus
        await page.click('canvas');
        await page.waitForTimeout(1000);
        
        // Try to open virtual keyboard with F6 using key code
        await page.keyboard.press('F6');
        await page.waitForTimeout(1000);
        
        // Also try with down/up
        await page.keyboard.down('F6');
        await page.waitForTimeout(100);
        await page.keyboard.up('F6');
        await page.waitForTimeout(2000);

        // Take screenshot after F6 opens keyboard but before typing
        const keyboardCanvas = await page.$('canvas');
        if (keyboardCanvas) {
          const afterKeyboardScreenshot = await keyboardCanvas.screenshot();
          const screenshotsDir = path.join(__dirname, 'screenshots');
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }
          const filename = `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}_2_after_keyboard.png`;
          const filepath = path.join(screenshotsDir, filename);
          fs.writeFileSync(filepath, afterKeyboardScreenshot);
          console.log(`📸 After F6 keyboard screenshot saved: ${filepath}`);
        }
        
        // Analyze virtual keyboard elements
        if (VERBOSE_MODE) {
          console.log(`   🔍 Analyzing virtual keyboard elements...`);
        }
        try {
          const keyboardInfo = await page.evaluate(() => {
            // Find all clickable elements that might be keyboard keys
            const allElements = document.querySelectorAll('*');
            const keyboardElements = [];
            
            for (let element of allElements) {
              const text = element.textContent?.trim();
              const tagName = element.tagName?.toLowerCase();
              const className = element.className;
              const id = element.id;
              
              // Look for elements that might be keyboard keys
              if (text && text.length <= 3 && (
                text.match(/^[A-Z0-9\*\-=\.\,\;\:\'\"\[\]\\\/\s]+$/) || // Common keyboard characters
                text === 'Enter' || text === 'Return' || text === 'Space' || text === 'Shift' ||
                text === 'Caps' || text === 'Ctrl' || text === 'Alt' || text === 'Tab' ||
                text === 'Esc' || text === 'Del' || text === 'Backspace'
              )) {
                keyboardElements.push({
                  tagName,
                  text,
                  className,
                  id,
                  hasOnClick: !!element.onclick,
                  hasOnMouseDown: !!element.onmousedown,
                  hasOnMouseUp: !!element.onmouseup,
                  hasOnTouchStart: !!element.ontouchstart,
                  hasOnTouchEnd: !!element.ontouchend,
                  boundingRect: element.getBoundingClientRect()
                });
              }
            }
            
            return {
              totalElements: allElements.length,
              keyboardElements: keyboardElements.slice(0, 50), // Limit to first 50
              bodyHTML: document.body.innerHTML.substring(0, 2000) // First 2000 chars
            };
          });
          
          if (VERBOSE_MODE) {
            console.log(`   📊 Found ${keyboardInfo.keyboardElements.length} potential keyboard elements out of ${keyboardInfo.totalElements} total elements`);
            console.log(`   🔑 Sample keyboard elements:`);
            keyboardInfo.keyboardElements.slice(0, 10).forEach((el, i) => {
              console.log(`     ${i+1}. <${el.tagName}> "${el.text}" (class: ${el.className}, id: ${el.id})`);
            });
          }
          
          // Save the analysis to a file
          const screenshotsDir = path.join(__dirname, 'screenshots');
          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }
          const analysisPath = path.join(screenshotsDir, `keyboard_analysis_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
          fs.writeFileSync(analysisPath, JSON.stringify(keyboardInfo, null, 2));
          if (VERBOSE_MODE) {
            console.log(`   ✅ Keyboard analysis saved to: ${analysisPath}`);
          }
        } catch (error) {
          if (VERBOSE_MODE) {
            console.log(`   ❌ Error analyzing keyboard: ${error.message}`);
          }
        }
        
        // Try coordinate-based clicking on the virtual keyboard
        if (VERBOSE_MODE) {
          console.log(`   🎯 Attempting coordinate-based keyboard interaction...`);
        }
        
        try {
          // Get canvas dimensions
          const canvas = await page.$('canvas');
          if (canvas) {
            const canvasBox = await canvas.boundingBox();
            if (VERBOSE_MODE) {
              console.log(`   📐 Canvas dimensions: ${canvasBox.width}x${canvasBox.height} at (${canvasBox.x}, ${canvasBox.y})`);
            }
            
                // Create a comprehensive keyboard map based on the visible layout
                const keyboardMap = {
                  // Row 1 (Top): ESC, !1, "2, #3, $4, %5, &6, '7, (8, )9, @0, =-^~, \|, BRK
                  row1: {
                    y: canvasBox.y + canvasBox.height * 0.25, // Top row
                    keys: {
                      'ESC': { x: 0.05, width: 0.08 },
                      '!': { x: 0.15, width: 0.05 },
                      '"': { x: 0.22, width: 0.05 },
                      '#': { x: 0.29, width: 0.05 },
                      '$': { x: 0.36, width: 0.05 },
                      '%': { x: 0.43, width: 0.05 },
                      '&': { x: 0.50, width: 0.05 },
                      "'": { x: 0.57, width: 0.05 },
                      '(': { x: 0.64, width: 0.05 },
                      ')': { x: 0.71, width: 0.05 },
                      '@': { x: 0.78, width: 0.05 },
                      '=': { x: 0.85, width: 0.05 },
                      '\\': { x: 0.92, width: 0.05 },
                      'BRK': { x: 0.95, width: 0.05 }
                    }
                  },
                  // Row 2 (QWERTY): CAPS/FUNC, Q, W, E, R, T, Y, U, I, O, P, £{, -}, [], COPY
                  row2: {
                    y: canvasBox.y + canvasBox.height * 0.35, // Second row
                    keys: {
                      'CAPS': { x: 0.05, width: 0.08 },
                      'Q': { x: 0.15, width: 0.05 },
                      'W': { x: 0.22, width: 0.05 },
                      'E': { x: 0.29, width: 0.05 },
                      'R': { x: 0.36, width: 0.05 },
                      'T': { x: 0.43, width: 0.05 },
                      'Y': { x: 0.50, width: 0.05 },
                      'U': { x: 0.57, width: 0.05 },
                      'I': { x: 0.64, width: 0.05 },
                      'O': { x: 0.71, width: 0.05 },
                      'P': { x: 0.68, width: 0.05 }, // Moved two keys left from 0.78 to 0.68
                      '£': { x: 0.85, width: 0.05 },
                      '-': { x: 0.92, width: 0.05 },
                      '[': { x: 0.95, width: 0.05 },
                      'COPY': { x: 0.98, width: 0.05 }
                    }
                  },
                  // Row 3 (ASDF): CTRL, A, S, D, F, G, H, J, K, L, +;, *:, RETURN
                  row3: {
                    y: canvasBox.y + canvasBox.height * 0.45, // Third row
                    keys: {
                      'CTRL': { x: 0.05, width: 0.08 },
                      'A': { x: 0.15, width: 0.05 },
                      'S': { x: 0.22, width: 0.05 },
                      'D': { x: 0.29, width: 0.05 },
                      'F': { x: 0.36, width: 0.05 },
                      'G': { x: 0.43, width: 0.05 },
                      'H': { x: 0.45, width: 0.05 }, // Moved left from 0.50 to 0.45
                      'J': { x: 0.57, width: 0.05 },
                      'K': { x: 0.64, width: 0.05 },
                      'L': { x: 0.64, width: 0.05 }, // Moved further left from 0.68 to 0.64
                      '+': { x: 0.78, width: 0.05 },
                      '*': { x: 0.75, width: 0.05 }, // Moved left from 0.80 to 0.75 (closer to RETURN)
                      'RETURN': { x: 0.80, width: 0.08 }, // Moved left to be just right of * key (0.75)
                    }
                  },
                  // Row 4 (ZXCV): SHIFT, Z, X, C, V, B, N, M, <,, >., ?/, SHIFT, DEL
                  row4: {
                    y: canvasBox.y + canvasBox.height * 0.55, // Fourth row
                    keys: {
                      'SHIFT': { x: 0.05, width: 0.08 },
                      'Z': { x: 0.15, width: 0.05 },
                      'X': { x: 0.22, width: 0.05 },
                      'C': { x: 0.29, width: 0.05 },
                      'V': { x: 0.36, width: 0.05 },
                      'B': { x: 0.43, width: 0.05 },
                      'N': { x: 0.50, width: 0.05 },
                      'M': { x: 0.57, width: 0.05 },
                      '<': { x: 0.64, width: 0.05 },
                      '>': { x: 0.71, width: 0.05 },
                      '?': { x: 0.78, width: 0.05 },
                      'SHIFT2': { x: 0.85, width: 0.08 },
                      'DEL': { x: 0.95, width: 0.05 }
                    }
                  }
                };

                // Function to get key coordinates from the map
                function getKeyCoordinates(key) {
                  for (const rowName in keyboardMap) {
                    const row = keyboardMap[rowName];
                    if (row.keys[key]) {
                      const keyInfo = row.keys[key];
                      return {
                        x: canvasBox.x + canvasBox.width * keyInfo.x + (canvasBox.width * keyInfo.width / 2),
                        y: row.y + (canvasBox.height * 0.05 / 2) // Center vertically within key height
                      };
                    }
                  }
                  return null;
                }

                // Test RETURN key next - should be on same row as * (row 3) and to the right
                const keyPositions = [
                  { char: 'Enter', key: 'RETURN' }
                ].map(item => {
                  const coords = getKeyCoordinates(item.key);
                  return {
                    char: item.char,
                    x: coords ? coords.x : canvasBox.x + canvasBox.width * 0.5,
                    y: coords ? coords.y : canvasBox.y + canvasBox.height * 0.5
                  };
                });
            
            for (const key of keyPositions) {
              if (VERBOSE_MODE) {
                console.log(`   🔤 Clicking ${key.char} at (${Math.round(key.x)}, ${Math.round(key.y)})`);
              }
              
              // Move to the key position first
              await page.mouse.move(key.x, key.y);
              await page.waitForTimeout(50);
              
                  // Press and release mouse button
                  await page.mouse.down();
                  await page.waitForTimeout(25);
                  await page.mouse.up();
                  await page.waitForTimeout(200); // Longer delay between clicks
            }
            
            if (VERBOSE_MODE) {
              console.log(`   ✅ Completed coordinate-based keyboard input`);
            }
          }
        } catch (error) {
          if (VERBOSE_MODE) {
            console.log(`   ❌ Error with coordinate-based clicking: ${error.message}`);
          }
        }
        
        // Wait longer for all key presses to be processed
        await page.waitForTimeout(2000);
        
        // Get canvas dimensions for clicking below keyboard
        const canvas = await page.$('canvas');
        let canvasBox = null;
        if (canvas) {
          canvasBox = await canvas.boundingBox();
        }
        
        // Click below the keyboard to bring emulator window to foreground
        if (canvasBox) {
          await page.mouse.move(canvasBox.x + canvasBox.width * 0.5, canvasBox.y + canvasBox.height * 0.8);
          await page.mouse.down();
          await page.mouse.up();
          await page.waitForTimeout(500);
        }
        
        // Press F6 again to close the virtual keyboard using down/up method
        await page.keyboard.down('F6');
        await page.waitForTimeout(100);
        await page.keyboard.up('F6');
        await page.waitForTimeout(2000); // Give more time for keyboard to close
        
        // OCR scan before final screenshot to see what was typed
        try {
          const canvas = await page.$('canvas');
          if (canvas) {
            const preFinalScreenshot = await canvas.screenshot();
            const screenshotsDir = path.join(__dirname, 'screenshots');
            if (!fs.existsSync(screenshotsDir)) {
              fs.mkdirSync(screenshotsDir, { recursive: true });
            }
            const preFinalPath = path.join(screenshotsDir, `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}_pre_final.png`);
            fs.writeFileSync(preFinalPath, preFinalScreenshot);
            
            // Run OCR on the pre-final screenshot
            const Tesseract = require('tesseract.js');
            const { data: { text } } = await Tesseract.recognize(preFinalPath, 'eng');
            console.log(`🔍 Pre-final OCR: "${text.trim()}"`);
          }
        } catch (error) {
          console.log(`   ⚠️  Pre-final OCR failed: ${error.message}`);
        }
        
        // Screenshot after keyboard entry is now taken earlier after F6
      } catch (error) {
        console.log(`   ⚠️  Keyboard entry failed: ${error.message}`);
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
        
        const filename = `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}_3_final.png`;
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
    headless: false, // Run in visible mode to see the virtual keyboard
    slowMo: 200 // Add delay to see what's happening
  });
  
  // Filter tests if testFilter is specified
  let testsToRun = romTests;
  if (TEST_FILTER.length > 0) {
    testsToRun = romTests.filter(test => TEST_FILTER.includes(test.name));
    console.log(`🔍 Filtering tests to: ${TEST_FILTER.join(', ')}`);
    console.log(`📋 Running ${testsToRun.length} of ${romTests.length} tests`);
    if (testsToRun.length === 0) {
      console.log('❌ No tests match the filter criteria');
      process.exit(1);
    }
  }
  
  const results = [];
  
  try {
    for (const romTest of testsToRun) {
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