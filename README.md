I2CBeeb ROM and Support for RTC within the Electron AP6
========================================================

This project got started as a means to explore and implement RTC commands and others that make use of the RTC (a `PCF8583`) within the Electron **AP6** by Dave Hitchens. More discussion [here](https://www.stardot.org.uk/forums/viewtopic.php?t=28720). Currenty status is that the I2C ROM by MartinB is working with a reasonble level of testing. It can be downloaded from here `/dist/i2c/I2C31EAP6.rom`. See known issues below. 

**IMPORTANT DISTRIBUTION NOTE**

This repository is only for development and testing purposes, a final 
distribution means for this AP6 version of the **I2CBeeb** ROM is still being considered. Please continue to use the official I2CBeeb ROMs [thread](https://stardot.org.uk/forums/viewtopic.php?t=10966) for other variants. Looking forward, since this repo supports building all variants of the ROM, one option is this repository may become the main I2CBeeb repository in the future, or it may reside some other place. Currently the source code is only shared by Martin as attachments on StarDot and in this repository per his kind permission. 

Usage
-----

You need a Plus 1 with the AP6 expansion board fitted and a battery installed for the RTC chip to retain time and data. Download and install/load the ROM above. All the commands are as per  documentation on Martins [thread](https://stardot.org.uk/forums/viewtopic.php?t=10966) with the notable exception that the `*TEMP` command outputs `Not Available`, because the PCF8583 RTC in the AP6 does not have this feature. 

What the PCF8583 does have though is storage! Meaning you can do things like this to store information and have it retained. Note that the PCF8583 free ram starts at 10h, however the ROM uses 10h and 11h locations so please avoid using those, anything above 12h is fine! 

    *I2CRXB 50 #12 A%
    *I2CRXB 50 #02 A%
    *I2CTXB 50 #12 66

    $&A00="HELLO"
    *I2CTXD 50 #12 06
    *I2CRXD 50 #12 06
    P.$&A00

Building
--------

Please note that some manual configuration and setup is needed to build each variant of the I2CBeeb ROM (including the one that supports AP6). This is because each environment is different, especially when emulators are invovled. The information here should be enough for you to find your way around and adapt to your workflow. If you want to help out please get in touch on the StarDot thread above. 

Compilation is done natively on a BBC Micro using the **Lancs Assembler ROM** (see `/bin/Lancs Assembler`). You must transfer source files in `/src.i2c` however you prefer over to a BBC Micro (or emulation of one) with the compiler ROM installed via an SSD, serial transfer or my preference `UPURSFS`. The shell scripts in `/bin` such as `/bin/buildi2c-eap6.sh` do this and then use an emulator to compile, which runs the `*COMPILE` command. While something like `BeebASM` could be used, the source would have to be ported etc, however once setup with an emulated Beeb doing the compile, its kinda cool in an old school way!

This project uses **B-em** with **VDFS** pointing to `/dev/i2c` folder. This is also a subfolder visible to `/bin/startTubeHost.sh` used to enable the use of **UPURSFS** on real target machine (BBC or Electron). This combination allows a local (Mac in my case) workflow to compile by using the emulator (at top speed) the resulting ROM file is visible immediatly (thanks to VDFS) to the connected computer via `UPURSFS`. Its crazy but works very well once setup!

Source Files and Copying to a BBC Micro
---------------------------------------

As mentioned above, while the source files in `/src.i2c` look like they can be compiled on a modern computer, via `Beebasm` (for example), however they cannot. To compile they must be transfered to a BBC Micro per above. 

The `/src.i2c` folder structure contains the main ROM source code in `/src.i2c/I2CBeeb.asm` which leverages some include files to allow conditional compilation to result in three flavors of the ROM, supporting a BBC Micro and Acorn Electron with AP5 and AP6 interfaces. 

- Copy `/src.i2c/I2CBeeb.asm` to `I2C`
- To build `I2C31B` ROM for the BBC Micro
  - Copy `/src.i2c/inc/bus/B.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/DS3231.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/B.asm` to `I2CVER`
- To build `I2C31E` ROM for the Acorn Electron AP5
  - Copy `/src.i2c/inc/bus/E.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/DS3231.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/E.asm` to `I2CVER`
- To build `I2C31EAP6` ROM for the Acorn Electron AP6
  - Copy `/src.i2c/inc/bus/EAP6.asm` to `I2CBUS`
  - Copy `/src.i2c/inc/rtc/PCF8583.asm` to `I2CRTC` 
  - Copy `/src.i2c/inc/targets/EAP6.asm` to `I2CVER`

The shell scripts in `/bin/buildxxx.sh` perform the above copy to the virtual folder used by b-em (must be configured separate) and then copies the compiled ROM over to `/dist`. 

Martin, and indeed myself, really value lots of comments. So if you want to know more please browse the headers of the above `.asm` files to understand more how the various include files and main source file interact.

How do I increment the ROM version?
-----------------------------------

I maintained the **v3.1** version from Martin, despite adding AP6 support. This was because the existing Beeb and Electron (AP5) versions really have not changed, nor has any core new functionality been added for those users. 

If in the future a new version is needed the version is stored firstly in `/src.i2c/inc/target/X,asm` this will change the version in the compiled ROMs. However, please be aware, the filenames and other references to 3.1 are still hardcoded in a few places, especially if you are using the shell scripts in `/bin`. 

Where did the Source code come from?
------------------------------------

In the **StarDot** thread linked above, MartinB the author of the **I2C Beeb ROM** shared his code in order to help create a compatible version for the Acorn Electron AP6. Rather than create fork of his code just for AP6 I decided to explore if AP6 support can be added and thus support future updates.

Changing just the required parts of the code was quite easy as Martin had done an amazing job at separating out the code needed to access the I2C bus and read/write to the RTC from all the other logic. With a little use of the `INCLUDE` directive in the Lancs Compiler it was possible to have a single source file for the bulk of the code in `/src/I2CBeeb.asm` with the differences needed to support different targets in `/src/inc` per above. This means that should the main code be updated, we can easily rebuild all three targets from it, much like how the variants of **MMFS** work.

Martin has given kind permission in the **StarDot** thread above to leverage his code to make all this possible and hopefully making iterating on the ROM for all targets possible in the future (though right now there are no plans beyond adding support for AP6, as its kinda pretty good as-is tbh).

What are all the other files?
-----------------------------

I like to collect all the files when working on a project for ease of use and future reference. Such as the **Lancs Assembler** in `/bin` or some of my very first explorations with accessing the AP6 RTC in `/dev/ap6rtc`. You can also find original files from Martin in `/dev/i2c/archive` as well. Finally, before Martin kindly shared his code I was researching `/src.softrtc` as starting point. So really all these files are not required to develop and build the I2CBeeb ROM as described above, but serve as a handy past reference. Maybe I will clear them out in the future.

Known Issues
------------
- The AP6 uses the RTC chip PCF8583, which only holds years 0-3. A full year depends on some additional logic and storage of an offset when the year is set. This has been implemented, though the logic to update it automatically has not as yet. This means that the year will fall out of sync every 4 years without manual changes. There is partially provision to fix this in the code, it just needs some additional code to compare on read the last year stored with current and take action - this is shown in the C code examples linked below.
- Minor issue, per StarDot thread, there is a missing blank line when displaying the date/time on power on. This is possibly due to the placement of the ROM in my testing which is ROM 1. Will do more testing in other slots.

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
