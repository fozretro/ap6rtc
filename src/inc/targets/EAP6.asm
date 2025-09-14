\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\version strings, short and long (with biuld)
\this target should include
\ inc\bus\EAP6.asm               I2CBUS
\ inc\rtc\PCF8583.asm            I2CRTC
MACRO version
          EQUS	"3.2EAP6"      \version string with CR and..	
ENDMACRO
MACRO versionl
          EQUS	"3.2 EAP6 130925#" \ Must be 16 characters ending in #, with DDMMYY 
ENDMACRO