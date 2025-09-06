#!/bin/bash

# Build I2C32EAP6 ROM - creates two versions for relocation analysis
# This script compiles the I2C ROM twice (at $8000 and $8100) and copies to tmp/

set -e

echo "Building I2C32EAP6 ROM for relocation analysis..."

# Change to project root
cd "$(dirname "$0")/../.."

# Create tmp directory
mkdir -p bin/smjoin/tmp

# Copy source files to /dev/i2c
echo "Copying source files..."
cp ./src.i2c/I2CBeeb.asm ./dev/i2c/I2C
cp ./src.i2c/inc/bus/EAP6.asm ./dev/i2c/I2CBUS
cp ./src.i2c/inc/rtc/PCF8583.asm ./dev/i2c/I2CRTC
cp ./src.i2c/inc/targets/EAP6.asm ./dev/i2c/I2CVER

# Remove padding for SMJoin builds
echo "Removing padding for SMJoin compatibility..."
sed -i '' '/DS	\$BF7F-\*+1/d' ./dev/i2c/I2C
echo "  -> Removed DS \$BF7F-*+1 padding line"

# First build at $8000 (original address)
echo "Building at \$8000..."
./bin/b-em/b-em -autoboot -sp9 -vroot ./dev/i2c
cp ./dev/i2c/I2CROM ./dev/i2c/I2CROM_8000
echo "  -> ROM size: $(wc -c < ./dev/i2c/I2CROM_8000) bytes"

# Modify ORG to $8100 for second build
echo "Modifying ORG to \$8100..."
sed -i '' 's/ORG	\$8000/ORG	\$8100/' ./dev/i2c/I2C
echo "  -> ORG changed from \$8000 to \$8100"

# Second build at $8100
echo "Building at \$8100..."
./bin/b-em/b-em -autoboot -sp9 -vroot ./dev/i2c
cp ./dev/i2c/I2CROM ./dev/i2c/I2CROM_8100
echo "  -> ROM size: $(wc -c < ./dev/i2c/I2CROM_8100) bytes"

# Copy to tmp directory
echo "Copying intermediate files to tmp directory..."
cp ./dev/i2c/I2CROM_8000 ./bin/smjoin/tmp/i2c-8000.rom
cp ./dev/i2c/I2CROM_8100 ./bin/smjoin/tmp/i2c-8100.rom

echo "✅ Step 1 complete: Created i2c-8000.rom and i2c-8100.rom in bin/smjoin/tmp/"
echo "Build complete! Intermediate ROMs ready for next step in bin/smjoin/tmp/"