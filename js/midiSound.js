// import midiPlayerJs from 'https://cdn.jsdelivr.net/npm/midi-player-js@2.0.16/+esm'
import midiPlayerJs from "./libs/midi-player-js.js";
import { Soundfont } from 'https://cdn.jsdelivr.net/npm/smplr@0.16.3/+esm'

/**
 * Erstellt Töne/Frequnzen aus MidiDatei
 * @see https://www.jsdelivr.com/package/npm/smplr
 * @see https://www.jsdelivr.com/package/npm/midi-player-js
 */
export class MidiSoundGenerator{
    #midiPlayer = null;
    #audioCTX = null;
    #midiInstumentTable = {
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
     * Erzeugt einen MidiPlayer
     * @param {AudioContext} audioCTX 
     * @param {Function} func 
     */
    constructor(audioCTX, func){
        this.#audioCTX = audioCTX;
        this.#midiPlayer = new midiPlayerJs.Player(func)
    }

    /**
     * Lädt ein Midibuffer und gibt Eine Liste mit den Trackszurück und einer funktion zum spieln der Töne
     * @param {ArrayBuffer} midiBuffer 
     * @returns {Promise<>}
     */
    async loadMidi(midiBuffer, staffInstrumentMap){
        this.#midiPlayer.loadArrayBuffer(midiBuffer);
        this.#midiPlayer.dryRun();
        const skipTimes = {};
        let lastTick = 0;

        // const staffInstrumentMapRev = Object.entries(staffInstrumentMap.internal).reduce((acc, [mapStaff, realStaff]) => {
        //     acc[realStaff] = mapStaff;
        //     return acc;
        // }, {});
        
        const trackPrograms = {};
        for(const event of this.#midiPlayer.events.flat().sort((a, b) => a.tick - b.tick)){
            if (event.name === 'Program Change') {
                const midiValue = event.value;
                
                trackPrograms[event.track] = midiValue;
            
            // Pausen berechnung
            }else if(event.name === 'Note on' && event.velocity > 0){
                const realStaff = event.track-1//staffInstrumentMap.internal[event.track-1];
                if(realStaff && staffInstrumentMap[realStaff].analyse){
                    const gapSize = this.#midiPlayer.getDivision().division * (4 / staffInstrumentMap[realStaff].rhythm[0]) * staffInstrumentMap[realStaff].rhythm[1]
                    
                    if(event.tick - lastTick > gapSize){
                        skipTimes[lastTick] = event.tick - gapSize;
                    }
                }
            }else if(event.name === 'Note off' || (event.name === 'Note on' && event.velocity === 0)){
                
                const realStaff = event.track-1 //staffInstrumentMap.internal[event.track-1];
                if(realStaff && staffInstrumentMap[realStaff].analyse){
                    lastTick = event.tick;
                }
            }else if(event.name === "End of Track"){
                const gapSize = this.#midiPlayer.getDivision().division * (4 / staffInstrumentMap[1].rhythm[0]) * staffInstrumentMap[1].rhythm[1]
                if(this.#midiPlayer.getTotalTicks() - lastTick > gapSize){
                    skipTimes[lastTick] = event.tick;
                }
            }
        }

        this.#midiPlayer.skipToSeconds(0);

        this.instrumentsByTrack = {}
        for (const trackId of Object.keys(trackPrograms)){
            this.instrumentsByTrack[trackId] = await new Soundfont(this.#audioCTX, {instrument: this.#midiInstumentTable[trackPrograms[trackId]]}).load;;
        }

        return {instruments: this.instrumentsByTrack, skipRests: skipTimes};
    }

    /**
     * Gibt die Sekunden seit Wiedergabe zurück.
     * @returns {number}
     */
    getTime(){
        return this.#midiPlayer.getCurrentTime();
    }

    /**
     * Startet den MidiPlayer
     */
    playMidi(){
        this.#midiPlayer.play();
    }

    /**
     * Springt zur übergeben Zeit im Stück.
     * @param {number} time
     */
    skipToTime(time){
        this.#midiPlayer.skipToSeconds(time);
    }

    /**
     * Springt zum übergeben Tick im Stück.
     * @param {number} tick
     */
    skipToTick(tick){
        this.#midiPlayer.skipToTick(tick);
    }

    

    /**
     * Pausiert den MidiPlayer
     */
    pauseMidi(){
        this.#midiPlayer.pause();
        this.skipToTime(this.getTime());
        for (const trackId in this.instrumentsByTrack) {
            const instrument = this.instrumentsByTrack[trackId];
            // smplr: instrument.stop() stoppt alle aktuell klingenden Noten dieses Instruments
            instrument.stop(); 
        } 
    }

    /**
     * Stopt den MidiPlayer
     */
    stopMidi(){
        this.#midiPlayer.stop();
        for (const trackId in this.instrumentsByTrack) {
            const instrument = this.instrumentsByTrack[trackId];
            // smplr: instrument.stop() stoppt alle aktuell klingenden Noten dieses Instruments
            instrument.stop(); 
        } 
    }

    async playSound(pitch, pitchDuration){
        if(!this.defaultInstrument) this.defaultInstrument = await new Soundfont(this.#audioCTX, {instrument: this.#midiInstumentTable[0]}).load;

        this.defaultInstrument.start({ 
            note: pitch, // Die MIDI Note Number
            velocity: 100, // Die Anschlagstärke (0-127)
            duration: pitchDuration
        });
    }
}