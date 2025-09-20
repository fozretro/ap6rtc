\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\-------------------------------------------------------------------------------
\ The marcos below assume the AP6 control register is the I2C bus interface
\ The AP6 is an expansion fitted to the Acorn Electron Plus 1 and includes the 
\ PCF8583 RTS clock built into it, along with pin headers for additional devices

				\AP6 interface registers
ap6reg	= 	$FCD6		\AP6 control register
xsdahi	= 	&80		\TODO Explain bitmask
xsdalo	= 	&7F		\TODO Explain bitmask
xsclhi	= 	&40		\TODO Explain bitmask
xscllo	= 	&BF		\TODO Explain bitmask
ap6regc	=	$62		\last written value to AP6 control reg
ap6idle	= 	$11		\idle value of AP6 ctrl reg

upiob	=	ap6reg		\alias
getsda	= 	xsdahi		\alias

\-------------------------------------------------------------------------------
\*** Macro definitions ***
\-------------------------------------------------------------------------------

MACRO sclhi
	LDA ap6regc
	ORA #(xsclhi)
	STA ap6regc
	STA ap6reg
ENDMACRO
	
\-------------------------------------------------------------------------------
\SCL (clock) driven lo by adjusting the AP6 control register, see AP6 manual

MACRO scllo
	LDA ap6regc
	AND #(xscllo)
	STA ap6regc
	STA ap6reg
ENDMACRO

\-------------------------------------------------------------------------------
\Allows SDA (data) to float hi by adjusting the AP6 control register, see AP6 manual

MACRO sdahi
	LDA	ap6regc
	ORA	#(xsdahi)
	STA	ap6regc
	STA	ap6reg
ENDMACRO

\-------------------------------------------------------------------------------
\SDA (data) driven lo by adjusting the AP6 control register, see AP6 manual

MACRO sdalo
	LDA	ap6regc
	AND	#(xsdalo)
	STA	ap6regc
	STA	ap6reg
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
	sdahi				\SCL & SDA now high
ENDMACRO

\-------------------------------------------------------------------------------
\i2cstart - issues an I2C START by a sequence of SDA>lo, <delay>, SCL>lo.
\Sets idle state (both hi) first.

MACRO i2cstart
	LDA #ap6idle		\idle value for AP6
	STA ap6reg			\set AP6 reg (write only) to known state
	STA ap6regc			\maintain a copy of the last written value
	i2cidle
	sdalo
	scllo
ENDMACRO

\-------------------------------------------------------------------------------
\*** End of Macro definitions ***
\-------------------------------------------------------------------------------