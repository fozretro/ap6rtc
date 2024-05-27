\-------------------------------------------------------------------------------
\ The marcos below assume the BBC Micro analog port is the I2C bus interface
\ Assumes System 6522 VIA @ $FE40 and uses PB5=SDA , PB4=SCL

				\System VIA (6522) Registers
upiob	EQU	$FE40		\I/O Register B
upddrb	EQU	$FE42		\Data Direction Register B
 
xsdahi 	EQU	$DF		\upddrb AND #xsdahi=b5 reset=data hi
xsdalo	EQU	$20		\upddrb OR #xsdalo=b5 set=data lo
getsda	EQU	$20		\upiob AND #getsda to read data

xsclhi	EQU	$EF		\upddrb AND #xsclhi=b4 reset=clock hi
xscllo	EQU	$10		\upddrb OR #xscllo=b4 set=clock lo
getscl	EQU	$10		\upiob AND #getscl to read clock

\-------------------------------------------------------------------------------
\*** Macro definitions ***
\-------------------------------------------------------------------------------
\Allows SCL (clock) to float hi by setting VIA DDRB b4 to 0=input
\Checks for clock-stretch from slave where SCL is held lo by slave by polling
\DIOB until b4 becomes clear.

sclhi	MACRO
	LDA	upddrb		\set SCL to input (0 = float hi/read)
	AND	#xsclhi		\only clear b4 of DDR
	STA	upddrb
cstr@$MC	LDA	upiob		\wait for b4 to transit high
	AND	#getscl
	BEQ	cstr@$MC		\clock lo, wait...
sclx@$MC	NOP			\clock hi, continue
	ENDM

\-------------------------------------------------------------------------------
\SCL (clock) driven lo by setting VIA DDRB b4 to 1=output and DIOB b4 to 0

scllo	MACRO
	LDA	upiob
	AND	#xsclhi		\only clear b4 of DIO
	STA	upiob
	LDA	upddrb
	ORA	#xscllo		\only set b4 of DDR
	STA	upddrb
	ENDM

\-------------------------------------------------------------------------------
\Allows SDA (data) to float hi by setting VIA DDRB bit 5 (only) to 0=input

sdahi	MACRO
	LDA	upddrb
	AND	#xsdahi		\only clear b5 of DDR
	STA	upddrb
	ENDM

\-------------------------------------------------------------------------------
\SDA (data) driven lo by setting VIA DDRB b5 to 1=output and DIOB b5 to 0

sdalo	MACRO
	LDA	upiob
	AND	#xsdahi		\only clear b5 of DIO
	STA	upiob
	LDA	upddrb
	ORA	#xsdalo		\only set b5 of DDR
	STA	upddrb
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
	i2cidle
	sdalo
	scllo
	ENDM

\-------------------------------------------------------------------------------
\*** End of Macro definitions ***
\-------------------------------------------------------------------------------