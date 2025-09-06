#!/usr/bin/env node

/**
 * Generate relocation data for SMJoin-compatible ROMs
 * Compares two ROM builds compiled at different addresses to identify relocatable bytes
 * Based on the PROCsm_table logic from MiniRom.bas and AP6v133.src
 */

const fs = require('fs');

function generateRelocData(rom8000Path, rom8100Path, outputPath) {
    console.log(`Reading ROM built at $8000: ${rom8000Path}`);
    const rom8000 = fs.readFileSync(rom8000Path);
    
    console.log(`Reading ROM built at $8100: ${rom8100Path}`);
    const rom8100 = fs.readFileSync(rom8100Path);
    
    if (rom8000.length !== rom8100.length) {
        throw new Error(`ROM sizes don't match: ${rom8000.length} vs ${rom8100.length}`);
    }
    
    const romSize = rom8000.length;
    console.log(`ROM size: ${romSize} bytes`);
    console.log(`Starting byte-by-byte comparison...`);
    
    // Generate relocation data using the same logic as PROCsm_table
    let byte = 0;
    let count = 0;
    let offset = 0;
    let relocatableBytes = 0;
    const relocData = [];
    const relocDetails = []; // Store details about each relocation
    
    while (offset < romSize) {
        const byte8000 = rom8000[offset];
        const byte8100 = rom8100[offset];
        
        // Check if this byte needs relocation (difference of 0x100)
        const diff = (byte8100 - byte8000) & 0xFF;
        if (diff === 0x01) { // 0x8100 - 0x8000 = 0x0100, so low byte changes by 1
            // This byte is relocatable
            byte = Math.floor(byte / 2) + 128 * (byte8100 - byte8000);
            count++;
            relocatableBytes++;
            
            // Store relocation details
            relocDetails.push({
                offset: offset,
                byte8000: byte8000,
                byte8100: byte8100,
                address8000: 0x8000 + offset,
                address8100: 0x8100 + offset
            });
        } else if (diff !== 0) {
            console.log(`Warning: Unexpected difference at offset 0x${offset.toString(16)}: 0x${byte8000.toString(16)} vs 0x${byte8100.toString(16)}`);
        }
        
        // Pack 8 bits into a byte
        if (count === 8) {
            relocData.push(byte);
            byte = 0;
            count = 0;
        }
        
        offset++;
    }
    
    // Handle remaining bits
    if (count > 0) {
        relocData.push(byte);
    }
    
    console.log(`Found ${relocatableBytes} relocatable bytes`);
    console.log(`Generated ${relocData.length} bytes of compressed relocation data`);
    
    // Analyze and log relocation details
    console.log(`\nRelocation Analysis:`);
    console.log(`==================`);
    
    // Group relocations by type
    const addressRelocs = [];
    const instructionRelocs = [];
    
    // First pass: identify address relocations
    const processedOffsets = new Set();
    
    relocDetails.forEach((reloc, index) => {
        const { offset, byte8000, byte8100 } = reloc;
        
        if (processedOffsets.has(offset)) return;
        
        // Check if this is part of a 2-byte address
        if (index < relocDetails.length - 1) {
            const nextReloc = relocDetails[index + 1];
            if (nextReloc.offset === offset + 1) {
                // Check if both bytes change by 1 (indicating address relocation)
                const lowByteDiff = (byte8100 - byte8000) & 0xFF;
                const highByteDiff = (nextReloc.byte8100 - nextReloc.byte8000) & 0xFF;
                
                if (lowByteDiff === 1 && highByteDiff === 1) {
                    // This is a 2-byte address relocation
                    const lowByte = byte8000;
                    const highByte = nextReloc.byte8000;
                    const address = lowByte | (highByte << 8);
                    const newAddress = address + 0x100;
                    
                    addressRelocs.push({
                        offset: offset,
                        address: address,
                        newAddress: newAddress
                    });
                    
                    processedOffsets.add(offset);
                    processedOffsets.add(offset + 1);
                    return;
                }
            }
        }
        
        // Single byte relocation
        instructionRelocs.push({
            offset: offset,
            byte8000: byte8000,
            byte8100: byte8100
        });
        processedOffsets.add(offset);
    });
    
    console.log(`Address relocations (${addressRelocs.length}):`);
    addressRelocs.slice(0, 10).forEach(reloc => {
        console.log(`  Offset 0x${reloc.offset.toString(16).padStart(4, '0')}: 0x${reloc.address.toString(16).padStart(4, '0')} -> 0x${reloc.newAddress.toString(16).padStart(4, '0')}`);
    });
    if (addressRelocs.length > 10) {
        console.log(`  ... and ${addressRelocs.length - 10} more`);
    }
    
    // Instruction pattern mapping (defined once, used multiple times)
    const instructionPatterns = {
            // Direct addressing
            0x4C: { name: 'JMP', format: 'address', context: 'high byte of JMP target' },
            0x20: { name: 'JSR', format: 'address', context: 'high byte of JSR target' },
            0x6C: { name: 'JMP (indirect)', format: 'none', context: 'high byte of indirect address' },
            
            // Load/Store operations
            0x8D: { name: 'STA', format: 'address', context: 'high byte of STA address' },
            0x9D: { name: 'STA', format: 'address', context: 'high byte of STA address' },
            0x99: { name: 'STA', format: 'address', context: 'high byte of STA address' },
            0xAD: { name: 'LDA', format: 'address', context: 'high byte of LDA address' },
            0xBD: { name: 'LDA', format: 'address', context: 'high byte of LDA address' },
            0xB9: { name: 'LDA', format: 'address', context: 'high byte of LDA address' },
            0x8C: { name: 'STY/STZ', format: 'address', context: 'high byte of STY/STZ address' },
            0x9C: { name: 'STY/STZ', format: 'address', context: 'high byte of STY/STZ address' },
            0xAC: { name: 'LDY', format: 'address', context: 'high byte of LDY address' },
            0xBC: { name: 'LDY', format: 'address', context: 'high byte of LDY address' },
            0x8E: { name: 'STX/STZ', format: 'address', context: 'high byte of STX/STZ address' },
            0x9E: { name: 'STX/STZ', format: 'address', context: 'high byte of STX/STZ address' },
            0xAE: { name: 'LDX', format: 'address', context: 'high byte of LDX address' },
            0xBE: { name: 'LDX', format: 'address', context: 'high byte of LDX address' },
            
            // Arithmetic operations
            0x6D: { name: 'ADC', format: 'address', context: 'high byte of ADC address' },
            0x7D: { name: 'ADC', format: 'address', context: 'high byte of ADC address' },
            0x79: { name: 'ADC', format: 'address', context: 'high byte of ADC address' },
            0x6E: { name: 'ROR', format: 'address', context: 'high byte of ROR address' },
            0x7E: { name: 'ROR', format: 'address', context: 'high byte of ROR address' },
            0x7A: { name: 'ROR', format: 'address', context: 'high byte of ROR address' },
            
            // Logical operations
            0x0D: { name: 'ORA', format: 'address', context: 'high byte of ORA address' },
            0x1D: { name: 'ORA', format: 'address', context: 'high byte of ORA address' },
            0x19: { name: 'ORA', format: 'address', context: 'high byte of ORA address' },
            0x2D: { name: 'AND', format: 'address', context: 'high byte of AND address' },
            0x3D: { name: 'AND', format: 'address', context: 'high byte of AND address' },
            0x39: { name: 'AND', format: 'address', context: 'high byte of AND address' },
            0x4D: { name: 'EOR', format: 'address', context: 'high byte of EOR address' },
            0x5D: { name: 'EOR', format: 'address', context: 'high byte of EOR address' },
            0x59: { name: 'EOR', format: 'address', context: 'high byte of EOR address' },
            
            // Shift operations
            0x0E: { name: 'ASL/ROL', format: 'address', context: 'high byte of ASL/ROL address' },
            0x1E: { name: 'ASL/ROL', format: 'address', context: 'high byte of ASL/ROL address' },
            0x1A: { name: 'ASL/ROL', format: 'address', context: 'high byte of ASL/ROL address' },
            0x4E: { name: 'LSR/ROR', format: 'address', context: 'high byte of LSR/ROR address' },
            0x5E: { name: 'LSR/ROR', format: 'address', context: 'high byte of LSR/ROR address' },
            0x5A: { name: 'LSR/ROR', format: 'address', context: 'high byte of LSR/ROR address' },
            0x2E: { name: 'ROL/ROR', format: 'address', context: 'high byte of ROL/ROR address' },
            0x3E: { name: 'ROL/ROR', format: 'address', context: 'high byte of ROL/ROR address' },
            0x3A: { name: 'ROL/ROR', format: 'address', context: 'high byte of ROL/ROR address' },
            
            // Increment/Decrement
            0xCE: { name: 'DEC', format: 'address', context: 'high byte of DEC address' },
            0xDE: { name: 'DEC', format: 'address', context: 'high byte of DEC address' },
            0xDA: { name: 'DEC', format: 'address', context: 'high byte of DEC address' },
            0xEE: { name: 'INC', format: 'address', context: 'high byte of INC address' },
            0xFE: { name: 'INC', format: 'address', context: 'high byte of INC address' },
            0xFA: { name: 'INC', format: 'address', context: 'high byte of INC address' },
            
            // Bit operations
            0x0C: { name: 'TSB/TRB', format: 'address', context: 'high byte of TSB/TRB address' },
            0x1C: { name: 'TSB/TRB', format: 'address', context: 'high byte of TSB/TRB address' },
            0x1A: { name: 'TSB/TRB', format: 'address', context: 'high byte of TSB/TRB address' },
            0x2C: { name: 'BIT', format: 'address', context: 'high byte of BIT address' },
            0x3C: { name: 'BIT', format: 'address', context: 'high byte of BIT address' },
            0x3A: { name: 'BIT', format: 'address', context: 'high byte of BIT address' },
            
            // Comparison operations
            0xDD: { name: 'CMP', format: 'address', context: 'high byte of CMP address' },
            0xDE: { name: 'CMP', format: 'address', context: 'high byte of CMP address' },
            0xFD: { name: 'SBC', format: 'address', context: 'high byte of SBC address' },
            0xFE: { name: 'SBC', format: 'address', context: 'high byte of SBC address' },
            
            // Immediate values
            0x32: { name: 'AND immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x33: { name: 'AND immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x45: { name: 'EOR immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x46: { name: 'EOR immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x24: { name: 'BIT immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x25: { name: 'BIT immediate/special', format: 'none', context: 'high byte of immediate value' },
            0x29: { name: 'AND immediate', format: 'none', context: 'high byte of immediate value' },
            0x2A: { name: 'AND immediate', format: 'none', context: 'high byte of immediate value' },
            0x49: { name: 'EOR immediate', format: 'none', context: 'high byte of immediate value' },
            0x4A: { name: 'EOR immediate', format: 'none', context: 'high byte of immediate value' },
            0x69: { name: 'ADC immediate', format: 'none', context: 'high byte of immediate value' },
            0x6A: { name: 'ADC immediate', format: 'none', context: 'high byte of immediate value' },
            0x89: { name: 'BIT immediate', format: 'none', context: 'high byte of immediate value' },
            0x8A: { name: 'BIT immediate', format: 'none', context: 'high byte of immediate value' },
            0xA9: { name: 'LDA immediate', format: 'none', context: 'high byte of immediate value' },
            0xAA: { name: 'LDA immediate', format: 'none', context: 'high byte of immediate value' },
            0xC9: { name: 'CMP immediate', format: 'none', context: 'high byte of immediate value' },
            0xCA: { name: 'CMP immediate', format: 'none', context: 'high byte of immediate value' },
            0xE9: { name: 'SBC immediate', format: 'none', context: 'high byte of immediate value' },
            0xEA: { name: 'SBC immediate', format: 'none', context: 'high byte of immediate value' },
            0x09: { name: 'ORA immediate', format: 'none', context: 'high byte of immediate value' },
            0x0A: { name: 'ORA immediate', format: 'none', context: 'high byte of immediate value' }
    };
    
    console.log(`\nInstruction relocations (${instructionRelocs.length}):`);
    instructionRelocs.slice(0, 20).forEach(reloc => {
        const { offset, byte8000, byte8100 } = reloc;
        const address = 0x8000 + offset;
        
        // Look at the instruction context around this relocation
        const prev2Byte = offset > 1 ? rom8000[offset - 2] : 0;
        const prevByte = offset > 0 ? rom8000[offset - 1] : 0;
        const instruction = rom8000[offset];
        const nextByte = offset < romSize - 1 ? rom8000[offset + 1] : 0;
        
        // Look up instruction pattern
        const pattern = instructionPatterns[prev2Byte];
        let instructionType = '';
        let context = '';
        
        if (pattern) {
            if (pattern.format === 'address') {
                const target = prevByte | (instruction << 8);
                instructionType = `${pattern.name} $${target.toString(16).padStart(4, '0')}`;
            } else if (pattern.format === 'none') {
                instructionType = pattern.name;
            }
            context = pattern.context;
        } else {
            instructionType = `Unknown context`;
            context = `(prev2: 0x${prev2Byte.toString(16).padStart(2, '0')}, prev: 0x${prevByte.toString(16).padStart(2, '0')}, this: 0x${instruction.toString(16).padStart(2, '0')}, next: 0x${nextByte.toString(16).padStart(2, '0')})`;
        }
        
        console.log(`  Offset 0x${offset.toString(16).padStart(4, '0')} ($${address.toString(16)}): 0x${byte8000.toString(16).padStart(2, '0')} -> 0x${byte8100.toString(16).padStart(2, '0')} [${instructionType}] ${context}`);
    });
    if (instructionRelocs.length > 20) {
        console.log(`  ... and ${instructionRelocs.length - 20} more`);
    }
    
    // Count identified vs unknown relocations
    const knownOpCodes = new Set(Object.keys(instructionPatterns).map(key => parseInt(key, 10)));
    
    const identifiedCount = instructionRelocs.filter(reloc => {
        const prev2Byte = reloc.offset > 1 ? rom8000[reloc.offset - 2] : 0;
        return knownOpCodes.has(prev2Byte);
    }).length;
    
    const unknownCount = instructionRelocs.length - identifiedCount;
    
    console.log(`\nRelocation Summary:`);
    console.log(`==================`);
    console.log(`Total relocations: ${instructionRelocs.length}`);
    console.log(`Identified patterns: ${identifiedCount}`);
    console.log(`Unknown patterns: ${unknownCount}`);
    console.log(`Success rate: ${Math.round((identifiedCount / instructionRelocs.length) * 100)}%`);
    
    // Map relocations to source code context
    console.log(`\nSource Code Mapping:`);
    console.log(`==================`);
    console.log(`ROM starts at 0x8000, so ROM offset 0x${relocDetails[0]?.offset.toString(16).padStart(4, '0')} = address 0x${(0x8000 + (relocDetails[0]?.offset || 0)).toString(16)}`);
    console.log(`This corresponds to the ROM header area in the source code.`);
    console.log(`\nKey relocation areas:`);
    
    // Analyze relocation patterns
    const headerRelocs = relocDetails.filter(r => r.offset < 0x100).length;
    const codeRelocs = relocDetails.filter(r => r.offset >= 0x100 && r.offset < 0x1000).length;
    const dataRelocs = relocDetails.filter(r => r.offset >= 0x1000).length;
    
    console.log(`  Header area (0x0000-0x00FF): ${headerRelocs} relocations`);
    console.log(`  Code area (0x0100-0x0FFF): ${codeRelocs} relocations`);
    console.log(`  Data area (0x1000+): ${dataRelocs} relocations`);
    
    if (addressRelocs.length > 0) {
        console.log(`\nAddress relocations likely represent:`);
        console.log(`  - JMP instruction targets`);
        console.log(`  - JSR instruction targets`);
        console.log(`  - Data structure pointers`);
    }
    
    if (instructionRelocs.length > 0) {
        console.log(`\nSingle-byte relocations likely represent:`);
        console.log(`  - High bytes of addresses (0x80 -> 0x81)`);
        console.log(`  - Page-relative addressing`);
        console.log(`  - Indexed addressing modes`);
    }
    
    // Create the final ROM with SMJoin-compatible header
    console.log(`\nCreating SMJoin-compatible ROM header...`);
    console.log(`==========================================`);
    
    const finalRom = Buffer.alloc(romSize + relocData.length);
    console.log(`  -> Allocated buffer: ${finalRom.length} bytes (${romSize} ROM + ${relocData.length} reloc data)`);
    
    // Copy the ROM data (use the $8000 version as base)
    rom8000.copy(finalRom, 0);
    console.log(`  -> Copied ${romSize} bytes of ROM data from $8000 build`);
    
    // Log original ROM header before modification
    console.log(`\nOriginal ROM header (before modification):`);
    console.log(`  Offset 0-2 (Language): 0x${finalRom[0].toString(16).padStart(2, '0')} 0x${finalRom[1].toString(16).padStart(2, '0')} 0x${finalRom[2].toString(16).padStart(2, '0')}`);
    console.log(`  Offset 3-5 (Service):  0x${finalRom[3].toString(16).padStart(2, '0')} 0x${finalRom[4].toString(16).padStart(2, '0')} 0x${finalRom[5].toString(16).padStart(2, '0')} (JMP 0x${(finalRom[4] | (finalRom[5] << 8)).toString(16)})`);
    console.log(`  Offset 6-7 (Type/Len): 0x${finalRom[6].toString(16).padStart(2, '0')} 0x${finalRom[7].toString(16).padStart(2, '0')}`);
    
    // Update ROM header for SMJoin compatibility
    console.log(`\nModifying ROM header for SMJoin compatibility:`);
    
    // Offset 0-2: Language entry (BRK + address to relocation table)
    finalRom[0] = 0x00; // BRK instruction
    const relocTableAddr = 0x8000 + romSize; // Relocation table address must be >= 0x8000 for SMJoin
    finalRom[1] = relocTableAddr & 0xFF;
    finalRom[2] = (relocTableAddr >> 8) & 0xFF;
    console.log(`  -> Language entry: BRK + 0x${relocTableAddr.toString(16).padStart(4, '0')} (${relocTableAddr} decimal)`);
    console.log(`     Low byte: 0x${(relocTableAddr & 0xFF).toString(16).padStart(2, '0')}, High byte: 0x${((relocTableAddr >> 8) & 0xFF).toString(16).padStart(2, '0')} (bit 7 set: ${((relocTableAddr >> 8) & 0x80) !== 0})`);
    
    // Offset 3-5: Service entry (keep original - will be modified by next tool in pipeline)
    const originalServiceAddr = finalRom[4] | (finalRom[5] << 8);
    console.log(`  -> Service entry: JMP 0x${originalServiceAddr.toString(16)} (unchanged - will be modified by next tool)`);
    
    // Offset 6: Copyright byte (keep existing)
    console.log(`  -> Copyright byte: 0x${finalRom[6].toString(16).padStart(2, '0')} (unchanged)`);
    
    // Offset 7: Relocation table length
    finalRom[7] = relocData.length;
    console.log(`  -> Relocation table length: ${relocData.length} bytes (0x${relocData.length.toString(16)})`);
    
    // Log modified ROM header
    console.log(`\nModified ROM header (after modification):`);
    console.log(`  Offset 0-2 (Language): 0x${finalRom[0].toString(16).padStart(2, '0')} 0x${finalRom[1].toString(16).padStart(2, '0')} 0x${finalRom[2].toString(16).padStart(2, '0')}`);
    console.log(`  Offset 3-5 (Service):  0x${finalRom[3].toString(16).padStart(2, '0')} 0x${finalRom[4].toString(16).padStart(2, '0')} 0x${finalRom[5].toString(16).padStart(2, '0')} (JMP 0x${(finalRom[4] | (finalRom[5] << 8)).toString(16)})`);
    console.log(`  Offset 6-7 (Type/Len): 0x${finalRom[6].toString(16).padStart(2, '0')} 0x${finalRom[7].toString(16).padStart(2, '0')}`);
    
    // Append relocation data
    console.log(`\nAppending relocation data:`);
    console.log(`  -> Relocation data starts at offset: ${romSize} (0x${romSize.toString(16)})`);
    console.log(`  -> Relocation data length: ${relocData.length} bytes`);
    console.log(`  -> Relocation data ends at offset: ${romSize + relocData.length - 1} (0x${(romSize + relocData.length - 1).toString(16)})`);
    
    Buffer.from(relocData).copy(finalRom, romSize);
    console.log(`  -> Successfully appended ${relocData.length} bytes of relocation data`);
    
    // Log first few bytes of relocation data for verification
    console.log(`  -> First 16 bytes of relocation data: ${Array.from(relocData.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    
    // Write the final ROM
    fs.writeFileSync(outputPath, finalRom);
    console.log(`\nFinal ROM written to: ${outputPath}`);
    console.log(`Total size: ${finalRom.length} bytes (${romSize} code + ${relocData.length} reloc data)`);
    
    // Verify the final ROM header
    console.log(`\nFinal ROM header verification:`);
    console.log(`  Offset 0-2 (Language): 0x${finalRom[0].toString(16).padStart(2, '0')} 0x${finalRom[1].toString(16).padStart(2, '0')} 0x${finalRom[2].toString(16).padStart(2, '0')} (BRK + 0x${(finalRom[1] | (finalRom[2] << 8)).toString(16)})`);
    console.log(`  Offset 3-5 (Service):  0x${finalRom[3].toString(16).padStart(2, '0')} 0x${finalRom[4].toString(16).padStart(2, '0')} 0x${finalRom[5].toString(16).padStart(2, '0')} (JMP 0x${(finalRom[4] | (finalRom[5] << 8)).toString(16)})`);
    console.log(`  Offset 6-7 (Type/Len): 0x${finalRom[6].toString(16).padStart(2, '0')} 0x${finalRom[7].toString(16).padStart(2, '0')} (Type: 0x${finalRom[6].toString(16)}, RelocLen: ${finalRom[7]})`);
}

// Main execution
if (process.argv.length !== 5) {
    console.log('Usage: node generate-reloc-data.js <rom8000> <rom8100> <output>');
    process.exit(1);
}

const rom8000Path = process.argv[2];
const rom8100Path = process.argv[3];
const outputPath = process.argv[4];

try {
    generateRelocData(rom8000Path, rom8100Path, outputPath);
    console.log('Relocation data generation complete!');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
