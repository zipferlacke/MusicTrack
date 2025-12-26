import progressjszipEsm from 'https://cdn.jsdelivr.net/npm/@progress/jszip-esm@1.0.4/+esm'

export const midiInstumentTable = {
    0: "acoustic_grand_piano",
    1: "bright_acoustic_piano",
    2: "electric_grand_piano",
    3: "honky_tonk_piano",
    4: "electric_piano_1",
    5: "electric_piano_2",
    6: "harpsichord",
    7: "clavinet",
    8: "celesta",
    9: "glockenspiel",
    10: "music_box",
    11: "vibraphone",
    12: "marimba",
    13: "xylophone",
    14: "tubular_bells",
    15: "dulcimer",
    16: "drawbar_organ",
    17: "percussive_organ",
    18: "rock_organ",
    19: "church_organ",
    20: "reed_organ",
    21: "accordion",
    22: "harmonica",
    23: "tango_accordion",
    24: "acoustic_guitar_nylon",
    25: "acoustic_guitar_steel",
    26: "electric_guitar_jazz",
    27: "electric_guitar_clean",
    28: "electric_guitar_muted",
    29: "overdriven_guitar",
    30: "distortion_guitar",
    31: "guitar_harmonics",
    32: "acoustic_bass",
    33: "electric_bass_finger",
    34: "electric_bass_pick",
    35: "fretless_bass",
    36: "slap_bass_1",
    37: "slap_bass_2",
    38: "synth_bass_1",
    39: "synth_bass_2",
    40: "violin",
    41: "viola",
    42: "cello",
    43: "contrabass",
    44: "tremolo_strings",
    45: "pizzicato_strings",
    46: "orchestral_harp",
    47: "timpani",
    48: "string_ensemble_1",
    49: "string_ensemble_2",
    50: "synth_strings_1",
    51: "synth_strings_2",
    52: "choir_aahs",
    53: "voice_oohs",
    54: "synth_voice",
    55: "orchestra_hit",
    56: "trumpet",
    57: "trombone",
    58: "tuba",
    59: "muted_trumpet",
    60: "french_horn",
    61: "brass_section",
    62: "synth_brass_1",
    63: "synth_brass_2",
    64: "soprano_sax",
    65: "alto_sax",
    66: "tenor_sax",
    67: "baritone_sax",
    68: "oboe",
    69: "english_horn",
    70: "bassoon",
    71: "clarinet",
    72: "piccolo",
    73: "flute",
    74: "recorder",
    75: "pan_flute",
    76: "blown_bottle",
    77: "shakuhachi",
    78: "whistle",
    79: "ocarina",
    80: "lead_1_square",
    81: "lead_2_sawtooth",
    82: "lead_3_calliope",
    83: "lead_4_chiff",
    84: "lead_5_charang",
    85: "lead_6_voice",
    86: "lead_7_fifths",
    87: "lead_8_bass_lead",
    88: "pad_1_new_age",
    89: "pad_2_warm",
    90: "pad_3_polysynth",
    91: "pad_4_choir",
    92: "pad_5_bowed",
    93: "pad_6_metallic",
    94: "pad_7_halo",
    95: "pad_8_sweep",
    96: "fx_1_rain",
    97: "fx_2_soundtrack",
    98: "fx_3_crystal",
    99: "fx_4_atmosphere",
    100: "fx_5_brightness",
    101: "fx_6_goblins",
    102: "fx_7_echoes",
    103: "fx_8_sci_fi",
    104: "sitar",
    105: "banjo",
    106: "shamisen",
    107: "koto",
    108: "kalimba",
    109: "bag_pipe",
    110: "fiddle",
    111: "shanai",
    112: "tinkle_bell",
    113: "agogo",
    114: "steel_drums",
    115: "woodblock",
    116: "taiko_drum",
    117: "melodic_tom",
    118: "synth_drum",
    119: "reverse_cymbal",
    120: "guitar_fret_noise",
    121: "breath_noise",
    122: "seashore",
    123: "bird_tweet",
    124: "telephone_ring",
    125: "helicopter",
    126: "applause",
    127: "gunshot"
}

/**
 * Hilfreiche Sammlung von Funktionen für files
 */
export class FileHelper{
    /**
     * @type {{title:string, subtitle:string, composer:string, instruments:{midiNumber:string}}}
     */
    constructor(){}

    extendMetaDataMEI(fileString){
        const parser = new DOMParser();
        const file = parser.parseFromString(fileString, "application/xml")
        const root = [file.querySelector("pgHead"), file.querySelector("fileDesc")]
        const metaData = {}

        let possibilities = [`[type="title"]`, `[role="title"]`, `[label="title"]`, `[halign="center"][valign="top"]`, `title [type="main"]`, `title`];
        metaData.title = this.#getValue(root, possibilities)?.textContent?? "Unbekannt";

        possibilities = [`[type="subtitle"]`, `[role="subtitle"]`, `[label="subtitle"]`, `title [type="subordinate"]`];
        metaData.subtitle = this.#getValue(root, possibilities)?.textContent?? "Unbekannt";

        possibilities = [`[type="composer"]`, `[role="composer"]`, `[label="composer"]`, `[halign="right"][valign="bottom"]`, `composer`];
        metaData.composer = this.#getValue(root, possibilities)?.textContent?? "Unbekannt";
        const scoreDef = file.querySelector(`scoreDef`);
        if(!scoreDef.getAttribute("midi.bpm")) scoreDef.setAttribute("midi.bpm", 120);
        metaData.defaultBPM = parseInt(scoreDef.getAttribute("midi.bpm"));
        metaData.currentBPM = metaData.defaultBPM;
        const instuments = [];
        const staffMap = {internal:{}};
        let staffElemnts = [... file.querySelectorAll(`scoreDef > staffGrp > *`)];
        while (staffElemnts.length > 0){
            const staffElm = staffElemnts.shift();

            // Allgemeine Logik zur Namensfindung
            const findInstrumentName = (el) => {
                let instrumentName = el.querySelector('label')?.textContent;
                if (instrumentName) return instrumentName;           
                // Fallback auf MIDI-Tabelle
                const midiNumber = el.querySelector("instrDef")?.getAttribute("midi.instrnum");
                if (midiNumber) {
                    return `(${midiInstumentTable[parseInt(midiNumber)]})`;
                }

                return "Unbekannt";
            };
            const findMidiNumber = (el) => {
                return parseInt(el.querySelector("instrDef")?.getAttribute("midi.instrnum")|| "0");
            }
      
            const findAttribute = (elm, map) => {
                for (const {selc, att } of map) {
                    let target;
                    
                    if (selc === "&") {
                        target = elm;
                    } else {
                        target = elm.querySelector(selc);
                    }

                    if (target && target.hasAttribute(att)) {
                        return target.getAttribute(att);
                    }
                }

                //Fallback
                const scoreDef = elm.closest('scoreDef');
                if (scoreDef) {
                    for (const { att } of map) {
                        if (scoreDef.hasAttribute(att)) return scoreDef.getAttribute(att);
                    }
                }

                return null;
            };
            

            if(staffElm.tagName == "staffDef"){
                const instrument = {
                    id:instuments.length,
                    name: findInstrumentName(staffElm),
                    midiNumber: findMidiNumber(staffElm),
                    transSemi: parseInt(findAttribute(staffElm, [{selc:"&", att:"trans.semi"}]) || "0"),
                    rhythm: [
                        parseInt(findAttribute(staffElm, [{selc:"&", att:"meter.count"}, {selc:"meterSig", att:"count"}]) || "4"), 
                        parseInt(findAttribute(staffElm, [{selc:"&", att:"meter.unit"}, {selc:"meterSig", att:"unit"}]) || "4")
                    ],
                    visible: true,
                    analyse: true,
                    staffNumbers: [parseInt(staffElm.getAttribute("n"))]
                }
                instuments.push(instrument);
                for (const staffNumber of instrument.staffNumbers) {staffMap[staffNumber] = instrument; staffMap.internal[staffNumber] = staffNumber};

            }else if(staffElm.tagName == "staffGrp" && staffElm.querySelector(`grpSym[symbol="brace"]`)){
                const staffNumbersArray = Array.from(staffElm.querySelectorAll("staffDef"))
                    .map(staffDef => {
                        const n_value = staffDef?.getAttribute("n");
                        
                        if(n_value) return parseInt(n_value);
                    })
                const instrument = {
                    id:instuments.length,
                    name: findInstrumentName(staffElm),
                    transSemi: parseInt(findAttribute(staffElm, [{selc:"staffDef", att:"trans.semi"}]) || "0"),
                    midiNumber: findMidiNumber(staffElm),
                    rhythm: [
                        parseInt(findAttribute(staffElm, [{selc:"staffDef", att:"meter.count"}, {selc:"meterSig", att:"count"}]) || "4"), 
                        parseInt(findAttribute(staffElm, [{selc:"staffDef", att:"meter.unit"}, {selc:"meterSig", att:"unit"}]) || "4")
                    ],
                    visible: true,
                    analyse: true,
                    staffNumbers: staffNumbersArray
                }
                instuments.push(instrument);
                for (const staffNumber of instrument.staffNumbers) {staffMap[staffNumber] = instrument; staffMap.internal[staffNumber] = staffNumber};

            }else{
                if(staffElm.querySelectorAll("& > *"))
                    staffElemnts = [...staffElemnts, ...staffElm.querySelectorAll("& > *")]; 
            }
        }
        metaData.instruments = instuments;
        metaData.staffInstrumentMap = staffMap;
        return metaData;
    }

    /**
     * Gibt das gesuchte XMLElement oder null zurück. Bassierend auf den EIngabe Daten.  
     * @param {Element[]} rootElmts Liste der Werte XML ELemnte von Wo gesucht werden soll
     * @param {string[]} possibilities Liste der konkreten Bezeichner die gesucht werden sollen 
     * @returns {Element|null}
     */
    #getValue(rootElmts, possibilities){
        for(const root of rootElmts){
            if(!root) continue;
            for(const possibilitiy of possibilities){
                if(root.querySelector(possibilitiy)) return root.querySelector(possibilitiy);
            }
        }
        return null;
    }

    /**
     * Konvertiert ein FileBuffer zu einem Sting
     * @param {string} fileName
     * @param {ArrayBuffer} fileBuffer
     * @returns {Promise<string>}
     */
    async convertFiletoSting(fileName, fileBuffer){
        if(!fileName.includes("mxl")){
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(fileBuffer);
        } else {
            const jszip = new progressjszipEsm();
            const unzip = await jszip.loadAsync(fileBuffer); 
            for (const [relativePath, fileEntry] of Object.entries(unzip.files)) {
                if (fileEntry.dir) continue;
                if (relativePath.includes("container.xml") || relativePath === "mimetype") continue;

                if (relativePath.endsWith(".mxl")||relativePath.endsWith(".xml")||relativePath.endsWith(".musicxml")) {
                    return await fileEntry.async("text");
                }
            }
        }
    }
}