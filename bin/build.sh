# Clear output folder
rm -rf ./src/out/eap6
# Compile Acorn Electron AP6 target
./bin/beebasm -v -i ./src/I2CBeeb.asm -do ./src/out/i2c.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -D PAD=0 \
    -o "I2CROM"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/i2c.ssd ./src/out/eap6
