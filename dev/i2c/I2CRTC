RTC	EQU	$50		\AP6 RTC I2C Slave Address (PCF8583 Build) 
RTC_TEMP	EQU	0		\no temp support for this RTC

\-------------------------------------------------------------------------------
\Gets time and date parameters from RTC into buffer buf00-buf07 @ $0380

getrtc
	LDX	#>i2cbuf		\set I2C buffer to $0A00
	STX	bufloc
	LDX	#<i2cbuf
	STX	bufloc+1
				\set up rxd call to fetch all RTC data
	LDA	#RTC		\PCF8583 RTC device id
	STA	$68
	LDA	#0		\register number - start at 0 (control)
	STA	$69
	LDA	#17		\number of bytes to fetch (addr $00-$11)
	STA	$6A
	STA	$6C		\reg-valid flag to non-zero
	JSR	cmd6		\and make the rxd(go) call

	\ Seconds
	LDA	&A02		\ PCF8583 - Seconds (02h reg)
	STA 	buf00		\ > DS3231 - Seconds
	\ Minutes
	LDA 	&A03		\ PCF8583 - Minutes (03h reg)
	STA	buf01		\ > DS3231 - Minutes
	\ Hours
	LDA	&A04		\ PCF8583 - Hours (04h reg)
	STA	buf02		\ > DS3231 - Hours
	\ Day of Week
	LDA	&A06		\ PCF8583 - Weekdays/Months (06h reg)
	LSR A
	LSR A
	LSR A
	LSR A
	LSR A
	SED			\ Enable BCD mode
	CLC
	ADC 	#1		\ PCF8583 Day of week is base 0, S3231 is base 1
	CLD			\ Clear BCD mode
	STA	buf03		\ > DS3231 - Day
	\ Day of Month
	LDA 	&A05		\ PCF8583 - Year/Date (05h reg)
	AND	#$3F		\ Mask bits 7,6 (Year)
	STA	buf04		\ > DS3231 - Date
	\ Month
	LDA 	&A06		\ PCF8583 - Weekdays/Months (06h reg)
	AND 	#$1F 		\ Mask bits 7,6 and 5 (Weekdays)
	STA	buf05		\ > DS3231 - Month
	\ Year
	LDA 	&A05		\ PCF8583 - Year/Date
	LSR A
	LSR A
	LSR A
	LSR A
	LSR A
	LSR A
	SED			\ Enabled BCD mode
	CLC			\ Explicitly clear carry
	ADC 	&A10		\ Add offset (must be a leap year)
	CLD			\ Disabled BCD mode
	\ TODO: Check previosuly written year incase overflow and adjust offset
	STA	buf06		\ > DS3231 - Year (0-99 value)
	\ Other
	LDA 	#0
	STA 	buf07		\ > DS3231 - Zero for now
	STA	buf08		\ > DS3231 - Zero for now
	STA	buf09		\ > DS3231 - Zero for now
	STA	buf12		\ > DS3231 - Zero for now
	STA	buf17		\ > DS3231 - Zero for now
	STA	buf18		\ > DS3231 - Zero for now

	RTS			\and return

\------------------------------------------------------------------------------
\Writes the time and date data set at buf00-buf06 to the RTC
\First copies t&d bytes across to the main I2C buffer at $0A00 and then
\performs the write using an internal txd call.

writetd				\copy t&d data to I2C buffer
	\ Seconds
	LDA 	buf00		\ DS3231
	STA	&A02		\ > PCF8583 - Seconds (02h reg)
	\ Minutes
	LDA	buf01		\ DS3231
	STA	&A03		\ > PCF8583 - Minutes (03h reg)
	\ Hours
	LDA 	buf02		\ DS3231
	STA	&A04		\ > PCF8583 - Hours (04h reg)
	\ Day of Week
	LDA	buf03		\ DS3231
	SED			\ Enable BCD mode
	SEC
	SBC 	#1		\ PCF8583 Day of week is base 0
	CLD
	ASL 	A		
	ASL 	A
	ASL 	A
	ASL 	A
	ASL 	A		\ > PCF8583 - Weeekdays (bits 7-5, 06h reg)
	\ Month
	ORA	buf05		\ DS3231
	STA	&A06		\ > PCF8583 - Month (bits 4-0, 06h reg)
	\ Year
	LDA	buf06		\ DS3231 (0-99 in BCD format)
	PHA			\ Store, year with base year substracted
	AND 	#&FC		\ Leap year offset is simply year with bits 1-0 removed
	STA	&A10		\ Store offset in PCF8583 RAM
	PLA			\ Restore, year with base year substracted
	SED			\ Enable BCD mode
	SEC			\ Good practice to set before SBC
	SBC	&A10		\ Subtract offset, reminder is for bits 7-6, 05h reg
	STA	&A11		\ Store copy of last written year for check on read
	CLD			\ Disable BCD mode
	ASL 	A		\ Shift bits 1-0 until they are in 7-6 of 05h reg
	ASL 	A		\ This is because PCF8583 only stores 0-3 years
	ASL 	A		\ however corectly storing at least part of the year
	ASL 	A		\ is important for its leap year handling
	ASL 	A		\ the rest of the year (per above) is stored in &A10
	ASL 	A		\ > PCF8583 - Year/Date (bits 7-6, 05h reg)
	\ Day of Month
	ORA	buf04		\ DS3231
	STA	&A05		\ > PCF8583 - Year/Date (bits 5-0, 05h reg)

	LDA	#RTC		\set up txd call
	STA	$68		\slave address
	LDA	#0		\start from 0h reg in PCF8583
	STA	$69		\start register
	STA	$6D		\no stop inhibit
	LDA	#17
	STA	$6A		\17 bytes to tx (from 00h>11h)
	STA	$6C		\non-zero = $69 register valid
	JSR	cmd4		\perform the write via txd(go)

	RTS			\and return