#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# Parse command line arguments
SKIP_I2C_BUILD=false
KEEP_SERVER_RUNNING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-i2c-build)
            SKIP_I2C_BUILD=true
            shift
            ;;
        --nokill-romserver)
            KEEP_SERVER_RUNNING=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--skip-i2c-build] [--nokill-romserver]"
            echo "  --skip-i2c-build     Skip I2C ROM compilation, use existing files"
            echo "  --nokill-romserver   Keep ROM server running after tests complete"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo "🚀 AP6 Complete Build Pipeline"
echo "============================="
if [ "$SKIP_I2C_BUILD" = true ]; then
    echo "  -> Skipping I2C build (using existing files)"
fi
echo ""

# Change to project root
cd "$(dirname "$0")/.."

# Clear tmp folder when not skipping I2C build
if [ "$SKIP_I2C_BUILD" = false ]; then
    echo "🧹 Clearing temporary build files..."
    rm -rf ./bin/smjoin/tmp/*
    echo "✅ Temporary files cleared"
    echo ""
fi

if [ "$SKIP_I2C_BUILD" = false ]; then
    echo "📦 Step 1: Building I2C EAP6 Join ROM..."
    ./bin/smjoin/smjoin-build-i2c-rom.sh
    if [ $? -ne 0 ]; then
        echo "❌ I2C EAP6 Join build failed!"
        exit 1
    fi
    echo "✅ I2C EAP6 Join build completed successfully"
else
    echo "📦 Step 1: Skipping I2C EAP6 Join ROM build..."
    if [ ! -f "./bin/smjoin/tmp/i2c-8000.rom" ] || [ ! -f "./bin/smjoin/tmp/i2c-8100.rom" ]; then
        echo "❌ Required I2C ROM files not found. Run without --skip-i2c-build first."
        exit 1
    fi
    echo "✅ Using existing I2C ROM files"
fi
echo ""


echo "🔗 Step 2: Creating relocation ROM..."
cd bin/smjoin/

# Remove existing i2c-reloc.rom if it exists
if [ -f "tmp/i2c-reloc.rom" ]; then
    echo "🧹 Removing existing i2c-reloc.rom..."
    rm -f tmp/i2c-reloc.rom
    echo "✅ Existing i2c-reloc.rom removed"
fi

node smjoin-reloc.js tmp/i2c-8000.rom tmp/i2c-8100.rom tmp/i2c-reloc.rom
if [ $? -ne 0 ]; then
    echo "❌ Relocation ROM creation failed!"
    exit 1
fi
echo "✅ Relocation ROM created successfully"
echo ""

echo "🔗 Step 3: Combining ROMs with SMJoin..."
node smjoin-create.js ../../dev/smjoin-8kb/AP1V131 ../../dev/smjoin-8kb/AP6V134 ../../dev/smjoin-8kb/TUBEELK ../../dev/smjoin-8kb/AP6COUNT tmp/i2c-reloc.rom ../../dist/ap6.rom
if [ $? -ne 0 ]; then
    echo "❌ SMJoin combination failed!"
    exit 1
fi
echo "✅ SMJoin combination completed successfully"
echo ""

echo "📊 Final ROM Statistics:"
ls -la ../../dist/ap6.rom
echo ""

echo "🧪 Step 4: Running ROM tests..."
if [ "$KEEP_SERVER_RUNNING" = true ]; then
    echo "  -> Server will be kept running after tests complete"
    node smjoin-test.js --nokill-romserver
else
    node smjoin-test.js
fi
if [ $? -ne 0 ]; then
    echo "❌ ROM tests failed!"
    exit 1
fi
echo ""

echo "🎉 AP6 Complete Build Pipeline finished successfully!"
echo "Output: dist/ap6.rom"
echo "=================================================="
