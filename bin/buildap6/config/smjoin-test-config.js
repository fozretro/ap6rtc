/**
 * Configuration for SMJoin ROM testing
 * Defines test cases, server settings, OCR options, and keyboard mappings
 */

module.exports = {
    // ROM test configurations
    romTests: [
        {
            name: 'AP6.rom',
            rom: 'AP6.rom',
            expectedSize: 16147,
            description: 'Official AP6 Plus 1.1.33 ROM - reference baseline',
            expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC'] // Check for key text using OCR
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
            expectedElements: ['RH', 'Flus', '1', '32K', 'BASIC', 'I2C', 'Sun'], // Check for key text using OCR
            bootCommands: ['*HELP', '*NOW']
        }
    ],

    // Server configuration
    server: {
        port: 8080,
        script: 'smjoin-test-server.py',
        timeout: 10000, // 10 seconds
        checkInterval: 500 // 500ms
    },

    // OCR configuration
    ocr: {
        language: 'eng',
        options: {
            // Enhanced options for computer/terminal text recognition
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?@#$%^&*()_+-=[]{}|\\/"\'<>~` ',
            tessedit_pageseg_mode: 6, // PSM.SINGLE_BLOCK - Treat as single text block
            tessedit_ocr_engine_mode: 1, // OEM.LSTM_ONLY - Use LSTM neural network
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
        }
    },

    // Browser configuration
    browser: {
        headless: true, // Default to headless mode
        slowMo: 0, // Default no slow motion
        keyboardSlowMo: 200 // Slow motion when keyboard input is needed
    },

    // Emulator configuration
    emulator: {
        baseUrl: 'https://0xc0de6502.github.io/electroniq/',
        loadTimeout: 15000, // 15 seconds
        contentWaitTime: 3000, // 3 seconds
        keyboardWaitTime: 1000 // 1 second
    },

    // Console log filtering
    consoleFilter: {
        // Messages to skip in non-verbose mode
        skipInNonVerbose: [
            'INFO:',
            'DEBUG:',
            'WARNING:',
            'ScriptProcessorNode is deprecated',
            'AudioContext was not allowed to start',
            'GL Driver Message',
            'GPU stall due to ReadPixels',
            'WebGL-',
            'OpenGL, Performance'
        ],
        // Messages to always skip
        alwaysSkip: [
            'INFO: Initializing raylib',
            'INFO: Platform backend',
            'INFO: Supported raylib modules',
            'INFO: Display size',
            'INFO: GL:',
            'INFO: TEXTURE:',
            'INFO: SHADER:',
            'INFO: AUDIO:',
            'INFO: STREAM:',
            'INFO: SYSTEM:',
            'WebSocket connection to',
            'failed'
        ]
    },

    // Keyboard mapping configuration
    keyboard: {
        // Virtual keyboard layout coordinates (relative to canvas)
        layout: {
            // Row 1 (Top): ESC, !1, "2, #3, $4, %5, &6, '7, (8, )9, @0, =-^~, \|, BRK
            row1: {
                y: 0.25, // Top row
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
                y: 0.35, // Second row
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
                    'P': { x: 0.68, width: 0.05 },
                    '£': { x: 0.85, width: 0.05 },
                    '-': { x: 0.92, width: 0.05 },
                    '[': { x: 0.95, width: 0.05 },
                    'COPY': { x: 0.98, width: 0.05 }
                }
            },
            // Row 3 (ASDF): CTRL, A, S, D, F, G, H, J, K, L, +;, *:, RETURN
            row3: {
                y: 0.45, // Third row
                keys: {
                    'CTRL': { x: 0.05, width: 0.08 },
                    'A': { x: 0.15, width: 0.05 },
                    'S': { x: 0.22, width: 0.05 },
                    'D': { x: 0.29, width: 0.05 },
                    'F': { x: 0.36, width: 0.05 },
                    'G': { x: 0.43, width: 0.05 },
                    'H': { x: 0.45, width: 0.05 },
                    'J': { x: 0.57, width: 0.05 },
                    'K': { x: 0.64, width: 0.05 },
                    'L': { x: 0.64, width: 0.05 },
                    '+': { x: 0.78, width: 0.05 },
                    '*': { x: 0.75, width: 0.05, requiresShift: true },
                    'RETURN': { x: 0.80, width: 0.08 }
                }
            },
            // Row 4 (ZXCV): SHIFT, Z, X, C, V, B, N, M, <,, >., ?/, SHIFT, DEL
            row4: {
                y: 0.55, // Fourth row
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
        },
        // Timing settings
        timing: {
            keyPressDelay: 10,
            keyReleaseDelay: 10,
            clickDelay: 50,
            shiftDelay: 10,
            f6Delay: 100
        }
    },

    // OCR text matching configuration
    textMatching: {
        // Fuzzy matching patterns for common OCR errors
        substitutions: {
            'i': '[il1]',
            'l': '[il1]',
            '1': '[il1]',
            'o': '[o0]',
            '0': '[o0]',
            's': '[s5]',
            '5': '[s5]',
            'b': '[b6]',
            '6': '[b6]',
            'g': '[g9]',
            '9': '[g9]',
            'z': '[z2]',
            '2': '[z2]',
            '*': '[>»]',
            '>': '[>»]',
            '»': '[>»]'
        },
        // Levenshtein distance threshold for fuzzy matching
        maxDistance: 2,
        // Minimum word length for fuzzy matching
        minWordLength: 2
    },

    // Screenshot configuration
    screenshots: {
        directory: 'screenshots',
        naming: {
            pattern: 'screenshot_{romName}_{index}_{description}.png',
            replacements: {
                romName: /[^a-zA-Z0-9]/g,
                replacement: '_'
            }
        }
    },

    // Test execution configuration
    execution: {
        // Wait time between tests (ms)
        testDelay: 2000,
        // Maximum message length before truncation
        maxMessageLength: 200,
        // Default test timeout
        defaultTimeout: 30000
    }
};
