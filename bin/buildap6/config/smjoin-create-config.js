/**
 * Configuration for SMJoin ROM combination
 * Builds AP6v134t replacement ROM with I2C instead of TreeCopy
 * 
 * Original AP6v134t.rom contains:
 * - Plus 1 1.34 (22 Jun 2018) + Plus 1 Support 1.31 (22 Jun 2018)
 * - ROM Manager & File Utils 1.34 (01 Jan 2021) 
 * - Electron TUBE HOST 1.10 (01 Jan 1990)
 * - RAMCountAP6 0.05 (20 May 2016)
 * - TreeCopy 1.62 (08 Feb 2017)
 * 
 * Our replacement contains:
 * - Plus 1 1.34 (22 Jun 2018) + Plus 1 Support 1.31 (22 Jun 2018)
 * - ROM Manager & File Utils 1.34 (01 Jan 2021)
 * - Electron TUBE HOST 1.10 (01 Jan 1990) 
 * - RAMCountAP6 0.05 (20 May 2016)
 * - I2C (custom ROM) - replaces TreeCopy
 */

module.exports = {
    // ROM files to combine (in order)
    romFiles: [
        {
            path: "../../roms/AP1Plus-v1.34.rom",
            name: "AP1Plus"
        },
        {
            path: "../../roms/ROMManager-v1.34.rom", 
            name: "ROMManager",
            pageAlignment: false
        },
        {
            path: "../../roms/TUBEelk-v1.10.rom",
            name: "TUBEelk", 
            pageAlignment: false
        },
        {
            path: "tmp/i2c-reloc.rom",
            name: "I2C",
            pageAlignment: true 
        },
        {
            path: "../../roms/AP6Count-v0.05.rom",
            name: "AP6Count",
            pageAlignment: false
        }
    ],
    
    // Output configuration
    output: {
        path: "../../dist/ap6.rom",
        name: "AP6v134t-I2C ROM (TreeCopy replaced with I2C)"
    }
};
