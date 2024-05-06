                     SoftRTC - Soft Real-Time Clock
                     ------------------------------
Implements a Real-Time Clock using the system TIME timer. The time&date
stored in TIME is preserved over BREAK, though it may lose a few seconds.
The year range is 1980 to 2107. The day of the week is calculated from the
date.

OSWORD 14 - Read RTC
 XY?0=0+n use 7-bit BCD date block
 XY?0=8+n use 8-bit BCD date block
 XY?0=0  XY?0=8   Read as 25-character string
 XY?0=1  XY?0=9   Read as 7- or 8-byte BCD block
 XY?0=2  XY?0=10  Convert 7- or 8-byte BCD block at XY+1 to string
 XY?0=3  XY?0=11  Read as 5-byte centisecond time (unsupported)

OSWORD 15 - Write RTC
 XY?0=5   Set from 5-byte centisecond time (unsupported)
 XY?0=7   Set from XY+1=BCD 7-byte date block with year 1980-2079
 XY?0=8   Set from XY+1=BCD 8-byte date block with century
 XY?0=8   Set from XY+1="hh:mm:ss"
 XY?0=11  Set from XY+1="dd mmm yyyy"
 XY?0=15  Set from XY+1="DDD,dd mmm yyyy"
 XY?0=20  Set from XY+1="dd mmm yyyy.hh:mm:ss"
 XY?0=24  Set from XY+1="DDD,dd mmm yyyy.hh:mm:ss"

String date format:
 "DDD,dd mmm yyyy.hh:mm:ss"
 The punctuation is normally irrelevant, the position of the component
 values is fixed.

7-byte BCD date block format:
 +0 year    &00-&99, year is 1980-2079
 +1 month   &01-&12
 +2 date    &01-&31
 +3 day     &01-&07 Sun-Sat
 +4 hour    &00-&59
 +5 minute  &00-&59
 +6 second  &00-&59

8-byte BCD date block format:
 +0 century &00-&99 (&19-&21 supported)
 +1 year    &00-&99
 +2 month   &01-&12
 +3 date    &01-&31
 +4 day     &01-&07 Sun-Sat
 +5 hour    &00-&59
 +6 minute  &00-&59
 +7 second  &00-&59

*TIME and *DATE are synonyms
 *TIME        - display time from OSWORD 14,0
 *TIME string - set time with OSWORD 15,length

The SoftRTC source code can be used to implement RTC support using any
other RTC source by changing the RTC read and write routines.

https://mdfs.net/Software/BBC/SROM/Tools/SoftRTC.src.bas