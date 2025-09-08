# Builds the original source code provided by Martin
# Auto launch b-em with /dev/i2c - assumes VDFS configured to point to /dev/i2c
cp ./dist/i2c/archive/I2CBeeb_3dot1E.asm ./dev/i2c/I2C
./bin/b-em/b-em -autoboot -sp9
tr -s '\r' < ./dev/i2c/I2COUT  | tr '\001' ' ' | tr '\f' ' ' | tr '\r' '\n' 
cp ./dev/i2c/I2CROM ./dist/i2c/I2C31E.rom