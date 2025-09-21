# SMJoin ROM Relocation and Chaining Documentation

## Overview

This document captures the BBC Micro ROM relocation and chaining mechanisms used by SMJoin and related tools. The understanding was developed through analysis of three key sources:

1. **[MDFS JoinROM documentation](https://mdfs.net/Info/Comp/BBC/SROMs/JoinROM.htm)** - Describes the final chained structure
2. **MiniRom.bas & AP6 ROM source** - Show how to make ROMs joinable (with relocation data)
3. **SMJoin.bas implementation** - Reveals the actual joining process and chaining mechanism

## Understanding the Process

The MDFS documentation describes service entry points pointing to "spare space" that calls previous handlers, while the ROM sources show service entries pointing directly to their own handlers. 

The breakthrough came when it was realized:
- **Individual ROMs** (MiniRom.bas, AP6) are structured to be **joinable** (with relocation data)
- **SMJoin.bas** performs the **joining process** by relocating ROMs and inserting chaining code
- **MDFS documentation** describes the **final result** after SMJoin processing

The complete process involves three phases: making ROMs joinable, joining them with SMJoin, and the resulting chained execution flow.

## Candidate Bytes and Relocation Bitmap Generation

### What Are Candidate Bytes?

A **candidate byte** is any byte in a ROM that has the potential to be part of a relocatable address. Specifically, a candidate byte is one where **bits 7 and 6 are both set**:

```javascript
(byte & 0xC0) === 0x80
```

This means the byte has the pattern: `10xxxxxx` (where `x` can be 0 or 1)

### Why This Pattern Matters

In 6502 assembly, addresses are stored as **16-bit values** (2 bytes):
- **Low byte**: The lower 8 bits of the address
- **High byte**: The upper 8 bits of the address

When the high byte has bits 7 and 6 set (`10xxxxxx`), it indicates:
- **Bit 7 (0x80)**: This is likely a **memory address** (not just data)
- **Bit 6 (0x40)**: This suggests it's in the **upper memory range** (typically $8000-$FFFF)

### Examples of Candidate Bytes

- `0x80` = `10000000` ✅ (candidate)
- `0x81` = `10000001` ✅ (candidate) 
- `0x82` = `10000010` ✅ (candidate)
- `0x93` = `10010011` ✅ (candidate)
- `0x00` = `00000000` ❌ (not a candidate)
- `0x4C` = `01001100` ❌ (not a candidate)

### How Candidate Bytes Work in Relocation

When `smjoin-create.js` scans through a ROM:

1. **It only processes candidate bytes** - these are the ones that might contain relocatable addresses
2. **For each candidate byte**, it consumes one bit from the relocation bitmap
3. **If the bit is set (1)**, it relocates the address at that position
4. **If the bit is clear (0)**, it leaves the address unchanged

### Why This Filtering is Important

- **Performance**: Only processes bytes that could actually be addresses
- **Accuracy**: Avoids relocating data bytes that happen to have the right bit pattern
- **Efficiency**: Reduces the size of the relocation bitmap significantly

### Example: Relocation Bitmap Generation

**Important:** A candidate byte is identified by its bit pattern (`(byte & 0xC0) === 0x80`), but that doesn't automatically mean it needs relocation. The relocation system compares two versions of the same ROM compiled at different base addresses ($8000 vs $8100). If a candidate byte has the same value in both ROMs, it's likely data or a constant that happens to have the address-like bit pattern, so no relocation is needed. Only candidate bytes that differ between the two ROMs (typically by 0x01 in the high byte) are actually relocatable addresses.

Let's say we have a ROM with the following bytes at offsets 0x0000-0x000F:

```
Offset 0x0000: 0x00 (not candidate) - skipped
Offset 0x0001: 0x80 (candidate) - needs relocation
Offset 0x0002: 0x00 (not candidate) - skipped
Offset 0x0003: 0x81 (candidate) - no relocation needed
Offset 0x0004: 0x00 (not candidate) - skipped
Offset 0x0005: 0x82 (candidate) - needs relocation
Offset 0x0006: 0x00 (not candidate) - skipped
Offset 0x0007: 0x93 (candidate) - no relocation needed
Offset 0x0008: 0x00 (not candidate) - skipped
Offset 0x0009: 0x84 (candidate) - needs relocation
Offset 0x000A: 0x00 (not candidate) - skipped
Offset 0x000B: 0x85 (candidate) - no relocation needed
Offset 0x000C: 0x00 (not candidate) - skipped
Offset 0x000D: 0x86 (candidate) - needs relocation
Offset 0x000E: 0x00 (not candidate) - skipped
Offset 0x000F: 0x87 (candidate) - no relocation needed
```

**Step 1: Generate bits array (only for candidate bytes)**

A candidate byte is determined to need relocation by comparing the two compilation forms of the code at different addresses ($8000 vs $8100). If the candidate byte has different values between the two ROMs, it's a relocatable address and gets a bit value of 1. If it has the same value, it's data/constants and gets a bit value of 0.

```
Candidate at 0x0001: 0x80 (ROM $8000) vs 0x81 (ROM $8100) → different → bit = 1
Candidate at 0x0003: 0x81 (ROM $8000) vs 0x81 (ROM $8100) → same → bit = 0  
Candidate at 0x0005: 0x82 (ROM $8000) vs 0x83 (ROM $8100) → different → bit = 1
Candidate at 0x0007: 0x93 (ROM $8000) vs 0x93 (ROM $8100) → same → bit = 0
Candidate at 0x0009: 0x84 (ROM $8000) vs 0x85 (ROM $8100) → different → bit = 1
Candidate at 0x000B: 0x85 (ROM $8000) vs 0x85 (ROM $8100) → same → bit = 0
Candidate at 0x000D: 0x86 (ROM $8000) vs 0x87 (ROM $8100) → different → bit = 1
Candidate at 0x000F: 0x87 (ROM $8000) vs 0x87 (ROM $8100) → same → bit = 0
```

**Step 2: Compress into 8-bit bytes (LSB-first)**
```
bits = [1, 0, 1, 0, 1, 0, 1, 0]  (8 bits from 8 candidate bytes)
bitmap_byte_0 = 0b01010101 = 0x55 (bits 0,2,4,6 set)

Final relocation bitmap: [0x55]  (1 byte total)
```

**Note:** In this example, we have exactly 8 candidate bytes, so they compress into exactly 1 bitmap byte. If we had more candidate bytes, we would need additional bitmap bytes (e.g., 16 candidates = 2 bytes, 24 candidates = 3 bytes, etc.).

**Step 3: How smjoin-create.js consumes it**
```
Candidate at 0x0001: consume bit 0 (1) → relocate
Candidate at 0x0003: consume bit 1 (0) → no relocation
Candidate at 0x0005: consume bit 2 (1) → relocate  
Candidate at 0x0007: consume bit 3 (0) → no relocation
Candidate at 0x0009: consume bit 4 (1) → relocate
Candidate at 0x000B: consume bit 5 (0) → no relocation
Candidate at 0x000D: consume bit 6 (1) → relocate
Candidate at 0x000F: consume bit 7 (0) → no relocation
```

## Header Modification and Candidate Byte Generation

### The Process

When generating relocation data, the system must account for the fact that **header modification creates new candidate bytes**:

1. **Original ROM**: `00 00 00 4c 27 80 82 14...`
2. **After header modification**: `00 57 93 4c 27 80 82 14...`
   - Byte 1: `0x00` → `0x57` (low byte of relocation table offset)
   - Byte 2: `0x00` → `0x93` (high byte with bit 7 set)

3. **Result**: Byte 2 (`0x93`) now has `(0x93 & 0xC0) === 0x80`, making it a **candidate byte**!

### Implementation

The relocation bitmap generation process:

1. **Set header bytes first** - Set bytes 1 & 2 to the known relocation table offset
2. **Generate bitmap** - Create relocation bitmap accounting for the new candidate byte at offset 2
3. **Append bitmap** - Add the relocation bitmap to the end of the ROM

### Why This Is Necessary

- Header modification **creates new candidates** that weren't in the original ROM
- The bitmap consumption is **sequential** - each candidate byte consumes one bit
- The bitmap generation and consumption must be **perfectly aligned**
- We must set the header first, then generate the bitmap based on the modified ROM

## Complete ROM Joining Process

This section documents the complete ROM joining process as implemented in the BBC BASIC source code (`MiniRom.bas`, `AP6v133.src`, and `SMJoin.bas`). The process involves three distinct phases that work together to create joinable ROMs and then combine them into a single chained ROM image.

### Phase 1: Making ROMs Joinable (Individual ROM Sources)
**MiniRom.bas & AP6 ROM Source show how to structure ROMs for joining:**
- **Language Entry (0-2)**: `EQUB &00:EQUW RelocTable` - Points to relocation table
- **Relocation Data**: Generated by `PROCsm_table` at end of code

### Phase 2: ROM Joining Process (SMJoin.bas)
**When SMJoin loads each ROM:**
1. **Detects relocation data** from language entry pointing to relocation table
2. **Relocates the ROM** using the relocation data to new address
3. **Modifies service entry** to implement chaining:
   - Changes `JMP ServiceHandler` to `JMP NewModuleStart`
   - At `NewModuleStart`: Inserts `JSR PreviousHandler; LDX &F4` + relocated ROM code
4. **Links modules together** in a chain

### Phase 3: Final Chained Structure (MDFS Documentation)
**Result after SMJoin processing:**
```
8000   JMP MYLANG           ; Language entry (if language ROM)
8003   JMP NewStart3        ; Service entry points to newest module
...
Service1: \ Base service handler
...
NewStart3: JSR NewStart2    ; Call previous module (inserted by SMJoin)
           LDX &F4          ; Restore X register
           Service3: ...    ; ROM 3's service code
NewStart2: JSR Service1     ; Call base handler (inserted by SMJoin)  
           LDX &F4          ; Restore X register
           Service2: ...    ; ROM 2's service code
```

### Execution Flow
**When a service call happens, execution flows through the chain in reverse order:**
1. OS calls &8003 → JMP NewStart3
2. NewStart3: JSR NewStart2 → JSR Service1 → Service1 executes → returns
3. NewStart2: LDX &F4 → Service2 executes → returns  
4. NewStart3: LDX &F4 → Service3 executes → returns to OS

## Step-by-Step Instructions for SMJoin Compatibility and Creating a Combined ROM

The approach for making a ROM SMJoin-compatible depends on how the ROM is compiled and what tools are available. There are two main methods:

- **Method A**: For ROMs compiled with BBC BASIC, which has a built-in 6502 compiler that can be customized to generate the relocation bitmap
- **Method B**: For ROMs compiled with other assemblers (BeebAsm, Lancs Assembler, etc.), which require post-processing tools

Both methods achieve the same result: a ROM with proper relocation data that SMJoin can process, but they use different techniques to generate that relocation data.

### Method A: BBC BASIC ROMs (MiniRom.bas, AP6v133.src)

**Source files location:** `src.smjoin/MiniRom.bas`, `src.smjoin/SMJoin.bas`

This method shows how `MiniRom.bas` implements SMJoin compatibility using BBC BASIC's built-in relocation generation.

#### ROM Header Structure (MiniRom.bas)
```basic
.RomStart
BRK:EQUW RelocTable          \ Offsets 0-2: Language entry
JMP Service                  \ Offsets 3-5: Service entry
EQUB &82:EQUB Copyright-RomStart  \ Offsets 6-7: Copyright + copyright offset
```

#### Dual Compilation Control (MiniRom.bas)
```basic
DEFFNsm_pass(pass%)
IFpass%=0:M%=0
IFpass%=1:M%=O%-mcode%
P%=&8100-128*(pass%AND2)     \ Pass 0: &8100, Pass 2: &8000
O%=mcode%+M%*(pass%AND2)DIV2 \ Memory layout for dual compilation
IFpass%=1:IF O%+M%*2.125>L%:PRINT"Code overrun":END
=VALMID$("4647",pass%+1,1)   \ Return 4 for pass 0, 7 for pass 2
```

#### Relocation Data Generation (MiniRom.bas)
```basic
DEFPROCsm_table
base80%=mcode%+M%:base81%=mcode%:byte%=0:count%=0:off%=0:REPEAT
byte80%=base80%?off%:byte81%=base81%?off%:IF off%>=M%:byte80%=&80:byte81%=&80
IF ((byte81%-byte80%) AND &FE)<>0 THEN PRINT "ERROR: Offset by more than one page at &";~&8000+off%
IF (byte80% AND &C0)=&80:byte%=byte%DIV2+128*(byte81%-byte80%):count%=count%+1
IF count%=8:?O%=byte%:O%=O%+1:byte%=0:count%=0
off%=off%+1:UNTILoff%>=M% AND count%=0
ENDPROC
```

#### Main Assembly Process (MiniRom.bas)
```basic
PROCassem(0):CLEAR:PROCassem(2):PROCsm_table
A$="*SAVE "+fname$+" "+STR$~(mcode%+M%)+" "+STR$~O%+" FFFF0000 FFFBBC00"
PRINTA$;:OSCLIA$:PRINT
```

**Process:**
1. **`PROCassem(0)`**: Assemble at `&8100` (pass 0)
2. **`CLEAR`**: Clear memory
3. **`PROCassem(2)`**: Assemble at `&8000` (pass 2) 
4. **`PROCsm_table`**: Generate relocation data by comparing the two builds
5. **`*SAVE`**: Save final ROM with relocation data

#### Step 6: Create Combined ROM with BBC BASIC SMJoin
**Run the BBC BASIC SMJoin.bas program:**
```basic
CHAIN "SMJoin"
```

**What BBC BASIC SMJoin does:**
1. **Loads each ROM** and validates their headers
2. **Applies relocation data** to each ROM based on its final position
3. **Links service routines** to create a proper call chain
4. **Combines all ROMs** into a single image
5. **Outputs final combined ROM** ready for use

### Method B: Non-BBC BASIC ROMs (BeebAsm, Lancs Assembler, etc.)

For ROMs that cannot use BBC BASIC's `PROCsm_table` function, use the Node.js post-processing approach:

#### Step 1: Dual Compilation Setup
**Create a build script that compiles your ROM twice:**

1. **First compilation** at address `$8000`:
   ```bash
   # Compile ROM at $8000
   ./assembler source.asm -o rom_8000.bin
   ```

2. **Second compilation** at address `$8100`:
   ```bash
   # Modify ORG directive to $8100
   sed -i 's/ORG.*\$8000/ORG \$8100/' source.asm
   # Compile ROM at $8100  
   ./assembler source.asm -o rom_8100.bin
   ```

#### Step 2: Run Node.js Relocation Tool
**Use the Node.js tool to generate SMJoin-compatible ROM:**
```bash
cd bin/buildap6
node smjoin-reloc.js rom_8000.bin rom_8100.bin output_rom.bin
```

#### Step 3: What the Node.js Tool Does
**The tool automatically performs these modifications to create a SMJoin-compatible ROM:**

1. **Compares the two ROM builds** byte-by-byte to identify relocatable addresses
2. **Generates compressed relocation data** (bitmap of which bytes need relocation)
3. **Sets header bytes first** - Sets bytes 1 & 2 to the known relocation table offset
4. **Generates bitmap** - Creates relocation bitmap accounting for new candidate bytes
5. **Appends relocation data** to the end of the ROM
6. **Outputs final ROM** ready for SMJoin processing

#### Step 4: ROM Header Changes Summary
**Input ROM header:**
```assembly
romstart    DFB    0,0,0             \no language entry (3 nulls)
            JMP    service           \to service entry  
            DFB    $82               \ROM type : Service + 6502 code
            DFB    (copyr-romstart)  \offset to copyright string
```

**Output ROM header (SMJoin-compatible):**
```assembly
romstart    BRK                       \dummy language entry
            EQUW    RelocTable        \address to relocation table
            JMP     service           \to service entry (unchanged)
            DFB     $82               \ROM type : Service + 6502 code  
            DFB     (copyr-romstart)  \offset to copyright string (unchanged)
            ; ... ROM code ...
            ; ... relocation data appended at end ...
```

#### Step 5: Integration with SMJoin
**The output ROM can now be processed by SMJoin:**
- SMJoin detects the relocation data via the language entry
- SMJoin relocates the ROM to its final position
- SMJoin modifies the service entry to implement chaining
- ROM becomes part of the service call chain

#### Step 6: Create Combined ROM with SMJoin
**Use the Node.js SMJoin tool to combine multiple ROMs:**

**Method 1: Using configuration file (recommended)**
```bash
node smjoin-create.js --config config/smjoin-create-config.js
```

**What SMJoin does:**
1. **Loads each ROM** and validates their headers
2. **Applies relocation data** to each ROM based on its final position
3. **Links service routines** to create a proper call chain
4. **Combines all ROMs** into a single image
5. **Outputs final combined ROM** ready for use

## ROM Chaining Mechanism

Many ROMs programs do not use the full 8K or 16K of the ROM, and have spare space in them. You can use this spare space to add extra ROM code. This is fairly easy to do as long as no more than one component of a multi-code ROM claims memory or provides a language. The simplest method is to add purely service code to an existing ROM.

To do this, you need the image of the ROM you are adding to, and the source code (or a method of relocating the image) for the ROM code you want to add. This is done by changing the destination of the service call entry at &8003 to the start of the spare space at the end of the ROM. At the start of this spare space, the new code firstly calls the previous service handler, and then continues with the new code's service handler:

**Base ROM:**
```
8003   JMP SERV              \ Service entry
...
SERV   \ Service handler
```

**After adding new code:**
```
8003   JMP MYCODE            \ New service entry
...
SERV   \ Base service handler
...
MYCODE JSR SERV              \ Call base handler
...    \ My service handler
```

The additional code can even be a relocated ROM image with the language entry point in the first three bytes changed to the JSR SERV instruction. The following instruction will then be the relocated jump to the additional service handler.

Any number of ROM code fragments can be joined together like this. However, as each fragment is independent of each other, only one can claim workspace and use the workspace byte at &DF0+rom, and only one can be a language and be entered at &8000. To be entered as a language, the entry at &8000 should be changed to jump to the ROM code fragment's entry point:

**Base ROM:**
```
8000   BRK:BRK:BRK           \ No language entry
8003   JMP SERV              \ Service entry
```

**After adding language:**
```
8000   JMP MYLANG            \ New language entry
8003   JMP MYCODE            \ New service entry
...
SERV   \ Base service handler
...
MYCODE JSR SERV              \ Call base handler
...    \ My service handler
MYLANG \ My language startup
```

*Source: [MDFS JoinROM Documentation](https://mdfs.net/Info/Comp/BBC/SROMs/JoinROM.htm)*

## Two-Pass Assembly for Relocation Data Generation

The key to making ROMs joinable is generating relocation data that tells the system which bytes contain addresses that need to be adjusted when the ROM is moved to a different memory location.

### The Process
1. **First Pass**: Assemble the ROM code at address `&8000`
2. **Second Pass**: Assemble the same ROM code at address `&8100` 
3. **Compare**: Byte-by-byte comparison to find address differences
4. **Generate**: Create a compressed bitmap of which bytes need relocation

### Memory Layout
- **First half of buffer**: Pass 0 output (assembled at &8000)
- **Second half of buffer**: Pass 1 output (assembled at &8100)
- **Relocation table**: At the end, pointed to by ROM header

### Address Detection
The system looks for bytes that differ by exactly 1 page (256 bytes) between the two assemblies. This indicates address high bytes that need relocation:
- **&8000 assembly**: `JMP $8024` becomes `4C 24 80`
- **&8100 assembly**: `JMP $8124` becomes `4C 24 81`
- **Difference**: High byte changed from `80` to `81` (exactly 1 page)

### Relocation Bitmap Generation
The bitmap generation process uses **candidate byte filtering** for efficiency:

1. **Candidate Detection**: Each byte is checked: `(byte80% AND &C0)=&80` (candidate byte pattern)
2. **Difference Analysis**: For candidate bytes only, check if difference is ±1 page
3. **Bitmap Creation**: If difference is ±1 page: mark for relocation (bit = 1), otherwise (bit = 0)
4. **Compression**: Pack 8 relocation bits into each output byte (LSB-first)
5. **Storage**: Store compressed bitmap at end of ROM

**Important**: Only candidate bytes (those with `(byte & 0xC0) === 0x80`) are processed for relocation. This filtering:
- **Improves performance** by skipping non-address bytes
- **Reduces bitmap size** significantly 
- **Prevents false positives** from data bytes that happen to differ by 1

### ROM Header Structure
```
Byte 0: BRK ($00) - dummy language entry
Bytes 1-2: Word pointer to RelocTable (relocation bitmap address)
Bytes 3-5: JMP Service - service call entry point
Byte 6: ROM type/flags (&82 = service ROM with copyright)
Byte 7: Copyright pointer offset from RomStart
```

### Service Call Chaining
When ROMs are joined, SMJoin modifies the service entry points to create a chain:
1. **Base**: `8003 JMP SERV` (points to service handler)
2. **Modified**: `8003 JMP NewStart` (points to new module)
3. **New Module**: `JSR PreviousHandler` + `LDX &F4` + new service code

### Execution Flow
Service calls flow through the chain in reverse order (newest first):
1. OS calls &8003 → JMP NewStart3
2. NewStart3: JSR NewStart2 → JSR Service1 → Service1 executes → returns
3. NewStart2: LDX &F4 → Service2 executes → returns  
4. NewStart3: LDX &F4 → Service3 executes → returns to OS

This allows multiple ROMs to handle the same service calls, with each getting a chance to process the call before passing it to the next ROM in the chain.

## Configuration Files

The Node.js SMJoin tools support configuration files to externalize ROM definitions and settings, making the build process more maintainable and flexible.

### SMJoin Create Configuration (`smjoin-create-config.js`)

**Location:** `bin/buildap6/config/smjoin-create-config.js`

This configuration file defines which ROMs to combine and their settings:

```javascript
module.exports = {
    // ROM files to combine (in order)
    romFiles: [
        {
            path: "../../roms/AP1Plus-v1.34.rom",
            name: "AP1Plus"
        },
        {
            path: "../../roms/ROMManager-v1.34.rom", 
            name: "ROMManager",
            pageAlignment: false
        },
        {
            path: "../../roms/TUBEelk-v1.10.rom",
            name: "TUBEelk", 
            pageAlignment: false
        },
        {
            path: "../../roms/AP6Count-v0.05.rom",
            name: "AP6Count",
            pageAlignment: false
        },
        {
            path: "tmp/i2c-reloc.rom",
            name: "I2C",
            pageAlignment: true
        }
    ],

    // Output configuration
    output: {
        path: "../../dist/ap6.rom",
        name: "AP6v134t-I2C ROM (TreeCopy replaced with I2C)"
    }
};
```

**Configuration Options:**
- **`path`**: Relative path to the ROM file
- **`name`**: Display name for the ROM (used in logging)
- **`pageAlignment`**: Whether to align ROM to page boundary (256-byte boundary)
  - `true`: ROM will be aligned to next page boundary
  - `false`: ROM will be placed immediately after previous ROM
  - **Note**: First ROM always skips page alignment regardless of setting

### SMJoin Test Configuration (`smjoin-test-config.js`)

**Location:** `bin/buildap6/config/smjoin-test-config.js`

This configuration file defines the automated test suite:

```javascript
module.exports = {
    // Test server configuration
    server: {
        port: 8080,
        timeout: 10000
    },

    // ROM tests to run
    tests: [
        {
            name: "AP6.rom",
            description: "Official AP6 Plus 1.1.33 ROM - reference baseline",
            url: "https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/AP6.rom",
            expectedElements: ["RH Plus 1", "AP6"]
        },
        {
            name: "I2C.rom", 
            description: "I2C ROM - unmodified I2C ROM for comparison",
            url: "https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/I2C.rom",
            expectedElements: ["I2C", "RTC"]
        },
        {
            name: "LatestI2C8000.rom",
            description: "I2C ROM - unrelocated I2C ROM compiled at $8000",
            url: "https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestI2C8000.rom", 
            expectedElements: ["I2C", "RTC"]
        },
        {
            name: "LatestAP6.rom",
            description: "New AP6 ROM - combined ROM with I2C functionality",
            url: "https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/LatestAP6.rom",
            expectedElements: ["RH Plus 1", "AP6", "I2C", "RTC"]
        }
    ]
};
```

### SMJoin Test Server Configuration (`smjoin-test-server-config.json`)

**Location:** `bin/buildap6/config/smjoin-test-server-config.json`

This configuration file defines ROM mappings for the test server:

```json
{
  "rom_mappings": {
    "AP6.rom": "roms/ap6/AP6v134t.rom",
    "I2C.rom": "dist/i2c/I2C32EAP6.rom", 
    "LatestAP6.rom": "dist/ap6.rom",
    "LatestI2C8000.rom": "bin/buildap6/tmp/i2c-8000.rom"
  }
}
```

**Configuration Options:**
- **`rom_mappings`**: Maps test ROM names to actual file paths
- **Keys**: The ROM name used in test URLs (e.g., `AP6.rom`)
- **Values**: Relative path from project root to the actual ROM file

### Using Configuration Files

**SMJoin Create with config:**
```bash
cd bin/buildap6
node smjoin-create.js --config config/smjoin-create-config.js
```

**SMJoin Test with config:**
```bash
cd bin/buildap6  
node smjoin-test.js --config config/smjoin-test-config.js
# Or use default config:
node smjoin-test.js
```

**Test Server with config:**
```bash
cd bin/buildap6
python3 smjoin-test-server.py
# Server automatically loads smjoin-test-server-config.json
```

### Current Implementation Status

- ✅ **`smjoin-create.js`**: Full `--config` support implemented
- ✅ **`smjoin-test.js`**: Full `--config` support implemented
- ✅ **`smjoin-test-server.py`**: Uses JSON configuration file automatically

### Benefits of Configuration Files

1. **Maintainability**: ROM paths and settings centralized in one place
2. **Flexibility**: Easy to switch between different ROM combinations
3. **Documentation**: Configuration files serve as documentation of the build process
4. **Version Control**: Changes to ROM combinations tracked in git
5. **Automation**: Build scripts can reference configuration files
6. **Testing**: Test configurations can be easily modified for different scenarios

## References

- [MDFS JoinROM Documentation](https://mdfs.net/Info/Comp/BBC/SROMs/JoinROM.htm)
- MiniRom.bas implementation (`src.smjoin/MiniRom.bas`)
- AP6 ROM source (`src.AP6v133/AP6v133.src`)
- I2C ROM source (`src.i2c/I2CBeeb.asm`)
- SMJoin tool (`src.smjoin/SMJoin.bas`)
