\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\-------------------------------------------------------------------------------
\ These implementations of 'getrtc', 'writetd' and 'wtbrk' are PFC8583 compatible 
\ The code below respects DS3231 data layout assumptions in the main code so there is
\ is no impact the to the main structure of the code regardless of RTC used.
\ The PCF8583 is fitted to an Acorn Electron AP6 expansion for the Plus 1

RTC	EQU	$50		\AP6 RTC I2C Slave Address (PCF8583 Build) 
RTC_TEMP	EQU	0		\no tempurate support for this RTC

\-------------------------------------------------------------------------------
\ Notes
\ 1 - Subroutines must honor the register format of DS3231, effectively internal format used by this ROM
\    When getrtc returns the contents of bufXX are as if a DS3231 was read from
\    When writetd is called the contents of bufXX are mapped to what PCF8583 expects before writing
\ 2 - There is no temperature support so related code paths are conditinally compiled out via RTC_TEMP
\ 3 - Register 10h onwards is free ram in PCF8583, below code reserves use of 10h and 11h
\ 4 - Register 10h is used for an offset to calculate the year (since PCF8583 only stores 0-3 years)
\ 5 - Register 11h bits 7-6 store a copy of the last year value writen to the devices month/year register
\ 6 - Register 11h bit 0 stores the status to *TBRK command to display date/time on boot

\-------------------------------------------------------------------------------
\Gets time and date parameters from RTC into buffer buf00-buf07 @ $0380

getrtc
	LDX	#>i2cbuf		\set I2C buffer to $0A00
	STX	bufloc
	LDX	#<i2cbuf
	STX	bufloc+1		\set up rxd call to fetch all RTC data				
	LDA	#RTC		\PCF8583 RTC device id
	STA	$68
	LDA	#0		\register number - start at 0 (control)
	STA	$69
	LDA	#18		\number of bytes to fetch (addr $00-$11)
	STA	$6A
	STA	$6C		\reg-valid flag to non-zero
	JSR	cmd6		\and make the rxd(go) call
	JSR	fromPCF8583	\update t&d data (bufXX) from I2C buffer ($A00)
	RTS			\and return

\------------------------------------------------------------------------------
\Writes the time and date data set at buf00-buf06 to the RTC
\First copies t&d bytes across to the main I2C buffer at $0A00 and then
\performs the write using an internal txd call.

writetd				
	JSR 	toPCF8583		\copy t&d data (bufXX) to I2C buffer ($A00)
	LDA	#RTC		\set up txd call
	STA	$68		\slave address
	LDA	#0		\start from 0h reg in PCF8583
	STA	$69		\start register
	STA	$6D		\no stop inhibit
	LDA	#18
	STA	$6A		\17 bytes to tx (from 00h>11h)
	STA	$6C		\non-zero = $69 register valid
	JSR	cmd4		\perform the write via txd(go)
	RTS			\and return

\------------------------------------------------------------------------------
\ writes the toggle state for *TBRK
\ the PCF8583 has free ram, and so we can use some of that to store the toggle state
\ in this case in reg 11h, this contains last written year and the toggle state
\ On calling this subscrounte &6A arrives with (bit 0) 0 or 1 depending on toggle state
\ On returning the caller expects &6A to be untouched

wtbrk	
	LDA 	&6A		\toggle value 0 or 1
	PHA			\stores to return &6A back to caller in orignal state
	STA	buf12		\copy toggle value to DS3231 buffer
	JSR	toPCF8583		\calculate PCF8583 register values from bufXX values
	LDA	&A11		\transfer calculated value for register 11h (combo of toggle and last year)
	STA	&6A		\to new single byte value to be written
	LDA	#RTC		\target i2c device id
	STA	$68
	STA	$6C		\$6C<>0 mean register specified in $69
	LDA	#17		\start register = 17 (11h) free frame 
	STA	$69
	LDA	#0
	STA	$6D		\$6D=0 means Stop after txb
	JSR	cmd3		\and send the byte via txb(go)
	PLA			\restore &68 value
	STA	&6A		\caller expects 0 or 1 
	RTS

\-------------------------------------------------------------------------------
\Copies from PCF8583 data in &A00 to DS3231 bufXX
fromPCF8583
          \ Check for a year change
          JSR       checkYearChange
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
	STA	buf06		\ > DS3231 - Year (0-99 value)
	\ Display time/date on boot
	LDA	&A11		\ PCF8583 - Use bit 0 of 11h free ram for boot message toggle
	AND	#1		\ Mask off all bits other than 0 (11h 7-6 bits store last written year)
	STA	buf12		\ > DS3231 - honor use of RTC 'Alarm 2 Hour' field (bits 3-0)
	\ Other
	LDA 	#0
	STA 	buf07		\ > DS3231 - Zero for now
	STA	buf08		\ > DS3231 - Zero for now
	STA	buf09		\ > DS3231 - Zero for now
	STA	buf17		\ > DS3231 - Zero for now
	STA	buf18		\ > DS3231 - Zero for now
          RTS

\------------------------------------------------------------------------------
\ Following logic is ported from getYear https://github.com/xoseperez/pcf8583/blob/master/src/PCF8583.cpp          
\ This routine deals with software support needed by PCF8583 as it only stores 0-3 years
\ Refer to the above C++ code for more information
checkYearChange

          \ On read keep the last year set in sync with current device year by comparing the two values
          LDA       &A11                \ Read byte with last set year in
          AND       #192                \ Only intersted bits 7-6
          STA       &A12                \ Store in temp storage for compare
          LDA       &A05                \ Read byte with current clock year in
          AND       #192                \ Only intersted bits 7-6
          STA       &A13                \ Store in temp storage for compare
          LDA       &A12                \ Load extracted last set year (bits 7-6 only)
          CMP       &A13                \ Compare with extracted current clock year (bits 7-6 only)
          BEQ       noChange            \ Nothing to do, no new year since clock last read/written
	LDA	&A11		\ Get the current toggle state for the break message
	AND	#1		\ Only interested in bit 0 this time
          ORA       &A13                \ Combine with the current clock year (bits 7-6)
          STA       &A11                \ Store back the updated last year and toggle state value
          
          \ Send updated 11h register storing Last Year + Boot Message Toggle to device
	STA	&6A		\ To new single byte value to be written
	LDA	#RTC		\ Target i2c device id
	STA	$68
	STA	$6C		\ $6C<>0 mean register specified in $69
	LDA	#17		\ Start register = 17 (11h) free frame 
	STA	$69
	LDA	#0
	STA	$6D		\ $6D=0 means Stop after txb
	JSR	cmd3		\ Send the byte via txb(go)

          \ The year changed, so check for 4 year overlfow, by checking if the last year is now greater than current year?
          LDA       &A12                \ Load extracted last set year (bits 7-6 only)
          CMP       &A13                \ Compare with extracted current clock year (bits 7-6 only)
          BCC       noChange            \ Last year less than current year?
          SED			\ Enable BCD mode
          CLC                           \ Clear carry
          LDA       &A10                \ If greater than more than 4 years passed and we need to update offset
          ADC       #4                  \ Adjust offset + 4 to compensate
          STA       &A10                \ Store updated offset
          CLD			\ Disabled BCD mode

          \ Send updated 10h register storing Year Offset to device
	STA	&6A		\ To new single byte value to be written
	LDA	#RTC		\ Target i2c device id
	STA	$68
	STA	$6C		\ $6C<>0 mean register specified in $69
	LDA	#16		\ Start register = 16 (10h) free frame 
	STA	$69
	LDA	#0
	STA	$6D		\ $6D=0 means Stop after txb
	JSR	cmd3		\ Send the byte via txb(go)

nochange  RTS

\------------------------------------------------------------------------------
\Copies from DS3231 data in bufXX to PCF8583 data in $A00
toPCF8583
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
	SBC	&A10		\ Subtract offset, reminder is to be used for bits 7-6, 05h reg
	CLD			\ Disable BCD mode
	ASL 	A		\ Shift bits 1-0 until they are in 7-6 of 05h reg
	ASL 	A		\ This is because PCF8583 only stores 0-3 years
	ASL 	A		\ however corectly storing at least part of the year
	ASL 	A		\ is important for its leap year handling
	ASL 	A		\ the rest of the year (an offset) is stored in &A10
	ASL 	A		\ > PCF8583 - Year/Date (bits 7-6, 05h reg)
	STA	&A05		\ store what we have for 5h so far
	\ Year Copy and Show on Break Toggle
	ORA	buf12		\ DS3231 dispaly on boot state is stored in bit 0 of buf12 
	STA	&A11		\ > PCF8583 - Store copy year and ToB state in user ram
	\ Day of Month
	LDA	&A05		\ load previously calc'd 5h value with year in bits 7-6
	ORA	buf04		\ now apply DS3231 value for date (bits 5-0)
	STA	&A05		\ > PCF8583 - Year/Date (bits 5-0, 05h reg)
	RTS

\------------------------------------------------------------------------------
\Additional command line validation for I2CTXB
\routine needs to output its own error message and return carry set if in error state
\in this case we are perventing the user overwriting to regsiters below h11
txbval
          LDA       i2cdev              \ Validation only applies when writing to PCF8583
          CMP       #RTC
          BNE       etxbval             \ skip if device is not PCF8583
          LDA       i2creg
          CMP       #&12                \ check if byte is within reserved range
          BCS       etxbval             \ ok if greater than or equal h12
          LDA       #8                  \ otherwise emit 'Reserved' error 
          JSR	xmess
          SEC                           \ confirm we are in error to caller
          RTS
etxbval   CLC                           \ no error
          RTS

\------------------------------------------------------------------------------
\Additional command line validation for I2CTXD
\routine needs to output its own error message and return carry set if in error state
\in this case we are perventing the user overwriting free ram used by this ROM when using PCF8583
txdval    
          JSR       txbval              \ regards of bytes written check start register
          RTS          