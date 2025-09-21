   10REM > MiniROM/src 1.00
   20REM 1.00 05-Feb-2016 J.G.Harston
   30REM Header for a miniature SROM/Module with only a single command
   40:
   50PROCassem(0):CLEAR:PROCassem(2):PROCsm_table
   60A$="*SAVE "+fname$+" "+STR$~(mcode%+M%)+" "+STR$~O%+" FFFF0000 FFFBBC00"
   70PRINTA$;:OSCLIA$:PRINT
   80END
   90:
  100DEFPROCassem(pass%)
  110file$ ="TEST"                   :REM Saved filename
  120title$="ROMTITLE"               :REM ROM title
  130vers$ ="0.01 (01 Jan 2015)"     :REM ROM version and date
  140copy$ ="(C)J.G.Harston"         :REM Copyright message
  150:
  160ver%=VALvers$*10
  170DIM mcode% &1800,L% -1
  180OSASCI=&FFE3:OSNEWL=&FFE7:OSWRCH=&FFEE
  190:
  200FOR pass%=pass% TO pass%+1
  210opt%=FNsm_pass(pass%)
  220[OPT opt%
  230.RomStart
  240BRK:EQUW RelocTable
  250JMP Service
  260EQUB &82:EQUB Copyright-RomStart
  270.RomTitle
  280EQUB ver%:EQUS title$
  290EQUB &00 :EQUS vers$
  300.Copyright
  310EQUB &00:EQUS copy$
  320EQUB &00
  330:
  340.Service
  350CMP #4:BEQ Serv4          :\ *command
  360CMP #9:BNE NotServ9       :\ Not *Help
  370LDA (&F2),Y
  380CMP #13:BNE Serv9Skip     :\ Not *Help <cr>
  390JSR OSNEWL:LDX #0
  400.Serv9Lp
  410LDA RomTitle+1,X          :\ Print ROM title
  420BNE P%+4:LDA #ASC" "      :\ Convert &00 to <spc>
  430CMP #ASC"(":BEQ Serv9Done :\ End at '('
  440JSR OSWRCH:INX:BNE Serv9Lp
  450.Serv9Done
  460JSR OSNEWL
  470.Serv9Skip
  480LDA #9
  490.NotServ9
  500RTS
  510:
  520.Serv4
  530TYA:PHA:DEY:LDX #&FF
  540.Serv4Lp
  550INX:INY:LDA (&F2),Y
  560CMP #ASC".":BEQ Serv4Dot
  570CMP #ASC"!":BCC Serv4End
  580CMP RomTitle+1,X:BEQ Serv4Lp :\ Match with ROM title
  590EOR #&20                     :\ Change case
  600CMP RomTitle+1,X:BEQ Serv4Lp :\ Match with ROM title
  610.Serv4Quit
  620PLA:TAY                      :\ Restore Y
  630.Serv4Exit
  640LDA #4:RTS                   :\ Restore A and return unclaimed
  650.Serv4End
  660LDA RomTitle+1,X:BNE Serv4Quit
  670DEY
  680.Serv4Dot
  690INY:LDA (&F2),Y              :\ Step past '.'
  700CMP #ASC" ":BEQ Serv4Dot     :\ Skip any spaces
  710PLA                          :\ Drop saved Y
  720:
  730\ (&F2),Y => any parameters
  740:
  750\ Demo code, just print the command line
  760.DemoLp
  770LDA (&F2),Y:JSR OSASCI
  780INY:CMP #13:BNE DemoLp
  790:
  800:
  810LDA #0:RTS                   :\ Claim call and return
  820]:RelocTable=P%
  830NEXT:ENDPROC
  840:
  850DEFFNsm_pass(pass%)
  860IFpass%=0:M%=0
  870IFpass%=1:M%=O%-mcode%
  880P%=&8100-128*(pass%AND2)
  890O%=mcode%+M%*(pass%AND2)DIV2
  900IFpass%=1:IF O%+M%*2.125>L%:PRINT"Code overrun":END
  910=VALMID$("4647",pass%+1,1)
  920:
  930DEFPROCsm_table
  940base80%=mcode%+M%:base81%=mcode%:byte%=0:count%=0:off%=0:REPEAT
  950byte80%=base80%?off%:byte81%=base81%?off%:IF off%>=M%:byte80%=&80:byte81%=&80
  960IF ((byte81%-byte80%) AND &FE)<>0 THEN PRINT "ERROR: Offset by more than one page at &";~&8000+off%
  970IF (byte80% AND &C0)=&80:byte%=byte%DIV2+128*(byte81%-byte80%):count%=count%+1
  980IF count%=8:?O%=byte%:O%=O%+1:byte%=0:count%=0
  990off%=off%+1:UNTILoff%>=M% AND count%=0
 1000ENDPROC
