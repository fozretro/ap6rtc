#!/usr/bin/env node

/**
 * Node.js port of SMJoin BBC Basic program
 * Builds Sideways Modules into a single image
 * 
 * Based on src.smjoin/SMJoin.bas
 */

const fs = require('fs');
const path = require('path');

class SMJoin {
    constructor() {
        this.mem = new Uint8Array(0x4100); // 16KB + 256 bytes
        this.ptr = 0;
        this.in = 0;
        this.romCount = 0; // Track number of ROMs added
        this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    }

    loadConfig(configPath) {
        try {
            const config = require(path.resolve(configPath));
            return config;
        } catch (error) {
            console.error(`Failed to load config from ${configPath}:`, error.message);
            return null;
        }
    }

    addFileFromConfig(romConfig) {
        const options = {
            pageAlignment: romConfig.pageAlignment !== false // Default to true if not specified
        };
        return this.addFile(romConfig.path, options);
    }

    log(...args) {
        if (this.verbose) {
            console.log(...args);
        }
    }

    addFile(filename, options = {}) {
        const pageAlignment = options.pageAlignment !== false; // Default to true if not specified
        const isFirstRom = this.romCount === 0;
        
        this.log(`Adding file: ${filename}`);
        
        if (!fs.existsSync(filename)) {
            console.error(`File '${filename}' not found`);
            return false;
        }

        const data = fs.readFileSync(filename);
        const len = data.length;
        
        if (len > 0x4100 - this.ptr) {
            console.error(`File '${filename}' too long (${len} bytes, ${0x4100 - this.ptr} available)`);
            return false;
        }

        if (this.ptr) {
            this.ptr += 2; // Add 2-byte gap between modules
        }

        // Align to 256-byte page boundary if pageAlignment is enabled (but not for first ROM)
        if (pageAlignment && !isFirstRom) {
            const pageBoundary = Math.ceil(this.ptr / 256) * 256;
            if (this.ptr !== pageBoundary) {
                this.log(`  Aligning from 0x${this.ptr.toString(16)} to 0x${pageBoundary.toString(16)} (page boundary)`);
                this.ptr = pageBoundary;
            }
        }

        // Copy file data to memory
        this.mem.set(data, this.ptr);
        
        // Check for relocation data
        let reloc = 0;
        if (this.mem[this.ptr] === 0 && (this.mem[this.ptr + 2] & 0x80) === 0x80) {
            reloc = this.ptr + (this.readWord(this.ptr + 1) & 0x3FFF);
            this.log(`  Found relocation table at offset 0x${reloc.toString(16)}`);
        }

        if (reloc === 0 && this.ptr > 0) {
            console.error(`File '${filename}' not relocatable, must be first entry`);
            return false;
        }

        const oldPtr = this.ptr;
        this.ptr = this.link(reloc, len);
        
        if (oldPtr === this.ptr) {
            const availableSpace = 0x4000 - oldPtr;
            // Calculate the actual space that would be needed
            let actualSpaceNeeded = 0;
            if (reloc > 0) {
                // ROM has relocation table, use code size (reloc - oldPtr)
                actualSpaceNeeded = reloc - oldPtr;
            } else {
                // ROM has no relocation table, use full file size
                actualSpaceNeeded = len;
            }
            const overflow = actualSpaceNeeded - availableSpace;
            console.error(`File '${filename}' too long after processing`);
            console.error(`  Available space: ${availableSpace} bytes (0x${availableSpace.toString(16)})`);
            console.error(`  Required space: ${actualSpaceNeeded} bytes (0x${actualSpaceNeeded.toString(16)})`);
            console.error(`  Need to free: ${overflow} bytes (0x${overflow.toString(16)})`);
            console.error(`  Current position: 0x${oldPtr.toString(16)}`);
            console.error(`  Maximum position: 0x4000`);
            console.error(`  Note: Using actual ROM code size (relocation table excluded)`);
            return false;
        }

        // Clear memory from ptr to 0x3FFF
        for (let i = this.ptr; i <= 0x3FFF; i += 4) {
            this.writeWord(i, 0);
        }

        // Increment ROM count
        this.romCount++;

        if (oldPtr !== 0 || this.ptr < 0x3FFF) {
            return true;
        }

        // Trim trailing zeros
        while (this.ptr > 0 && this.mem[this.ptr - 1] === this.mem[0x3FFF]) {
            this.ptr--;
        }
        this.ptr++;

        return true;
    }

    readWord(offset) {
        return this.mem[offset] | (this.mem[offset + 1] << 8);
    }

    writeWord(offset, value) {
        this.mem[offset] = value & 0xFF;
        this.mem[offset + 1] = (value >> 8) & 0xFF;
    }

    readLong(offset) {
        return this.mem[offset] | (this.mem[offset + 1] << 8) | (this.mem[offset + 2] << 16) | (this.mem[offset + 3] << 24);
    }

    writeLong(offset, value) {
        this.mem[offset] = value & 0xFF;
        this.mem[offset + 1] = (value >> 8) & 0xFF;
        this.mem[offset + 2] = (value >> 16) & 0xFF;
        this.mem[offset + 3] = (value >> 24) & 0xFF;
    }

    link(reloc, len) {
        if (this.ptr === 0) {
            if (reloc === 0) {
                return len; // First item, no relocation table
            }
            return reloc; // First item, strip relocation table
        }

        this.log(`  Relocating module from 0x${this.ptr.toString(16)} to 0x${reloc.toString(16)}`);

        // Relocate loaded module
        const code = this.ptr;           // Start of loaded code
        const end = reloc;               // End of loaded code
        let count = 0;                   // No bits read yet
        let byte = 0;                    // Relocation bitmap

        if (end > 0x4000) {
            this.log(`  Module too long after relocation (0x${end.toString(16)} > 0x4000)`);
            return this.ptr;
        }

        // Process relocation bitmap
        this.initReloc(reloc);
        for (let here = code; here < end; here++) {
            if ((this.mem[here] & 0xC0) === 0x80) {
                this.processRelocByte(here, code);
            }
        }

        // Look for last unlinked module
        let link = -2;
        let found = false;
        let next = 0;
        let last = 0;

        do {
            found = false;
            
            // Look for: JSR xxxx:LDX &F4:JMP yyyy
            if (this.mem[link] === 0x20 && (this.readLong(link + 3) & 0xFFFFFF) === 0x4CF4A6) {
                found = true;
                next = link + 6;
            }
            
            // Look for: JSR xxxx:JMP yyyy
            if ((this.readLong(link) & 0xFF0000FF) === 0x4C000020) {
                found = true;
                next = link + 4;
            }
            
            if (link < 0) {
                found = true;
                next = link + 6;
            }
            
            if (found) {
                last = link;
                link = this.readWord(next) & 0x3FFF;
            }
        } while (found);

        this.log(`  Found last module at 0x${last.toString(16)}, linking to 0x${link.toString(16)}`);

        // Link new module to previous service handler
        this.mem[this.ptr - 2] = 0x20;  // JSR opcode
        this.mem[this.ptr - 1] = link & 0xFF;  // Low byte of address
        this.mem[this.ptr - 0] = (link >> 8) | 0x80; // High byte of address
        this.mem[this.ptr + 1] = 0xA6;  // LDX opcode
        this.mem[this.ptr + 2] = 0xF4;  // &F4 operand

        // Link previous module to new module
        this.mem[next + 0] = (this.ptr - 2) & 0xFF;  // Low byte of address
        this.mem[next + 1] = ((this.ptr - 2) >> 8) | 0x80; // High byte of address

        return end;
    }

    processRelocByte(here, code) {
        if (this.count === 0) {
            this.byte = this.mem[this.reloc];
            this.reloc++;
            this.count = 8;
        }

        if (this.byte & 1) {
            const addr = (this.readWord(here - 1) & 0x3FFF) + code;
            this.mem[here - 1] = addr & 0xFF;
            this.mem[here] = (addr >> 8) + 0x80;
            this.log(`    Relocated at 0x${(here - code + 0x8000).toString(16)}: 0x${addr.toString(16)}`);
        }

        this.byte = this.byte >> 1;
        this.count--;
    }

    save(outputFile) {
        this.log(`Saving output to: ${outputFile}`);
        this.log(`Final size: ${this.ptr} bytes (0x${this.ptr.toString(16)})`);
        
        const output = this.mem.slice(0, this.ptr);
        fs.writeFileSync(outputFile, output);
        
        console.log(`SMJoin completed: ${this.ptr} bytes written to ${outputFile}`);
    }

    // Initialize relocation processing
    initReloc(reloc) {
        this.reloc = reloc;
        this.count = 0;
        this.byte = 0;
    }
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    // Check for config file option
    const configIndex = args.indexOf('--config');
    let config = null;
    let inputFiles = [];
    let outputFile = '';
    
    if (configIndex !== -1 && configIndex + 1 < args.length) {
        // Use configuration file
        const configPath = args[configIndex + 1];
        const smjoin = new SMJoin();
        config = smjoin.loadConfig(configPath);
        
        if (!config) {
            process.exit(1);
        }
        
        inputFiles = config.romFiles.map(rom => rom.path);
        outputFile = config.output.path;
        
        // Remove --config and config path from args
        args.splice(configIndex, 2);
    } else if (args.length < 2) {
        console.log('Usage: node smjoin-create.js [--config <config.js>] <input1> <input2> ... <output> [--verbose]');
        console.log('Example: node smjoin-create.js --config config/smjoin-create-config.js --verbose');
        console.log('Example: node smjoin-create.js AP1V131 AP6V134 TUBEELK AP6COUNT I2C COMB_OUT.rom');
        process.exit(1);
    } else {
        // Legacy mode - command line arguments
        inputFiles = args.slice(0, -1);
        outputFile = args[args.length - 1];
    }

    // Filter out verbose flag
    const verboseIndex = args.indexOf('--verbose');
    const verbose = verboseIndex !== -1;
    if (verbose) {
        args.splice(verboseIndex, 1);
    }

    console.log('SMJoin Node.js - Building Sideways Modules');
    console.log('==========================================');
    if (config) {
        console.log(`Using config: ${config.romFiles.map(rom => rom.name).join(', ')}`);
    } else {
        console.log(`Input files: ${inputFiles.join(', ')}`);
    }
    console.log(`Output file: ${outputFile}`);
    console.log('');

    const smjoin = new SMJoin();
    smjoin.verbose = verbose;
    
    if (config) {
        // Use configuration
        for (const romConfig of config.romFiles) {
            if (!smjoin.addFileFromConfig(romConfig)) {
                console.error(`Failed to add file: ${romConfig.path}`);
                process.exit(1);
            }
        }
    } else {
        // Legacy mode
        for (const file of inputFiles) {
            if (!smjoin.addFile(file)) {
                console.error(`Failed to add file: ${file}`);
                process.exit(1);
            }
        }
    }

    smjoin.save(outputFile);
}

if (require.main === module) {
    main();
}

module.exports = SMJoin;
