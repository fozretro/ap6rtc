#!/bin/bash

# Build I2CEAP6 ROM - creates two versions for relocation analysis
# This script compiles the I2C ROM twice (at $8000 and $8100) and copies to tmp/

set -e

echo "Building I2CEAP6 ROM for relocation analysis..."

# Change to project root
cd "$(dirname "$0")/../.."

# Create tmp directory
mkdir -p bin/smjoin/tmp

# Build I2C ROM at $8000
./bin/beebasm -i ./src/I2CBeeb.asm -do ./bin/smjoin/tmp/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -D ALTBASE=0 \
    -D PAD=0 \
    -o "I2CEAP6"
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./bin/smjoin/tmp/out.ssd ./bin/smjoin/tmp/8000

# Build I2C ROM at $8100
./bin/beebasm -i ./src/I2CBeeb.asm -do ./bin/smjoin/tmp/out.ssd -title I2C \
    -S INCBUS="./src/inc/bus/EAP6.asm" \
    -S INCRTC="./src/inc/rtc/PCF8583.asm" \
    -S INCTARGET="./src/inc/targets/EAP6.asm" \
    -D ALTBASE=1 \
    -D PAD=0 \
    -o "I2CEAP6"    
# Extract from ssd to output folder
./bin/mmbutils/beeb getfile ./bin/smjoin/tmp/out.ssd ./bin/smjoin/tmp/8100

echo "✅ Step 1 complete: Created i2c-8000.rom and i2c-8100.rom in bin/smjoin/tmp/"
echo "Build complete! Intermediate ROMs ready for next step in bin/smjoin/tmp/"