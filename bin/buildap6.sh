#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

# ROM file constants
ROM_FILES=(
    "../../src.AP6.MDFS/AP1v131"
    "../../src.AP6.MDFS/AP6v134"
    "../../src.AP6.MDFS/TUBEelk"
    "../../src.AP6.MDFS/AP6Count"
    "tmp/i2c-reloc.rom"
)
OUTPUT_ROM="../../dist/ap6.rom"

# Parse command line arguments
SKIP_I2C_BUILD=false
KEEP_SERVER_RUNNING=false
TEST_FILTER=""
VERBOSE=false
SKIP_TESTING=false

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
        --testFilter)
            TEST_FILTER="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --skip-testing)
            SKIP_TESTING=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--skip-i2c-build] [--nokill-romserver] [--testFilter ROM1,ROM2,...] [--verbose] [--skip-testing]"
            echo "  --skip-i2c-build     Skip I2C ROM compilation, use existing files"
            echo "  --nokill-romserver   Keep ROM server running after tests complete"
            echo "  --testFilter         Comma-separated list of ROM names to test (e.g., AP6.rom,I2C.rom)"
            echo "                       Available ROMs: AP6.rom, LatestAP6.rom, I2C.rom, LatestI2C.rom"
            echo "  --verbose, -v        Enable verbose logging in test output"
            echo "  --skip-testing       Skip ROM testing step entirely"
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
if [ "$SKIP_TESTING" = true ]; then
    echo "  -> Skipping testing step"
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
if [ "$VERBOSE" = true ]; then
    node smjoin-create.js "${ROM_FILES[@]}" "$OUTPUT_ROM" --verbose
else
    node smjoin-create.js "${ROM_FILES[@]}" "$OUTPUT_ROM"
fi
if [ $? -ne 0 ]; then
    echo "❌ SMJoin combination failed!"
    exit 1
fi
echo "✅ SMJoin combination completed successfully"
echo ""

echo "📊 Final ROM Statistics:"
ls -la "$OUTPUT_ROM"
echo ""

if [ "$SKIP_TESTING" = true ]; then
    echo "🧪 Step 4: Skipping ROM tests..."
    echo "✅ Testing step skipped"
else
    echo "🧪 Step 4: Running ROM tests..."
    if [ -n "$TEST_FILTER" ]; then
        echo "  -> Filtering tests to: $TEST_FILTER"
    fi
    if [ "$VERBOSE" = true ]; then
        echo "  -> Verbose logging enabled"
    fi
    if [ "$KEEP_SERVER_RUNNING" = true ]; then
        echo "  -> Server will be kept running after tests complete"
        if [ -n "$TEST_FILTER" ] && [ "$VERBOSE" = true ]; then
            node smjoin-test.js --nokill-romserver --testFilter "$TEST_FILTER" --verbose
        elif [ -n "$TEST_FILTER" ]; then
            node smjoin-test.js --nokill-romserver --testFilter "$TEST_FILTER"
        elif [ "$VERBOSE" = true ]; then
            node smjoin-test.js --nokill-romserver --verbose
        else
            node smjoin-test.js --nokill-romserver
        fi
    else
        if [ -n "$TEST_FILTER" ] && [ "$VERBOSE" = true ]; then
            node smjoin-test.js --testFilter "$TEST_FILTER" --verbose
        elif [ -n "$TEST_FILTER" ]; then
            node smjoin-test.js --testFilter "$TEST_FILTER"
        elif [ "$VERBOSE" = true ]; then
            node smjoin-test.js --verbose
        else
            node smjoin-test.js
        fi
    fi
    if [ $? -ne 0 ]; then
        echo "❌ ROM tests failed!"
        exit 1
    fi
fi
echo ""

echo "🎉 AP6 Complete Build Pipeline finished successfully!"
echo "Output: $OUTPUT_ROM"
echo "=================================================="
