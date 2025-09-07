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
        this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    }

    log(...args) {
        if (this.verbose) {
            console.log(...args);
        }
    }

    addFile(filename) {
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

        // Align to 256-byte page boundary
        const pageBoundary = Math.ceil(this.ptr / 256) * 256;
        if (this.ptr !== pageBoundary) {
            this.log(`  Aligning from 0x${this.ptr.toString(16)} to 0x${pageBoundary.toString(16)} (page boundary)`);
            this.ptr = pageBoundary;
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
            console.error(`File '${filename}' too long after processing`);
            return false;
        }

        // Clear memory from ptr to 0x3FFF
        for (let i = this.ptr; i <= 0x3FFF; i += 4) {
            this.writeWord(i, 0);
        }

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
    
    if (args.length < 2) {
        console.log('Usage: node smjoin-nodejs.js <input1> <input2> ... <output> [--verbose]');
        console.log('Example: node smjoin-nodejs.js AP1V131 AP6V134 TUBEELK AP6COUNT I2C COMB_OUT.rom');
        process.exit(1);
    }

    // Filter out verbose flag
    const verboseIndex = args.indexOf('--verbose');
    const verbose = verboseIndex !== -1;
    if (verbose) {
        args.splice(verboseIndex, 1);
    }

    const outputFile = args[args.length - 1];
    const inputFiles = args.slice(0, -1);

    console.log('SMJoin Node.js - Building Sideways Modules');
    console.log('==========================================');
    console.log(`Input files: ${inputFiles.join(', ')}`);
    console.log(`Output file: ${outputFile}`);
    console.log('');

    const smjoin = new SMJoin();
    smjoin.verbose = verbose;
    
    for (const file of inputFiles) {
        if (!smjoin.addFile(file)) {
            console.error(`Failed to add file: ${file}`);
            process.exit(1);
        }
    }

    smjoin.save(outputFile);
}

if (require.main === module) {
    main();
}

module.exports = SMJoin;
