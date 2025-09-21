\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\
\ Special note for this v3.1 AP6 Variant \
\ Please read the README on GitHub       \
\ https://github.com/fozretro/ap6rtc     \
\ This contains more information on this \
\ variant Martins code and intend usage  \
\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\

\version strings, short and long (with biuld)
\this target should include
\ inc\bus\E.asm               I2CBUS
\ inc\rtc\DS3231.asm          I2CRTC
version	MACRO
          ASC	'3.2E'		\version string with CR and..	
          ENDM
versionl  MACRO
          ASC	'3.2 ELK  130925#' \ Must be 16 characters ending in #, with DDMMYY
          ENDM          