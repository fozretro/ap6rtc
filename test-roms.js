const { chromium } = require('playwright');

// ROM test configurations
const romTests = [
  {
    name: 'Official AP6 ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/AP6.rom',
    expectedSize: 7772,
    description: 'Official AP6 Plus 1.1.33 ROM - reference baseline'
  },
  {
    name: 'Standard I2C ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/I2C_standard.rom',
    expectedSize: 16384,
    description: 'Standard I2C ROM without SMJoin modifications'
  },
  {
    name: 'SMJoin-Modified I2C ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/I2C.rom',
    expectedSize: 4977,
    description: 'I2C ROM modified for SMJoin compatibility'
  },
  {
    name: '8KB Combined ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/COMB_8kb.rom',
    expectedSize: 7852,
    description: 'Combined ROM with 4 official AP6 ROMs'
  },
  {
    name: '16KB Combined ROM',
    url: 'https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8081/COMB.rom',
    expectedSize: 12805,
    description: 'Combined ROM with all 5 ROMs including I2C'
  }
];

async function testROM(romTest, browser) {
  console.log(`\n🧪 Testing: ${romTest.name}`);
  console.log(`📝 Description: ${romTest.description}`);
  console.log(`🔗 URL: ${romTest.url}`);
  
  const page = await browser.newPage();
  
  try {
    // Set up console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      } else if (msg.type() === 'log') {
        console.log(`📋 Console Log: ${msg.text()}`);
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
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️  Load time: ${loadTime}ms`);
    
    // Wait for the emulator to initialize
    await page.waitForTimeout(3000);
    
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
    
    console.log(`🖥️  Emulator status:`, emulatorLoaded);
    
    // Check for any error messages on the page
    const errorElements = await page.$$eval('*', elements => {
      return elements
        .filter(el => el.textContent && el.textContent.toLowerCase().includes('error'))
        .map(el => el.textContent.trim())
        .slice(0, 5); // Limit to first 5 errors
    });
    
    if (errorElements.length > 0) {
      console.log(`⚠️  Page errors found:`, errorElements);
    }
    
    // Try to interact with the emulator (if it's responsive)
    try {
      // Look for the emulator screen content
      const screenContent = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return null;
        
        // Try to get some basic info about the canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        // Get a small sample of pixels to see if there's content
        const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height));
        const pixels = imageData.data;
        
        // Count non-black pixels (basic content detection)
        let nonBlackPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          if (r > 0 || g > 0 || b > 0) nonBlackPixels++;
        }
        
        return {
          canvasSize: { width: canvas.width, height: canvas.height },
          nonBlackPixels,
          totalPixels: pixels.length / 4
        };
      });
      
      if (screenContent) {
        console.log(`📺 Screen content:`, screenContent);
      }
    } catch (error) {
      console.log(`⚠️  Could not analyze screen content: ${error.message}`);
    }
    
    // Test result
    const success = emulatorLoaded.hasCanvas && emulatorLoaded.hasElectroniq;
    const status = success ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${status} - ${romTest.name}`);
    console.log(`📊 Network requests: ${networkRequests.length}`);
    
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
  console.log('=' .repeat(60));
  
  const browser = await chromium.launch({ 
    headless: false, // Set to true for headless mode
    slowMo: 1000 // Slow down actions for better visibility
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
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (result.loadTime) {
      console.log(`   ⏱️  Load time: ${result.loadTime}ms`);
    }
    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }
    if (result.networkRequests) {
      console.log(`   🌐 Network requests: ${result.networkRequests}`);
    }
  });
  
  const passCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log(`\n🎯 Results: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed - check the logs above');
  }
}

// Run the tests
runAllTests().catch(console.error);
