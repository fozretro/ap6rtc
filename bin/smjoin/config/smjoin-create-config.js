/**
 * Configuration for SMJoin ROM combination
 * Defines ROM files and their page alignment options
 */

module.exports = {
    // ROM files to combine (in order)
    romFiles: [
        {
            path: "../../src.AP6.MDFS/AP1v131",
            name: "AP1v131"
        },
        {
            path: "../../src.AP6.MDFS/AP6v134", 
            name: "AP6v134",
            pageAlignment: false
        },
        {
            path: "../../src.AP6.MDFS/TUBEelk",
            name: "TUBEelk", 
            pageAlignment: false
        },
        {
            path: "../../src.AP6.MDFS/AP6Count",
            name: "AP6Count",
            pageAlignment: false
        },
        // {
        //     path: "../../src.AP6v133t/roms/TreeROM",
        //     name: "TreeROM",
        //     pageAlignment: false
        // },
        {
            path: "tmp/i2c-reloc.rom",
            name: "I2C",
            pageAlignment: true 
        }
    ],
    
    // Output configuration
    output: {
        path: "../../dist/ap6.rom",
        name: "AP6 Combined ROM"
    }
};
