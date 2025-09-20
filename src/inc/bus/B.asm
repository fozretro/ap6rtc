\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\


\-------------------------------------------------------------------------------
\ The marcos below assume the BBC Micro analog port is the I2C bus interface
\ Assumes System 6522 VIA @ $FE40 and uses PB5=SDA , PB4=SCL

\System VIA (6522) Registers
upiob	=	$FE40		\I/O Register B
upddrb	=	$FE42		\Data Direction Register B
 
xsdahi 	=	$DF		\upddrb AND #xsdahi=b5 reset=data hi
xsdalo	=	$20		\upddrb OR #xsdalo=b5 set=data lo
getsda	=	$20		\upiob AND #getsda to read data

xsclhi	=	$EF		\upddrb AND #xsclhi=b4 reset=clock hi
xscllo	=	$10		\upddrb OR #xscllo=b4 set=clock lo
getscl	=	$10		\upiob AND #getscl to read clock

\-------------------------------------------------------------------------------
\*** Macro definitions ***
\-------------------------------------------------------------------------------
\Allows SCL (clock) to float hi by setting VIA DDRB b4 to 0=input
\Checks for clock-stretch from slave where SCL is held lo by slave by polling
\DIOB until b4 becomes clear.

MACRO sclhi
	LDA	upddrb		\set SCL to input (0 = float hi/read)
	AND	#xsclhi		\only clear b4 of DDR
	STA	upddrb
.cstr	
	LDA	upiob		\wait for b4 to transit high
	AND	#getscl
	BEQ	cstr		\clock lo, wait...
.sclx	
	NOP				\clock hi, continue
ENDMACRO

\-------------------------------------------------------------------------------
\SCL (clock) driven lo by setting VIA DDRB b4 to 1=output and DIOB b4 to 0

MACRO scllo
	LDA	upiob
	AND	#xsclhi		\only clear b4 of DIO
	STA	upiob
	LDA	upddrb
	ORA	#xscllo		\only set b4 of DDR
	STA	upddrb
ENDMACRO

\-------------------------------------------------------------------------------
\Allows SDA (data) to float hi by setting VIA DDRB bit 5 (only) to 0=input

MACRO sdahi
	LDA	upddrb
	AND	#xsdahi		\only clear b5 of DDR
	STA	upddrb
ENDMACRO

\-------------------------------------------------------------------------------
\SDA (data) driven lo by setting VIA DDRB b5 to 1=output and DIOB b5 to 0

MACRO sdalo
	LDA	upiob
	AND	#xsdahi		\only clear b5 of DIO
	STA	upiob
	LDA	upddrb
	ORA	#xsdalo		\only set b5 of DDR
	STA	upddrb
ENDMACRO

\-------------------------------------------------------------------------------
\i2cdbit - sets SDA hi or lo to mirror Carry flag

MACRO i2cdbit
	BCC	dblo
	sdahi				\C=1, SDA=1
	BCS	dbx
.dblo	
	sdalo				\C=0, SDA=0
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