\version strings, short and long (with biuld)
\this target should include
\ inc\bus\B.asm               I2CBUS
\ inc\rtc\DS3231.asm          I2CRTC
version	MACRO
          ASC	'3.1B'		\version string with CR and..	
          ENDM
versionl  MACRO
          ASC	'I2C 3.1B 121118#'
          ENDM          