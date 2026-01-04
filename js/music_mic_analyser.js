/**
 * Mikrophon Analysierer
 * @author Florian Wüllner
 * @version 1.0
 */
export class MicAnalyser {
 
    /**
     * @typedef {object} Options
     * @property {number} centVarianceAnalyse Anaylse spektrum in Cent (75 Radius)
     * @property {number} centStepAnalyse Genauigkiet der Analyse in Cent (1)
     * @property {number} threshold_db Minimale Lautstärke in db für ein Ton (-80) 
     * @property {number} listinigQualityMs Wie häufig die Audiospur ausgewerte werden soll (25ms)
     * @property {number} fftSize=4096
     * @property {{drawFlag:boolean, startFrequency:Number, stopFrequency:Number, freqAreaColor:String, freqColor:String}} draw
     * 
     */
    /**
     * Alle Einstellungen vom MicAnalyser
     * @type {Options}
     */
    options = {
        centVarianceAnalyse:75,
        centStepAnalyse: 1,
        threshold_db: -80, 
        listinigQualityMs:25,
        fftSize:4096, 
        draw:{
            drawFlag:false, 
            startFrequency:0, 
            stopFrequency:1500,
            freqAreaColor: "rgba(0 0 255 / 1)",
            freqColor: "rgba(255 0 / 0.8)"
        }
    };
    
    /**
     * Ein MirkophoneAnalyser wird erstellt
     * @param {AudioContext} audioContext
     * @param {String} grapicsId
     * @param {Options} [options={}]
     */
    constructor(audioContext, grapicsId, options={}) {
        this.audioCTX = audioContext;
        this.options = {
            ...this.options,
            ...options 
        };

        this.micAnalyser = this.audioCTX.createAnalyser();
        this.micAnalyser.fftSize = this.options.fftSize;
        this.micAnalyser.smoothingTimeConstant = 0;

        // Grapische Elemente werden erstellt
        if(this.options.draw.drawFlag){
            this.canvas = document.querySelector(grapicsId);
            this.canvasCtx = this.canvas.getContext("2d");
        }
    }

    /**
     * Microphone Spur wird eingehangen
     */
    async startListinig(){
        // Mikrophone Stream erstellt und fertig gemacht
        if (this.audioCTX.state === 'suspended' || this.audioCTX.state === 'interrupted') {
            await this.audioCTX.resume();
        }
        this.rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micSource = this.audioCTX.createMediaStreamSource(this.rawStream);
        
        // 2. Verbinde die Nodes (Processor ist bereits für onaudioprocess konfiguriert)
        this.micSource.connect(this.micAnalyser);
    }

    /**
     * Microphone Spur wird ausgekoppelt
     */
    async stopListinig(){
        if(this.intervallID){
            clearInterval(this.intervallID); this.intervallID = null;
        }

        if (this.micSource) {
            this.micSource.disconnect(); // Trenne die Verbindung zur Source

            // Stoppe den MediaStream, um die Mikrofon-LED auszuschalten
            this.micSource.mediaStream.getTracks().forEach(track => {track.stop()});

            this.micSource = null;
        }
    }

    /**
     * Microphone Daten werden analysiert
     * @param {{frequency:number, score:number[], duration:number, maxCountDeviations:number, centDeviations:number[]}[]} noteData - Liste der Noten die Analysiert werden sollen
     */
    analyseMic(noteData){
        const micRawData = new Float32Array(this.micAnalyser.fftSize);
        this.micAnalyser.getFloatTimeDomainData(micRawData);
        this.#applyHanningWindow(micRawData);

        // Canvas wird zurück gesetzt
        if(this.options.draw.drawFlag){
            this.canvasCtx.fillStyle = "rgb(250 250 250)";
            this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        for(const note of noteData){
            let maxAmplitude = -100;
            let maxCent = 0;
            // Amplitude für Frequnz wird berechnet + die der Unsicherheit
            for(let i = -this.options.centVarianceAnalyse; i<this.options.centVarianceAnalyse+1; i+=this.options.centStepAnalyse){
                const frequency = note.frequency * Math.pow(2, i/1200);
                let amplitude = this.#goertzel_padded(micRawData, this.audioCTX.sampleRate, frequency, this.audioCTX.sampleRate);
                if (amplitude < 1e-10) {
                    amplitude = -100;
                } else {
                    amplitude = 20 * Math.log10(amplitude);
                }
                if(amplitude > maxAmplitude) {
                    maxAmplitude = amplitude;
                    maxCent = i;
                }
            }
            // Bewertung ob frequnz getroffen wurde wird erstellt
            if(maxAmplitude > this.options.threshold_db){
                const centDeviation = Math.abs(maxCent);
                note.centDeviations.push(maxCent);   
                note.score.push(1 - centDeviation/this.options.centVarianceAnalyse);
            }else{
                note.centDeviations.push(null);
                note.score.push(0);
            }

            if(note.score.length > note.maxCountDeviations ) {
                note.score.shift();
                note.centDeviations.shift();
            }

            if(this.options.draw.drawFlag){
                const freqfactor = Math.pow(2, this.options.centVarianceTarget/1200);
                const freqBoundLow = note.frequency / freqfactor;
                const freqBoundUp = note.frequency * freqfactor;
                const freqVariance = freqBoundUp - freqBoundLow;
                this.#drawFrequencyBox(note.frequency, freqVariance, this.options.draw.freqAreaColor);
            }
        }

        if(this.options.draw.drawFlag){
        const freq_stop = 1000;
            const bins = new Float32Array(freq_stop);
            for(let i=this.options.draw.startFrequency; i< this.options.draw.stopFrequency; i++){
                const amplitude = this.#goertzel_padded(micRawData, this.audioCTX.sampleRate, i, this.audioCTX.sampleRate); 
                if (amplitude < 1e-10) {
                    bins[i] = -100;
                } else {
                    bins[i] = 20 * Math.log10(amplitude);
                }
            }
            this.#drawSpectrum(bins, this.options.draw.freqColor);
        }

        // const fftData = new Float32Array(this.micAnalyser.fftSize);
        // this.micAnalyser.getFloatFrequencyData(fftData);

        // const fftData_plot = new Float32Array(freq_stop);
        // const fftbinsize = Math.round(this.audioCTX.sampleRate/this.micAnalyser.fftSize);
        // let fftbinstep = fftbinsize;
        // let fftbincount = 0;
        // for (let i = 0; i < freq_stop; i++) {
            // if(i > fftbinstep) {fftbincount++; fftbinstep+= fftbinsize;}
            // fftData_plot[i] = fftData[fftbincount];   
        // }
        
        //this.drawSpectrum(fftData_plot, freq_stop, "rgba(255 50 50 / 0.5)");
    }

    /**
     * Es wird ein HanningWindow auf den AudioStream angewandt
     * @param {Float32Array} samples AudioSamples  
     */
    #applyHanningWindow(samples) {
        const N = samples.length;
        for (let i = 0; i < N; i++) {
            // Hanning-Formel: 0.5 * (1 - cos(2*pi*i / N))
            const hanningMultiplier = 0.5 * (1 - Math.cos(2 * Math.PI * i / N));
            samples[i] *= hanningMultiplier;
        }
    }

    /**
     * Liefert die normalisierte Amplitude an der eingegeben Frequnz
     * Die Funktion nutzt die komplexe Endformel, um Zero-Padding zu simulieren,
     * ohne die Nullen durchlaufen zu müssen.
     * * @param {Float32Array} samples AudioSamples  
     * @param {Number} sampleRate  
     * @param {Number} targetFrequency
     * @param {Number} paddedLength (Muss GOERTZEL_PADDED_LENGTH sein)
     * @returns 
     */
    #goertzel_padded(samples, sampleRate, targetFrequency, paddedLength) {
        const N_real = samples.length; 
        const N_padded = paddedLength; 

        // 1. Bin k und Koeffizienten basierend auf der PADDED Länge berechnen
        const k_padded = Math.round((targetFrequency * N_padded) / sampleRate);
        
        const omega = (2.0 * Math.PI * k_padded) / N_padded;
        const cos_w = 2.0 * Math.cos(omega); // 2 * cos(w) für die Rekursion

        // Die Einzelwerte cos(w) und sin(w) werden für die Endberechnung benötigt
        const cos_single = Math.cos(omega);
        const sin_single = Math.sin(omega); 

        let s0 = 0, s1 = 0, s2 = 0;

        // 2. Goertzel-Iterationen NUR über die ECHTEN Samples durchführen (N_real)
        for (let i = 0; i < N_real; i++) {
            s0 = samples[i] + (cos_w * s1) - s2;
            s2 = s1;
            s1 = s0;
        }
        
        // 3. 💥 Direkte Berechnung der komplexen Magnitude (Zero-Padding Shortcut)
        // Die Formel für die Power (|X[k]|^2) ist: 
        // Power = (s1 - s2*cos(w))^2 + (s2*sin(w))^2

        // Realteil der DFT-Komponente X[k]
        const realPart = s1 - (s2 * cos_single);
        // Imaginärteil der DFT-Komponente X[k]
        const imagPart = s2 * sin_single; 

        // 4. Leistung berechnen (Real^2 + Imag^2)
        const power = (realPart * realPart) + (imagPart * imagPart);

        // 5. Normierung (Wir normieren auf N_real, da dies die tatsächlich gesammelten Daten sind)
        const normalizedAmplitude = Math.sqrt(power) / N_real; 

        return normalizedAmplitude;
    }

    /**
     * Liefert die normalisierte Amplitude an der eingegeben Frequnz
     * @param @param {Float32Array} samples AudioSamples  
     * @param {Number} sampleRate  
     * @param {Number} targetFrequency
     * @param {Number} [paddedLength=samples.lenght] 
     * @returns 
     */
    #goertzel_padded_(samples, sampleRate, targetFrequency, paddedLength=samples.length) {
        const N_real = samples.length; // Die tatsächliche Anzahl der Samples (z.B. 2048)
        const N_padded = paddedLength; // Die theoretische FFT-Größe (z.B. 32768)

        // 1. Bin k und Koeffizienten basierend auf der PADDED Länge berechnen
        // Dies erzeugt die gewünschte feinere Frequenzauflösung
        const k_padded = Math.round((targetFrequency * N_padded) / sampleRate);
        
        // Die Kreisfrequenz w und der Koeffizient cos_w basieren auf N_padded
        const w = (2.0 * Math.PI * k_padded) / N_padded;
        const cos_w = 2.0 * Math.cos(w);

        let s0 = 0, s1 = 0, s2 = 0;

        // 2. Goertzel-Iterationen NUR über die ECHTEN Samples durchführen (Zero-Padding ignoriert)
        // Nur der Vorkommensbereich der echten Daten im ge-padded-Array wird iteriert.
        for (let i = 0; i < N_real; i++) {
            s0 = samples[i] + (cos_w * s1) - s2;
            s2 = s1;
            s1 = s0;
        }
        
        // Der Algorithmus muss die restlichen (Zero-Padded) Iterationen ausführen,
        // da die Koeffizienten auf N_padded basieren. Da die Samples 0 sind, können 
        // wir die Schleife abbrechen und nur die Rekursion der s1 und s2 beibehalten:

        // Wenn N_padded > N_real, muss die s1/s2 Rekursion für die Nullen fortgesetzt werden.
        // Dies ist der entscheidende Schritt für das Zero-Padding mit Goertzel.
        for (let i = N_real; i < N_padded; i++) {
            // Hier ist samples[i] = 0 (die Nullen des Paddings)
            s0 = (cos_w * s1) - s2; 
            s2 = s1;
            s1 = s0;
        }


        // 3. Power berechnen
        const power = (s1 * s1) + (s2 * s2) - (s1 * s2 * cos_w);

        // 4. Normierung
        // Die Normierung erfolgt basierend auf der ECHTEN Anzahl der Samples (N_real), 
        // um die Amplitude unabhängig von der Padded Length zu machen.
        const normalizedAmplitude = Math.sqrt(power) / N_real; 

        return normalizedAmplitude;
    }

    /**
     * Es wird für jede Frequnz eine Box gemahlt
     * @param {Number} freq 
     * @param {Number} freqVariance 
     * @param {String} freqAreaColor 
     */
    #drawFrequencyBox(freq, freqVariance, freqAreaColor){
        const amout = this.options.draw.stopFrequency - this.options.draw.startFrequency;
        const barWidth = (this.canvas.width / amout);

        this.canvasCtx.fillStyle = freqAreaColor;
        this.canvasCtx.fillRect(
            barWidth*freq - barWidth*freqVariance,
            0,
            barWidth*freqVariance*2+1,
            this.canvas.height
        );
    }
    
    /**
     * Es wird ein Graph gemahlt der für alle Amplituden die Frequnzen zeigt..  
     * @param {Number[]} bins 
     * @param {String} color 
     */
    #drawSpectrum(bins, color){
        const amout = this.options.draw.stopFrequency - this.options.draw.startFrequency;
        const barWidth = (this.canvas.width / amout);
        
        
        // --
        // 1. Den Füllfarb-Kontext nur einmal setzen
        this.canvasCtx.fillStyle = color;
        
        // 2. Den Pfad immer neu starten, um alte Pfad-Daten zu löschen
        this.canvasCtx.beginPath(); 
        
        // Startposition auf der Basislinie (unten links)
        this.canvasCtx.moveTo(0, this.canvas.height); 

        let posX = 0;
        for (let i = 0; i < amout; i++) {
            const db = bins[i];
            
            // WICHTIG: Prüfen Sie Ihre Skalierung! (max(db, -100) + 100)*10 
            // sollte auf this.canvas.height normiert werden, wenn *10 zu groß ist.
            // Ich übernehme hier Ihre Skalierung:
            const barHeight = (Math.max(db, -100) + 100) * 10; 
            
            // A. Erster Punkt des Balkens (links oben): 
            // Der Pfad wird vom Ende des vorherigen Balkens zu diesem Punkt gezogen.
            // Dies erzeugt eine implizite vertikale Linie (wenn die Höhe anders ist).
            this.canvasCtx.lineTo(posX, this.canvas.height - barHeight);
            
            // B. Zweiter Punkt des Balkens (oben rechts): 
            // Erzeugt die horizontale Linie des Balkens.
            this.canvasCtx.lineTo(posX + barWidth, this.canvas.height - barHeight);
            
            posX += barWidth;
        }

        // 3. Ende des Pfades: Gerade Linie zurück zur Basislinie (unten rechts)
        this.canvasCtx.lineTo(this.canvas.width, this.canvas.height);
        
        // 4. Schließt den Pfad zur Startposition (0, this.canvas.height) und füllt ihn
        this.canvasCtx.closePath(); 
        this.canvasCtx.fill();
        // --

        
        // this.canvasCtx.fillStyle = color;
        // let posX = 0;
        // for (let i = 0; i < amout; i++) {
        //     const db = bins[i];
        //     const barHeight = (Math.max(db, -100) + 100)*10;
        //     this.canvasCtx.fillRect(
        //         posX,
        //         this.canvas.height - barHeight,
        //         barWidth,
        //         barHeight
        //     );

        //     posX += barWidth;
        // }
    }
}