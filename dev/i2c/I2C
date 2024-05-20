\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\	   *** I2C Beeb ***	     	 \
\	   I2C Rom Utilities	 \
\          (c) Martin Barr 2018	 \
\			     	 \
\	         V3.2EAP6	     	 \
\	        16-11-18	     	 \
\			     	 \
\    	 For the Acorn Electron (AP6)	 \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\-------------------------------------------------------------------------------
\Notes:
\
\1. Assumes Electron with Plus 1 and AP6 expansion
\
\2. Commands :	*I2C
\		*I2CRESET
\		*I2CQUERY (Q)
\		*I2CTXB <addr> (#<hh>) <byte>(;)
\		*I2CTXD <addr> (#<hh>) <no.bytes>(;)
\		*I2CRXB <addr> (#<hh>) (A%-Z%)
\		*I2CRXD <addr> (#<hh>) <no.bytes>
\		*I2CSTOP
\		*TBRK
\		*TIME
\		*DATE
\		*TEMP
\		*NOW
\		*NOW$
\		*TSET <hh:mm:ss>
\		*DSET <day> <dd-mm-yy>
\
\
\3. Changes introduced in v1.0 :
\
\	a) Adds *I2C command.
\	b) Adds 'Q' switch to *I2CQUERY to allow output suppression.
\	c) Fully implements low-level direct rom calls for machine-code
\	   programming.
\
\4. Changes introduced in v2.0 :
\
\	a) Corrects an RxB bug which was writing to an integer variable
\	   when not specified. (Multi-use zp flag problem.)
\	b) Many low level digital signal control subroutines replaced by
\	   macros and embedded in main routines to offer significant bit-
\	   stream speed increases. (Approx. 20KHz > 30KHz)
\	c) Prints blank line leader during *HELP or *HELP I2C
\
\5. Changes introduced in v3.0 :
\
\	a) Migrates I2C bus from User Port to Analogue Port using System
\	   VIA @ $FE40 where SCL=PB4 and SDA=PB5 (Joystick Fire 0 & 1)
\	   (Not applicable to Electron as it has no equivalent Analogue Port)
\
\6. Changes introduced in v3.1 :
\
\	a) Embedded RTC Time & Date support as per RAMagic! adding :
\	   *TBRK *TIME *DATE *TEMP *NOW *NOw$
\	   *TSET <hh:mm:ss>
\	   *DSET <day> <dd-mm-yy>
\
\	b) *NOW$ creates a 25-character ASCII BCD string at i2cbuf (&0A00) in
\	   the form of 21:14:35<spc>Fri<spc>19-10-18<spc>21<cr>
\
\	c) Implements new OSWORD &0E Type 4 call to return time string :
\
\		On entry:
\		  XY+0=function code
\		Type 4 - Return BCD time and date string.
\		On exit:
\		  XY?0 to XY?24 = 21:14:35<spc>Fri<spc>19-10-18<spc>21<cr>
\
\	d) Implements OSWORD &0E Type 1 call to return time parameter block :
\
\		On entry:
\		  XY+0=function code
\		Type 1 - Return BCD clock value.
\		On exit:
\		  XY?0=year	(&00-&99)
\		  XY?1=month	(&01-&12)
\		  XY?2=date	(&01-&31)
\		  XY?3=day of week	(&01-&07, Sun-Sat)
\		  XY?4=hours	(&00-&23)
\		  XY?5=minutes	(&00-&59)
\		  XY?6=seconds	(&00-&59)
\
\	e) Adds a further blank line during *HELP or *HELP I2C but now after
\	   the end of rom print dialogue.
\
\7. Changes introduced in v3.2
\
\   a) Support for Electron Plus 1 with AP6 expansion
\
\-------------------------------------------------------------------------------
\Constants etc. defined here

OSASCI	EQU	$FFE3		\print A to screen
OSWRCH	EQU	$FFEE		\write A to output stream
OSNEWL	EQU	$FFE7		\print new line
OSBYTE	EQU	$FFF4		\OSBYTE
OSRDCH	EQU	$FFE0		\read character from input stream

OSW_A	EQU	$EF		\A at time of unknown OSWORD call
OSW_X	EQU	$F0		\X at .....
OSW_Y	EQU	$F1		\Y at .....

				\ AP6 Interface
ap6reg	EQU 	$FCD6
xsdahi	EQU 	&80		\ TODO Explain bitmask
xsdalo	EQU 	&7F		\ TODO Explain bitmask
xsclhi	EQU 	&40		\ TODO Explain bitmask
xscllo	EQU 	&BF		\ TODO Explain bitmask

COMVEC	EQU	$0234		\command execution vector (IND3V)
cli	EQU	$F2		\command line pointer - use (cli),Y
ivars	EQU	$0400		\BASIC integer % variable base address

bufloc	EQU	$CE		\zp,y pointer to i2c buffer for RxB..
				\..and RxD. Normally $0A00 but can..
				\..also be $0380 during RTC access.

i2cbuf	EQU	$0A00		\i2c Tx and Rx data buffer (to $0AFF)
eeplo	EQU	$60		\24C32 target address lo-byte for r/w
eephi	EQU	$61		\24C32 target address hi-byte for r/w
ap6regc	EQU	$62		\last written value to AP6 control reg
bcdt	EQU	$63		\temporary for bcd tens
bcdu	EQU	$64		\temporary for bcd units
i2cslot	EQU	$65		\sideways rom slot id of i2c rom
zpreg	EQU	$66		\transient store for Pxr registers
i2cstat	EQU	$67		\i2c transaction status 0=good
i2cdev	EQU	$68		\i2c slave device address
i2creg	EQU	$69		\i2c slave device target register
i2cbyte	EQU	$6A		\i2c rx or tx byte
temp1	EQU	$6B		\command transient temporary #1
temp2	EQU	$6C		\command transient temporary #2
htextl	EQU	$6D		\help text pointer lo / general flag
htexth	EQU	$6E		\help text pointer hi / general flag
comdata	EQU	$6F		\temp Y store during command parsing

devidlo	EQU	$08		\lowest i2c device id to interrogate
devidhi	EQU	$77		\highest i2c device id to interrogate

EEP32	EQU	$57		\AT24C32 eeprom I2C slave address
RTC	EQU	$50		\AP6 RTC I2C Slave Address 
cs	EQU	$7F		\seconds	  :	Bits 6-0 Mask $7F
cm	EQU	$7F		\minutes	  :	Bits 6-0 Mask $7F
ch	EQU	$3F		\hours	  :	Bits 5-0 Mask $3F
cwd	EQU	$07		\weekday	  :	Bits 3-0 Mask $07
cdd	EQU	$3F		\day	  :	Bits 5-0 Mask $3F
cmm	EQU	$1F		\month	  :	Bits 4-0 Mask $1F
cyy	EQU	$FF		\year	  :	Bits 7-0 Mask $FF
deg	EQU	$7F		\temperatue :	Bits 6-0 Mask $7F

buf00	EQU	$0380		\temp RTC buffer 0 (secs)
buf01	EQU	$0381		\temp RTC buffer 1 (mins)
buf02	EQU	$0382		\temp RTC buffer 2 (hours)
buf03	EQU	$0383		\temp RTC buffer 3 (day)
buf04	EQU	$0384		\temp RTC buffer 4 (date)
buf05	EQU	$0385		\temp RTC buffer 5 (month)
buf06	EQU	$0386		\temp RTC buffer 6 (year)
buf07	EQU	$0387		\temp RTC buffer 7
buf08	EQU	$0388		\temp RTC buffer 8
buf09	EQU	$0389		\temp RTC buffer 9
\..
buf12	EQU	$038C		\temp RTC buffer 12 (Alarm Hours 2)
\..
buf17	EQU	$0391		\temp RTC buffer 17 (temp MSB)
buf18	EQU	$0392		\temp RTC buffer 18 (temp LSB)


cr	EQU	13		\<cr>
lf	EQU	10		\<lf>
spc	EQU	32		\<space>
colon	EQU	58		\<:>
dash	EQU	45		\<->
bkspc	EQU	8		\<backspace> (ascii 'BS')
upper	EQU	$DF		\lower to upper case mask (b5=0 on AND)
lower	EQU	$20		\upper to lower case mask (b5=1 on ORA)
ap6idle	EQU 	$11		\idle value of AP6 ctrl reg


\end of declarations

\-------------------------------------------------------------------------------
\*** Macro definitions ***
\-------------------------------------------------------------------------------
\ TODO: Explain further about how AP6 interface at &FCD6 is used to control I2C

sclhi	MACRO
	LDA 	ap6regc
	ORA 	#(xsclhi)
	STA 	ap6regc
	STA 	ap6reg
	ENDM
	
\-------------------------------------------------------------------------------
\SCL (clock) driven lo by ... TODO

scllo	MACRO
	LDA 	ap6regc
	AND 	#(xscllo)
	STA 	ap6regc
	STA 	ap6reg
	ENDM

\-------------------------------------------------------------------------------
\Allows SDA (data) to float hi by ... TODO

sdahi	MACRO
	LDA	ap6regc
	ORA	#(xsdahi)
	STA	ap6regc
	STA	ap6reg
	ENDM

\-------------------------------------------------------------------------------
\SDA (data) driven lo by ... TODO

sdalo	MACRO
	LDA	ap6regc
	AND	#(xsdalo)
	STA	ap6regc
	STA	ap6reg
	ENDM

\-------------------------------------------------------------------------------
\i2cdbit - sets SDA hi or lo to mirror Carry flag

i2cdbit	MACRO
	BCC	dblo@$MC
	sdahi			\C=1, SDA=1
	BCS	dbx@$MC
dblo@$MC	sdalo			\C=0, SDA=0
dbx@$MC	NOP
	ENDM

\-------------------------------------------------------------------------------
\i2clock - generates a single positive pulse on SCL

i2clock	MACRO
	sclhi
	scllo
	ENDM

\-------------------------------------------------------------------------------
\Sets Clock and Data lines high - the I2C idle state

i2cidle	MACRO
	scllo
	sdahi
	sclhi
	ENDM

\-------------------------------------------------------------------------------
\i2cstop - issues an I2C STOP by a sequence of SCL>lo, SDA>lo, SCL>hi, SDA>hi.
\This puts the bus into the I2C IDLE state.

i2cstop	MACRO
	scllo
	sdalo
	sclhi
	sdahi			\SCL & SDA now high
	ENDM

\-------------------------------------------------------------------------------
\i2cstart - issues an I2C START by a sequence of SDA>lo, <delay>, SCL>lo.
\Sets idle state (both hi) first.

i2cstart	MACRO
	LDA #ap6idle		\idle value for AP6
	STA ap6reg		\set AP6 reg (write only) to known state
	STA ap6regc		\maintain a copy of the last written value
	i2cidle
	sdalo
	scllo
	ENDM

\-------------------------------------------------------------------------------
\*** End of Macro definitions ***
\-------------------------------------------------------------------------------

	ORG	$8000		\sideways rom address start (to $BFFF)

\-------------------------------------------------------------------------------
romstart	DFB	0,0,0		\no language entry (3 nulls)
	JMP	service		\to service entry
	DFB	$82		\ROM type : Service + 6502 code
	DFB	(copyr-romstart)	\offset to copyright string
title	DFB	0		\version
	ASC	'I2C'		\title string
	DFB	0		\..and null terminator
	ASC	'3.2EAP6'		\version string with CR and..
copyr	DFB	0		\copyright string..
	ASC	'(C) M.P.Barr 2018'
	DFB	0		\..'framed' by nulls

\end of ROM header

\-------------------------------------------------------------------------------
\Service entry and start of rom code

service	CMP	#1		\A=1, autoboot? ('Break' or switch on)
	BNE	serv_a1		\no, next check
	\ JMP	boot		\else goto boot handler (print time)
	RTS
serv_a1	CMP	#4		\A=4, unknown command?
	BNE	serv_a2		\no, next check
	JMP	command		\else goto command handler
serv_a2	CMP	#8		\A=8, Unrecognised OSWORD?
	BNE	serv_a3		\no, next check
	JMP	xosword		\else goto unknown OSWORD handler
serv_a3	CMP	#9		\A=9, *HELP entered?
	BNE	serv_x		\no, next check
	JMP	help		\yes, goto help handler
serv_x	RTS			\not a call we want so exit

\-------------------------------------------------------------------------------
\Handler for *HELP or *HELP xxx where xxx could be our help cue which is 'I2C'

help	LDA	(cli),Y		\get last non-space chr after *HELP
	CMP	#cr		\just a <cr> ?
	BNE	bighelp		\no, more text typed so see if it's us

	TYA			\*HELP<cr> so just need to print..
	PHA			\..our title and return. Thus, first..
	TXA			\..save the registers
	PHA
	JSR	OSNEWL		\blank line leader (Acorn protocol)
	LDX	#1		\indexing title with X
help_a1	LDA	title,X		\get a title chr
	BNE	help_a2		\not a null so goto print it
	LDA	#spc		\else replace with a <space>
help_a2	JSR	OSASCI		\print the chr
	INX			\increment index
	CPX	#(copyr-title)	\test for the end of 'title'+'version'
	BNE	help_a1		\not finished so loop for next chr

help_a4	JSR	OSNEWL		\print new line
	PLA			\else the *HELP<cr> command must be..
	TAX			\..passed on for other Roms
	PLA			\so restore the regs
	TAY
	LDA	#9		\restore the HELP code for other Roms
	RTS			\and return

bighelp	TYA			\*HELP abc.. typed so is it us?
	PHA			\save the regs
	TXA
	PHA
	LDX	#0		\X will be our rom name pointer
help_a3	LDA	(cli),Y		\get next user chr
	CMP	#$61		\check if chr is lower case
	BMI	help_b3		\not, so continue
	AND	#upper		\else force to upper case
help_b3	CMP	myname,x		\compare with next myname chr
	BNE	help_a4		\no match so exit no action
	CMP	#cr		\did we match on 2 <cr>'s ?
	BEQ	help_a5	\yes, it's us then so goto service
	INY			\else carry on comparing
	INX			\increment both pointers
	BNE	help_a3		\and loop back

\User typed *HELP I2C so we need to list our commands from 'comtab' and
\for convention, we will first print the full rom title as for normal *HELP

help_a5	JSR	OSNEWL		\blank line leader (Acorn protocol)
	LDX	#1		\X used as index for title
help_b1	LDA	title,X		\get a title chr
	BNE	help_b2		\not a null so goto print it
	LDA	#spc		\else replace with a <space>
help_b2	JSR	OSASCI		\print the chr
	INX			\increment index
	CPX	#(copyr-title)	\test for the end of 'title'+'version'
	BNE	help_b1		\not finished so loop for next chr

	LDA	#cr		\tidy cursor to left
	JSR	OSASCI		\OSASCI will add a <lf>

				\now process help text
	LDA	#>comtab		\initialise character pointer
	STA	htextl
	LDA	#<comtab
	STA	htexth
	LDY	#0		\Y used as character index (always 0)
help_a6	LDA	#spc		\indent each command by two <spaces>
	JSR	OSASCI
	JSR	OSASCI
help_a8	LDA	(htextl),Y	\get a chr from table
	BMI	help_a7		\-ve means end of command or of table
	JSR	OSASCI		\else print chr
	INC	htextl		\and continue with this command..
	BNE	help_a8		\..incrementing pointer
	INC	htexth
	BNE	help_a8		\unconditional loop back

help_a7	LDA	(htextl),Y	\get the -ve chr again
	CMP	#$FF		\was it $FF and end of table?
	BEQ	help_a9		\yes, goto exit
	LDA	#cr		\else <cr><lf> after each command
	JSR	OSASCI
	INY			\at each command end incr pointer by two
	INC	htextl		\..to skip action address
	BNE	help_a6
	INC	htexth
	BNE	help_a6		\not at end yet so loop back for next

help_a9	PLA			\else finished extended help so..
	TAX			\..restore regs
	PLA
	TAY
	LDA	#0		\set A=0 to inform MOS that we..
	RTS			\..took the xHelp command, and exit!

\-------------------------------------------------------------------------------
\Main unknown MOS *<command> interpreter - entered when A=4

command	TXA			\save X
	PHA
	LDX	#$FF		\X will index through command table
	DEY			\X & Y will immediately be incremented
	TYA			\save Y on the stack for restoration..
	PHA			\..(re-increment if passing on)
comm_a1	INY			\incr pointers
	INX
	LDA	comtab,X		\test for end of table = $FF
	CMP	#$FF
	BEQ	comm_a4		\hit table end, not for us, jump to exit
	LDA	(cli),Y		\get next chr of the user *command
	CMP	#$61		\check if chr is lower case
	BMI	comm_a6		\not, so continue
	AND	#upper		\else force to upper case
comm_a6	CMP	#cr		\if <cr> or <space> then one more test
	BEQ	comm_a5		\<cr> - end of user command
	CMP	#spc
	BEQ	comm_a5		\<spc> - end of user command
	CMP	comtab,X		\compare with chr from command table
	BNE	comm_a2		\no match, skip this command
	JMP	comm_a1		\else repeat for next chr

comm_a5	LDA	comtab,X		\get equivalent comtab command chr
	BMI	comm_a3		\$8x, this is a command match so..
				\..goto get exe address
	CMP	#spc
	BNE	comm_a2		\not <space> or $8x so skip

comm_a0	INX			\matched a command with parameters
	LDA	comtab,X		\so move along to exe address
	BPL	comm_a0
	BNE	comm_a3		\and goto get exe address

comm_a2	DEX			\back one chr so we don't miss the $8x
comm_a7	INX			\increment pointer
	LDA	comtab,X		\get next chr of failed comtab command
	BPL	comm_a7		\repeat till we hit the -ve exe address
	INX			\then skip the second address byte
	PLA			\restore original Y ((MOS value of Y)-1)
	PHA			\save again
	TAY
	JMP	comm_a1		\and do it all again

comm_a3	STY	comdata		\save Y which points to any user data
	LDA	comtab,X		\get command exeHi from comtab..
	STA	COMVEC+1		\..and place in vector
	INX			\point X at next addres byte
	LDA	comtab,X		\get command exeLo from comtab..
	STA	COMVEC		\..and place in vector
	PLA			\restore original MOS value of Y
	TAY			\which was decremented on entry
	INY
	PHA			\re-save on stack
	JMP	(COMVEC)		\and execute the command!

comm_a4	PLA			\wasn't one of our commands so..
	TAY
	INY			\restore Y to it's MOS value
	PLA			\restore X
	TAX
	LDA	#4		\restore action code
	RTS			\and pass command on for other Roms

\-------------------------------------------------------------------------------
\Command table as	'*COMMAND <spc> *HELP dialogue'
\		 <command label>

comtab	ASC	'I2C'
	DFDB	stari2c
	ASC	'I2CRESET'
	DFDB	starrst
	ASC	'I2CQUERY (Q)'
	DFDB	i2cquery
	ASC	'I2CTXB <addr> (<#nn>) <byte>(;)'
	DFDB	i2ctxb
	ASC	'I2CTXD <addr> (<#nn>) <no.bytes>(;)'
	DFDB	i2ctxd
	ASC	'I2CRXB <addr> (<#nn>) (A%-Z%)'
	DFDB	i2crxb
	ASC	'I2CRXD <addr> (<#nn>) <no.bytes>'
	DFDB	i2crxd
	ASC	'I2CSTOP'
	DFDB	starstp

	ASC	'TBRK'
	DFDB	xtbrk
	ASC	'TIME'
	DFDB	xtime
	ASC	'DATE'
	DFDB	xdate
	ASC	'TEMP'
	DFDB	xtemp
	ASC	'NOW'
	DFDB	xnow
	ASC	'NOW$'
	DFDB	xi2crtc
	ASC	'TSET <hh:mm:ss>'
	DFDB	xtset
	ASC	'DSET <day> <dd-mm-yy>'
	DFDB	xdset

	DFB	$FF		\end of table marker

\-------------------------------------------------------------------------------

myname	STR	'I2C'		\our name in upper case for *H.I2C

\-------------------------------------------------------------------------------
\Prints full time & date (as per *NOW) on <Break> This is a user selectable
\feature and can be toggled on or off using *TBREAK which toggles the ToB
\flag. Entered via MOS reset/boot call with A=1

boot	TYA			\save registers
	PHA
	TXA
	PHA

	JSR	getrtc		\fetch rtc data block
	LDA	buf12		\get 'Alarm 2 Hour' (=ToB)
	AND	#$0F		\isolate bits 3-0
	BEQ	boot_x		\if zero, skip header
	JSR	xxnow		\else do the header printing

boot_x	PLA			\restore the registers
	TAX
	PLA
	TAY
	LDA	#1		\preserve MOS boot call for other roms
	RTS			\and return

\------------------------------------------------------------------------------
\Handler for OSWORD calls implemented in I2C rom. Currently, $0E Type 1 and 4 

xosword	LDA	OSW_A		\get unknown OSWORD call
	CMP	#14		\is it a Real Time Clock call?
	BNE	xosw_a2		\not RTC read, try next
	LDY	#0		\else test OWORD 14 function
	LDA	(OSW_X),Y		\Type is provided by caller at XY+0
	CMP	#4		\is it our new time$ call?
	BNE	xosw_a1		\not a Type 4, try next type
	JMP	OSW$0E4		\else jump to our OSWORD &0E Type 4
xosw_a1	CMP	#1		\Type 1? 
	BNE	xosw_a2		\no, test next OSWORD call
	JMP	OSW$0E1		\else jump to our OSWORD &0E Type 1
				
xosw_a2	LDA	OSW_A		\get unknown OSWORD call
	NOP			\further OSWORD tests go here

xosx	LDA	#8		\not an RTC call so restore A
xosxx	RTS			\and return flagging command untaken

\------------------------------------------------------------------------------
\OSWORD call &0E Type 1 emulation - requests BCD output of the RTC into a
\parameter block specified by XY (little-endian). Normally a Master series
\only call but can be implemented on an Elk with an RTC. This implementation
\faithfully reproduces the returned parameter block of OSWORD &0E Type 1 

OSW$0E1	JSR	getrtc		\first fetch rtc data block and then
				\get DS3231 BCD values, mask & save..
	LDA	buf06		\year
	AND	#cyy
	STA	(OSW_X),Y
	INY			\move along MOS parameter block..
	LDA	buf05		\month
	AND	#cmm
	STA	(OSW_X),Y
	INY
	LDA	buf04		\date
	AND	#cdd
	STA	(OSW_X),Y
	INY
	LDA	buf03		\weekday
	AND	#cwd
	STA	(OSW_X),Y
	INY
	LDA	buf02		\hours
	AND	#ch
	STA	(OSW_X),Y
	INY
	LDA	buf01		\minutes
	AND	#cm
	STA	(OSW_X),Y
	INY
	LDA	buf00		\seconds
	AND	#cs
	STA	(OSW_X),Y

	LDA	#0		\claim call and return to MOS
	RTS			\simple RTS, registers not preserved

\------------------------------------------------------------------------------
\OSWORD call &0E Type 4 - returns an ASCII BCD time and date string as per
\the new *NOW$ function of this rom. See that command header for details of the
\string noting that here, the string is returned at the address pointed to by
\the OSWORD entry XY (lo/hi)

OSW$0E4	JSR	xxi2crtc		\duplicate *NOW$ function

	LDA	#0		\claim call and return to MOS
	RTS			\simple RTS, registers not preserved

\------------------------------------------------------------------------------
\Command to toggle Time-on-Break (ToB) function. Uses RTC 'Alarm 2 Hour' field
\to enumerate the ToB flag which is initially a simple non-zero/zero On/Off
\switch. At each call, toggles the ToB flag at Bit0 of Alarm2 Hours, RTC
\module address $0C.
 
				\read existing flag state..
xtbrk	JSR	getrtc		\fetch rtc data block
	LDA	buf12		\get Alarm 2 Hour (=ToB)
	AND	#$0F		\isolate bits 3-0
	BEQ	xtb1		\if zero, goto set
	LDA	#0		\else currently on, turn off	
	BEQ	xtb2		\and goto write zero
xtb1	LDA	#1		\currently off, turn on

xtb2	STA	$6A		\tx byte (1 or 0 ToB flag)
	LDA	#RTC		\target i2c device id (here rtc)
	STA	$68
	STA	$6C		\$6C<>0 mean register specified in $69
	LDA	#12		\start register = 12 = Alarm 2 Hours
	STA	$69
	LDA	#0
	STA	$6D		\$6D=0 means Stop after txb

	JSR	cmd3		\and send the byte via txb(go)
	LDA	$6A		\report On or Off
	BEQ	xtb3		\0 SO goto 'Off'
	LDA	#6		\else 1 so 'On'
	BNE	xtb4
xtb3	LDA	#5
xtb4	JSR	xmess		\print 'On' or 'Off'

	PLA			\finished so..
	TAY			\MOS command graceful exit
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\------------------------------------------------------------------------------
\*I2C - sets a confirm-present byte and records the slot id of this I2C rom

i2cgo	NOP			\assembler call entry point
stari2c	LDA	#$2C		\set zpreg to $2C..
	STA	zpreg		\..to confirm rom present
	LDA	&F4		\record our rom id
	STA	i2cslot

	PLA			\finished so..
	TAY			\MOS command graceful exit
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\*I2CRESET - performs a reset by ensuring no device is waiting for master clock
\pulses and by issuing a stop -> idle.

rstgo	NOP			\assembler call entry point
	SEI
starrst	JSR	i2creset		\call internal routine

rstx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\To 'reset' any hung devices, issues nine clock pulses followed by an i2c stop

i2creset	LDX	#9		\issuing nine clocks
	scllo			\start with clock lo
rstc	i2clock
	DEX
	BNE 	rstc		\loop for nine ticks
	i2cstop			\issue a stop
	RTS			\and return

\-------------------------------------------------------------------------------
\*I2CSTOP - external rom star-command wrapper for internal I2C stop routine

stpgo	NOP			\assembler call entry point
	SEI
starstp	i2cstop			\call internal routine

stpx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\*I2CQUERY - find connected i2c devices

i2cquery	LDA	#0		\reset quiet flag
	STA	htexth
	LDY	comdata		\restore Y to correct CLI value
	LDA	(cli),Y		\command only, no parameters?
	CMP	#13		\<cr>
	BEQ	qrygo		\no params, begin query
	JSR	qryparse		\else parse command line
	BCC	qrygo		\parse ok, continue
	JMP	qryx		\else error occurred, exit

qrygo	NOP			\assembler call entry point
	SEI
	LDA	#$FF		\init responding list to none
	STA	i2cbuf 
	LDA	#0		\reset detected device counter
	STA	temp2
	LDA	htexth		\output suppressed?
	BNE	qry3		\yes, skip output
	LDA	#1		\else print text leader
	JSR	xmess
qry3	LDA	#devidlo		\first device id
	STA	temp1		\current id counter

qryloop	i2cstart			\issue a device address with read
	LDA	temp1		\next device id to interrogate
	SEC			\C = 1 = Read
	JSR	i2caddr
	JSR	i2crxack
	BCS	qry1		\no reply (NACK), skip report

	LDA	temp1		\else record responding id in i2cbuf
	LDX	temp2
	STA	i2cbuf,X
	LDA	htexth		\output suppressed?
	BNE	qry4		\yes, skip output
	LDA	#spc		\else ACK received, print id
	JSR	OSASCI
	LDA	#'$'
	JSR	OSASCI
	LDA	temp1
	JSR	hex
qry4	INC	temp2		\increment device counter

qry1	LDA	temp1		\last id to interrogate?
	CMP	#devidhi
	BEQ	qry2

	i2cstop			\not finished, issue stop
	INC	temp1		\increment id
	JMP	qryloop		\and loop to interrogate next

qry2	i2cstop			\finished, issue stop
	LDA	#$FF		\mark end of responding devices
	LDX	temp2		\with $FF
	STA	i2cbuf,X 
	LDA	htexth		\screen output suppressed?
	BNE	qryx		\yes, exit now

	LDA	temp2		\else, any devices detected?
	BNE	qnewl		\yes, tidy output
	LDA	#2		\else report no replies
	JSR	xmess
	BEQ	qryx		\and exit
qnewl	JSR	OSNEWL		\tidy dev list with a new line

qryx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\Command line parser for i2cquery - returns Carry clear if ok else reports error
\and returns Carry set.

qryparse	CMP	#spc		\parameter so next should be <spc>
	BNE	qryerr		\no, exit via syntax error
	INY			\step along
	LDA	(cli),Y		\fetch parameter
	CMP	#'Q'		\'Q' is only legal switch
	BNE	qryerr		\no, exit via syntax error
	INC	htexth		\else q so set output inhibit flag
	CLC			\no errors
	BCC	qrypx		\and exit

qryerr	LDA	#3		\report syntax error
	JSR	xmess
	SEC

qrypx	RTS			\exit

\-------------------------------------------------------------------------------
\*I2CTXB - transmit a single byte to a slave.
\Syntax is : *I2CTXB <addr> (<#nn>) <byte>(;)

i2ctxb	LDY	comdata		\restore Y to correct CLI value
	LDA	(cli),Y		\command only, no address?
	CMP	#13
	BNE	txb1		\no, begin command
	LDA	#0		\else report rom version
	JSR	xmess
	JMP	txbx		\and exit

txb1	JSR	txbparse		\parse command line
	BCC	txbgo		\parse ok, continue
	JMP	txbx		\else error occurred, exit

txbgo	NOP			\assembler call entry point
	SEI
	LDA	#0		\begin i2c tx with clear status
	STA	i2cstat
	LDA	i2cdev		\is address 'special' $FF ?
	CMP	#$FF
	BEQ	txb2		\yes, only send 8 data bits, no addr
	i2cstart			\issue an i2c start
	LDA	i2cdev		\fetch device address
	CLC			\Carry = 0 = write
	JSR	i2caddr		\send address
	JSR	i2crxack		\ACK from slave?
	BCS	txberr1		\no, abort on error
	LDX	temp2		\is a register specified?
	BEQ	txb2		\no, goto data byte
	LDA	i2creg		\else fetch register number
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCS	txberr1		\no, abort on error	
txb2	LDA	i2cbyte		\fetch data byte for transmit
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCC	txb3		\yes, exit good tx

txberr1	LDA	i2cstat		\Tx ACK error so set b0 in status
	ORA	#1
	STA	i2cstat

txb3	LDA	htextl		\stop inhibited ?
	BNE	txbx		\yes, skip to exit
	i2cstop			\else issue an i2c stop

txbx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\Command line parser for i2ctxb - returns Carry clear if ok else reports error
\and returns Carry set.

txbparse	CMP	#spc		\next chr should be <space>
	BNE	txbperr		\error
	LDA	#0		\reset inhibit 'i2c stop' flag
	STA	htextl		\re-using rom help zp
	INY
	JSR	clbyte		\next two digits should be i2c address
	BCS	txbperr		\error
	STA	i2cdev		\save i2c target device address
	CMP	#&FF		\$FF is valid meaning 'no address'..
	BEQ	txbp4		\..so skip range check
	CMP	#&80		\else max i2c 7-bit address is $7F
	BPL	txbperr		\address out of range (>$7F)

txbp4	INY			\device address ok
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	txbperr		\error
	INY
	LDA	(cli),Y		\next chr might be '#'
	LDX	#0		\X flags # presence : 0=no, $FF=yes
	CMP	#'#'
	BNE	txbp1		\not an #
	DEX			\set X=$FF when # present
	INY			\if #, adjust Y to point at hex digits
txbp1	JSR	clbyte		\next two digits should be hex ms/ls
	BCS	txbperr		\error
	CPX	#$FF		\if X=$FF, we have register no.
	BNE	txbp2		\else we now have tx byte

	STA	i2creg		\save register number
	INY
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	txbperr		\error
	INY
	JSR	clbyte		\fetch tx byte
	BCS	txbperr		\error

txbp2	STA	i2cbyte		\save txbyte
	STA	i2cbuf		\and in i2c buffer
	STX	temp2		\save a copy of X - i2c register flag
	INY			\next chr could be ';' or <Return>
	LDA	(cli),Y
	CMP	#';'		\inhibit i2c stop switch?
	BNE	txbp3		\no, so check for <Return>
	INC	htextl		\else ; so set inhibit flag to 1
	INY
	LDA	(cli),Y		\last chr now must be <Return>
txbp3	CMP	#cr
	BNE	txbperr		\error
	CLC			\else flag cl good
	BCC	txbpx		\and exit

txbperr	LDA	#3		\report syntax error
	JSR	xmess
	SEC			\flag error with Carry set

txbpx	RTS

\-------------------------------------------------------------------------------
\*I2CTXD - transmit a contiguous sequence of N bytes to a slave. Tx bytes are
\buffered in i2cbuf ($0A00) before calling command. For 256 bytes, <no.bytes>
\is entered as 00. Syntax is : *I2CTXD <addr> (<#nn>) <no.bytes>(;)

i2ctxd	LDY	comdata		\restore Y to correct CLI value
	LDA	(cli),Y		\command only, no address?
	CMP	#13
	BNE	txd1		\no, begin command
	LDA	#0		\else report rom version
	JSR	xmess
	JMP	txdx		\and exit

txd1	JSR	txdparse		\parse command line
	BCC	txdgo		\parse ok, continue
	JMP	txdx		\else error occurred, exit

txdgo	NOP			\assembler call entry point
	SEI
	LDA	#0		\begin i2c tx with clear status
	STA	i2cstat
	i2cstart			\issue an i2c start
	LDA	i2cdev		\fetch device address
	CLC			\Carry = 0 = write
	JSR	i2caddr		\send address
	JSR	i2crxack		\ACK from slave?
	BCS	txderr1		\no, abort on error
	LDX	temp2		\is a register specified?
	BEQ	txd2		\no, skip to tx data
	LDA	i2creg	 	\else fetch register number
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCS	txderr1		\no, abort on error

txd2	LDX	#0		\zero data index
txd3	LDA	i2cbuf,X		\fetch a data byte for transmit
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCS	txderr1		\no, abort on error
	INX			\increment data index
	CPX	i2cbyte		\all done?
	BNE	txd3		\no, loop for next
	BEQ	txd4		\finished tx so good exit

txderr1	LDA	i2cstat		\Tx ACK error so set b0 in status
	ORA	#1
	STA	i2cstat

txd4	LDA	htextl		\stop inhibited ?
	BNE	txdx		\yes, skip to exit
	i2cstop			\else issue an i2c stop

txdx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\Command line parser for i2ctxd - returns Carry clear if ok else reports error
\and returns Carry set.

txdparse	CMP	#spc		\next chr should be <space>
	BNE	txdperr		\error
	INY
	JSR	clbyte		\next two digits should be i2c address
	BCS	txdperr		\error
	STA	i2cdev		\save i2c target device address
	CMP	#&80		\max i2c 7-bit address is $7F
	BPL	txdperr		\address out of range (>$7F)
	INY			\device address ok
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	txdperr		\error
	INY
	LDA	(cli),Y		\next chr might be '#'
	LDX	#0		\X flags # presence : 0=no, $FF=yes
	CMP	#'#'
	BNE	txdp1		\not an #
	DEX			\set X=$FF when # present
	INY			\if #, adjust Y to point at hex digits
txdp1	JSR	clbyte		\next two digits should be hex ms/ls
	BCS	txdperr		\error
	CPX	#$FF		\if X=$FF, we have register no.
	BNE	txdp2		\else we now have number of tx bytes
	STA	i2creg		\save register number
	INY
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	txdperr		\error
	INY
	JSR	clbyte		\fetch number of tx bytes
	BCS	txdperr		\error

txdp2	STA	i2cbyte		\save number of tx bytes
	INY			\next chr could be ';' or <Return>
	LDA	(cli),Y
	CMP	#';'		\inhibit i2c stop switch?
	BNE	txdp3		\no, so check for <Return>
	INC	htextl		\else ; so set inhibit flag to 1
	INY
	LDA	(cli),Y		\last chr now must be <Return>
txdp3	CMP	#cr
	BNE	txdperr		\error
	CLC			\flag cl good
	BCC	txdpx		\and exit

txdperr	LDA	#3		\report syntax error
	JSR	xmess
	SEC			\flag error with Carry set

txdpx	RTS

\-------------------------------------------------------------------------------
\Parses next two chrs of command line assuming they are either an explicit
\ascii-hex byte or a BASIC A-Z % integer variable. Assumes on entry that Y is
\pointing to the first character of the subject pair.	
\Returns the hex byte in A with Carry clear else returns Carry set on error

clbyte	INY			\step on to second char and..
	LDA	(cli),Y		\..is it a % ?
	CMP	#'%'
	BNE	clbhex
	DEY			\else fetch intvar character
	LDA	(cli),Y
	JSR	intvar		\check for A-Z %
	BCS	clberr		\error
	INY			\valid, adjust Y to end of % pair
	BCC	clbgood		\% value fetched, goto good exit

clbhex	DEY			\assume hex so re-point to ms digit
	LDA	(cli),Y
	JSR	aschex		\validate and convert to true hex
	BMI	clberr		\if A -ve, illegal character
	ASL
	ASL
	ASL
	ASL
	AND	#$F0
	STA	temp1
	INY
	LDA	(cli),Y		\ls digit
	JSR	aschex		\validate and convert to true hex
	BMI	clberr		\if A -ve, illegal character
	ORA	temp1		\combine ls and ms digits
clbgood	CLC			\byte good, return Carry clear
	BCC	clbx

clberr	SEC			\error, return Carry set

clbx	RTS

\-------------------------------------------------------------------------------
\Validates integer variable identifier preceding % to be A-Z and if so, fetches
\and returns LS byte of variable with Carry clear. If identifier not A-Z, flags
\error via Carry set.
\BASIC A-Z % LS byte is located at ($0400 + (4 * (ascii-hex - $40)))

intvar	CMP	#'A'		\chr below 'A' ?
	BMI	iverr		\yes, error
	CMP	#'['		\chr above or = '[' (next chr after Z)
	BPL	iverr		\yes, error
	SEC			\else calc (4 * (ascii-hex - $40))
	SBC	#$40
	ASL
	ASL
	STA	htexth		\save $0400 A-Z offset for RXB 
	STX	zpreg		\briefly preserve X for indexed read
	TAX
	LDA	ivars,X		\fetch % var LS byte
	LDX	zpreg		\restore X
	CLC			\flag no error (C=0)
	BCC	ivx

iverr	SEC			\flag error (C=1)

ivx	RTS

\-------------------------------------------------------------------------------
\*I2CRXB - reads a single byte from a slave
\Syntax is : *I2CRXB <addr> (<#nn>) (A%-Z%)

i2crxb	LDY	comdata		\restore Y to correct CLI value
	LDA	(cli),Y		\command only, no address?
	CMP	#13
	BNE	rxb1		\no, begin command
	LDA	#0		\else report rom version
	JSR	xmess
	JMP	rxbx		\and exit

rxb1	LDX	#>i2cbuf		\set I2C buffer to $0A00
	STX	bufloc
	LDX	#<i2cbuf
	STX	bufloc+1

	JSR	rxbparse		\parse command line
	BCC	rxbgo		\parse ok, continue
	JMP	rxbx		\else error occurred, exit

rxbgo	NOP			\assembler call entry point
	SEI
	LDA	#0		\begin i2c rx with clear status
	STA	i2cstat
	i2cstart			\issue an i2c start
	LDA	i2cdev		\fetch device address
	SEC			\Carry = 1 = read
	LDX	temp2		\are we specifying a register?
	BEQ	rxb2		\no, RnW = read is correct
	CLC			\else toggle to RnW = write
rxb2	JSR	i2caddr		\send address
	JSR	i2crxack		\ACK from slave?
	BCC	rxb6		\yes, continue
	JMP	rxberr1		\else abort on error

rxb6	LDX	temp2		\is a register specified?
	BEQ	rxb3		\no, skip to rx data
	LDA	i2creg	 	\else fetch register number
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCS	rxberr1		\no, abort on error
	i2cstart			\issue a re-start
	LDA	i2cdev		\re-send address..
	SEC			\..but now with RnW = read
	JSR	i2caddr
	JSR	i2crxack		\ACK from slave?
	BCS	rxberr1		\no, abort on error

rxb3	JSR	i2crxbyte		\read one byte from slave
	LDY	#0		\store rx byte in i2c input buffer
	STA	(bufloc),Y

	LDX	htexth		\rx byte to be stored in a % var?
	BEQ	rxb5		\no, skip
	STA	ivars,X		\save rx byte in % var ls byte
	LDA	#0		\and zero other 3 % var bytes 
	INX
	STA	ivars,X
	INX
	STA	ivars,X
	INX
	STA	ivars,X

rxb5	SEC			\single byte read so send NACK
	JSR	i2ctxack
	JMP	rxb4		\and exit via i2c stop

rxberr1	LDA	i2cstat		\Rx ACK error so set b1 in status
	ORA	#2
	STA	i2cstat

rxb4	i2cstop			\issue an i2c stop

rxbx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\Command line parser for i2crxb - returns Carry clear if ok else reports error
\and returns Carry set.

rxbparse	CMP	#spc		\next chr should be <space>
	BNE	rxbperr		\error
	LDA	#0
	STA	temp2		\default register specified to 'no'
	STA	htexth		\reset <ivar>% present flag
	INY
	JSR	clbyte		\next two digits should be i2c address
	BCS	rxbperr		\error
	STA	i2cdev		\save i2c target device address
	CMP	#&80		\max i2c 7-bit address is $7F
	BPL	rxbperr		\address out of range (>$7F)

	INY			\device address ok
	LDA	(cli),Y		\next chr must be <space> or <Return>
	CMP	#cr		\Return?
	BEQ	rxbp1		\yes, cl finished
	CMP	#spc		\else must be <space>?
	BNE	rxbperr		\error

	INY
	LDA	(cli),Y		\next chr now might be '#'
	CMP	#'#'
	BNE	rxbp2		\not an #, skip to % var check
	INY			\# so adjust Y to point at hex digits
	JSR	clbyte		\next two digits should be hex ms/ls
	BCS	rxbperr		\error
	STA	i2creg		\save register number
	DEC	temp2		\and set temp2=$FF as # present

	INY
	LDA	(cli),Y		\next chr must be <space> or <Return>
	CMP	#cr		\<Return> ?
	BEQ	rxbp1		\yes, cl finished
	CMP	#spc		\else must be <space>
	BNE	rxbperr		\error

	INY			\move pointer to chr after <space>
rxbp2	INY			\step on one chr to possible %
	LDA	(cli),Y		\only a var % is valid now
	CMP	#'%'
	BNE	rxbperr		\error
	DEY			\% present, re-adjust Y to first chr
	JSR	clbyte		\validate and fetch var %
	BCS	rxbperr		\error
	INY			\cl must now be finished
	LDA	(cli),Y		\so next chr must be <Return>
	CMP	#cr
	BNE	rxbperr		\error

rxbp1	CLC			\flag cl good
	BCC	rxbpx		\and exit

rxbperr	LDA	#3		\report syntax error
	JSR	xmess
	SEC			\flag error with Carry set

rxbpx	RTS

\-------------------------------------------------------------------------------
\*I2CRXD - receives a contiguous sequence of N (specified) bytes from a slave.
\The received bytes are stored in i2cbuf ($0A00). For 256 bytes, <no.bytes>
\N is entered as 100. Syntax is : *I2CRXD <addr> (<#nn>) <no.bytes>

i2crxd	LDY	comdata		\restore Y to correct CLI value
	LDA	(cli),Y		\command only, no address?
	CMP	#13
	BNE	rxd1		\no, begin command
	LDA	#0		\else report rom version
	JSR	xmess
	JMP	rxdx		\and exit

rxd1	LDX	#>i2cbuf		\set I2C buffer to $0A00
	STX	bufloc
	LDX	#<i2cbuf
	STX	bufloc+1

	JSR	rxdparse		\parse command line
	BCC	rxdgo		\parse ok, continue
	JMP	rxdx		\else error occurred, exit

rxdgo	NOP			\assembler call entry point
	SEI
	LDA	#0		\begin i2c tx with clear status
	STA	i2cstat
	i2cstart			\issue an i2c start
	LDA	i2cdev		\fetch device address
	SEC			\Carry = 1 = read
	LDX	temp2		\are we specifying a register?
	BEQ	rxd2		\no, RnW = read is correct
	CLC			\else toggle to RnW = write
rxd2	JSR	i2caddr		\send address
	JSR	i2crxack		\ACK from slave?
	BCC	rxd7		\yes, continue
	JMP	rxderr1		\else abort on error

rxd7	LDX	temp2		\is a register specified?
	BEQ	rxd3		\no, skip to rx data
	LDA	i2creg	 	\else fetch register number
	JSR	i2ctxbyte		\and send it
	JSR	i2crxack		\ACK from slave?
	BCS	rxderr1		\no, abort on error
	i2cstart			\issue a re-start
	LDA	i2cdev		\re-send address..
	SEC			\..but now with RnW = read
	JSR	i2caddr
	JSR	i2crxack		\ACK from slave?
	BCS	rxderr1		\no, abort on error

rxd3	LDY	#0		\zero data index
rxd4	JSR	i2crxbyte		\read a byte from slave
	STA	(bufloc),Y	\store rx byte in i2c input buffer
	INY			\increment data index
	CPY	i2cbyte		\all done?
	BEQ	rxd5		\yes
	CLC			\no, another read required..
	JSR	i2ctxack		\..so send ACK
	JMP	rxd4		\and loop

rxd5	SEC			\finished reads so..
	JSR	i2ctxack		\..send NACK
	JMP	rxd6		\and exit via i2cstop

rxderr1	LDA	i2cstat		\Rx ACK error so set b1 in status
	ORA	#2
	STA	i2cstat

rxd6	i2cstop			\issue an i2c stop

rxdx	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	CLI
	RTS			\return to MOS

\-------------------------------------------------------------------------------
\Command line parser for i2crxd - returns Carry clear if ok else reports error
\and returns Carry set.

rxdparse	CMP	#spc		\next chr should be <space>
	BNE	rxdperr		\error
	INY
	JSR	clbyte		\next two digits should be i2c address
	BCS	rxdperr		\error
	STA	i2cdev		\save i2c target device address
	CMP	#&80		\max i2c 7-bit address is $7F
	BPL	rxdperr		\address out of range (>$7F)
	INY			\device address ok
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	rxdperr		\error
	INY
	LDA	(cli),Y		\next chr might be '#'
	LDX	#0		\X flags # presence : 0=no, $FF=yes
	CMP	#'#'
	BNE	rxdp1		\not an #
	DEX			\set X=$FF when # present
	INY			\if #, adjust Y to point at hex digits
rxdp1	JSR	clbyte		\next two digits should be hex ms/ls
	BCS	rxdperr		\error
	CPX	#$FF		\if X=$FF, we have register no.
	BNE	rxdp2		\else we now have number of tx bytes
	STA	i2creg		\save register number
	INY
	LDA	(cli),Y		\next chr should be <space>
	CMP	#spc
	BNE	rxdperr		\error
	INY
	JSR	clbyte		\fetch number of tx bytes
	BCS	rxdperr		\error

rxdp2	STA	i2cbyte		\save number of tx bytes
	BEQ	rxdperr		\zero is not valid
	STX	temp2		\save a copy of X - i2c register flag
	INY			\last chr could be <Return> or '0'
	LDA	(cli),Y
	CMP	#cr		\<Return> ?
	BEQ	rxdp3		\yes, good exit
	CMP	#'0'		\is it a '0' ?
	BNE	rxdperr		\no and any other illegal, error exit
	LDA	i2cbyte		\extra '0' only legal for '100'
	CMP	#$10
	BNE	rxdperr		\bytes not 100, trailing 0 invalid
	LDA	#0		\else set no. bytes to 0 == 256
	STA	i2cbyte
	INY			\last chr must now be <Return>
	LDA	(cli),Y
	CMP	#cr		\<Return> ?
	BNE	rxdperr		\no, error

rxdp3	CLC			\flag cl good
	BCC	rxdpx		\and exit

rxdperr	LDA	#3		\report syntax error
	JSR	xmess
	SEC			\flag error with Carry set

rxdpx	RTS

\-------------------------------------------------------------------------------
\i2caddr - writes 7-bit device address + RnW to bus
\Right-aligned 7-bit address is passed in A, RnW in Carry : 1=Read, 0=Write
 
i2caddr	STA	zpreg		\preserve X & Y
	TXA
	PHA
	TYA
	PHA
	LDA	zpreg

	PHP			\save Carry (RnW) state
	ASL			\adjust 7-bit address to high 7 bits

	LDY	#7		\pass 7 address bits thru C, MS to LS
adloop	ASL			\shift top bit into C
	TAX			\temp save remaining address bits in X
	i2cdbit			\send current address bit to SDA
	i2clock			\clock it
	TXA
	DEY
	BNE	adloop
	PLP			\restore Carry (RnW) state
	i2cdbit			\send RnW to SDA
	i2clock			\clock it

	PLA			\restore X & Y
	TAY
	PLA
	TAX
	RTS

\-------------------------------------------------------------------------------
\i2crxack - tests slave acknowledge for ACK (SDA=lo) or NACK (SDA=hi) after a
\write. Carry returns set for NACK or clear for ACK.

i2crxack	sclhi
	sdahi
	LDA	ap6reg		\ read from AP6 reg 
	AND	#(xsdahi)		\ bit 7 mask
	CLC			\Carry mirrors RxACK
	BEQ	rxax
	SEC
rxax	scllo
	RTS

\-------------------------------------------------------------------------------
\i2ctxack - transmits ACK as SDA=0 or NACK as SDA=1. On entry, Carry indicates
\required acknowledge state. ( ACK=Carry reset , NACK=Carry set )

i2ctxack	i2cdbit			\send acknowledge to SDA
	i2clock			\and clock it
	RTS

\-------------------------------------------------------------------------------
\i2crxbyte - receives a single 8-bit byte from slave and returns in A

i2crxbyte	TXA			\preserve X & Y
	PHA
	TYA
	PHA

	scllo
	sdahi
	LDX	#0		\build rx byte in X
	LDY	#8		\8 bits to receive
rxloop	sclhi			\clock hi
	LDA	ap6reg		\read a data bit (sent MS to LS)
	AND	#xsdahi
	CLC
	BEQ	rxby1
	SEC
rxby1	TXA
	ROL			\rotate bit from C into rx byte LS
	TAX			\save temporarily in X
	scllo			\clock lo
	DEY
	BNE	rxloop		\eight bit loop

	STX	zpreg		\save rx byte which is in X

	PLA			\restore X & Y
	TAY
	PLA
	TAX

	LDA	zpreg		\recover rx byte to A	
	RTS

\-------------------------------------------------------------------------------
\i2ctxbyte - transmits a single 8-bit byte to slave. Byte passed in A.

i2ctxbyte	STA	zpreg		\preserve X & Y
	TXA
	PHA
	TYA
	PHA
	LDA	zpreg

	LDY	#8		\tx 8 individual bits
	TAX			\copy byte into X
txloop	TXA
	ASL			\shift each bit into Carry
	TAX
	i2cdbit			\send the bit on SDA
	i2clock			\clock it
	DEY
	BNE	txloop

	PLA			\restore X & Y
	TAY
	PLA
	TAX
	RTS

\------------------------------------------------------------------------------
\
\RTC time and date functions
\
\------------------------------------------------------------------------------
\*I2CRTC
\Creates a 25-character ASCII/BCD string at i2cbuf (&0A00) onwards as
\follows : hh:mm:ss<sp>day<sp>dd-mm-yy<sp>tt<cr>
\This can be read from BASIC using the $ indirection operator and the returned
\string variable can then be chopped up with string handling functions.
\e.g rtc$=$&A00 : CLK$=LEFT$(rtc$,8)
\Calls xxi2crtc which is implemented for OSWORD #14 and so this call sets up
\OSW_X and OS_Y to point to &0A00 as if derived from an OSWORD call.

xi2crtc	LDA	#>i2cbuf		\set up OSW_X and OSW_Y to &0A00
	STA	OSW_X
	LDA	#<i2cbuf
	STA	OSW_Y
	LDY	#0		\Y indexes succesive buffer writes 

	JSR	xxi2crtc		\and call xxi2crtc to do the work

	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\------------------------------------------------------------------------------
\Local subroutine for xi2crtc to allow calling from elsewhere within our rom
\See xi2crtc header for details. Time & Date string is stored at OSW_X/OSW_Y

xxi2crtc	JSR	getrtc		\get rtc time & date to buffer
	LDA	buf02		\get BCD hours
	AND	#ch		\mask
	PHA			\save
	LSR			\convert BCD hours tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	STA	(OSW_X),Y		\hours tens = $0A00
	PLA			\recover BCD hours
	AND	#$0F		\convert BCD hours units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\hours units = $0A01

	LDA	#colon		\colon delimiter
	INY
	STA	(OSW_X),Y		\: = $0A02

	LDA	buf01		\get BCD minutes
	AND	#cm		\mask
	PHA			\save
	LSR			\convert BCD mins tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\mins tens = $0A03
	PLA			\recover BCD hours
	AND	#$0F		\convert BCD mins units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\mins units = $0A04

	LDA	#colon		\colon delimiter
	INY
	STA	(OSW_X),Y		\: = $0A05

	LDA	buf00		\get seconds
	AND	#cs		\mask
	PHA			\save
	LSR			\convert BCD secs tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\secs tens = $0A06
	PLA			\recover BCD secs
	AND	#$0F		\convert BCD secs units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\secs units = $0A07

	LDA	#spc		\spc delimiter to end time
	INY
	STA	(OSW_X),Y

				\day of the week string
	STX	zpreg		\preserve X
	LDA	buf03		\get 1-7 weekday number
	AND	#cwd		\mask
	SEC			\subtract 1 to index days as 0..6
	SBC	#1
	ASL			\multiply by 4 (days are 3 chr + <cr>)
	ASL
	TAX			\index days array with X
i2r_a1	LDA	days,X		\get a day chr
	CMP	#cr		\<cr> and end of day?
	BEQ	i2r_a2		\yes, day string finished
	INY
	STA	(OSW_X),Y		\store day chr in 12c buffer
	INX			\incr day chr read pointer
	BNE	i2r_a1		\and loop for next day chr

i2r_a2	LDX	zpreg		\restore X
	LDA	#spc		\space delimiter to end day
	INY
	STA	(OSW_X),Y

	LDA	buf04		\get BCD date
	AND	#cdd		\mask
	PHA			\save
	LSR			\convert BCD date tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\date tens = $0A0D
	PLA			\recover BCD date
	AND	#$0F		\convert BCD date units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\date units = $0A0E

	LDA	#dash		\dash delimiter
	INY
	STA	(OSW_X),Y		\- = $0A0F

	LDA	buf05		\get BCD month
	AND	#cmm		\mask
	PHA			\save
	LSR			\convert BCD month tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\mins tens = $0A10
	PLA			\recover BCD month
	AND	#$0F		\convert BCD month units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\month units = $0A11

	LDA	#dash		\dash delimiter
	INY
	STA	(OSW_X),Y		\- = $0A12

	LDA	buf06		\get year
	AND	#cyy		\mask
	PHA			\save
	LSR			\convert BCD year tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\year tens = $0A13
	PLA			\recover BCD year
	AND	#$0F		\convert BCD year units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\year units = $0A14

	LDA	#spc		\space delimiter to end date
	INY
	STA	(OSW_X),Y
	
	LDA	buf17		\get hex temperature
	AND	#deg		\mask
	JSR	hexbcd		\convert to BCD
	PHA			\save
	LSR			\convert BCD temp tens to ASCII
	LSR
	LSR
	LSR
	CLC
	ADC	#$30
	INY
	STA	(OSW_X),Y		\temp tens = $0A16
	PLA			\recover BCD temp
	AND	#$0F		\convert BCD temp units to ASCII
	ADC	#$30
	INY
	STA	(OSW_X),Y		\temp units = $0A17

	LDA	#cr		\finish full string with <cr> ($0D)
	INY
	STA	(OSW_X),Y

	RTS

\------------------------------------------------------------------------------
\*TIME
\Prints time at current cursor position formatted as <hh:mm:ss> (24hr format)

xtime	JSR	getrtc		\get rtc time & date to buffer
	LDX	#0		\direct '*' call so end with <cr>
	JSR	xxtime		\call time output

	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\..............................................................................
\Local subroutine for xtime to allow calling from elsewhere within our rom
\Call with X -ve to skip <cr> after time output

xxtime	TXA			\save X to later test whether this is..
	PHA			\..a direct *TIME or an indirect call

	LDA	buf02		\get hours
	AND	#ch		\mask
	JSR	dec_print		\and print
	LDA	#colon		\colon delimiter
	JSR	OSASCI		\print
	LDA	buf01		\get minutes
	AND	#cm		\mask
	JSR	dec_print		\and print
	LDA	#colon		\colon delimiter
	JSR	OSASCI		\print
	LDA	buf00		\get seconds
	AND	#cs		\mask
	JSR	dec_print		\and print

	PLA			\get entry X which is $FF if this is..
	BMI	time_a1		\..an indirect call from elsewhere..
				\..and if so, skip the <cr>
	LDA	#cr		\else finish with a <cr><lf>
	JSR	OSASCI
time_a1	RTS			\and return

\------------------------------------------------------------------------------
\*DATE
\Prints date at current cursor position formatted as <Day dd-mm-yy>

xdate	JSR	getrtc		\get rtc time & date to buffer
	LDX	#0		\direct '*' call so end with <cr>
	JSR	xxdate		\call date output

	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\..............................................................................
\Local subroutine for xdate to allow calling from elsewhere within our rom
\Call with X -ve to skip <cr> after date output

xxdate	TXA			\save X to later test whether this is..
	PHA			\..a direct *DATE or an indirect call

	LDA	buf03		\get weekday
	AND	#cwd		\mask
	SEC			\subtract 1 to index days as 0..6
	SBC	#1
	ASL			\multiply by 4 (days are 3 chr + <cr>)
	ASL
	TAX			\index days array with X
date_a1	LDA	days,X		\get a day chr
	CMP	#cr		\<cr> and end of day?
	BEQ	date_a2		\yes, onto date
	JSR	OSASCI		\else print day chr
	INX			\incr pointer
	BNE	date_a1		\and loop for next day chr
date_a2	LDA	#spc		\print a space delimiter
	JSR	OSASCI
	LDA	buf04		\get date
	AND	#cdd		\mask
	JSR	dec_print		\and print
	LDA	#dash		\hyphen delimiter
	JSR	OSASCI		\print
	LDA	buf05		\get month
	AND	#cmm		\mask
	JSR	dec_print		\and print
	LDA	#dash		\hyphen delimiter
	JSR	OSASCI		\print
	LDA	buf06		\get year
	AND	#cyy		\mask
	JSR	dec_print		\and print

	PLA			\get entry X which is $FF if this is..
	BMI	date_a3		\..an indirect call from elsewhere..
				\..and if so, skip the <cr>
	LDA	#cr		\else finish with a <cr><lf>
	JSR	OSASCI
date_a3	RTS			\and return

\------------------------------------------------------------------------------
\*TEMP
\Prints temperature at current cursor position formatted as <t>"<units>" (tbd)

xtemp	JSR	getrtc		\get rtc time & date to buffer
	LDX	#0		\direct '*' call so end with <cr>
	JSR	xxtemp		\call temperature output

	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\..............................................................................
\Local subroutine for xtemp to allow calling from elsewhere within our rom
\Call with X -ve to skip <cr> after temp output

xxtemp	TXA			\save X to later test whether this is..
	PHA			\..a direct *TEMP or an indirect call

	LDA	buf17		\get temp upper bits, lsb=1
	AND	#deg		\mask
	JSR	hexbcd		\convert hex degrees to bcd
	JSR	dec_print		\and print the BCD temperature
	LDA	#4		\followed by units text
	JSR	xmess
	
	PLA			\get entry X which is $FF if this is..
	BMI	temp_ax		\..an indirect call from elsewhere..
				\..and if so, skip the <cr>
	LDA	#cr		\else finish with a <cr><lf>
	JSR	OSASCI
temp_ax	RTS			\and return

\------------------------------------------------------------------------------
\*NOW
\Prints date, time & temperature on one line by calling xxdate, xxtime & xxtemp

xnow	JSR	getrtc		\get rtc time & date to buffer
	JSR	xxnow		\call time & date output

	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS

\..............................................................................
\Local subroutine for xnow to allow calling from elsewhere within our rom

xxnow	LDX	#$FF		\this will signal no <cr> after time
	JSR	xxtime		\print time
	LDA	#spc		\delimit time & date with two spaces
	JSR	OSASCI
	JSR	OSASCI
	LDX	#$FF		\also no <cr> after date
	JSR	xxdate		\print date
	LDA	#spc		\delimit date and temp with two spaces
	JSR	OSASCI
	JSR	OSASCI
	LDX	#0		\<cr> after temperature
	JSR	xxtemp		\print temperature

	RTS			\and return

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
	LDA	#7		\number of bytes to fetch (addr $00-$06)
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
	\ TODO: Need to add some offset
	STA	buf06		\ > DS3231 - Year		
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
\*TSET
\Allows user to set the time by typing *TSET hh:mm:ss (must be exact format)

xtset	JSR	getrtc		\poulate buffer with current t&d
	LDA	#colon		\set parser delimiter to ':' for time
	STA	temp2
	JSR	tdparse		\get BCD time into buf00-buf02
	BMI	xtset_err		\format error detected, abort err
	SED			\range test hh:mm:ss in decimal mode
	LDA	buf02		\get hours
	CMP	#$24		\only 0-23 valid
	BCS	xtset_err		\invalid, abort err
	LDA	buf01		\get minutes
	CMP	#$60		\only 0-59 valid
	BCS	xtset_err		\invalid, abort err
	LDA	buf00		\get seconds
	CMP	#$60		\only 0-59 valid
	BCS	xtset_err		\invalid, abort err
	CLD			\else all good, clear decimal mode

	JSR	writetd		\write full t&d buffer to the RTC

	LDX	#0		\read back and display time as reponse
	JSR	xxtime		\call with X +ve to give <cr><lf>

xtset_x	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS  

\..............................................................................

xtset_err	CLD			\D flag might be set if error occurred
	LDX	#$FF		\index message on X
xtset_a1	INX			\move along message
	LDA	tseterr,X		\get a chr
	JSR	OSASCI		\print it
	CMP	#cr		\<cr> and end?
	BNE	xtset_a1		\no, loop
	BEQ	xtset_x		\else goto exit xtset

tseterr	STR	'TSET time format (24hr) : <hh:mm:ss>'

\------------------------------------------------------------------------------
\*DSET
\Allows user to set the date by typing *DSET <day> <dd-mm-yy> where <day> is
\first three characters of Monday-Sunday. (Must be this exact format)

xdset	JSR	getrtc		\poulate buffer with current t&d
	JSR	dparse		\process <day> into buf03 (1-7:Mon-Sun)
	BMI	xdset_err		\format error detected, abort err

				\*** then process <dd-mm-yy>
	LDA	#dash		\set parser delimiter to '-' for date
	STA	temp2
	JSR	tdparse		\get BCD date into buf04-buf06
	BMI	xdset_err		\format error detected, abort err
	SED			\range test dd-mm-yy in decimal mode
	LDA	buf04		\get date
	BEQ	xdset_err		\0 not valid
	CMP	#$32		\only 1-31 valid
	BCS	xdset_err		\invalid, abort err
	LDA	buf05		\get month
	BEQ	xdset_err		\0 not valid
	CMP	#$13		\only 1-12 valid
	BCS	xdset_err		\invalid, abort err
	LDA	buf06		\get year
	CMP	#$99		\only 0-98 valid
	BCS	xdset_err		\invalid, abort err
	CLD			\else all good, clear decimal mode

	JSR	writetd		\write full t&d buffer to the RTC

	LDX	#0		\read back and display date as reponse
	JSR	xxdate		\call with X +ve to give <cr><lf>

xdset_x	PLA			\MOS command graceful exit
	TAY
	PLA
	TAX
	LDA	#0		\set A=0 to inform MOS command taken
	RTS			\return to MOS  

\..............................................................................

xdset_err	CLD			\D flag might be set if error occurred
	LDX	#$FF		\index message on X
xdset_a1	INX			\move along message
	LDA	dseterr,X		\get a chr
	JSR	OSASCI		\print it
	CMP	#cr		\<cr> and end?
	BNE	xdset_a1		\no, loop
	BEQ	xdset_x		\else goto exit xtset

dseterr	STR	'DSET date format : <day> <dd-mm-yy>'

\------------------------------------------------------------------------------
\Routine called by tset and dset to parse command line for time as hh:mm:ss
\or date as dd-mm-yy. After validation, collects the 3 pairs of digits in BCD
\format, storing them in either buf00-buf02 in the case of time or buf04-buf06
\in the case of date. The routine identifies time or date by the delimiter 
\(stored in temp2 on entry) being either a ':' for time or a'-' for date.
\Does NOT range check, this is done by tset and dset since the ranges are
\different for time and date. If a format error is encountered A returns -ve
\else A returns +ve.

tdparse	LDY	comdata		\point Y to <spc> or <cr> after command
	LDA	(cli),Y		\get the chr
	CMP	#cr		\<cr>?
	BNE	tdp_a1		\no, continue
	JMP	tdp_err		\else error, no time/date supplied
tdp_a1	INY			\move along user data
	LDA	(cli),Y		\get next chr
	CMP	#spc		\another <spc>?
	BEQ	tdp_a1		\yes, keep skipping
	STY	comdata		\Y & comdata now point to start of data
	INY			\check we have the xx|yy|zz format..
	INY			\..by moving to the first delimiter
	LDA	(cli),Y		\get the chr
	CMP	temp2		\must be ':' or '-'
	BEQ	tdp_a5		\yes, continue
	JMP	tdp_err		\else format error
tdp_a5	INY			\move to next delimiter
	INY
	INY
	LDA	(cli),Y		\get the chr
	CMP	temp2		\must be ':' or '-'
	BEQ	tdp_a6		\yes, continue
	JMP	tdp_err		\else format error
tdp_a6	INY			\finally, move to where <cr> should be
	INY
	INY
	LDA	(cli),Y		\get the chr
	CMP	#cr		\<cr>?
	BEQ	tdp_a7		\yes, continue
	JMP	tdp_err		\else format error

tdp_a7	LDY	comdata		\point Y at start of data again
tdp_a2	LDA	(cli),Y		\check each digit for >='0' and =<'9'..
	CMP	temp2		\..or one of the delimiters
	BEQ	tdp_a3		\delimiter so goto move along 
	SEC			\else do 0-9 check
	SBC	#$30		\>= $30 ('0') ?
	BCC	tdp_err		\no, out of range
	SBC	#10		\should now be max. 9 so take 10 off
	BCS	tdp_err		\no, greater than 9 so out of range
tdp_a3	INY			\incr pointer
	TYA			\when Y is 8 bigger than comdata..
	SEC			\..we should be at the <cr>
	SBC	comdata
	CMP	#8
	BNE	tdp_a2		\not 8 yet, loop for next chr
	LDA	(cli),Y		\else confirm at <cr>?
	CMP	#cr
	BNE	tdp_err		\no, not <cr> so format error

				\now convert the 3 items to BCD and
				\save initially in buf07-buf-09
	DEY			\working backwards through 3 items
	LDA	(cli),Y		\get seconds/date units
	STA	bcdu		\and save
	DEY
	LDA	(cli),Y		\get seconds/date tens
	STA	bcdt		\and save
	JSR	asc_bcd		\convert to single byte BCD
	STA	buf07		\temporaily save BCD seconds/date
	DEY			\2 x DEY to skip delimiter..
	DEY			\..and point to minutes/month units
	LDA	(cli),Y		\get minutes/month units
	STA	bcdu		\and save
	DEY
	LDA	(cli),Y		\get minutes/month tens
	STA	bcdt		\and save
	JSR	asc_bcd		\convert to single byte BCD
	STA	buf08		\temporaily save BCD minutes/month
	DEY			\2 x DEY to skip delimiter..
	DEY			\..and point to hours/year units
	LDA	(cli),Y		\get hours/year units
	STA	bcdu		\and save
	DEY
	LDA	(cli),Y		\get hours/year tens
	STA	bcdt		\and save
	JSR	asc_bcd		\convert to single byte BCD
	STA	buf09		\temporaily save BCD hours/year

	LDA	temp2		\now move values to correct locations
	CMP	#'-'		\if date, go to use buf04-buf06
	BEQ	tdp_a4
	LDA	buf07		\else time so use buf00 to buf02
	STA	buf00		\seconds
	LDA	buf08
	STA	buf01		\minutes
	LDA	buf09
	STA	buf02		\hours
	LDA	#1
	BPL	tdp_x		\and exit with A +ve, no error

tdp_a4	LDA	buf07		\date so use buf04 to buf06
	STA	buf06		\year
	LDA	buf08
	STA	buf05		\month
	LDA	buf09
	STA	buf04		\date
	LDA	#1
	BPL	tdp_x		\and exit with A +ve, no error

tdp_err	LDA	#-1		\flag error to tset or dset
tdp_x	RTS			\and return

\------------------------------------------------------------------------------
\Additional parse to extract day of the week from *DSET <day> <dd-mm-yy> where
\<day> is first three characters of Monday-Sunday

dparse	LDY	comdata		\point Y to <spc> or <cr> after command
	LDA	(cli),Y		\get the chr
	CMP	#cr		\<cr>?
	BEQ	dp_err		\if yes, error, no date supplied
dp_a1	INY			\move along user data
	LDA	(cli),Y		\get next user chr
	CMP	#spc		\another <spc>?
	BEQ	dp_a1		\yes, keep skipping
	STY	comdata		\Y & comdata now point to start of data
	INY			\move past weekday characters
	INY
	INY
	LDA	(cli),Y		\get next chr..
	CMP	#spc		\..which should be a <space>
	BNE	dp_err		\not, abort error
	LDY	comdata		\else move back to first user chr..
	LDA	(cli),Y		\..and fetch it
	AND	#upper		\force first user chr to upper case
	STA	(cli),Y		\and re-save
	INY			\set 2nd & 3rd to lower as per table
	LDA	(cli),Y		\fetch
	ORA	#lower		\force lower case
	STA	(cli),Y		\re-save
	INY			\and do the same for the third day chr
	LDA	(cli),Y		\fetch
	ORA	#lower		\force lower case
	STA	(cli),Y		\re-save

				\*** ready to match day from 'days''
	LDX	#$FF		\X will index through 'days'
dp_a2	LDY	comdata		\move back to first user chr
	DEY			\decrement Y ready for first incr
dp_a3	INY			\move along user day         
	INX			\move along table
	LDA	days,X		\get a table chr
	BMI	dp_err		\end of table, no match, abort err
	CMP	#cr		\if <cr> then day matched
	BEQ	dp_match
	CMP	(cli),Y		\compare with user day chr
	BEQ	dp_a3		\both match, onto next chr
dp_a4	INX			\not this table day, move to next
	LDA	days,X		\by finding the next <cr>
	CMP	#cr		\<cr>?
	BNE	dp_a4		\no, try next chr
	BEQ	dp_a2		\end of this table day so start..
				\..again on next table day

dp_match	TXA			\X is now table day index * 4 - 1
	CLC			\so add 1..
	ADC	#1
	LSR			\..divide by 4..
	LSR
	STA	buf03		\..and save day (1-7) in buf03
	LDA	#3		\re-adjust comdata pointer..
	CLC			\..to space after <day> by adding 3
	ADC	comdata
	STA	comdata		\re-save adjusted comdata for 'parse'
	LDA	#1		\set A +ve to flag success
	BNE	dp_x		\and exit

dp_err	LDA	#-1		\flag -ve error to dset
dp_x	RTS			\and return

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
	LDA	buf06
	ASL 	A		
	ASL 	A
	ASL 	A
	ASL 	A
	ASL 	A
	ASL 	A		\ > PCF8583 - Year/Date (bits 7-6, 05h reg)
	\ Day of Month
	ORA	buf04		\ DS3231
	STA	&A05		\ > PCF8583 - Year/Date (bits 5-0, 05h reg)

	LDA	#RTC		\set up txd call
	STA	$68		\slave address
	LDA	#0		\start from 02h (seconds) reg in PCF8583
	STA	$69		\start register
	STA	$6D		\no stop inhibit
	LDA	#7
	STA	$6A		\5 bytes to tx (from 02h>06h)
	STA	$6C		\non-zero = $69 register valid
	JSR	cmd4		\perform the write via txd(go)

	RTS			\and return

\------------------------------------------------------------------------------
\Generic RTC 24C32 read routine. On entry, eeprom start address is held in
\eephi & eeplo and number of bytes to read is held in A where 0 = 256 bytes.
\RXD is used for the read so returned bytes are in i2cbuf ($A00 onwards)   

eeprd	PHA			\temporarily save number of bytes
	LDA	#EEP32		\target i2c device id (here eeprom)
	STA	$68
	STA	$6D		\$6D<>0 means no Stop after txb
	LDA	#0
	STA	$6C		\$6C=0 mean no register specified

	LDA	eephi		\first send eeprom address hi-byte
	STA	$6A		\tx byte
	JSR	cmd3		\send the hi-byte via txb(go)

	LDA	#$FF		\streaming so no i2c address this time
	STA	$68
	LDA	eeplo		\next, send eeprom address lo-byte
	STA	$6A		\tx byte
	JSR	cmd3		\send the lo-byte via txb(go)	

	LDA	#EEP32		\now perform an rxd multi-byte read
	STA	$68		\restore eeprom id
	LDA	#0		\$6C=0 mean no register specified
	STA	$6C
	PLA			\retrieve number of bytes to read..
	STA	$6A		\and set for rxd
	JSR	cmd6		\and fetch the bytes via rxd(go)

	RTS

\------------------------------------------------------------------------------
\Generic RTC 24C32 write routine. On entry, eeprom start address is held in
\eephi & eeplo and number of bytes to write is held in A where 0 = 256 bytes.
\TXD is used for the write so bytes to transmit are in i2cbuf ($A00 onwards)   

eepwr	PHA			\temporarily save number of bytes
	LDA	#EEP32		\target i2c device id (here eeprom)
	STA	$68
	STA	$6D		\$6D<>0 means no Stop after txb
	LDA	#0
	STA	$6C		\$6C=0 mean no register specified

	LDA	eephi		\first send eeprom address hi-byte
	STA	$6A		\tx byte
	JSR	cmd3		\send the hi-byte via txb(go)

	LDA	#$FF		\streaming so no i2c address this time
	STA	$68
	LDA	eeplo		\next, send eeprom address lo-byte
	STA	$6A		\tx byte
	JSR	cmd3		\send the lo-byte via txb(go)	

	LDA	#EEP32		\now perform a txd multi-byte write
	STA	$68		\restore eeprom id
	LDA	#0		\$6C=0 mean no register specified
	STA	$6C
	PLA			\retrieve number of bytes to write..
	PHA			\..but preserve entry A
	STA	$6A		\set for txd
	JSR	cmd4		\and write the bytes via txd(go)
	PLA			\restore entry A

	RTS

\------------------------------------------------------------------------------
\Routine to convert two Ascii bytes to single BCD byte. Ascii bytes must be
\pre-validated for 0-9 range. On entry, Ascii bytes should be passed with
\tens in bcdt and units in bcdu. BCD returned in A

asc_bcd	LDA	bcdt		\fetch tens
	ASL			\shift lower nibble to upper
	ASL
	ASL
	ASL
	STA	temp1		\and save
	LDA	bcdu		\fetch units
	AND	#$0F		\clear ascii offset
	CLC			\add to saved tens
	ADC	temp1
	RTS			\and return, BCD in A

\-------------------------------------------------------------------------------
\Converts a BCD byte in A to true hex - returned in A

bcdhex	PHA			\save bcd temporarily
	LDA	#0
	STA	temp1		\temp1 will 'count' the hex
	PLA			\recover bcd
	SEC
	SED			\decimal mode
bcdh_1	SBC	#1		\decrement A in decimal
	BMI	bcdh_x		\if bcd gone negative, finished
	INC	temp1		\increment hex (INC is not decimal)
	BNE	bcdh_1		\always loop
bcdh_x	LDA	temp1		\transfer hex result to A
	CLD
	RTS			\and return
	
\-------------------------------------------------------------------------------
\Takes a hex byte in A and reurns BCD conversion in A. Max entry value should be
\$63 which converts to maximum byte BCD of 99 - aimed at time/date so byte only.

hexbcd	STA	temp1		\performs a simple BCD incremental
	SED			\count in A whilst decrementing the
	CLC			\source hex value in temp1 to zero 
	LDA	#0
hb_a1	DEC	temp1
	BMI	hb_a2
	ADC	#1
	BNE	hb_a1
hb_a2	CLD
	RTS

\-------------------------------------------------------------------------------
\Takes an ascii-hex character in A and returns the true hex nibble equivalent
\also in A. If the input character is not 0-9 or A-F then a returns -ve.

aschex	CMP	#$30		\< "0"
	BMI	aherr		\yes, error
	CMP	#$47		\< "G"
	BPL	aherr		\no, error
	CMP	#$3A		\> "9"
	BMI	ah_a1		\no, 0-9 so skip hex alpha adjust
	CMP	#$41		\< "A"
	BMI	aherr		\yes, illegal character (: - @)
	SEC			\else adjust A-F to follow 0-9
	SBC	#7
ah_a1	AND	#$0F		\adjust 0-F ascii to 0-F true hex
	RTS

aherr	LDA	#$FF		\set A -ve to flag error
	RTS

\-------------------------------------------------------------------------------
\Prints A in hex

hex	PHA			\save number
	LSR			\shift high nibble to low
	LSR
	LSR
	LSR
	CLC
	ADC	#$30		\always need at least $30 adding
	CMP	#$3A		\digit > 9?
	BCC	hex_a1		\no, goto print
	CLC			\else add another 7
	ADC	#7
hex_a1	JSR	OSASCI		\print high nibble
	PLA			\retrieve original number
hexnib	AND	#$0F		\mask for lower nibble
	CLC
	ADC	#$30		\always need at least $30 adding
	CMP	#$3A		\digit > 9?
	BCC	hex_a2		\no, goto print
	CLC			\else add another 7
	ADC	#7
hex_a2	JSR	OSASCI		\print low nibble

	RTS			\and return

\------------------------------------------------------------------------------
\Decimal print subroutine : prints BCD (note) in A to screen

dec_print PHA			\save a copy of A
	LSR			\shift high nibble (tens) to low nibble
	LSR
	LSR
	LSR
	CLC			\add in ascii offset for numbers
	ADC	#$30
	JSR	OSASCI		\print tens
	PLA			\recover original value
	AND	#$0F		\clear upper nibble to leave units
	CLC			\add in ascii offset for numbers
	ADC	#$30
	JSR	OSASCI		\print units
	RTS			\return 

\-------------------------------------------------------------------------------
\xmess - Multi-message print routine.
\All messages are 16 characters long (padded with trailing spaces if necessary)
\and the final character must be a '#' (<cr>) or a '}' (no <cr>)
\Messages are selected via A = <message number> in the max. range 0-15
\Note 1 : exits A = 0 and thus caller can branch always via BEQ on return

txt0	ASC	'I2C 3.1E 161118#'
txt1	ASC	'ACK Rx'
txt1a	DFB	$27
txt1b	ASC	'd from :}'
txt2	ASC	' No devices.   #'
txt3	ASC	'Bad syntax!    #'
txt4	ASC	'degC   '
txt4a	DFB	$7F,$7F,$7F
txt4b	ASC	'     }'
txt5	ASC	'Off            #'
txt6	ASC	'On             #'


xmess	ASL			\multiply message number by 16
	ASL
	ASL
	ASL
	TAX
xmess1	LDA	txt0,X		\get a character
	CMP	#'#'		\end of message # ?
	BEQ	xmessx		\yes, exit with <cr>
	CMP	#'}'		\end of message } ?
	BEQ	xmnocr		\yes, exit without <cr>
	JSR	OSASCI		\else print chr
	INX			\increment index
	BNE	xmess1		\loop for next character

xmessx	LDA	#13		\for messages ending with <cr>
	JSR	OSASCI
xmnocr	LDA	#0		\always return A=0
	RTS			\return

\------------------------------------------------------------------------------
\Array of days of the week

days	STR	'Sun'		\1..
	STR	'Mon'
	STR	'Tue'
	STR	'Wed'
	STR	'Thu'
	STR	'Fri'
	STR	'Sat'		\..7

	DFB	$FF		\end of table marker

\-------------------------------------------------------------------------------
\To create an Acorn 16k SWROM image, pad from here to $BF7F with zeroes

	DS	$BF7F-*+1		\writes n x $00 to object file

\-------------------------------------------------------------------------------
\Jump table to allow 16 commands to be called from assembler with fixed call
\addresses irrespective of i2c rom version re-compilations.

cmd1	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CRESET	($BF80)
	DFW	rstgo
cmd2	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CQUERY	($BF88)
	DFW	qrygo
cmd3	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CTXB	($BF90)
	DFW	txbgo
cmd4	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CTXD	($BF98)
	DFW	txdgo
cmd5	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CRXB	($BFA0)
	DFW	rxbgo
cmd6	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CRXD	($BFA8)
	DFW	rxdgo
cmd7	DFB	$EA,$8A,$48,$98,$48,$4C	\I2CSTOP	($BFB0)
	DFW	stpgo
cmd8	DFB	$EA,$8A,$48,$98,$48,$4C	\TBRK	($BFB8)
	DFW	xtbrk
cmd9	DFB	$EA,$8A,$48,$98,$48,$4C	\TIME	($BFC0)
	DFW	xtime
cmd10	DFB	$EA,$8A,$48,$98,$48,$4C	\DATE	($BFC8)
	DFW	xdate
cmd11	DFB	$EA,$8A,$48,$98,$48,$4C	\TEMP	($BFD0)
	DFW	xtemp
cmd12	DFB	$EA,$8A,$48,$98,$48,$4C	\NOW	($BFD8)
	DFW	xnow
cmd13	DFB	$EA,$8A,$48,$98,$48,$4C	\NOW$	($BFE0)
	DFW	xi2crtc
cmd14	DFB	$EA,$8A,$48,$98,$48,$4C	\TSET	($BFE8)
	DFW	xtset
cmd15	DFB	$EA,$8A,$48,$98,$48,$4C	\DSET	($BFF0)
	DFW	xdset
cmd16	DFB	$EA,$8A,$48,$98,$48,$4C	\I2C	($BFF8)
	DFW	i2cgo

\-------------------------------------------------------------------------------
\*** End of I2C Rom ***
\
\Checksum32 = $????????



