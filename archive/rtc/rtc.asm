; Test code to establish how to read and write from the RTC in the AP6 
ORG &1900

OSWRCH=&FFEE
RTCADDR=&A0
ap6reg=&FCD6
ap6idle = $11
xsdahi = &80
xsdalo = &7F
xsclhi = &40
xscllo = &BF
ap6regc=&70
byte=&71
ackNak=&72
rtcAddr=&73

.begin
.exec
      \ Basic test code writes X and reads it from free RAM
      LDA #'X'
      LDX #&12
      JSR writeByte
      LDX #&12
      JSR readByte
      JSR OSWRCH
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
      JSR scllo
      ASL byte
      BCC writeValueLow
      JSR sdahi
      BNE writeValueDone
.writeValueLow
      JSR sdalo
.writeValueDone
      JSR sclhi
      DEX
      BNE writeValueLoop
      JSR scllo
      JSR sdahi
      JSR sclhi
      LDA ap6reg
      AND #xsdahi
      STA ackNak
      JSR scllo
      PLA
      TAX
      RTS
  
.readValue
      TXA
      PHA
      LDA #0
      STA byte
      LDX #8
.readValueLoop
      JSR scllo
      JSR sclhi
      LDA ap6reg
      AND #xsdahi
      CMP #xsdahi
      ROL byte
      DEX
      BNE readValueLoop
      JSR scllo
      JSR sdahi
      JSR sclhi
      JSR scllo
      PLA
      TAX
      LDA byte
      RTS
      
.sclhi
	LDA 	ap6regc
	ORA 	#(xsclhi)
	STA 	ap6regc
	STA 	ap6reg
      RTS

.scllo
	LDA 	ap6regc
	AND 	#(xscllo)
	STA 	ap6regc
	STA 	ap6reg
      RTS

.sdahi
	LDA	ap6regc
	ORA	#(xsdahi)
	STA	ap6regc
	STA	ap6reg
	RTS

.sdalo
	LDA	ap6regc
	AND	#(xsdalo)
	STA	ap6regc
	STA	ap6reg
	RTS

.i2clock
	JSR sclhi
	JSR scllo
      RTS

.i2cidle
	JSR scllo
	JSR sdahi
	JSR sclhi
      RTS

.stop
	JSR scllo
	JSR sdalo
	JSR sclhi
	JSR sdahi
	RTS

.start
	LDA #ap6idle
	STA ap6reg
	STA ap6regc
	JSR i2cidle
	JSR sdalo
	JSR scllo
	RTS

.end
 
PUTBASIC "rtc.bas", "RTCTEST"
SAVE "RTC", begin, end, exec 