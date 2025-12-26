export class SoundGenerator{
    /**
     * Ein SoundGenerator wird erstellt
     * @param {AudioContext} audioContext
     */
    constructor(audioContext){
        this.audioContext = audioContext;
        this.masterGain = new GainNode(this.audioContext);
        this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.masterGain.connect(this.audioContext.destination);
    }

    /**
     * Gibt die Mastergain Node zurück
     * @returns {GainNode}
     */
    getGain(){
        return this.masterGain;
    }

    /**
     * Gibt die aktuelle AudioContext Zeit zurück
     * @returns {Number}
     */
    getCurrentTime(){
        return this.audioContext.currentTime
    }


    /**
     * 
     * @param {{isRest: boolean, durationMs: number, frequency: number, note: Object, gnote: Object}[]} data  
     * @param {GainNode} masterGain   
     * @param {'sine' | 'square' | 'sawtooth' | 'triangle'} [waveType='sine'] 
     */
    creatSound(data, masterGain, waveType="sine"){
        const currentTime = this.audioContext.currentTime;

        data.forEach(note =>{
            if (!note.isRest) {
                const oscillator = new OscillatorNode(this.audioContext);
                const noteGain = new GainNode(this.audioContext); 

                // Eine Note spielen
                oscillator.type = waveType;
                oscillator.frequency.setValueAtTime(note.frequency, currentTime);
                
                // Verbindung: Oszillator -> NoteGain -> MasterGain
                oscillator.connect(noteGain);
                noteGain.connect(masterGain);
                
                // Einfache ADSR-Hüllkurve (Attack/Release) zur Vermeidung von Klicks
                const maxNoteGain = 1/data.length;
                const totalNoteDurationSec = note.durationMs / 1000;
                const attackTime = 0.01; // 10ms
                const decayTime = 0.1;  // 100ms
                const sustainLevel = maxNoteGain * 0.7; // Halten bei 70% des max. Gains

                // 1. Reset auf 0
                noteGain.gain.setValueAtTime(0, currentTime); 
                // 2. ATTACK: Auf Peak gehen (maxNoteGain)
                noteGain.gain.exponentialRampToValueAtTime(maxNoteGain, currentTime + attackTime);
                // 3. DECAY: Auf Sustain-Level abfallen
                noteGain.gain.setTargetAtTime(sustainLevel, currentTime + attackTime, decayTime);
                // 4. NOTE-OFF (virtueller Release-Trigger)
                // Führe den Release (Abfall auf 0) kurz vor dem Ende der Note aus.
                noteGain.gain.exponentialRampToValueAtTime(0.00001, currentTime + totalNoteDurationSec-0.20);
                oscillator.start(currentTime);
                oscillator.stop(currentTime + totalNoteDurationSec);
            }
        });
        
    }
}