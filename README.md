Support for RTC within the Electron AP6
=======================================

This is a project to explore and implement RTC commands and others that make use of the RTC within the Electron AP6 by Dave Hitchens. More discussion [here](https://www.stardot.org.uk/forums/viewtopic.php?t=28720). Currenty status is that the I2C ROM by MartinB is working! See `/dist/i2c/I2C31EAP6.rom` and known issues below. 

**IMPORTANT NOTE**: This reposotiry is only for development purposes a final distribution means for this has note been considered. 

Useful Stuff
------------

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

Test Commands
-------------

    *I2CRXB 50 #10 A%
    *I2CRXB 50 #02 A%
    *I2CTXB 50 #10 66

    $&A00="HELLO"
    *I2CTXD 50 #12 06
    *I2CRXD 50 #12 06
    P.$&A00

TODO List
---------
- Implement remaining year handling
- Look for comment TODO's and fix
- Add comments to notes in I2CBeeb.asm on mapping /bus, /rtc and /targets to beeb files
- Write Dave H some test scripts/code for AP6

Known Issues
------------
- Minor issue, per StarDot thread, there is a missing blank line when displaying the date/time on power on. This is possibly due to the placement of the ROM in my testing which is ROM 1. Will do more testing in other slots.