# Always delete the old SSD to avoid trailing dot issues
rm -f ./dist/i2c.ssd
# Create ./dist/i2c.ssd using mmbutils
./bin/mmbutils/beeb blank_ssd ./dist/i2c.ssd
# Create temporary files with correct names (no trailing dots)
cp ./dist/i2c/I2C32B.rom ./dist/i2c/I2C32B
cp ./dist/i2c/I2C32E.rom ./dist/i2c/I2C32E
cp ./dist/i2c/I2C32EAP6.rom ./dist/i2c/I2C32EAP6
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./dist/i2c/I2C32B ./dist/i2c/I2C32E ./dist/i2c/I2C32EAP6
./bin/mmbutils/beeb title ./dist/i2c.ssd i2crom
# Clean up temporary files
rm ./dist/i2c/I2C32B ./dist/i2c/I2C32E ./dist/i2c/I2C32EAP6
# Expand it back out into the Beebs development workspace the OBJECT file for local running and to update .inf file for OBJECT
rm -rf ./dev/ap6rtc-dist
./bin/mmbutils/beeb getfile ./dist/i2c.ssd ./dev/ap6rtc-dist
# Fix filenames by removing trailing dots
for file in ./dev/ap6rtc-dist/I2C*.; do
    if [ -f "$file" ]; then
        mv "$file" "${file%.}"
    fi
done
for file in ./dev/ap6rtc-dist/I2C*..inf; do
    if [ -f "$file" ]; then
        mv "$file" "${file%..inf}.inf"
    fi
done
cp ./dev/ap6rtc-dist/I2C* ./dev/ap6rtc