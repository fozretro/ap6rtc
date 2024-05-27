
\------------------------------------------------------------------------------
\ writes the toggle state for *TBRK
\ the DS3231 does not have free ram, so *TBRK toggle is stored in 12h register
\ the 12th register is used (when enabled) for alaram functionlity so safe to use
\ since this ROM does not support this feature of the RTC

wtbrk	
	LDA	#RTC		\target i2c device id (here rtc)
	STA	$68
	STA	$6C		\$6C<>0 mean register specified in $69
	LDA	#12		\start register = 12 = Alarm 2 Hours
	STA	$69
	LDA	#0
	STA	$6D		\$6D=0 means Stop after txb
	JSR	cmd3		\and send the byte via txb(go)
	RTS