\-------------------------------------------------------------------------------
\ The marcos below assume the AP6 control register is the I2C bus interface
\ The AP6 is an expansion fitted to the Acorn Electron Plus 1 and includes the 
\ PCF8583 RTS clock built into it, along with pin headers for additional devices

				\AP6 interface registers
ap6reg	EQU 	$FCD6		\AP6 control register
xsdahi	EQU 	&80		\TODO Explain bitmask
xsdalo	EQU 	&7F		\TODO Explain bitmask
xsclhi	EQU 	&40		\TODO Explain bitmask
xscllo	EQU 	&BF		\TODO Explain bitmask
ap6regc	EQU	$62		\last written value to AP6 control reg
ap6idle	EQU 	$11		\idle value of AP6 ctrl reg

upiob	EQU	ap6reg		\alias
getsda	EQU 	xsdahi		\alias

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