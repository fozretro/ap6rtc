# Auto launch b-em with /dev/i2c - assumes VDFS configured to point to /dev/i2c
cp ./src.i2c/I2CBeeb_3dot1EAP6.asm ./dev/i2c/I2C
/Users/andrewfawcett/Documents/b-em/b-em/b-em -autoboot -sp9
tr -s '\r' < ./dev/i2c/I2COUT  | tr '\001' ' ' | tr '\f' ' ' | tr '\r' '\n' 
cp ./dev/i2c/I2CROM ./dist/i2c/I2C32EAP6.rom