# Compile ./dist/ap6rtc.ssd
beebasm -v -i ./src/rtc.asm -do ./dist/ap6rtc.ssd -title ap6rtc -opt 3
# Expand it back out into the Beebs development workspace the OBJECT file for local running and to update .inf file for OBJECT
rm -rf ./dev/ap6rtc-dist
perl ./bin/mmbutils/beeb getfile ./dist/ap6rtc.ssd ./dev/ap6rtc-dist
cp ./dev/ap6rtc-dist/RTC* ./dev/ap6rtc
cp ./dev/ap6rtc-dist/I2C* ./dev/ap6rtc