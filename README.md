Support for RTC within the Electron AP6
=======================================

Project to explore and hopefully implement RTC commands and others that make use of the RTC within the Electron AP6. More discussion [here](https://www.stardot.org.uk/forums/viewtopic.php?t=28720). 

Useful Stuff
------------

Various reference resources, forum posts etc..
- [Read RTC Clock - OSWORD 14](https://beebwiki.mdfs.net/OSWORD_%260E)
- [Write RTC Clock - OSWORD 15](https://beebwiki.mdfs.net/OSWORD_%260F)
- [Real time clock upgrade for Electron](https://www.stardot.org.uk/forums/viewtopic.php?p=419371&hilit=RTC#p419371)
- [OSWORD 14 & 15 numbers for real-time clocks](https://www.stardot.org.uk/forums/viewtopic.php?t=28743)
- [Userport RTC](https://stardot.org.uk/forums/viewtopic.php?f=3&t=26270)
- [Setting a real-time clock to centi-second accuracy](https://www.stardot.org.uk/forums/viewtopic.php?p=419313#p419313)

Notes
-----

*I2CRXB 50 #10 A%
*I2CRXB 50 #02 A%
*I2CTXB 50 #10 66

$&A00="HELLO"
*I2CTXD 50 #12 06
*I2CRXD 50 #12 06
P.$&A00

writetd - copies from buf00-buf06 (7 bytes) to &A00 and writes to RTC
- here I could do the transform from DS3231 to PCF8583 format
- i can transform into $A00 before the write
gettd - reads diretly into buf00-buf12
- here I could do the transform from PCF8583 to DS3231 format
- i can read directoy into $A00 then transform into buf00-buf12 

Maybe some kind of fancy mapping thing?
PCT8583 > DS3231
00 > 01, 7F > 35  \ Seconds
... \ Hours
... etc

Handling year...
https://github.com/xoseperez/pcf8583/blob/master/src/PCF8583.cpp 
https://github.com/xoseperez/pcf8583/blob/master/src/PCF8583.cpp#L162 

https://github.com/pciebiera/rtc-philips-pcf8583/blob/master/rtc-philips-pcf8583.c 

Testing writing
---------------

After *NOW that gives

16:32:16 Tue 10-02-00

0A00 01 64 16 32 16 10 42 00

     ?? ??

*TSET 16:32:16

0A00 02 35 16 32 16 10 42 00

     00 01 02 03 04 05 06

Things Remaining
----------------

- Make the repo private and upload this to GitHub for safe keeping
- Implement remaining year handling
- Look for comment TODO's and fix
- Add comments to notes in I2CBeeb.asm on mapping /bus, /rtc and /targets to beeb files
- Write Dave H some test scripts/code for AP6

- Done - Fix banner positioning on hard reset / boot, see tip from Dave in stardot
     - https://mdfs.net/Software/BBC/SROM/AP6Count.bas - this manipulates &267 to supress
     - https://mdfs.net/Software/BBC/SROM/Plus1/ 
     - Looks like this was in from the start - reproduced with orignal ROM - revist separatly
- Done - Test build system results in binary identical versions of original 3.1 ROMs

Next Project
------------
- https://mdfs.net/Info/Comp/BBC/SROMs/JoinROM.htm - ROM joining thing
- https://mdfs.net/Software/BBC/SROM/Tools/MiniROM.src - Base ROM code