import { MusicSheet } from "./music_sheet.js";
import { MicAnalyser } from "./music_mic_analyser.js";
import { MusicDB } from "./music_db.js";
import { showBanner } from "/wuefl-libs/banner/banner.js";
import { userDialog } from "/wuefl-libs/userDialog/userDialog.js";
import { SelectPicker } from "/wuefl-libs/selectpicker/selectpicker.min.js"
import { midiInstumentTable } from "./music_metadata_extender.js";
import Soundfont from "./libs/soundfont-player.min.js"
import {MusicDiagrams} from "./music_digramms.js";
import * as Types from "./types.js";
// import { AudioContext } from 'https://jspm.dev/standardized-audio-context';
// import { Soundfont } from 'https://cdn.jsdelivr.net/npm/smplr@0.16.3/+esm'




export class MusicEngine{
    /**
     * @type {{sound:Boolean, analyse:Boolean, state:"idle"|"running"|"paused", playIndex:number, edit:boolean, load:boolean, listinigQualityMs:number, centOptions:{analyseRadius:number,yellowRadius:number, greenRadius:number}}}
     */
    options = {sound:false, analyse:true, state:"idle", playIndex:0, edit:false, load:true, loadingScreen:[], centOptions:{analyseRadius:75, yellowRadius:25, greenRadius:10}, listinigQualityMs:25}
    /**
     * @type {{
     *  htmlElm: {sheetNotes:HTMLElement, sheetScore:HTMLElement, sheetTitle:HTMLElement, sheetComposer:HTMLElement, sheetBPM:HTMLInputElement, sheetSettings:HTMLInputElement, micGraphElm:HTMLCanvasElement, sheetEdit:HTMLElement, noteDiagrams:HTMLElement, legend:HTMLElement}, 
     *  style: {noAnalyseCSS:HTMLElement, notesValidationCss: HTMLElement},
     *  score:{value:number, scoresSum:number, scoresAmount:number}, 
     *  finished:boolean, 
     *  sheetId:number,
     *  options:{mode:"normal"|"learn", bpm:number, defaultBPM:number, firstOpen:boolean, skipRest:"auto"|"ask"|"never", noteAnalyse:"holding"|"declining", showNoteNames:number[], drawNoteDiagrams:boolean},
     *  instruments: Types.Instrument[],
     *  staffInstrumentMap: {<number>:Types.Instrument, internal:{<number>:number}},
     *  noteAnnotations:{id:string, text:string}[],
     *  pageLoaded:boolean,
     *  intervallAnalyse: string|null,
     *  skipOptions:{{skipStart:skipEnd}},
     * }}
     */
    sheetData = {
        htmlElm:{
            sheetScore:document.querySelector(".sheet_score"),
            sheetTitle:document.querySelector(".sheet_title"),
            sheetComposer:document.querySelector(".sheet_composer"),
            // sheetVisibleInstuments:document.querySelector("#visible_instuments"),
            // sheetAnalyseInstuments:document.querySelector("#analyse_instuments"),
            // sheetMode:document.querySelector("#sheet_mode"),
            sheetBPM:document.querySelector("#sheet_bpm"),
            sheetSettings:document.querySelector("#sheet_settings"),
            sheetEdit:document.querySelector("#sheet_edit"),
            micGraphElm:null,
            noteDiagrams:document.querySelector("#noteDiagrams"),
            legend:document.querySelector("#legend"),
        },
        style:{
            noAnalyseCSS:document.querySelector(".no_analyse_css"),
            notesValidationCss:document.querySelector(".notes_validation_css"),
        }, 
        score:{scoresSum:0, scoresAmount:0, value:0},
        finished:false, 
        sheetId:null,
        options:{mode:"normal", bpm:120, defaultBPM:120, firstOpen:true, skipRest:"auto", noteAnalyse:"declining", showNoteNames:[], drawNoteDiagrams:true},
        instruments: [],
        noteAnnotations:[],
        staffInstrumentMap : {},
        pageLoaded: false,
        skipOptions: [],
        intervallAnalyse:null
    };

    /**
     * @type {{
     *  activeNotes: Types.Note[],
     *  activeNotesMap:Object<number,Types.Note>,
     *  timestamps: {on:string[]|null, off:string[]|null, tstamp:number}[],
     *  activeRests:string[],
     *  skipRests:Object<number, number>,
     *  instrumentFontByStaff: Object<string, Soundfont>,
     *  noteDiagramMap: Object<string, SVGElement>
     * }}
     */
    musicData = {activeNotes:[], activeNotesMap:{}, timestamps:[], activeRests:[], skipRests:[], instrumentFontByStaff:{}, noteDiagramMap:{}};

    /**
     * Eine MusicEngine wird erstellt.
     * @param {String|HTMLElement} sheetElm 
     * @param {String} micGraphElm
     * @param {*} options
     */
    constructor(sheetElm, micGraphElm, options){

        /**
         * @type {MusicSheet}
         */
        this.musicSheet = new MusicSheet(sheetElm);
        this.sheetData.htmlElm.sheetNotes = sheetElm;
        this.sheetData.htmlElm.micGraphElm= micGraphElm;
        
        this.db_helper = new MusicDB();
	}

	async init(){
        this.#showLoadingAnimation(true);
        this.audioCTX = new AudioContext();

        this.micAnalyser = new MicAnalyser(this.audioCTX, this.sheetData.htmlElm.micGraphElm, {listinigQualityMs:this.options.listinigQualityMs, centVarianceAnalyse:this.options.centOptions.analyseRadius});
        this.diagramHelper = new MusicDiagrams();

        this.sheetData.pageLoaded = true;
        await this.db_helper.updateLastUsed()

		const rawSheetMataData = await this.db_helper.getActiveSheetMetaData();
		const rawSheetString = await this.db_helper.getActiveSheetBuffer();
        let  sheet = rawSheetString.sheetBuffer;

		this.sheetData.sheetId = rawSheetMataData.id;
		this.sheetData.score.value = rawSheetMataData.score;
		this.sheetData.options = {...this.sheetData.options, ...rawSheetMataData.options}

		this.sheetData.noteAnnotations = rawSheetMataData.noteAnnotations;
        this.sheetData.instruments = rawSheetMataData.instruments;
        this.sheetData.staffInstrumentMap = rawSheetMataData.staffInstrumentMap;
		this.sheetData.htmlElm.sheetScore.innerHTML = `<progress max="1" value="${this.sheetData.score.value}"></progress><span>${(this.sheetData.score.value*100).toFixed(0)}/100</span>`;
        for (const staffId of Object.keys(this.sheetData.staffInstrumentMap)){
            if(staffId == "internal") continue;
            // this.musicData.instrumentFontByStaff[staffId] = await new Soundfont(this.audioCTX, {instrument: midiInstumentTable[this.sheetData.staffInstrumentMap[staffId].midiNumber], kit: "FluidR3_GM"}).load;
            this.musicData.instrumentFontByStaff[staffId] = await new Soundfont.instrument(this.audioCTX, midiInstumentTable[this.sheetData.staffInstrumentMap[staffId].midiNumber], { 
                format: 'mp3',
                soundfont: 'MusyngKite' // Oder 'FluidR3_GM'
            })
        }
        console.log(navigator.userAgent)
        if (/iPad|iPhone|iPod|AppleWebKit/.test(navigator.userAgent)) {
            showBanner("Na Apple Nutzer :/<br> Kein Ton? Die die rote Glocke im Kontrollzentrum deaktiviert?", "warning", 5000);
        }

        this.sheetData.htmlElm.legend.innerHTML = `
            Farblegende (100 cent ist der Abstand zwischen Halbtönen)
            <li><span data-color="green"></span><span>bis ${this.options.centOptions.greenRadius} cent Abweichung</span></li>
            <li><span data-color="yellow"></span><span>bis ${this.options.centOptions.yellowRadius} cent Abweichung</span></li>
            <li><span data-color="red"></span><span>bis ${this.options.centOptions.analyseRadius} cent Abweichung</span></li>
        `

        if(sheet == null){
            userDialog({
                type:"error",
                title:"Fehler",
                content:`Keine Daten zum Anzeigen in der Datei gefunden :/. <br> Datei bitte überprüfen.`,
                confirmText:"Ok",
                onlyConfirm:true
            });
            return;
        }

        //Initial Zustand für Visible/Analyse Select wird gesetzt
        await this.setInstrumentVisibility(this.sheetData.instruments);

        this.sheetData.htmlElm.sheetTitle.innerHTML = rawSheetMataData.title;
		this.sheetData.htmlElm.sheetComposer.innerHTML = rawSheetMataData.composer;

        this.sheetData.htmlElm.sheetBPM.value = this.sheetData.options.bpm;
		this.sheetData.htmlElm.sheetBPM.max = this.sheetData.options.defaultBPM*4;
		this.sheetData.htmlElm.sheetBPM.min = this.sheetData.options.defaultBPM*0.2;
		this.sheetData.htmlElm.sheetBPM.addEventListener("change", async(e)=>{
            let value = parseInt(this.sheetData.htmlElm.sheetBPM.value);
            const min = parseInt(this.sheetData.htmlElm.sheetBPM.min);
            const max = parseInt(this.sheetData.htmlElm.sheetBPM.max);

            if (value < min) value = min;
            if (value > max) value = max;
     
            this.sheetData.options.bpm = value;
            this.sheetData.htmlElm.sheetBPM.value = value;
            this.musicSheet.setBPMFactor(this.sheetData.options.bpm/this.sheetData.options.defaultBPM);
            await this.stop();
            this.#loadPayerData();

            await this.db_helper.setSheetOptions(this.sheetData.sheetId, this.sheetData.options);
        });
        this.sheetData.htmlElm.sheetSettings.addEventListener("click", ()=>{this.settings()});

		this.sheetData.htmlElm.sheetNotes.addEventListener("click", this.#noteTab.bind(this));
		this.sheetData.htmlElm.sheetEdit.addEventListener("click", () => {
            this.options.edit = !this.options.edit;

            showBanner(this.options.edit?"Modus: Bearbeiten":"Modus: normal", "info", 3000);
            this.sheetData.htmlElm.sheetEdit.dataset.edit=this.options.edit;
        });
        this.#showLoadingAnimation(false);
    }

    /**
     * 
     * @param {[]} array 
     */
    async #changeVisibleInstruments(array){
        for (const instrument of this.sheetData.instruments){
            if(array.includes(instrument.id)){
                instrument.analyse = instrument.analyse || instrument.visible == false;
                instrument.visible = true;
            }else{
                instrument.visible = false;
            }
        }
        await this.setInstrumentVisibility(this.sheetData.instruments);
        this.db_helper.updateSheetInstruments(this.sheetData.sheetId, this.sheetData);
    }

    #changeVisibleAnalyse(array){
        for (const instrument of this.sheetData.instruments){
            instrument.analyse = array.includes(instrument.id);                
        }
        this.setInstrumentVisibility(this.sheetData.instruments);
        this.db_helper.updateSheetInstruments(this.sheetData.sheetId, this.sheetData)
    }

    /**
     * Musik Stück wird gestartet
     */
    async start(){
        this.#showLoadingAnimation(true);
        console.log("start");
        this.musicData.activeNotes = [];
        this.musicData.activeNotesMap = {};
        this.musicData.activeRests = [];

        this.sheetData.htmlElm.sheetNotes.dataset.playing = true;
        if(this.options.state == "idle"){
            this.musicData.timestamps = this.musicSheet.renderPlay();
            [...this.sheetData.htmlElm.sheetNotes.querySelectorAll(`.note`)].map(noteElm => noteElm?.style.removeProperty('--note-color'));
            this.sheetData.style.notesValidationCss.textContent = "";
            this.sheetData.htmlElm.noteDiagrams.innerHTML = "";
        }
        let lastTime = Date.now()
        if(this.options.analyse) {
            await this.micAnalyser.startListinig();
            this.sheetData.intervallAnalyse = setInterval(
                () => {
                    this.micAnalyser.analyseMic(this.musicData.activeNotes);
                    lastTime = Date.now();
                    for (const noteObj of this.musicData.activeNotes){
                        this.#validateNote(noteObj.id);
                        this.diagramHelper.updateNoteDiagramm(noteObj.centDeviations, noteObj.maxCountDeviations, this.musicData.noteDiagramMap[noteObj.id])
                    }
                },  
                this.options.listinigQualityMs
            ); 
        }
        const notesAtTime = this.musicData.timestamps[this.options.playIndex];

        if(notesAtTime.on) this.#scrollToNote(notesAtTime.on[0].id);
        if(notesAtTime.restsOn) this.#scrollToNote(notesAtTime.restsOn[0].id);

        this.#showLoadingAnimation(false);
        this.options.state = "running";
        let localBPM = 0;
        for (const instrument of this.sheetData.instruments){
            if(instrument.analyse){
                localBPM = this.sheetData.options.bpm * (instrument.rhythm[1]/4) 
            }

        }
        const countdown = (number, midi, duration, staffNumber) =>{
            if(this.options.state != "running") return;
            if(number < 1) {
                this.step();
                return;
            };
            this.playSound(staffNumber, midi, duration);
            setTimeout(()=>countdown(number-1, midi, duration, staffNumber), duration);
        }
        
        for(let localIndex = this.options.playIndex; localIndex<this.musicData.timestamps.length; localIndex++){
            const currentTimeStamp = this.musicData.timestamps[localIndex]; 
            if(currentTimeStamp.on && currentTimeStamp.on.length != 0){
                const id = currentTimeStamp.on[0]
                const midi = this.musicSheet.getMIDIValuesForElementId(id);
                const realStaff = this.sheetData.staffInstrumentMap.internal[midi.staff];
                midi.pitch += this.sheetData.staffInstrumentMap[realStaff].transSemi;
                
                if(this.sheetData.staffInstrumentMap[realStaff].analyse){
                    countdown(3, midi.pitch, 60000/localBPM, realStaff);
                    break;
                }
                
            }
        }
    }

    /**
     * Musicstück wird pausiert
     */
    async pause(){
        if(this.options.state == "running"){
            this.options.state = "paused";
            await this.micAnalyser.stopListinig();
            clearInterval(this.sheetData.intervallAnalyse);
            console.log("Wiedergabe pausiert");
        }
    }

    async stop(){
        this.options.playIndex=0;
        this.options.state = "idle"
        if(this.options.analyse) await this.micAnalyser.stopListinig();
        clearInterval(this.sheetData.intervallAnalyse);
        this.musicData.timestamps = this.musicSheet.renderOverview();
        this.sheetData.htmlElm.sheetNotes.dataset.playing = false
    }

    async step(){
        if(this.options.state != "running") return;
        
        const skipToTime = this.musicData.skipRests[this.musicData.timestamps[this.options.playIndex].tstamp] 
        if(skipToTime){
            let i = this.options.playIndex+1; 
            for(i; i<this.musicData.timestamps.length; i++){
                if(this.musicData.timestamps[i].tstamp > skipToTime) break;
            }
            if(this.sheetData.options.skipRest == "auto"){
                this.options.playIndex = i;
            }else if(this.sheetData.options.skipRest == "ask"){
                window.applySkip = () => {
                    this.options.playIndex = i;
                };
                showBanner(`Pause überspringen?<button class="button" onclick="applySkip()">Ja</button>`, "info", 2000);
            }
        }

        const currentTimeStamp = this.musicData.timestamps[this.options.playIndex]; 

        const onEvents = currentTimeStamp.on;
        const onRestEvents = currentTimeStamp.restsOn;
        const offEvents = currentTimeStamp.off;
        const offRestEvents = currentTimeStamp.restsOff;
        
        if(offRestEvents){
            this.musicData.activeRests = this.musicData.activeRests.filter(itemA => !offRestEvents.some(itemB => itemB === itemA));
        }

        if(offEvents){
            for(const id of offEvents){
                const midi = this.musicSheet.getMIDIValuesForElementId(id);
                if(this.musicData.activeNotesMap[midi.id]){
                    await this.#validateNote(midi.id);
                    for(let i=0; i< this.musicData.activeNotes.length; i++){
                        if(this.musicData.activeNotes[i].id == midi.id){
                            this.musicData.activeNotes.splice(i, 1);
                            break;
                        }
                    }
                    this.musicData.noteDiagramMap[midi.id].remove();
                }
                delete this.musicData.activeNotesMap[midi.id];
            }
        }

        if(onEvents){
            for(const id of onEvents){
                const midi = this.musicSheet.getMIDIValuesForElementId(id);
                const realStaff = this.sheetData.staffInstrumentMap.internal[midi.staff];
                midi.pitch += this.sheetData.staffInstrumentMap[realStaff].transSemi;
                
                if(this.sheetData.staffInstrumentMap[realStaff].analyse){
                    /** 
                     * @type {Types.Note}
                     */
                    const note = {id:midi.id, midi:midi.pitch, frequency:this.#midiToFrequency(midi.pitch), duration:midi.duration, score:[], centDeviations:[], maxCountDeviations:Math.floor(midi.duration/this.options.listinigQualityMs)}
                    this.musicData.activeNotes.push(note);
                    this.musicData.activeNotesMap[note.id] = note;
                    this.musicData.noteDiagramMap[note.id] = this.diagramHelper.createNoteDiagramm({id:note.id, centVarianceAnalyse:this.options.centOptions.analyseRadius, centVarianceOk:this.options.centOptions.yellowRadius, centVarianceTop:this.options.centOptions.greenRadius})
                    if(this.sheetData.options.drawNoteDiagrams) this.sheetData.htmlElm.noteDiagrams.insertAdjacentElement("beforeend", this.musicData.noteDiagramMap[note.id]);
                }

                if(this.options.sound){
                    this.playSound(realStaff, midi.pitch, midi.duration)
                }
            }
        }
        if(onRestEvents){
            this.musicData.activeRests = this.musicData.activeRests.concat(onRestEvents);
        }
        

        const allActiveCompontents = this.musicData.activeRests.concat(Object.keys(this.musicData.activeNotesMap));
        this.#scrollToNote(allActiveCompontents[allActiveCompontents.length-1]);
        this.musicSheet.highlightNotes(allActiveCompontents);
        
        this.options.playIndex ++;
        if(this.options.playIndex < this.musicData.timestamps.length){
            setTimeout(()=>this.step(), this.musicData.timestamps[this.options.playIndex].tstamp - currentTimeStamp.tstamp);
        }else{
            this.sheetData.score.value = this.sheetData.score.scoresSum / this.sheetData.score.scoresAmount;
            this.sheetData.htmlElm.sheetScore.innerHTML = `<progress max="1" value="${this.sheetData.score.value}"></progress><span>${(this.sheetData.score.value*100).toFixed(0)}/100</span>`;
            this.db_helper.setSheetScore(this.sheetData.sheetId, this.sheetData.score.value);
            this.stop();
        } 
    }

    async #loadPayerData(){
        this.musicData.skipRests = {};
        let lastTime = 0;
        for(const elm of this.musicData.timestamps){

            if(elm.off){
                lastTime = elm.tstamp;
            }

            if(elm.on){
                for( const noteId of elm.on){
                    const staff = this.musicSheet.getStaff(noteId);
                    if(this.sheetData.staffInstrumentMap[this.sheetData.staffInstrumentMap.internal[staff]].visible){
                        if(elm.tstamp - lastTime > 60000/this.sheetData.options.bpm*6){
                            this.musicData.skipRests[lastTime] = elm.tstamp - 60000/this.sheetData.options.bpm*6;
                        }
                    }

                }
            }
        }
    }

    async #noteTab(e){
        if(e.target.closest(".note") && this.options.state != "running"){
            /**@type {HTMLElement} */
            const note = e.target.closest(".note")

            if(!this.options.edit){
                const midiValue = this.musicSheet.highlightNotes([note.getAttribute("id")]).list[0];
                const realStaff = this.sheetData.staffInstrumentMap.internal[midiValue.staff];
                midiValue.pitch += this.sheetData.staffInstrumentMap[realStaff].transSemi
                this.options.playIndex = this.musicData.timestamps.findIndex( timestamp => timestamp.tstamp >= midiValue.time);
                this.playSound(realStaff, midiValue.pitch, midiValue.duration);
            }else{
                const item = this.sheetData.noteAnnotations.find(e => e.id === note.id);
                const html = `<input type="text" value="${item?item.text:""}" name="text">`;
                const dialogContent = await userDialog({
                    title:"Notenanmerkung",
                    content: html,
                    type:"normal",
                    confirmText:"Speichern",
                });

                if(dialogContent.submit){
                    const data = dialogContent.data;
                    if(item){
                        item.text = data.text;
                    }else{
                        this.sheetData.noteAnnotations.push({id:note.id, text:data.text});
                    }
                    await this.db_helper.setSheetNoteAnnotations(this.sheetData.sheetId, this.sheetData.noteAnnotations);
                    this.setInstrumentVisibility();
                }
            }
        }
    }

    /**
     * Spielt ein Ton für den jeweiligen Staff ab 
     * @param {string} staff 
     * @param {number} pitch 
     * @param {number} pitchDuration - ms
     */
    async playSound(staff, pitch, pitchDuration) {
        if (this.audioCTX.state === 'suspended' || this.audioCTX.state === 'interrupted') {
            await this.audioCTX.resume();
        }
        this.musicData.instrumentFontByStaff[staff].play(pitch, this.audioCTX.currentTime, {
            gain: 100 / 127,      // Velocity umrechnen (0 bis 1)
            duration: pitchDuration / 1000
        });
    }
    // playSound(staff, pitch, pitchDuration){
    //     this.musicData.instrumentFontByStaff[staff].start({
    //         note: pitch, // Die MIDI Note Number
    //         velocity: 100, // Die Anschlagstärke (0-127)
    //         duration: pitchDuration/1000
    //     });
    // }

    
    #scrollToNote(noteId) {
        const noteElement = this.sheetData.htmlElm.sheetNotes.querySelector(`[id="${noteId}"]`);
        
        if (noteElement) {
            noteElement.scrollIntoView({
                behavior: 'smooth',   // Animiertes Scrollen
                block: 'nearest',      // Die Note wird vertikal in die Mitte des Containers geschoben
                inline: 'center'      // Die Note wird horizontal in die Mitte geschoben
            });
        }
    }
    
    /**
     * Rechnet eine midinumer zu einer frequnz um.
     * @param {number} midiNoteNumber 
     * @returns {number}
     */
    #midiToFrequency(midiNoteNumber) {
        const A4_FREQ = 440.0;
        const A4_MIDI = 69;
        return A4_FREQ * Math.pow(2, (midiNoteNumber - A4_MIDI) / 12);
    }

    /**
     * Überprüft gespielte Note
     * @param {string} id
     * @param {boolean} [first] 
     * @returns {Promise<void>} Eine Promise, die aufgelöst wird, wenn der nächste Schritt möglich ist.
     */
    async #validateNote(id, first = true) {
        // Die Funktion gibt sofort eine Promise zurück
        return new Promise((resolve) => {
            if (this.options.state !== "running") {
                // Bei nicht laufendem Zustand sofort auflösen/abbrechen
                console.warn("Not running")
                return resolve();
            }

            const note = this.musicData.activeNotesMap[id];

            if (!note) {
                // Note nicht gefunden, sofort auflösen
                console.warn("Note nicht gefunden")
                return resolve();
            }

            // Deklaration außerhalb der Schleife, damit sie im Intervall zugänglich ist
            let intervalId = null;
            let flagAllpassed = true; // Setze initial auf true

            const checkAndResolve = (isInitialCheck) => {
                // Logik zur Score-Berechnung (unverändert)
                let score;
                if(this.sheetData.options.noteAnalyse == "declining"){
                    score = note.score.length === 0 
                    ? 0 
                    : note.score.reduce((res, curr, i) => res + (curr * (note.score.length - i)), 0) / ((note.score.length * (note.score.length + 1)) / 2);
                }else{
                    score = note.score.length === 0 ? 0:note.score.reduce((res, curr) => res + curr)/note.score.length;
                }

                if (isInitialCheck) {
                    this.sheetData.score.scoresSum += score;
                    this.sheetData.score.scoresAmount += 1;
                }

                // Logik zum Färben und Prüfen (unverändert, außer Intervall-Logik)
                flagAllpassed = true;
                const noteElm = document.querySelector(`[id="${note.id}"]`);
                if (score > 1-(this.options.centOptions.greenRadius/this.options.centOptions.analyseRadius)) {
                    noteElm?.style.setProperty('--note-color', 'green');
                } else if (score > 1-(this.options.centOptions.yellowRadius/this.options.centOptions.analyseRadius)) {
                    noteElm?.style.setProperty('--note-color', 'yellow');
                } else {
                    flagAllpassed = false;
                    if (this.sheetData.options.mode !== "learn") {
                        noteElm?.style.setProperty('--note-color', 'red');
                    }
                }

                // --- Kern der Promise-Logik ---

                if (this.sheetData.options.mode === "learn" && !flagAllpassed) {
                    // Im Lernmodus und nicht bestanden:
                    // 1. MIDI pausieren (nur beim ersten Aufruf)
                    
                    // 2. Intervall starten (oder weiterlaufen lassen)
                    if (intervalId === null) {
                        intervalId = setInterval(() => {
                            // Wiederhole die Prüfung im Intervall, bis resolved
                            checkAndResolve(false);
                        }, 50);
                    }
                    
                    // Promise bleibt offen (kein resolve)
                } else {
                    // Lernmodus ODER Bestanden (flagAllpassed ist true)
                    
                    // 1. Intervall stoppen, falls aktiv
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }

                    // 3. Promise auflösen, damit der nächste await-Schritt fortfahren kann
                    resolve();
                }
            };

            // Start der Prüfung
            checkAndResolve(first);
        });
    }

    toogleVolume(){
        this.options.sound = !this.options.sound;
    }

    /**
     * Setzt Musik Sichbarkeit 
     */
    async setInstrumentVisibility(){
        this.#showLoadingAnimation(true);
        let hiddenInstruments = [];
        let cssSelectors = [];
        this.sheetData.staffInstrumentMap.internal = {};
        for (let i = 0; i < this.sheetData.instruments.length; i++) {
            const instrument = this.sheetData.instruments[i];
            if(!instrument.visible){hiddenInstruments.push(instrument.staffNumbers)}

            if(!instrument.analyse){
                cssSelectors.push(instrument.staffNumbers)
            }
        }

        
        
        const rawSheetString = await this.db_helper.getActiveSheetBuffer();
        const parser = new DOMParser();
        const xml = parser.parseFromString(rawSheetString.sheetBuffer, "text/xml");
        
        // Plaziere ggf. Notennamen
        const instrumentsWithNoteNames = this.sheetData.instruments.filter((e)=> this.sheetData.options.showNoteNames.includes(e.id));
        for(const instrument of instrumentsWithNoteNames){
            for(const staffNumber of instrument.staffNumbers){
                for(const note of xml.querySelectorAll(`staff[n="${staffNumber}"] note`)){
                    const text = `<dir startid="#${note.getAttribute("xml:id")}" place="above">${note.getAttribute("pname")}</dir>`;
                    note.closest("measure").insertAdjacentHTML("beforeend",text);
                }
            }
        }

        // Lösche temporär alle Instrumnte die ausgeblendet werden aus mei-Datei
        hiddenInstruments = hiddenInstruments.flat();

        const reorderElemts = (elms, att) => {
            for(const elm of elms){
                const staffNumber = parseInt(elm.getAttribute(att));
                let newStaffNumber = staffNumber;
                if(hiddenInstruments.includes(staffNumber)){
                    elm.remove();
                } else{
                    hiddenInstruments.map(e => {if(staffNumber > e ) newStaffNumber--});
                    elm.setAttribute(att, newStaffNumber);

                    this.sheetData.staffInstrumentMap.internal[newStaffNumber] = staffNumber;
                }
            }
        }
        reorderElemts(xml.querySelectorAll(`staff, staffDef`), "n");
        reorderElemts(xml.querySelectorAll(`[staff]`), "staff");

        
        for(const elm of xml.querySelectorAll(`staffGrp:not(:has(staffDef))`)){
            elm.remove();
        }

        

        //Render ggf eigenen Text
        for(const obj of this.sheetData.noteAnnotations){
            const measureObj = xml.querySelector(`measure:has(note[*|id="${obj.id}"])`);
            const text = `<dir startid="#${obj.id}" place="above">${obj.text}</dir>`;
            measureObj.insertAdjacentHTML("beforeend", text);
        }
    
        const serializer = new XMLSerializer();

        // Färbe  Noten von nicht analysierten Instrumenten
        cssSelectors = cssSelectors.flat();
        const staffInstrumentMapRev = Object.entries(this.sheetData.staffInstrumentMap.internal).reduce((acc, [mapStaff, realStaff]) => {
            acc[realStaff] = mapStaff;
            return acc;
        }, {});

        cssSelectors = cssSelectors.map(e => `[data-n="${staffInstrumentMapRev[e]}"]`).join(", ")
        this.sheetData.style.noAnalyseCSS.textContent = cssSelectors!= ''?`${cssSelectors}{fill:rgb(120 120 120)}`:"";

        await this.musicSheet.loadMusic(serializer.serializeToString(xml), this.sheetData.options.bpm/this.sheetData.options.defaultBPM, false);
        await this.stop();
        this.#loadPayerData();
        this.#showLoadingAnimation(false);
    }

    async settings(){
        const instruments = this.sheetData.instruments; 
        const html = `
            <label for="visible_instuments">
                <h3 class="heading-3">Instrumente Sichtbarkeit</h3>
                <select id="visible_instuments" multiple name="visible_instuments" data-defaults='${JSON.stringify(instruments.map(instrument => instrument.id))}'>
                ${instruments.map(instrument => `
                    <option value="${instrument.id}" ${instrument.visible?"selected": ""}>
                        ${instrument.name}
                    </option>
                `).join(" ")}
                </select>
            </label>
            <label for="analyse_instuments">
                <h3 class="heading-3">Instrumente Analysieren</h3>
                <select id="analyse_instuments" multiple name="analyse_instuments">
                ${instruments.map(instrument => `
                    <option value="${instrument.id}" ${instrument.analyse?"selected": ""}>
                        ${instrument.name}
                </option>
                `).join(" ")}
                </select>
            </label>
            <lable>
                <h3>Noten Diagramme anzeigen</h3>
                <input type="checkbox" name="drawNoteDiagrams" data-shape="toggle" ${this.sheetData.options.drawNoteDiagrams?"checked":""}>
            </lable>
            <label for="sheet_mode">
                <h3 class="heading-3">Spielmodus</h3>
                <select id="sheet_mode" name="mode"><option value="normal">Normal</option><option value="learn">Lernen</option></select>
            </label>
            <label for="sheet_noteanalyse_method">
                <h3 class="heading-3">Tonerkennung</h3>
                <select id="sheet_noteanalyse_method" name="noteAnalyse"><option value="holding">Ton halten</option><option value="declining">Ton abfallend</option></select>
            </label>
            <label for="sheet_skipRest_method">
                <h3 class="heading-3">Pausen überspringen</h3>
                <select id="sheet_skipRest_method" name="skipRest"><option value="auto">automatisch</option><option value="ask">bestätigen</option><option value="never">nie</option></select>
            </label>
            <label for="sheet_showNoteNames_method">
                <h3 class="heading-3">Notennamen anzeigen nach Instrumment</h3>
                <select id="sheet_showNoteNames_method" name="showNoteNames" multiple>
                    ${instruments.map(instrument => `
                    <option value="${instrument.id}" ${this.sheetData.options.showNoteNames.includes(instrument.id)?"selected": ""}>
                        ${instrument.name}
                    </option>
                `).join(" ")}
                </select>
            </label>
            <details class="details">
                <summary>Instrumente Transponieren</summary>
                <div>
                    ${instruments.map(instrument => `
                        <label>
                            <h4 class="heading-4">${instrument.name}</h4>
                            <input type="number" name="transSemi[][transSemi]" value="${instrument.transSemi}">
                        </label>
                        <input type="hidden" name="transSemi[][id]" value="${instrument.id}">

                    `).join(" ")}
                </div>
            </details>
        `;
        const onInsertFunc = () =>{
            document.querySelector('#sheet_mode').value = this.sheetData.options.mode;
            document.querySelector('#sheet_noteanalyse_method').value = this.sheetData.options.noteAnalyse;
            document.querySelector('#sheet_skipRest_method').value = this.sheetData.options.skipRest;
    

            const selctpicker = new SelectPicker({options:{saveButton:true, search:false}});
            selctpicker.create(document.querySelector("#visible_instuments"), {
                title:"Instrumente anzeigen",
            });
            selctpicker.create(document.querySelector("#analyse_instuments"), {
                title:"Instrumente analysieren",
            });
            
            selctpicker.create(document.querySelector("#sheet_mode"), {
                title:"Abspiel Modus wählen ",
            });
            selctpicker.create(document.querySelector("#sheet_noteanalyse_method"), {
                title:"Tonanalyse",
            });
            selctpicker.create(document.querySelector("#sheet_skipRest_method"), {
                title:"Pausen überspringen",
            });

            selctpicker.create(document.querySelector("#sheet_showNoteNames_method"), {
                title:"Notennamen anzeigen",
            });

            
            document.querySelector("#visible_instuments").addEventListener("change", (e)=>{
                const source = e.currentTarget;
                const dest = document.querySelector("#analyse_instuments");
                Array.from(source.options).forEach(opt => {
                    const existing = Array.from(dest.options).find(d => d.value === opt.value);
                    if (opt.selected && !existing) {
                        const option = opt.cloneNode(true);
                        option.selected = true;
                        dest.appendChild(option);
                    }else if (opt.selected && existing) {
                        dest.appendChild(existing);
                    } else if (!opt.selected && existing) {
                        existing.remove();
                    }
                });
            });
        };

        const dialogContent = await userDialog({
            title:"Einstellungen",
            content: html,
            type:"normal",
            confirmText:"Speichern",
            onInsert: onInsertFunc.bind(this),
        });

        
        if(dialogContent.submit){
            const data = dialogContent.data;
            console.log(data);

            this.sheetData.options.mode = data.mode;
            this.sheetData.options.skipRest = data.skipRest;
            this.sheetData.options.noteAnalyse = data.noteAnalyse;
            this.sheetData.options.showNoteNames = data.showNoteNames? data.showNoteNames.map(Number):[];
            this.sheetData.options.drawNoteDiagrams = data.drawNoteDiagrams;
            await this.db_helper.setSheetOptions(this.sheetData.sheetId, this.sheetData.options);

            for(const transSemi of data.transSemi){
                this.sheetData.instruments[transSemi.id].transSemi = transSemi.transSemi; 
            }
            this.db_helper.updateSheetInstruments(this.sheetData.sheetId, this.sheetData);
            
            this.#changeVisibleInstruments(data.visible_instuments);
            this.#changeVisibleAnalyse(data.analyse_instuments);

        };
    }

    /**
     * Verwaltet den Ladebildschirm
     * @param {boolean} loading 
     */
    #showLoadingAnimation(loading){
        if(loading){
            this.options.loadingScreen.push(1);
            document.body.setAttribute("data-loading", "");
        }else{
            this.options.loadingScreen.pop();
            if(this.options.loadingScreen.length == 0){
                document.body.removeAttribute("data-loading");
            }
        }
        
    }
}