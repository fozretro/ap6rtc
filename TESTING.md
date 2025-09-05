# ROM Testing Guide

This document provides direct links to test various ROM images in the Electroniq emulator.

## 🚀 Server Status

**Local Server**: `http://localhost:8080` (CORS-enabled)  
**Status**: ✅ Running and serving ROMs directly from original locations

## 📋 Available ROMs for Testing

### 1. Official AP6 ROM (Reference)
**URL**: `https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/AP6.rom`  
**Source**: Official Electroniq repository  
**Size**: 7,772 bytes  
**Status**: ✅ Working  
**Description**: Official AP6 Plus 1.1.33 ROM - use as reference baseline

### 2. Standard I2C ROM (Individual)
**URL**: `https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/I2C_standard.rom`  
**Source**: `dist/i2c/I2C32EAP6.rom`  
**Size**: 16,384 bytes  
**Status**: ✅ Working  
**Description**: Standard I2C ROM without SMJoin modifications

### 3. SMJoin-Modified I2C ROM (Individual)
**URL**: `https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/I2C.rom`  
**Source**: `dev/smjoin-16kb/I2C`  
**Size**: 4,977 bytes  
**Status**: ❓ Testing needed  
**Description**: I2C ROM modified for SMJoin compatibility

### 4. 8KB Combined ROM (4 Official ROMs)
**URL**: `https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/COMB_8kb.rom`  
**Source**: `dev/smjoin-8kb/COMB`  
**Size**: 7,852 bytes  
**Status**: ✅ Working  
**Description**: Combined ROM with 4 official AP6 ROMs (AP1v131, AP6v134, TUBEelk, AP6Count)

### 5. 16KB Combined ROM (5 ROMs + I2C)
**URL**: `https://0xc0de6502.github.io/electroniq/?romF=http://localhost:8080/COMB.rom`  
**Source**: `dev/smjoin-16kb/COMB`  
**Size**: 12,805 bytes  
**Status**: ❓ Testing needed  
**Description**: Combined ROM with all 5 ROMs including SMJoin-compatible I2C

## 🧪 Testing Protocol

### Phase 1: Individual ROM Testing
1. **Test Official AP6 ROM** - Verify baseline functionality
2. **Test Standard I2C ROM** - Verify I2C works individually
3. **Test SMJoin-Modified I2C ROM** - Verify SMJoin modifications work

### Phase 2: Combined ROM Testing
4. **Test 8KB Combined ROM** - Verify 4 ROMs work together
5. **Test 16KB Combined ROM** - Verify all 5 ROMs including I2C work together

### Phase 3: Comparison Testing
6. **Compare functionality** between individual and combined ROMs
7. **Test I2C commands** in the combined ROM
8. **Verify ROM chaining** and service calls work correctly

## 🔧 Troubleshooting

### If ROMs don't load:
1. **Check server status**: `curl -I http://localhost:8080/COMB.rom`
2. **Restart server**: `pkill -f server_cors_server.py && python3 server_cors_server.py &`
3. **Check file existence**: `ls -la dev/smjoin-16kb/COMB`

### If emulator shows errors:
1. **Check browser console** for CORS or network errors
2. **Verify URL format** includes `.rom` extension
3. **Try different ROM** to isolate the issue

## 📊 Expected Results

| ROM | Size | Status | Functionality |
|-----|------|--------|---------------|
| AP6.rom | 7,772 bytes | ✅ Working | AP6 Plus 1.1.33 |
| I2C_standard.rom | 16,384 bytes | ✅ Working | I2C 3.2B (standard) |
| I2C.rom | 4,977 bytes | ❓ Testing | I2C 3.2B (SMJoin-modified) |
| COMB_8kb.rom | 7,852 bytes | ✅ Working | 4 ROMs combined |
| COMB.rom | 12,805 bytes | ❓ Testing | 5 ROMs + I2C combined |

## 🎯 Success Criteria

- ✅ **Individual ROMs load** without errors
- ✅ **Combined ROMs load** without hanging
- ✅ **I2C functionality** accessible in combined ROM
- ✅ **ROM chaining** works correctly
- ✅ **Service calls** function properly

## 📝 Notes

- All ROMs are served directly from their original locations
- No file copying or duplication required
- Server automatically handles CORS headers
- Debug output shows file paths and existence status
- Port 8080 is used for consistency with previous testing

---

**Last Updated**: September 5, 2025  
**Server Version**: CORS-enabled Python HTTP server  
**Project**: AP6 RTC with I2C ROM Integration
