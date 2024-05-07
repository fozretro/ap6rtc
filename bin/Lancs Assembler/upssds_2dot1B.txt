
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\                 *** UPSSD ***                   \
\                                                 \
\             (c) Martin Barr 2010                \
\                                                 \
\           PC to User Port SSD creator           \
\      for use with Centronics adaptor cable      \
\                                                 \
\                     V2.1B                       \
\            For Acorn BBC Micromputers           \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\------------------------------------------------------------------------------
\Notes:
\
\1. Requires parallel PC printer port to Beeb User Port cable wired to
\   Centronics standard.                                   
\
\2. Link timeouts : First Byte ~ 80s (150)  Last Byte ~ 3s (6)                                                                    
\                                                                       
\3.                                                    
\
\------------------------------------------------------------------------------
\System constants and program constants & variables

loadexec  EQU       $1900               \Load & Execution address

OSASCI    EQU       $FFE3               \print A to screen
OSWORD    EQU       $FFF1               \OSWORD!

                                        \User Port 6522 Registers
upiob     EQU       $FE60               \I/O Register B
upifr	EQU	$FE6D		\Interrupt Flag Register
upddrb	EQU	$FE62		\Data Direction Register B
uppcr	EQU	$FE6C		\Peripheral Control Register
upier	EQU	$FE6E		\Interrupt Enable Register

ow7f      EQU       $1F00               \OSWORD $7F parameter block
               
cli       EQU       $F2                 \command line pointer - use (cli),Y

dstdrv    EQU       $80                 \destination drive (0..3)
dsttrk    EQU       $81                 \destination track (0..79)
starttrk	EQU	-1		\start track for write (inc'd to 0)

t0	EQU	$82		\timeout timer lo byte
t1	EQU	$83		\timeout timer mid byte
t2	EQU	$84		\timeout timer hi byte
timeout	EQU	$85		\iterations of t2 to signal timeout
tbyte1	EQU	150                 \timeout value for first byte
tbyten	EQU	6                   \timeout value for all other bytes

bufinit   EQU       $2000               \received byte buffer start address
buftrks	EQU	8		\buffer size in tracks
maxtrk	EQU	80		\maximum permitted write tracks + 1

				\top of buffer high byte (lo = 0)
buftop	EQU	(bufinit/256)+(buftrks*10) 
bptrl	EQU	$86		\track buffer pointer lo
bptrh	EQU	$87		\track buffer pointer hi
wptrl	EQU	$88		\disc write buffer pointer lo
wptrh	EQU	$89		\disc write buffer pointer hi
bufsecs	EQU	$8A		\buffered sectors (counts modulo 10)
newdata	EQU	$8C		\data-to-write flag

cr        EQU       13                  \<cr>

\end of declarations

\------------------------------------------------------------------------------

          ORG       loadexec            \Load & Execution address

\------------------------------------------------------------------------------
\Main task scheduler

enter     JSR       parse               \validate command line
          BCS       quit                \if C=1, error in command line, exit
          JSR       init                \perform all initialisations
          LDA       #1	          \inform user ready to receive
          JSR       xmess

	LDA	#tbyte1		\set extended timeout for first byte
	STA	timeout
	STA	upiob		\request first byte (dummy write i/o B)
	JSR	getbyte		\and goto wait for the first byte
	BCC	cont		\first byte received, begin xfer
	LDA       #2		\else first byte timed out, report error
	JSR	xmess
	BEQ	quit		\and exit
	
cont	LDA	#tbyten		\set normal timeout for rxd bytes
	STA	timeout
	LDA	#3		\report transfer started
	JSR	xmess
	BEQ	fetch_a1		\and enter transfer loop at save
				\to save first byte

fetch     JSR       getbyte             \fetch a byte
          BCS       finish              \carry set = timeout so goto complete
fetch_a1  JSR       bufchr              \store byte in the track buffer
          BCC       fetch               \if Carry clear fetch next byte
fetch_a2  JSR       write               \else buffer full, write the tracks
          BCC       fetch               \no write error, loop for next byte
	
fetch_a3  LDA       #4                  \else report write error
	JSR	xmess                
          BEQ       quit                \and exit
          
finish  	LDA	bufsecs		\last track complete? (= 10 sectors)
	BEQ	wlast		\yes, check for final write

bufpad	LDA	#0                  \else pad last track with nulls
	JSR	bufchr
	LDA	bufsecs             \until track is sector-complete
	BNE	bufpad
	
wlast	LDA	newdata		\data to write?
	BEQ	done		\no, skip write
	JSR	write		\else write remaining track(s)
	BCS	fetch_a3		\if Carry set, report write error

done      LDA	#5		\report finished ok
          JSR	xmess

quit      RTS

\-------------------------------------------------------------------------------
\Byte fetch routine
\Fetches one byte (Centronics Protocol) from the User Port
\Returns with Carry clear if byte received or with Carry set if no byte
\received within 'timeout' major counts of three byte timer t2-t0.
\If byte fetched successfully, initiates transfer of the next byte

				\for potential efficiency, always check
getbyte	LDA	upifr		\for CB1 edge trigger first
	BNE	rxd		\yes, byte waiting so goto fetch

	LDA	#0		\else reset timer hi, mid & lo counts
	STA	t0
	STA	t1
	STA	t2

getloop	LDA	upifr               \test for CB1 edge trigger
	BNE	rxd		\if none zero, byte received
	
	INC	t0		\increment 3 byte timer
	BNE	getloop
	INC	t1
	BNE	getloop
	INC	t2

	LDA	timeout 		\test for byte_not_received timeout
	CMP	t2
	BNE	getloop		\no timeout, loop
	SEC			\else timed out, set carry and return
	BCS	rxx

rxd	LDA	upiob		\CB1 triggered, get the byte

	                              \and initiate next byte transfer
	STA	upiob		\with a dummy write to I/O port B
	CLC			\clear Carry to flag byte received	

rxx	RTS			\RTS	
	
\-------------------------------------------------------------------------------
\Stores one byte in the track buffer and updates the buffer pointer.
\Monitors buffer and if full returns Carry set to indicate disc write required.
\Maintains a modulo 10 sector count to allow later determination of any
\incomplete track at end of transfer.

bufchr	LDY	#0		\zero Y (dummy index)
	STA	(bptrl),Y		\save in buffer
	INC	bptrl		\increment buffer pointer lo/hi
	BNE	bc1
	INC	bptrh
	INC	bufsecs		\increment sector count every 256 bytes
	LDA	bufsecs
	CMP	#10		\10 sectors (1 track) buffered?
	BNE	bc3                 \no, continue
	LDA	#0		\else reset sector count
	STA	bufsecs

bc3	LDA	#buftop		\test for buffer full
	CMP	bptrh
	BNE	bc1		\not full..
	SEC                           \else buffer full, exit Carry set
	BCS	bc2

bc1	CLC		          \buffer not full, exit Carry clear

bc2	LDA	#1		\set data-to-write flag
	STA	newdata		
	RTS

\-------------------------------------------------------------------------------
\Collects drive number from user command line (*UPSSD <d> where d = 0..3)
\Exits Carry clear if drive ok else reports error to user and returns Carry set
\If command is entered with no drive parameter, program version is reported
			
parse	LDA	(cli),Y             \command only, no drive?
	CMP	#13
	BNE	parse_a3
	LDA	#7                  \yes, report version
	JSR	xmess
	SEC                           \and exit setting error flag
	BCS	parse_a2

parse_a3	LDA	(cli),Y		\get first character after command<spc>
	CMP	#$30		\< "0"
	BMI	parse_a1		\yes, error
	CMP	#$34		\< "4"
	BPL	parse_a1		\no, error
	AND	#$0F		\else valid so convert to 0..3
	STA	dstdrv		\and save
	CLC			\flag drive ok to main
	BCC	parse_a2		\and return

parse_a1	LDA       #0                  \invalid drive number entered
          JSR	xmess		\report error
	SEC			\flag error to main

parse_a2	RTS			\and return

\-------------------------------------------------------------------------------
\Writes the track(s) in the buffer to disc. Returns Carry set if a disc error
\of any sort occurs. If write successful, resets buffer pointers to start of
\byte buffer.

write	LDA	#>bufinit		\reset write buffer pointer
          STA	wptrl
          LDA	#<bufinit
          STA	wptrh
   	          		\writing 1 track each pass
wrtrk 	INC	dsttrk		\increment destination track
	LDA	dsttrk
	CMP	#maxtrk             \at limit?
	BNE	wrcont		\no, continue
      	LDA	#6                  \else report max tracks exceeded
	JSR	xmess
	BEQ	wrerr		\and exit with error

wrcont	LDA	wptrl		\set OSWORD $7F buffer pointers
	STA	ow7f+1
	LDA	wptrh
	STA	ow7f+2
	LDA       #3                  \3 parameters for write
          STA       ow7f+5              
          LDA       #$4B                \$4B = OSWORD $7F Write Sector Multi
          STA       ow7f+6
	LDA	dsttrk		\start track
	STA	ow7f+7
	LDA	#0		\reset error byte
	STA	ow7f+10
	LDA	#$7F		\OSWORD $7F
	LDX       #>ow7f              \X = parameter block lo
          LDY       #<ow7f              \Y = parameter block hi
          JSR	OSWORD              \Write the track
     
	LDA       ow7f+10             \check for any error
	BNE	wrerr		\error, exit Carry set

	CLC			\increment write buffer pointer
	LDA	#10                 \by 1 track bytes (2560)
	ADC	wptrh
	STA	wptrh
	CMP	bptrh		\buffer emptied?
	BNE	wrtrk               \no, loop to write next track

          LDA	#>bufinit		\else reset buffer pointers
          STA	bptrl
          LDA	#<bufinit
          STA	bptrh
wrok	CLC			\clear Carry (good write)
	BCC	wrx                 \and exit
	
wrerr	SEC                           \error occurred so exit Carry set

wrx	LDA	#0		\reset data-to-write flag
	STA	newdata
	RTS

\-------------------------------------------------------------------------------
\Program initialisations

init      LDA       #0
	STA	newdata		\reset data-to-write flag
	STA	bufsecs             \buffered sector count = 0
          LDA	#starttrk		\DFS track start
          STA	dsttrk
          JSR       os7f                \initialise osword $7F block
          LDA	#>bufinit		\init buffer pointer lo / hi
          STA	bptrl
          LDA	#<bufinit
          STA	bptrh
          
                                        \initialise 6522 Port B (User Port)
	LDA	#0		\eight inputs
	STA	upddrb
	LDA	uppcr		\set CB1 (Strobe) to -ve edge
	AND	#$0F		\and set 'Write Handshaking' mode
	ORA	#$80		\Bits 7-4 = %1000
	STA	uppcr

          RTS                           \and return

\..............................................................................
\Initialise common parameters in OSWORD $7F data block

os7f      LDA       dstdrv              \destination drive
          STA       ow7f                
          LDA       #$FF                \top 16 bits of buffer = $FF = I/O proc
          STA       ow7f+3
          STA       ow7f+4
          LDA	#0		\start sector = 0
          STA       ow7f+8              
          LDA       #$2A                \writing 10 sectors of 256 bytes
          STA       ow7f+9              

	RTS

\-------------------------------------------------------------------------------
\Multi-message print routine.
\ALL messages are 15 characters long (padded with trailing spaces if necessary)
\and are selected via A = <message number> in the max. range 0-15
\(Note : exits A = 0 and thus caller can branch always via BEQ on return)

txt0	STR	'Invalid drive! '
txt1	STR	'Ready.         '
txt2	STR	'No data!       '
txt3	STR	'Receiving...   '
txt4	STR	'Write error!   '
txt5	STR	'Transfer Ended.'
txt6	STR	'Track No. >79  '
txt7	STR	'Ver 2.1B 070810'

xmess     ASL			\multiply message number by 16
	ASL
	ASL
	ASL
	TAX
xmess_a1	LDA	txt0,X		\get a character
	JSR	OSASCI		\print it
	INX                           \increment index
	CMP	#cr		\<cr>?
	BNE 	xmess_a1		\no, loop for next character
	RTS			\else finished, return

\-------------------------------------------------------------------------------
\** end of UPSSD **
