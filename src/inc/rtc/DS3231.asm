\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\-------------------------------------------------------------------------------
\ These implementations of 'getrtc', 'writetd' and 'wtbrk' are DS3231 compatible 
\ The code below simply passes back and forth the data in bufXX to the device
\ unlike the code in /inc/rtc/PCF8583.asm there is no translation needed
\ as the main code for this ROM assumes the DS3231 format

RTC	EQU	$68		\AP6 RTC I2C Slave Address (PCF8583 Build) 
RTC_TEMP	EQU	-1		\tempurate is supported for this RTC

\-------------------------------------------------------------------------------
\Gets time and date parameters from RTC into buffer buf00-buf07 @ $0380

getrtc	LDA	#>buf00		\re-direct i2c buffer to buf00
	STA	bufloc		\($0380)
	LDA	#<buf00
	STA	bufloc+1
				\set up rxd call to fetch all RTC data
	LDA	#RTC		\DS3231 RTC device id
	STA	$68
	LDA	#0		\register number - start at 0 (secs)
	STA	$69
	LDA	#19		\number of bytes to fetch (addr $00-$12)
	STA	$6A
	STA	$6C		\reg-valid flag to non-zero
	JSR	cmd6		\and make the rxd(go) call

	LDA	#>i2cbuf		\reset I2C buffer to $0A00
	STA	bufloc
	LDA	#<i2cbuf
	STA	bufloc+1

	RTS			\and return

\------------------------------------------------------------------------------
\Writes the 7-byte time and date data set at buf00-buf06 to the DS3231 RTC
\First copies the 7 t&d bytes across to the main I2C buffer at $0A00 and then
\performs the write using an internal txd call.

writetd	LDX	#0		\copy t&d data to I2C buffer
wtd_a1	LDA	buf00,X
	STA	i2cbuf,X
	INX
	CPX	#7		\copying 7 bytes
	BNE	wtd_a1
	
	LDA	#RTC		\set up txd call
	STA	$68		\slave address
	LDA	#0
	STA	$69		\start register
	STA	$6D		\no stop inhibit
	LDA	#7
	STA	$6A		\7 bytes to tx
	STA	$6C		\non-zero = $69 register valid
	JSR	cmd4		\perform the write via txd(go)

	RTS			\and return

\------------------------------------------------------------------------------
\Writes the toggle state for *TBRK
\the DS3231 does not have free ram, so *TBRK toggle is stored in 12h register
\the 12th register is used (when enabled) for alaram functionlity so safe to use
\since this ROM does not support this feature of the RTC

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

\------------------------------------------------------------------------------
\Additional command line validation for I2CTXB
\routine needs to output its own error message and return carry set if in error state
txbval    RTS       \ no additional validation for DS3231

\Additional command line validation for I2CTXD
\routine needs to output its own error message and return carry set if in error state
txdval    RTS       \ no additional validation for DS3231