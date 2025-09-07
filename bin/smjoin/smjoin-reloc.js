const fs = require('fs');

/**
 * SMJoin Relocation Table Generator
 * 
 * Takes two ROM files compiled at different base addresses ($8000 and $8100)
 * and generates a relocation table by comparing byte differences.
 * 
 * Usage: node smjoin-reloc.js <rom8000> <rom8100> <output>
 */

function main() {
    // Check command line arguments
    if (process.argv.length !== 5) {
        console.log('Usage: node smjoin-reloc.js <rom8000> <rom8100> <output>');
        console.log('  rom8000  - ROM file compiled at base address $8000');
        console.log('  rom8100  - ROM file compiled at base address $8100');
        console.log('  output   - Output file with relocation table appended');
        process.exit(1);
    }

    const rom8000File = process.argv[2];
    const rom8100File = process.argv[3];
    const outputFile = process.argv[4];

    console.log(`Reading ROM compiled at $8000: ${rom8000File}`);
    console.log(`Reading ROM compiled at $8100: ${rom8100File}`);
    console.log(`Output file: ${outputFile}`);

    try {
        // 1. Load the first two files in separate arrays
        const rom8000 = fs.readFileSync(rom8000File);
        const rom8100 = fs.readFileSync(rom8100File);

        console.log(`ROM $8000 size: ${rom8000.length} bytes`);
        console.log(`ROM $8100 size: ${rom8100.length} bytes`);

        // Validate file sizes match
        if (rom8000.length !== rom8100.length) {
            throw new Error(`ROM file sizes don't match: ${rom8000.length} vs ${rom8100.length}`);
        }

        // 2. Calculate initial relocation table
        console.log('Calculating initial relocation table...');
        const initialRelocTable = calculateTable(rom8000, rom8100);
        console.log(`Generated initial relocation table: ${initialRelocTable.length} bytes`);

        // 3. Simulate header modification to check for new candidate bytes
        const romSize = rom8000.length;
        const relocOffset = romSize;
        
        const modifiedRom8000 = new Uint8Array(rom8000);
        modifiedRom8000[1] = relocOffset & 0xFF;
        modifiedRom8000[2] = ((relocOffset >> 8) & 0x3F) | 0x80; // Set bit 7
        
        console.log(`Simulating header modification: [1]=0x${modifiedRom8000[1].toString(16)}, [2]=0x${modifiedRom8000[2].toString(16)}`);
        
        // 4. Recalculate relocation table with modified header
        console.log('Recalculating relocation table with header modifications...');
        const finalRelocTable = calculateTable(modifiedRom8000, rom8100);
        console.log(`Generated final relocation table: ${finalRelocTable.length} bytes`);

        // 5. Concatenate ROM data with final relocation table
        const totalSize = romSize + finalRelocTable.length;

        console.log(`ROM size: ${romSize} bytes`);
        console.log(`Relocation table offset: ${relocOffset} (0x${relocOffset.toString(16)})`);
        console.log(`Total output size: ${totalSize} bytes`);

        // Create the large array
        const result = new Uint8Array(totalSize);
        
        // Copy ROM data
        result.set(rom8000, 0);
        
        // Copy final relocation table
        result.set(finalRelocTable, relocOffset);

        // 6. Store relocation table offset in bytes 1-2 of the header
        // Byte 1: low byte of offset
        // Byte 2: high byte of offset (with bit 7 set to indicate relocation table present)
        result[1] = relocOffset & 0xFF;
        result[2] = ((relocOffset >> 8) & 0x3F) | 0x80; // Set bit 7 to indicate relocation table

        console.log(`Header modification:`);
        console.log(`  Byte 1: 0x${result[1].toString(16).padStart(2, '0')} (low byte of offset)`);
        console.log(`  Byte 2: 0x${result[2].toString(16).padStart(2, '0')} (high byte + bit 7 set)`);

        // 5. Write the large array to file
        fs.writeFileSync(outputFile, result);
        console.log(`✅ Successfully wrote ${totalSize} bytes to ${outputFile}`);

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Calculate relocation table by comparing two ROM arrays
 * @param {Uint8Array} rom8000 - ROM compiled at $8000
 * @param {Uint8Array} rom8100 - ROM compiled at $8100
 * @returns {Uint8Array} Compressed relocation table
 */
function calculateTable(rom8000, rom8100) {
    const romSize = rom8000.length;
    
    // First loop: scan for byte differences and store in bits array
    const bits = [];
    let relocCount = 0;

    console.log('Scanning for byte differences...');
    for (let i = 0; i < romSize; i++) {
        const byte8000 = rom8000[i];
        const byte8100 = rom8100[i];
        
        // Only process candidate bytes (those with bits 7&6 set)
        if ((byte8000 & 0xC0) === 0x80) {
            if (byte8000 !== byte8100) {
                // Check if this is a relocation (difference of 1 in high byte)
                const diff = (byte8100 - byte8000) & 0xFF;
                if (diff === 1) {
                    bits.push(1);
                    relocCount++;
                    
                    // Log first few relocations for debugging
                    if (relocCount <= 10) {
                        console.log(`  Relocation at offset ${i.toString(16).padStart(4, '0')}: 0x${byte8000.toString(16).padStart(2, '0')} -> 0x${byte8100.toString(16).padStart(2, '0')}`);
                    }
                } else {
                    bits.push(0);
                }
            } else {
                bits.push(0);
            }
        }
        // Note: We don't add anything for non-candidate bytes, just like smjoin-create.js skips them
    }

    console.log(`Found ${relocCount} relocatable bytes`);

    // Second loop: compress bits array into groups of 8 bits
    const relocTable = [];
    let bitCount = 0;
    let currentByte = 0;

    console.log('Compressing bits into relocation table...');
    for (let i = 0; i < bits.length; i++) {
        if (bits[i] === 1) {
            currentByte |= (1 << bitCount); // LSB-first bit setting
        }
        
        bitCount++;
        
        if (bitCount === 8) {
            relocTable.push(currentByte);
            if (currentByte !== 0) {
                console.log(`  Reloc byte ${relocTable.length - 1}: 0x${currentByte.toString(16).padStart(2, '0')} (${currentByte.toString(2).padStart(8, '0')})`);
            }
            currentByte = 0;
            bitCount = 0;
        }
    }

    // Flush final partial byte if needed
    if (bitCount > 0) {
        relocTable.push(currentByte);
        if (currentByte !== 0) {
            console.log(`  Reloc byte ${relocTable.length - 1}: 0x${currentByte.toString(16).padStart(2, '0')} (${currentByte.toString(2).padStart(8, '0')}) - final partial byte`);
        }
    }

    console.log(`Compressed to ${relocTable.length} bytes`);
    return new Uint8Array(relocTable);
}

// Run the main function
main();
