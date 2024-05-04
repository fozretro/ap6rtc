; Test code to establish how to read and write from the RTC in the AP6 
ORG &900

; OS Routines and Locations
OSWORD=&FFF1
OSWRCH=&FFEE
OSBYTE=&FFF4
OSARGS=&FFDA
ACCCON=&FE34
ROMSEL=&FE30

RTCADDR=&A0
I2CBUS=&FCD6
SCTL=&11
SCLHIGH=&40
SCLLOW=&BF
SDAHIGH=&80
SDALOW=&7F
sctl=&70
byte=&71
ackNak=&72
rtcAddr=&73

.begin
.exec
      \ LDA #65
      \ LDX #&10
      \ JSR writeByte
      LDX #2
      JSR readByte
      \ JSR &FFEE
      \ LDA #65
      \ JSR &FFEE
      \ JSR start
      \ LDA #50
      \ JSR writeValue
      RTS

.writeByte
      PHA              \ value
      TXA
      PHA              \ address
      JSR start
      LDA #RTCADDR
      JSR writeValue
      PLA              \ address
      JSR writeValue
      PLA              \ value
      JSR writeValue
      JSR stop
      RTS

  .readByte
      TXA
      PHA
      JSR start
      LDA #RTCADDR
      JSR writeValue
      PLA
      JSR writeValue
      JSR start
      LDA #RTCADDR+1
      JSR writeValue
      JSR readValue
      PHA
      JSR stop
      PLA
      RTS

  .writeValue
      STA byte
      TXA
      PHA
      LDX #8
  .writeValueLoop
      JSR setClkLow
      ASL byte
      BCC writeValueLow
      JSR setSdaHi
      BNE writeValueDone
  .writeValueLow
      JSR setSdaLow
.writeValueDone
      JSR setClkHi
      DEX
      BNE writeValueLoop
      JSR setClkLow
      \ JSR setIn
      JSR setSdaHi
      JSR setClkHi
      LDA I2CBUS
      AND #SDAHIGH
      STA ackNak
      JSR setClkLow
      \ JSR setOut
      PLA
      TAX
      RTS
  
  .readValue
      TXA
      PHA
      LDA #0
      STA byte
      \ JSR setIn
      LDX #8
  .readValueLoop
      JSR setClkLow
      JSR setClkHi
      LDA I2CBUS
      AND #SDAHIGH
      CMP #SDAHIGH
      ROL byte
      DEX
      BNE readValueLoop
      \ JSR setOut
      JSR setClkLow
      JSR setSdaHi
      JSR setClkHi
      JSR setClkLow
      PLA
      TAX
      LDA byte
      RTS
 
 .setOut
      LDA sctl
      ORA #(SCLHIGH+SDAHIGH)
      STA sctl
      STA I2CBUS
      RTS
 
 .setIn
      LDA sctl
      AND #(SDALOW)
      ORA #(SCLHIGH)
      STA sctl
      STA I2CBUS
      RTS
 
 .off
      LDA sctl
      AND #(SCLLOW AND SDALOW)
      STA sctl
      STA I2CBUS
      RTS
 
 .setClkHi
      LDA sctl
      ORA #(SCLHIGH)
      STA sctl
      STA I2CBUS
      RTS
 
 .setClkLow
      LDA sctl
      AND #(SCLLOW)
      STA sctl
      STA I2CBUS
      RTS
 
 .setSdaHi
      LDA sctl
      ORA #(SDAHIGH)
      STA sctl
      STA I2CBUS
      RTS
 
 .setSdaLow
      LDA sctl
      AND #(SDALOW)
      STA sctl
      STA I2CBUS
      RTS
 
 .start
      SEI
      LDA #SCTL
      STA sctl
      STA I2CBUS
      \JSR setOut
      \JSR setClkLow
      JSR setSdaHi
      JSR setClkHi
      JSR setSdaLow
      JSR setClkLow
      RTS
 
 .stop
      JSR setClkLow
      JSR setSdaLow
      JSR setClkHi
      JSR setSdaHi
      JSR setClkLow
      JSR off
      CLI
      RTS

.end
 
PUTFILE "dev/ap6rtc/!BOOT", "!BOOT", &0000
SAVE "RTC", begin, end, exec 