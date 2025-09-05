#!/bin/bash

# Builds the I2C32EAP6 ROM with SMJoin compatibility
# Performs dual compilation at $8000 and $8100 to generate relocation data
# Auto launch b-em with /dev/i2c - assumes VDFS configured to point to /dev/i2c

# Parse command line arguments
SKIP_COMPILE=false
NO_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-compile)
            SKIP_COMPILE=true
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--skip-compile] [--no-cleanup]"
            echo "  --skip-compile  Skip dual compilation, use existing ROM files"
            echo "  --no-cleanup    Keep temporary files after build"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "Building I2C32EAP6 ROM with SMJoin compatibility..."
if [ "$SKIP_COMPILE" = true ]; then
    echo "  -> Skipping compilation (using existing ROM files)"
fi
if [ "$NO_CLEANUP" = true ]; then
    echo "  -> Cleanup disabled (keeping temporary files)"
fi

if [ "$SKIP_COMPILE" = false ]; then
    # Copy source files to /dev/i2c
    echo "Copying source files..."
    cp ./src.i2c/I2CBeeb.asm ./dev/i2c/I2C
    cp ./src.i2c/inc/bus/EAP6.asm ./dev/i2c/I2CBUS
    cp ./src.i2c/inc/rtc/PCF8583.asm ./dev/i2c/I2CRTC
    cp ./src.i2c/inc/targets/EAP6.asm ./dev/i2c/I2CVER

    # Remove padding for SMJoin builds (keep original for regular builds)
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
else
    echo "Skipping compilation - using existing ROM files..."
    if [ ! -f "./dev/i2c/I2CROM_8000" ] || [ ! -f "./dev/i2c/I2CROM_8100" ]; then
        echo "Error: Required ROM files not found. Run without --skip-compile first."
        exit 1
    fi
    echo "  -> Found I2CROM_8000: $(wc -c < ./dev/i2c/I2CROM_8000) bytes"
    echo "  -> Found I2CROM_8100: $(wc -c < ./dev/i2c/I2CROM_8100) bytes"
fi

# Generate relocation data and create final ROM
echo "Generating relocation data and creating final ROM..."
node ./bin/smjoin-reloc-data.js ./dev/i2c/I2CROM_8000 ./dev/i2c/I2CROM_8100 ./dev/i2c/I2CROM_join

# Copy final ROM to smjoin-16kb directory for SMJoin tool
echo "Copying ROM to SMJoin directory..."
mkdir -p ./dev/smjoin-16kb
cp ./dev/i2c/I2CROM_join ./dev/smjoin-16kb/I2C
echo "I2C ROM with SMJoin compatibility" > ./dev/smjoin-16kb/I2C.inf

# Clean up temporary files
if [ "$NO_CLEANUP" = false ]; then
    echo "Cleaning up temporary files..."
    rm -f ./dev/i2c/I2CROM_8000
    rm -f ./dev/i2c/I2CROM_8100
    rm -f ./dev/i2c/I2CROM_join
else
    echo "Keeping temporary files (cleanup disabled)"
    echo "  -> I2CROM_8000: $(wc -c < ./dev/i2c/I2CROM_8000 2>/dev/null || echo 'not found') bytes"
    echo "  -> I2CROM_8100: $(wc -c < ./dev/i2c/I2CROM_8100 2>/dev/null || echo 'not found') bytes"
    echo "  -> I2CROM_join: $(wc -c < ./dev/i2c/I2CROM_join 2>/dev/null || echo 'not found') bytes"
fi

echo "Build complete! ROM ready for SMJoin in /dev/smjoin-16kb/"
