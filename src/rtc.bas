REM ***************************
REM Test 01 : Check for PCF8583
REM ***************************
*I2CQUERY Q
PRINT "Test 01 : ";
IF ?&A00=&50 THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 02 : Byte W/R
REM **************************
PRINT "Test 02 : ";
A%=42
B%=0
*I2CTXB 50 #12 A%
*I2CRXB 50 #12 B%
IF A%=B% THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 03 : Bytes W/R
REM **************************
PRINT "Test 03 : ";
$&A00="HELLO"
*I2CTXD 50 #12 06
*I2CRXD 50 #12 06
IF $&A00="HELLO" THEN PRINT "Pass" ELSE PRINT "Fail"

REM **************************
REM Test 04 : Passage of time
REM **************************
PRINT "Test 04 : ";
I%=5:O%=255:REPEAT
?&900=1
A%=14:X%=0:Y%=&09:CALL &FFF1
T%=( (?&906 DIV 16) AND &F ) *10 + (?&906 AND &F)
IF T%=O% THEN PRINT "Fail":EXIT
O%=T%
S%=TIME+100:REPEAT UNTIL TIME>S%
I%=I%-1:UNTIL I%=0
IF I%=0 THEN PRINT "Pass" 
