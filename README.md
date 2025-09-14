I2CBeeb for Acorn Electron Plus 1 and AP6
=========================================

This project got started as a means to explore and implement RTC commands and others that make use of the RTC (a `PCF8583`) within the Electron **AP6** by Dave Hitchens. StarDot forum discussion [here](https://www.stardot.org.uk/forums/viewtopic.php?t=28720). 

Status - BeebAsm Migration Complete (Sep 2025)
----------------------------------------------

The main source code has been successfully migrated from Lancs Assembler to BeebAsm and is now located in `/src`. This migration represents a significant improvement to the development workflow, eliminating the need to run B-em emulator to compile with the Lancs Assembler. The development process is now much faster with native compilation on modern systems, and provides full compatibility with modern editors such as Visual Studio Code and its 6502 tooling extensions.

The migration required careful attention to assembler syntax differences, particularly converting high/low byte operators from Lancs `>/<` syntax to BeebAsm `HI()/LO()` functions, and fixing endianness issues by converting `DFDB` (big-endian) to `EQUB HI(), LO()` format. The result is byte-for-byte compatibility with the original Lancs Assembler ROMs, verified through comprehensive binary comparison testing using both manual `cmp` commands and custom Python comparison tools.

The build system is being updated to focus around the `/src` directory, with primary build scripts now generating AP6 support ROMs using the modern BeebAsm toolchain. While the core migration is complete, the build scripts are still in progress of being fully updated to take advantage of the new native compilation workflow. The Electron AP6 ROM variant has been successfully built and tested with native compilation, while the BBC Micro and Electron AP5 variants remain to be validated with the new build system.

Status - v3.2 Release
---------------------

This adds support for type 0 OSWORD 14 handling to ensure `*TIME` and `PRINT $TIME` on the BBC Master Compact work - when using the I2CB ROM. This is based on the patch shared [here](https://www.stardot.org.uk/forums/viewtopic.php?p=371328#p371328). I have not tested as yet on the Electron or Electon AP6 targets, but plan to, in theory they have not changed since v3.1 behavior as this was a purely additional change... An ssd with the roms in is under `\dist` and the roms under `\dist\i2c`. Also of note is that `TIME="bla..."` is not supported yet - more fun later (remind to check `\src.softrc`)

Status - AP6 Target Beta
------------------------

Current status is this variant of the **I2CBeeb ROM by MartinB** is working with a reasonble level of testing with an AP6. However it is currently labelled as **Beta**, so please expect some bugs and report on the thread. It can be downloaded from here `/dist/i2c/I2C32EAP6.rom`. See known issues below. 

**IMPORTANT DISTRIBUTION NOTE**

This repository is only for development and testing purposes, a final 
distribution means for this AP6 version of the **I2CBeeb** ROM is still being considered. Please continue to use the official I2CBeeb ROMs [thread](https://stardot.org.uk/forums/viewtopic.php?t=10966) for other variants. Looking forward, since this repo supports building all variants of the ROM, one option is this repository may become the main I2CBeeb repository in the future, or it may reside some other place. Currently the source code is only shared by Martin as attachments on StarDot and in this repository per his kind permission. 

Usage with AP6
--------------

You need a Plus 1 with the AP6 expansion board fitted and a battery installed for the RTC chip to retain time and data. Download and install/load the ROM above. All the commands, `*TSET, *DSET, *NOW, *DATE, *TIME` etc work as per documentation on Martins [thread](https://stardot.org.uk/forums/viewtopic.php?t=10966). There is one notable exception that the `*TEMP` command outputs `Not Available`, because the PCF8583 RTC does not support this.

What the PCF8583 does have though is storage! Meaning you can do things like this to store information and have it retained. Note that the PCF8583 free ram starts at address `10h`, however the ROM uses `10h` and `11h` locations so please consider these reserved, anything above `12h` is fine! Note that, `50` used in the commands below is the device ID for the installed PCF8583.

    *I2CQUERY
    *I2CRXB 50 #12 A%
    *I2CRXB 50 #02 A%
    *I2CTXB 50 #12 66

    $&A00="HELLO"
    *I2CTXD 50 #12 06
    *I2CRXD 50 #12 06
    P.$&A00

Finally, note that the AP6, has I2C headers on board, meaning you can attach easily other I2C devices and access them using the above commands. Please be careful attaching new devices and observe the correct pin out, then run `*I2CQUERY`.

Building
--------

Please note that some manual configuration and setup is needed to build each variant of the I2CBeeb ROM (including the one that supports AP6). This is because each environment is different, especially when emulators are invovled. The information here should be enough for you to find your way around and adapt to your workflow. If you want to help out please get in touch on the StarDot thread above. 

Compilation is done natively on a BBC Micro using the **Lancs Assembler ROM** (see `/bin/Lancs Assembler`). You must transfer source files in `/src.i2c` however you prefer over to a BBC Micro (or emulation of one) with the compiler ROM installed via an SSD, serial transfer or my preference `UPURSFS`. The shell scripts in `/bin` such as `/bin/buildi2c-eap6.sh` do this and then use an emulator to compile, which runs the `*COMPILE` command. While something like `BeebASM` could be used, the source would have to be ported etc, however once setup with an emulated Beeb doing the compile, its kinda cool in an old school way!

This project uses **B-em** with **VDFS** pointing to `/dev/i2c` folder. This is also a subfolder visible to `/bin/startTubeHost.sh` used to enable the use of **UPURSFS** on real target machine (BBC or Electron). This combination allows a local (Mac in my case) workflow to compile by using the emulator (at top speed) the resulting ROM file is visible immediatly (thanks to VDFS) to the connected computer via `UPURSFS`. Its crazy but works very well once setup!

Some Year Testing
-----------------

The year logic is funky! Meaning there is software workarounds to the fact the PCF8583 only stores 2 bit years, max 4 years basically. So some shadow year and offset values are also stored to get to the year value. There is some management of these each time the date/time is read. As I did not want to wait for years to pass to complete my test some poking is required to emulate the conditions the code applies to.

**Note:** These tests actually require the validation logic *I2CTXB commenting out (the `JSR txbval` and `BCS txbpx` in `txbparse`) as the I2CRXB normally does not allow the reserved storage to be written.

**Test 1** - Last year sync properly with the current year (*TBRK off)

    Step 1
    *DSET Mon 01-01-20
    *NOW
    Assert &A10=32 (offset)
    Assert &A11=0  (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=128 (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2020
    A%=0
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=0

    Step 4
    *NOW
    Assert: Year is still 22
    Assert: &A11=128

    Step 5
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=128

**Test 2** - Last year sync properly with the current year (*TBRK on)

    Step 1
    *DSET Mon 01-01-20
    *NOW
    Assert &A10=32 (offset)
    Assert &A11=1  (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=129 (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2020
    A%=1
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=1

    Step 4
    *NOW
    Assert: Year is still 22
    Assert: &A11=129

    Step 5
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=129

**Test 3** - Check it adjusts for wrap around of year in RTC (*TBRK off)

    Step 1
    *DSET Mon 01-01-22
    *NOW
    Assert &A10=32  (offset)
    Assert &A11=128 (last year and boot toggle)

    Step 2
    *DSET Mon 01-01-25
    *NOW
    Assert &A10=36  (offset)
    Assert &A11=64  (last year and boot toggle)

    Step 3 - This emulates the machine not having been powered up since 2022
    A%=32
    *I2CTXB 50 #10 A%
    A%=42
    *I2CRXB 50 #10 A%
    Assert A%=10
    A%=128
    *I2CTXB 50 #11 A%
    A%=42
    *I2CRXB 50 #11 A%
    Assert A%=128

    Step 4
    *NOW
    Assert year is 25
    Assert &A10=36
    Assert &A11=64

Source Files and Copying to a BBC Micro
---------------------------------------

As mentioned above, while the source files in `/src.i2c` look like they can be compiled on a modern computer, via `Beebasm` (for example), however they cannot. To compile they must be transfered to a BBC Micro per above. 

The `/src.i2c` folder structure contains the main ROM source code in `/src.i2c/I2CBeeb.asm` which leverages some include files to allow conditional compilation to result in three flavors of the ROM, supporting a BBC Micro and Acorn Electron with AP5 and AP6 interfaces. 

- Copy `/src.i2c/I2CBeeb.asm` to `I2C`
- To build `I2C32B` ROM for the BBC Micro
  - Copy `/src.i2c/inc/bus/B.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/DS3231.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/B.asm` to `I2CVER`
- To build `I2C32E` ROM for the Acorn Electron AP5
  - Copy `/src.i2c/inc/bus/E.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/DS3231.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/E.asm` to `I2CVER`
- To build `I2C32EAP6` ROM for the Acorn Electron AP6
  - Copy `/src.i2c/inc/bus/EAP6.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/PCF8583.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/EAP6.asm` to `I2CVER`

The shell scripts in `/bin/buildxxx.sh` perform the above copy to the virtual folder used by b-em (must be configured separate) and then copies the compiled ROM over to `/dist`. 

Martin, and indeed myself, really value lots of comments. So if you want to know more please browse the headers of the above `.asm` files to understand more how the various include files and main source file interact.

How do I increment the ROM version?
-----------------------------------

Note for the AP6 release I maintained the **v3.1** version from Martin, despite adding AP6 support. This was because the existing Beeb and Electron (AP5) versions really have not changed, nor has any core new functionality been added for those users. 

If in the future a new version is needed the version is stored firstly in `/src.i2c/inc/target/X,asm` this will change the version in the compiled ROMs. However, please be aware, the filenames and other references to 3.1 are still hardcoded in a few places, especially for the original builds or if you are using the shell scripts in `/bin` for legacy versions.

Where did the Source code come from?
------------------------------------

In the **StarDot** thread linked above, MartinB the author of the **I2C Beeb ROM** shared his code in order to help create a compatible version for the Acorn Electron AP6. Rather than create fork of his code just for AP6 I decided to explore if AP6 support can be added and thus support future updates.

Changing just the required parts of the code was quite easy as Martin had done an amazing job at separating out the code needed to access the I2C bus and read/write to the RTC from all the other logic. With a little use of the `INCLUDE` directive in the Lancs Compiler it was possible to have a single source file for the bulk of the code in `/src/I2CBeeb.asm` with the differences needed to support different targets in `/src/inc` per above. This means that should the main code be updated, we can easily rebuild all three targets from it, much like how the variants of **MMFS** work.

Martin has given kind permission in the **StarDot** thread above to leverage his code to make all this possible and hopefully making iterating on the ROM for all targets possible in the future (though right now there are no plans beyond adding support for AP6, as its kinda pretty good as-is tbh).

What are all the other files?
-----------------------------

I like to collect all the files when working on a project for ease of use and future reference. Such as the **Lancs Assembler** in `/bin` or some of my very first explorations with accessing the AP6 RTC in `/dev/ap6rtc`. You can also find original files from Martin in `/dev/i2c/archive` as well. Finally, before Martin kindly shared his code I was researching `/src.softrtc` as starting point. So really all these files are not required to develop and build the I2CBeeb ROM as described above, but serve as a handy past reference. Maybe I will clear them out in the future.

SMJoin Compatibility Implementation (Sept 2025)
------------------------------------------------

**I2C ROM Successfully Integrated into Combined AP6 ROM System ✅**

Successfully implemented SMJoin compatibility for the I2C ROM, enabling it to be combined with other AP6 ROMs into a single 16KB ROM image. For detailed technical information about the ROM relocation and chaining mechanisms, see [SMJOIN.md](SMJOIN.md).

**Key Achievements:**
- **5 ROMs successfully combined**: AP1v131, AP6v134, TUBEelk, AP6Count, I2C
- **Total size**: 12.8KB (well under 16KB limit with 3.5KB free space)
- **SMJoin compatibility**: Proper relocation data generation and ROM header format
- **Automated build and test pipeline**: Complete workflow from I2C compilation to ROM testing

**Technical Implementation:**
- **Dual compilation process**: Compile ROM at $8000 and $8100 to generate relocation data
- **Node.js relocation tool**: `smjoin-reloc.js` compares builds and generates compressed relocation bitmap
- **Header modification simulation**: Sets header bytes first, then generates bitmap accounting for new candidate bytes
- **Service entry adjustment**: Automatically adjusts addresses for relocation from $8000 to $8100

**Build Tools:**
- `bin/buildap6.sh` - Unified build pipeline script with testing flags
- `bin/smjoin/smjoin-build-i2c-rom.sh` - Builds I2C ROM at both $8000 and $8100
- `bin/smjoin/smjoin-reloc.js` - Node.js tool for relocation data generation
- `bin/smjoin/smjoin-create.js` - Node.js port of BBC BASIC SMJoin tool
- `bin/smjoin/smjoin-test.js` - Playwright-based ROM testing with emulator automation
- `dist/ap6.rom` - Final combined ROM output

**Documentation:**
- `SMJOIN.md` - Comprehensive documentation of ROM relocation and chaining mechanisms
- Detailed explanation of candidate bytes, relocation bitmap generation, and header modification
- Step-by-step instructions for both BBC BASIC and non-BBC BASIC ROMs
- Complete example of relocation bitmap generation process

**Validation:**
- All 5 ROM tests pass: AP6.rom, LatestAP6.rom, I2C.rom, LatestI2C8000.rom
- I2C ROM correctly relocates service address and integrates with AP6 Plus
- Relocation data generation is stable and reproducible
- ROM header format matches SMJoin requirements
- Emulator testing confirms "RH Plus 1" display in combined ROM

**Result:** The I2C ROM is now fully compatible with the SMJoin system and can be combined with other AP6 ROMs into a single 16KB ROM image, providing a complete AP6 ROM solution with automated testing.

TreeROM Version Compatibility Issue (Sep 2025)
-----------------------------------------------

**Issue Identified: TreeROM Version Mismatch Preventing Full ROM Combination**

During testing of the complete AP6 ROM combination (including TreeROM), a version compatibility issue was discovered that prevents the full 5-ROM combination from fitting within the 16KB limit.

**Problem Analysis:**
- **Current TreeROM available**: Version 1.62 (8,704 bytes) - too large for 16KB ROM
- **Original AP6v134t.rom used**: TreeCopy Version 1.61 (8,291 bytes) - fits successfully
- **Available space**: 8,448 bytes (after combining AP1v131, AP6v134, TUBEelk, AP6Count, I2C)
- **Space deficit**: 256 bytes (8,704 - 8,448 = 256 bytes)

**Critical Discovery:**
The original AP6v133t.rom (16,067 bytes) contained **5 ROMs without I2C**:
- AP1v131, AP6v133, TUBEelk, AP6Count, TreeROM
- **No I2C ROM was included in the original combination**

Our current build includes **4 ROMs plus I2C** (12,887 bytes), which leaves 8,448 bytes available for additional ROMs.

**Detailed Size Analysis:**
- **TreeCopy 1.61** (original): 8,291 bytes ✅
- **TreeROM v1.62** (available): 8,704 bytes ❌ (256 bytes too large)
- **Available space**: 8,448 bytes
- **Size difference**: TreeROM v1.62 is 413 bytes larger than TreeCopy 1.61
- **Conclusion**: The 16KB ROM space can accommodate either the original 5 ROMs OR 4 ROMs + I2C, but not all 6 ROMs together

**Root Cause:**
The source code analysis at [MDFS TreeCopier](https://mdfs.net/Software/CommandSrc/FileUtils/TreeCopier/) confirms that TreeCopy version 1.62 source is larger than version 1.61, explaining the size difference. The original AP6v133t.rom was built using the smaller TreeROM version 1.61.

**Current Status:**
- ✅ **4-ROM combination works perfectly**: AP1v131, AP6v134, TUBEelk, AP6Count, I2C (12,887 bytes)
- ❌ **5-ROM combination fails**: Adding TreeROM 1.62 exceeds 16KB limit by 256 bytes
- ✅ **All tests pass**: Complete build and test pipeline functional without TreeROM
- ✅ **Binary analysis confirmed**: AP6v134t.rom contains TreeCopy 1.61 (8,291 bytes), not 1.62


**Reference:** [MDFS TreeCopier Source](https://mdfs.net/Software/CommandSrc/FileUtils/TreeCopier/) - Contains source code for both TreeCopy 1.61 and 1.62 versions.

Merging I2C ROM into the AP6 Main ROM Update (Jan 2025)
-------------------------------------------------------

I have been reviewing the orignal build scripts to merge 4 ROMs into 1 and have got them running via b-em emulator and its co-processor emmulation (previously looks like the scripts ran on an A5000). The src.AP* folders contain files I have been downloading to get to the point where I can reproduce the current merged ROM from the existing ROM images. This will prove I have the build tools/scripts working. There is however a difference I am exploring with Dave Hitchens at present. Once this is resolved I can apply the realloc table to the I2C ROM and merge it in as well (its about 4kb and we have 8kb spare!). Oh and I also spent a chunk of time getting b-em building on my Macbook running Silcon hardware - build in in /bin/b-em.


Known Issues
------------
- None at present

Other (Useful) Stuff
--------------------

Various reference resources, forum posts etc..
- [Read RTC Clock - OSWORD 14](https://beebwiki.mdfs.net/OSWORD_%260E)
- [Write RTC Clock - OSWORD 15](https://beebwiki.mdfs.net/OSWORD_%260F)
- [Real time clock upgrade for Electron](https://www.stardot.org.uk/forums/viewtopic.php?p=419371&hilit=RTC#p419371)
- [OSWORD 14 & 15 numbers for real-time clocks](https://www.stardot.org.uk/forums/viewtopic.php?t=28743)
- [Userport RTC](https://stardot.org.uk/forums/viewtopic.php?f=3&t=26270)
- [Setting a real-time clock to centi-second accuracy](https://www.stardot.org.uk/forums/viewtopic.php?p=419313#p419313)
- [Handling year in the RTC](https://github.com/xoseperez/pcf8583/blob/master/src/PCF8583.cpp)
- [Handling year in the RTC another example](https://github.com/xoseperez/pcf8583/blob/master/src/PCF8583.cpp#L162)
- [Handling year in the RTC yet another example](https://github.com/pciebiera/rtc-philips-pcf8583/blob/master/rtc-philips-pcf8583.c )
- [ROM joining approach](https://mdfs.net/Info/Comp/BBC/SROMs/JoinROM.htm)
- [Interesting base code for ROMS](https://mdfs.net/Software/BBC/SROM/Tools/MiniROM.src)
- [Source code AP6Count useful ref](https://mdfs.net/Software/BBC/SROM/AP6Count.bas)
- [Source code AP6 Plus 1 ROM](https://mdfs.net/Software/BBC/SROM/Plus1/)
