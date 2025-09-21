#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Clear output folder
rm -rf ./src/out
mkdir ./src/out

############################################################
# Build I2CB ROM
############################################################

# Compile Acorn BBC Micro target
echo ""
echo "*** Building I2CB ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/B.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/B.asm" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -o "I2CB"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/b

############################################################
# Build I2CE ROM
############################################################

# Compile Acorn Electron target
echo ""
echo "*** Building I2CE ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/E.asm" \
    -S INCRTC="./src/inc/rtc/DS3231.asm" \
    -S INCTARGET="./src/inc/targets/E.asm" \
    -D ALTBASE=0 \
    -D PAD=1 \
    -o "I2CE"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/e

############################################################
# Build I2EAP6 ROM
############################################################

# Compile Acorn Electron AP6 target
echo ""
echo "*** Building I2EAP6 ROM ***"
./bin/beebasm -i ./src/I2CBeeb.asm -do ./src/out/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -o "I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./src/out/out.ssd ./src/out/ap6

############################################################
# Build i2c.ssd
############################################################

# Always delete the old SSD to avoid trailing dot issues
echo ""
echo "*** Building I2C.SSD ***"
rm -f ./dist/i2c.ssd
# Create ./dist/i2c.ssd using mmbutils
./bin/mmbutils/beeb blank_ssd ./dist/i2c.ssd
# Add outputs above to ssd
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./src/out/ap6/I2CEAP6 ./src/out/b/I2CB ./src/out/e/I2CE
./bin/mmbutils/beeb title ./dist/i2c.ssd i2crom

############################################################
# Output indivudal roms to the dist folder
############################################################

cp ./src/out/b/I2CB ./dist/i2cb.rom
cp ./src/out/e/I2CE ./dist/i2ce.rom
cp ./src/out/ap6/I2CEAP6 ./dist/i2ceap6.rom

################################################################################
# Update Dev Folders used with real target machines via UPURSFS
################################################################################
echo ""
echo "*** Updating Dev Folders ***"
rm -rf ./dev/roms
./bin/mmbutils/beeb getfile ./dist/i2c.ssd ./dev/roms
for file in ./dev/roms/I2C*.; do
    if [ -f "$file" ]; then
        mv "$file" "${file%.}"
    fi
done
for file in ./dev/roms/I2C*..inf; do
    if [ -f "$file" ]; then
        mv "$file" "${file%..inf}.inf"
    fi
done
cp ./dev/roms/I2C* ./dev/eap6