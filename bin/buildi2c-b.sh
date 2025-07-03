# Builds the I2C32B ROM
# Auto launch b-em with /dev/i2c - assumes VDFS configured to point to /dev/i2c
cp ./src.i2c/I2CBeeb.asm ./dev/i2c/I2C
cp ./src.i2c/inc/bus/B.asm ./dev/i2c/I2CBUS
cp ./src.i2c/inc/rtc/DS3231.asm ./dev/i2c/I2CRTC
cp ./src.i2c/inc/targets/B.asm ./dev/i2c/I2CVER
./bin/b-em/b-em -autoboot -sp9 -vroot ./dev/i2c
tr -s '\r' < ./dev/i2c/I2COUT  | tr '\001' ' ' | tr '\f' ' ' | tr '\r' '\n' 
cp ./dev/i2c/I2CROM ./dist/i2c/I2C32B.rom