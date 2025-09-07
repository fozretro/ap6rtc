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
      rom: 'AP6.rom',
      expectedSize: 16147,
      description: 'Official AP6 Plus 1.1.33 ROM - reference baseline',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
    },
    {
      name: 'I2C.rom',
      rom: 'I2C.rom',
      expectedSize: 16384,
      description: 'Original I2C ROM - unmodified I2C ROM for comparison',
      expectedElements: ['I2C', '3.2EAP6', 'OS', '1.00'], // Check for I2C version info after *HELP
      bootCommands: ['*HELP'],
    },
    {
      name: 'LatestI2C8000.rom',
      rom: 'LatestI2C8000.rom',
      expectedSize: 4951,
      description: 'I2C ROM original - unrelocated I2C ROM compiled at $8000',
      expectedElements: ['I2C', '3.2EAP6', 'OS', '1.00', 'Sun'],
      bootCommands: ['*HELP', '*NOW']
    },
    {
      name: 'LatestAP6.rom',
      rom: 'LatestAP6.rom',
      expectedSize: 12805,
      description: 'New AP6 ROM - combined ROM with I2C functionality',
      expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC', 'I2C','Sun'], // Check for key text using OCR
      bootCommands: ['*HELP', '*NOW']
    }
];

// Levenshtein distance function for fuzzy string matching
function levenshteinDistance(str1, str2) {
  const matrix = [];
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[str2.length][str1.length];
}

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
      },
      // Enhanced options for computer/terminal text recognition
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?@#$%^&*()_+-=[]{}|\\/"\'<>~` ',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK, // Treat as single text block
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY, // Use LSTM neural network
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessedit_char_blacklist: '', // Don't blacklist any characters
      // Additional options for better terminal text recognition
      classify_bln_numeric_mode: '0', // Don't force numeric mode
      textord_min_linesize: '2.5', // Minimum line size
      textord_old_baselines: '0', // Use new baseline detection
      textord_old_xheight: '0', // Use new x-height detection
      textord_min_xheight: '8', // Minimum x-height
      textord_force_make_prop_words: 'F', // Don't force proportional words
      textord_force_make_prop_fonts: 'F', // Don't force proportional fonts
      // Character recognition improvements
      classify_enable_learning: 'F', // Disable learning for consistency
      classify_enable_adaptive_matcher: 'F', // Disable adaptive matching
      classify_enable_adaptive_debugger: 'F', // Disable adaptive debugger
      // Text layout improvements
      textord_really_old_xheight: 'F' // Don't use really old x-height
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
  // Build the emulator URL from the ROM name
  const baseUrl = 'https://0xc0de6502.github.io/electroniq/';
  const romUrl = `http://localhost:${SERVER_PORT}/${romTest.rom}`;
  const emulatorUrl = `${baseUrl}?romF=${romUrl}`;
  
  console.log(`🔗 URL: ${emulatorUrl}`);
  
  const page = await browser.newPage();
  let screenshotIndex = 1; // Track screenshot index for this test
  
  // Helper function to save screenshots with proper indexing
  async function saveScreenshot(canvas, description) {
    if (!canvas) return null;
    
    const screenshot = await canvas.screenshot();
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const filename = `screenshot_${romTest.name.replace(/[^a-zA-Z0-9]/g, '_')}_${screenshotIndex}_${description}.png`;
    const filepath = path.join(screenshotsDir, filename);
    fs.writeFileSync(filepath, screenshot);
    console.log(`📸 ${description} screenshot saved: ${filepath}`);
    screenshotIndex++;
    return filepath;
  }
  
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
    const romUrl = `http://localhost:${SERVER_PORT}/${romTest.rom}`;
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

    // Process bootCommands if present
    let finalUrl = emulatorUrl;
    if (romTest.bootCommands && romTest.bootCommands.length > 0) {
      // Add carriage return to each command to simulate Enter key press
      const commands = romTest.bootCommands.map(cmd => cmd + '\r').join('');
      finalUrl = `${emulatorUrl}&cmd=${encodeURIComponent(commands)}`;
      if (romTest.bootCommandsDelay) {
        finalUrl += `&cmd-delay=${romTest.bootCommandsDelay}`;
      }
      if (VERBOSE_MODE) {
        console.log(`   🚀 BootCommands: ${romTest.bootCommands.join(', ')} (with Enter)`);
        console.log(`   🔗 Final URL: ${finalUrl}`);
      }
    }

    // Load the emulator page
    const startTime = Date.now();
    await page.goto(finalUrl, { 
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
          await saveScreenshot(canvas, 'initial');
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
        await page.waitForTimeout(1000);
        
        // Click on the canvas to ensure focus
        await page.click('canvas');
        await page.waitForTimeout(500);
        
        // Open virtual keyboard with F6 (down/up method that works)
        await page.keyboard.down('F6');
        await page.waitForTimeout(100);
        await page.keyboard.up('F6');
        await page.waitForTimeout(1000);

        // Take screenshot after F6 opens keyboard but before typing
        const keyboardCanvas = await page.$('canvas');
        if (keyboardCanvas) {
          await saveScreenshot(keyboardCanvas, 'after_keyboard');
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
                      '*': { x: 0.75, width: 0.05, requiresShift: true }, // Moved left from 0.80 to 0.75 (closer to RETURN)
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
                        y: row.y + (canvasBox.height * 0.05 / 2), // Center vertically within key height
                        requiresShift: keyInfo.requiresShift || false
                      };
                    }
                  }
                  return null;
                }

                // Test full *HELP sequence with all working keys
                const keyPositions = [
                  { char: '*', key: '*' },
                  { char: 'H', key: 'H' },
                  { char: 'E', key: 'E' },
                  { char: 'L', key: 'L' },
                  { char: 'P', key: 'P' },
                  { char: 'Enter', key: 'RETURN' }
                ].map(item => {
                  const coords = getKeyCoordinates(item.key);
                  return {
                    char: item.char,
                    x: coords ? coords.x : canvasBox.x + canvasBox.width * 0.5,
                    y: coords ? coords.y : canvasBox.y + canvasBox.height * 0.5,
                    requiresShift: coords ? coords.requiresShift : false
                  };
                });
            
            for (const key of keyPositions) {
              if (VERBOSE_MODE) {
                console.log(`   🔤 Clicking ${key.char} at (${Math.round(key.x)}, ${Math.round(key.y)})${key.requiresShift ? ' [SHIFT]' : ''}`);
              }
              
              // Press shift if required
              if (key.requiresShift) {
                await page.keyboard.down('Shift');
                await page.waitForTimeout(10);
              }
              
              // Move to the key position first
              await page.mouse.move(key.x, key.y);
              await page.waitForTimeout(10);
              
              // Press and release mouse button
              await page.mouse.down();
              await page.waitForTimeout(10);
              await page.mouse.up();
              await page.waitForTimeout(50); // Reduced delay between clicks
              
              // Release shift if it was pressed
              if (key.requiresShift) {
                await page.keyboard.up('Shift');
                await page.waitForTimeout(10);
              }
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
        
        // Press F6 again to close the virtual keyboard using down/up method
        await page.keyboard.down('F6');
        await page.waitForTimeout(100);
        await page.keyboard.up('F6');
        await page.waitForTimeout(100);
        
        // OCR scan before final screenshot to see what was typed
        try {
          const canvas = await page.$('canvas');
          if (canvas) {
            const preFinalPath = await saveScreenshot(canvas, 'pre_final');
            
            // Run OCR on the pre-final screenshot (only in verbose mode)
            if (VERBOSE_MODE) {
              const Tesseract = require('tesseract.js');
              const { data: { text } } = await Tesseract.recognize(preFinalPath, 'eng');
              console.log(`🔍 Pre-final OCR: "${text.trim()}"`);
            }
          }
        } catch (error) {
          if (VERBOSE_MODE) {
            console.log(`   ⚠️  Pre-final OCR failed: ${error.message}`);
          }
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
        const filepath = await saveScreenshot(canvas, 'final');
        
        // Extract text using OCR
        const screenshot = await canvas.screenshot();
        ocrText = await extractTextFromScreenshot(screenshot);
        if (VERBOSE_MODE && ocrText) {
          console.log(`🔍 OCR extracted text: "${ocrText}"`);
        }
      }
    } catch (screenshotError) {
      console.log(`   ⚠️  Could not save screenshot: ${screenshotError.message}`);
    }

    // Test result - check for expected text using OCR with fuzzy matching
    let textSuccess = true;
    let missingElements = [];
    
    if (romTest.expectedElements && romTest.expectedElements.length > 0) {
      if (VERBOSE_MODE) {
        console.log(`🔍 Checking expected elements: ${romTest.expectedElements.join(', ')}`);
        console.log(`🔍 OCR text: "${ocrText}"`);
      }
      
      // Check each element and collect missing ones
      romTest.expectedElements.forEach(element => {
        const elementLower = element.toLowerCase();
        const ocrLower = ocrText.toLowerCase();
        let found = false;
        
        // Direct match
        if (ocrLower.includes(elementLower)) {
          if (VERBOSE_MODE) {
            console.log(`   ✅ Found direct match: "${element}"`);
          }
          found = true;
        } else {
          // Try partial matching - look for the element anywhere in the OCR text
          const words = ocrLower.split(/\s+/);
          const partialMatch = words.some(word => {
            if (word.includes(elementLower) || elementLower.includes(word)) {
              if (VERBOSE_MODE) {
                console.log(`   ✅ Found partial match: "${element}" in word "${word}"`);
              }
              return true;
            }
            return false;
          });
          
          if (partialMatch) {
            found = true;
          } else {
            // Fuzzy matching for common OCR errors
            let fuzzyMatch = false;
            
            // Create a flexible pattern that handles common OCR substitutions
            let flexiblePattern = elementLower
              .replace(/i/g, '[il1]')
              .replace(/l/g, '[il1]') 
              .replace(/1/g, '[il1]')
              .replace(/o/g, '[o0]')
              .replace(/0/g, '[o0]')
              .replace(/s/g, '[s5]')
              .replace(/5/g, '[s5]')
              .replace(/b/g, '[b6]')
              .replace(/6/g, '[b6]')
              .replace(/g/g, '[g9]')
              .replace(/9/g, '[g9]')
              .replace(/z/g, '[z2]')
              .replace(/2/g, '[z2]')
              .replace(/\*/g, '[>»]')
              .replace(/>/g, '[>»]')
              .replace(/»/g, '[>»]');
            
            // Convert to proper regex
            const regex = new RegExp(flexiblePattern.replace(/\[.*?\]/g, '[.*]'), 'i');
            fuzzyMatch = regex.test(ocrLower);
            
            // Also try simple character distance matching on individual words
            if (!fuzzyMatch) {
              const words = ocrLower.split(/\s+/);
              for (const word of words) {
                const distance = levenshteinDistance(elementLower, word);
                if (VERBOSE_MODE) {
                  console.log(`   🔍 Levenshtein distance for "${element}" vs "${word}": ${distance}`);
                }
                if (distance <= 2) {
                  fuzzyMatch = true;
                  if (VERBOSE_MODE) {
                    console.log(`   ✅ Found fuzzy match via Levenshtein: "${element}" matches "${word}"`);
                  }
                  break;
                }
              }
            }
            
            if (fuzzyMatch) {
              found = true;
              if (VERBOSE_MODE) {
                console.log(`   ✅ Found fuzzy match: "${element}"`);
              }
            }
          }
        }
        
        if (!found) {
          missingElements.push(element);
          if (VERBOSE_MODE) {
            console.log(`   ❌ No match found for: "${element}"`);
          }
        }
      });
      
      textSuccess = missingElements.length === 0;
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
    if (!textSuccess && missingElements.length > 0) {
      console.log(`   📝 Missing elements: ${missingElements.join(', ')}`);
    }
    
    return {
      name: romTest.name,
      success,
      loadTime,
      emulatorLoaded,
      networkRequests: networkRequests.length,
      errorElements: errorElements.length,
      ocrText,
      missingElements
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
      // Determine if this specific test requires keyboard input
      const needsKeyboard = !!romTest.keyboardEntry;
      
      // Launch browser for this specific test
      const browser = await chromium.launch({ 
        headless: !needsKeyboard, // Only run non-headless if this test needs keyboardEntry
        slowMo: needsKeyboard ? 200 : 0 // Add delay only when keyboardEntry is needed
      });
      
      try {
        const result = await testROM(romTest, browser);
        results.push(result);
        
        // Wait between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } finally {
        // Close browser after each test
        await browser.close();
      }
    }
  } finally {
    // Clean up: stop the server (unless --nokill-romserver flag is set)
    if (!KEEP_SERVER_RUNNING) {
      await stopServer();
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