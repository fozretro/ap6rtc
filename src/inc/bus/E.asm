\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\


\-------------------------------------------------------------------------------
\ The marcos below assume the Acorn Electron AP5 I2C bus interface
\ The AP5 is an port expansion cartridge for the Acorn Electron Plus 1 
\ Assumes User Port 6522 @ $FCB0 and uses PB0=SDA , CB2=SCL

				\User Port 6522 Registers
upiob	=	$FCB0		\I/O Register B
upddrb	=	$FCB2		\Data Direction Register B
uppcr	=	$FCBC		\Peripheral Control Register
upifr	=	$FCBD		\Interrupt Flag Register

xsdahi	=	$FE		\AND #xsdahi = bit 0 reset = data hi
xsdalo	=	$01		\OR #xsdalo = bit 0 set = data lo
getsda	=	$01		\upiob AND #getsda to read data

\-------------------------------------------------------------------------------
\*** Macro definitions ***
\-------------------------------------------------------------------------------
\Allows SCL (clock) to float hi by setting VIA PCR CB2 control bits 7-5 to 011
\which is Input +ve Edge with Interrupt.
\Checks for clock-stretch from slave where SCL is held lo by slave by polling
\IFR until bit 3 becomes set. 
\Allows user to <Escape> from slave clock stretch in the event of a hang.

MACRO sclhi
	LDA	upifr		\first clear any CB2 flag in IFR
	ORA	#$08
	STA	upifr
	LDA	uppcr		\set CB2 to input in 6522 PCR
	AND	#$1F
	ORA	#$60		\011x xxxx
	STA	uppcr
.cstr	
	LDA	upifr		\wait for CB2 to transit high
	AND	#$08
	BNE	sclx		\clock hi, exit immediately
	LDA	$FF			\else slave is clock stretching so..
	AND	#&80		\test for user <Esc> press
	BEQ	cstr		\no <Esc> so re-test clock status
	LDA	#$7C		\<Esc> pressed - process and exit
	JSR	OSBYTE
.sclx	
	NOP				\either clock gone hi or <Esc> pressed
ENDMACRO
	
\-------------------------------------------------------------------------------
\SCL (clock) driven lo by setting VIA PCR CB2 control bits 7-5 to 110

MACRO scllo
	LDA	uppcr		\6522 PCR
	AND	#$1F
	ORA	#$C0		\110x xxxx
	STA	uppcr
ENDMACRO

\-------------------------------------------------------------------------------
\Allows SDA (data) to float hi by setting VIA DDRB data bit to 0=input

MACRO sdahi
	LDA	upddrb
	AND	#xsdahi
	STA	upddrb
ENDMACRO

\-------------------------------------------------------------------------------
\SDA (data) driven lo by setting VIA DDRB data bit to 1=output and DIOB to 0

MACRO sdalo
	LDA	#0
	STA	upiob
	LDA	upddrb
	ORA	#xsdalo
	STA	upddrb
ENDMACRO

\-------------------------------------------------------------------------------
\i2cdbit - sets SDA hi or lo to mirror Carry flag

MACRO i2cdbit
	BCC	dblo
	sdahi			\C=1, SDA=1
	BCS	dbx
.dblo	
	sdalo			\C=0, SDA=0
.dbx	
	NOP
ENDMACRO

\-------------------------------------------------------------------------------
\i2clock - generates a single positive pulse on SCL

MACRO i2clock
	sclhi
	scllo
ENDMACRO

\-------------------------------------------------------------------------------
\Sets Clock and Data lines high - the I2C idle state

MACRO i2cidle
	scllo
	sdahi
	sclhi
ENDMACRO

\-------------------------------------------------------------------------------
\i2cstop - issues an I2C STOP by a sequence of SCL>lo, SDA>lo, SCL>hi, SDA>hi.
\This puts the bus into the I2C IDLE state.

MACRO i2cstop
	scllo
	sdalo
	sclhi
	sdahi			\SCL & SDA now high
ENDMACRO

\-------------------------------------------------------------------------------
\i2cstart - issues an I2C START by a sequence of SDA>lo, <delay>, SCL>lo.
\Sets idle state (both hi) first.

MACRO i2cstart
	i2cidle
	sdalo
	scllo
ENDMACRO

\-------------------------------------------------------------------------------
\*** End of Macro definitions ***
\-------------------------------------------------------------------------------