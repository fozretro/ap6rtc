# Create ./dist/i2c.ssd using mmbutils
./bin/mmbutils/beeb blank_ssd ./dist/i2c.ssd
./bin/mmbutils/beeb putfile ./dist/i2c.ssd ./dist/i2c/I2C32B.rom ./dist/i2c/I2C32E.rom ./dist/i2c/I2C32EAP6.rom
./bin/mmbutils/beeb title ./dist/i2c.ssd i2crom
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