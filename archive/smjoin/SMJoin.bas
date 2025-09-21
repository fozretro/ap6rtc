   10REM > SMJoin
   20REM Build Sideways Modules into a single image
   30:
   40DIM ctrl% 31,mem% &4100:X%=ctrl%:Y%=X%DIV256
   50ON ERROR REPORT:PROCClose_All:PRINT " at line ";ERL:END
   60ptr%=0:in%=0
   70PRINT "Enter input files, end with RETURN"
   80REPEAT:INPUT LINE ": "in$:IF in$<>"":PROCadd
   90UNTIL in$=""
  100INPUT LINE "Enter output filename: "out$
  110OSCLI "Save "+out$+" "+STR$~mem%+"+"+STR$~ptr%+" 0 FFFBBC00"
  120ON ERROR END
  130OSCLI "Stamp "+out$
  140END
  150:
  160DEFPROCadd
  170IF LEFT$(in$,1)="|":ENDPROC
  180IF LEFT$(in$,1)="*":OSCLI MID$(in$,2):ENDPROC
  190in%=OPENIN(in$):IF in%=0:PRINT"File '"in$"' not found":ENDPROC
  200len%=EXT#in%:IF len%>&4100-ptr%:PRINT"File '"in$"' too long":CLOSE#in%:in%=0:ENDPROC
  210IF ptr%:ptr%=ptr%+2
  220PROCgbpb(4,in%,mem%+ptr%,len%,0):CLOSE#in%:in%=0
  230reloc%=0:IF mem%?ptr%=0:IF (mem%?(ptr%+2) AND &80)=&80:reloc%=ptr%+(mem%!(ptr%+1) AND &3FFF)
  240IF reloc%=0:IF ptr%:PRINT"File '"in$"' not relocatable, must be first entry":ENDPROC
  250old%=ptr%:ptr%=FNlink:IF old%=ptr%:PRINT"File '"in$"' too long":ENDPROC
  260FOR A%=ptr% TO &3FFF STEP 4:mem%!A%=0:NEXT A%
  270IF old%<>0 OR ptr%<&3FFF:ENDPROC
  280REPEAT:ptr%=ptr%-1:UNTIL mem%?ptr%<>mem%?&3FFF:ptr%=ptr%+1
  290ENDPROC
  300:
  310DEFPROCbyte
  320IF count%=0:byte%=mem%?reloc%:reloc%=reloc%+1:count%=8
  330IF byte%AND1:addr%=(mem%!(here%-1)AND&3FFF)+code%:mem%?(here%-1)=addr%:mem%?here%=(addr%DIV256)+&80
  340REM IF byte%AND1:PRINT" At ";~here%-code%+&8000;" (";~here%+&8000;") addr=";~addr%-code%+&8000;" reloc to ";~addr%+&8000
  350byte%=byte%DIV2:count%=count%-1
  360ENDPROC
  370:
  380DEFFNlink
  390IF ptr%=0:IF reloc%=0:=len%   :REM First item, no relocation table
  400IF ptr%=0:IF reloc%>0:=reloc% :REM First item, strip relocation table
  410:
  420REM Relocate loaded module
  430code% =ptr%                   :REM Start of loaded code
  440end%  =reloc%                 :REM End of loaded code
  450count%=0                      :REM No bits read yet
  460byte% =0                      :REM Relocation bitmap
  470IF end%>&4000:=ptr%           :REM Even after removing reloc table, will be too long
  480FOR here%=code% TO end%-1
  490  IF (mem%?here% AND &C0)=&80:PROCbyte
  500NEXT here%
  510:
  520REM Look for last unlinked module
  530REM Look for:
  540REM    JSR xxxx:JMP yyyy
  550REM or JSR xxxx:LDX &F4:JMP yyyy
  560link%=-2
  570REPEAT
  580  found%=FALSE
  590  IF mem%?link%=&20 AND (mem%!(link%+3) AND &FFFFFF)=&4CF4A6:found%=TRUE:next%=link%+6
  600  IF (mem%!link% AND &FF0000FF)=&4C000020:found%=TRUE:next%=link%+4
  610  IF link%<0:found%=TRUE:next%=link%+6
  620  IF found%:last%=link%:link%=mem%!next% AND &3FFF
  630UNTIL found%=0
  640REM last%=> JSR xxxx opcode field of last module
  650REM link%=> Start of service handler of last module
  660REM next%=> JMP yyyy address field of last module
  670:
  680REM Link new module to previous service handler
  690mem%?(ptr%-2)=&20
  700mem%?(ptr%-1)=link%
  710mem%?(ptr%-0)=(link% DIV 256) OR &80
  720mem%?(ptr%+1)=&A6
  730mem%?(ptr%+2)=&F4
  740:
  750REM Link previous module to new module
  760mem%?(next%+0)=ptr%-2
  770mem%?(next%+1)=((ptr%-2) DIV 256) OR &80
  780=end%
  790:
  800DEFPROCClose_All
  810in%=in%:IFin%:A%=in%:in%=0:CLOSE#A%
  820ENDPROC
  830:
  840DEFPROCgbpb(A%,chn%,addr%,num%,ptr%)
  850?X%=chn%:X%!1=addr%:X%!5=num%:X%!9=ptr%:IFPAGE<&FFFFF:CALL&FFD1:ENDPROC
  860IFA%=1ORA%=3:PTR#?X%=X%!9
  870REPEAT:IFA%=1ORA%=2:BPUT#?X%,?X%!1 ELSE IFA%=3ORA%=4:?X%!1=BGET#?X%
  880X%!1=X%!1+1:X%!5=X%!5-1:UNTIL(EOF#?X%ANDA%>2)ORX%!5<1:ENDPROC
