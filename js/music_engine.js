import { MusicSheet } from "./music_sheet.js";
import { MicAnalyser } from "./music_mic_analyser.js";
import { MusicDB } from "./music_db.js";
import { showBanner } from "/wuefl-libs/js/banner.js";
import { userDialog } from "/wuefl-libs/js/userDialog.js";
import { midiInstumentTable } from "./music_metadata_extender.js";
import { Soundfont } from 'https://cdn.jsdelivr.net/npm/smplr@0.16.3/+esm'


export class MusicEngine{
    /**
     * @type {{sound:Boolean, analyse:Boolean, state:"idle"|"running"|"paused", playIndex:number, edit:boolean}}
     */
    options = {sound:false, analyse:true, state:"idle", playIndex:0, edit:false}
    /**
     * @type {{
     *  htmlElm: {sheetNotes:HTMLElement, sheetScore:HTMLElement, sheetTitle:HTMLElement, sheetComposer:HTMLElement, sheetBPM:HTMLInputElement, sheetSettings:HTMLInputElement, micGraphElm:HTMLCanvasElement, sheetEdit:HTMLElement}, 
     *  style: {noAnalyseCSS:HTMLElement, notesValidationCss: HTMLElement},
     *  score:{value:number, scoresSum:number, scoresAmount:number}, 
     *  finished:boolean, 
     *  sheetId:number,
     *  sheetBpmDefault:number,
     *  sheetBpmFactor:number,
     *  validateNoteStepIntervall:number|null,
     *  startRhythm: {denominator:number, numerator:number},
     *  options:{mode:"normal"|"learn", bpm:number, defaultBPM:number, firstOpen:boolean, skipRest:"auto"|"ask"|"never", noteAnalyse:"holding"|"declining", showNoteNames:number[]},
     *  instruments: {id:number, name:string, transSemi:number, midiNumber:number, rhythm:[number, number] staffNumbers:number[], visible:boolean, analyse:boolean}[],
     *  staffInstrumentMap: {<number>:{id:number, name:string, transSemi:number, midiNumber:number, rhythm:[number, number], staffNumbers:number[], visible:boolean, analyse:boolean}, internal:{<number>:number}},
     *  noteAnnotations:{id:string, text:string}[],
     *  pageLoaded:boolean,
     *  skipOptions:{{skipStart:skipEnd}};
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
            micGraphElm:null
        },
        style:{
            noAnalyseCSS:document.querySelector(".no_analyse_css"),
            notesValidationCss:document.querySelector(".notes_validation_css"),
            
        }, 
        score:{scoresSum:0, scoresAmount:0, value:0},
        finished:false, 
        sheetId:null,
        sheetBpmDefault:null,
        sheetBpmFactor:null,
        validateNoteStepIntervall:null,
        startRhythm: {denominator:4, numerator:4},
        options:{},
        instruments: [],
        noteAnnotations:[],
        staffInstrumentMap : {},
        pageLoaded: false,
        skipOptions: [],
    };

    /**
     * @type {{
     *  activeNotes:{id:string, frequency:number, duration:number, score:Number[], midi:Number},
     *  activeNotesMap:Object<number,{id:string, frequency:number, duration:number, score:Number[], midi:Number}>,
     *  timestamps: {on:string[]|null, off:string[]|null, tstamp:number}[]
     *  activeElms:string[]
     * }}
     */
    musicData = {activeNotes:[], activeNotesMap:{}, timestamps:[], activeElms:[]};
    instrumentFontByStaff = {}

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
        this.sheetData.pageLoaded = true;
        this.audioCTX = new AudioContext();

        /**
         * @type {MicAnalyser}
         */
        this.micAnalyser = new MicAnalyser(this.audioCTX, this.sheetData.htmlElm.micGraphElm);

        await this.db_helper.updateLastUsed()

		const rawSheetMataData = await this.db_helper.getActiveSheetMetaData();
		const rawSheetString = await this.db_helper.getActiveSheetBuffer();
        let  sheet = rawSheetString.sheetBuffer;

		this.sheetData.sheetId = rawSheetMataData.id;
		this.sheetData.score.value = rawSheetMataData.score;
		this.sheetData.options = rawSheetMataData.options;
		this.sheetData.noteAnnotations = rawSheetMataData.noteAnnotations;
        this.sheetData.instruments = rawSheetMataData.instruments;
        this.sheetData.staffInstrumentMap = rawSheetMataData.staffInstrumentMap;
		this.sheetData.htmlElm.sheetScore.innerHTML = `<progress max="1" value="${this.sheetData.score.value}"></progress><span>${(this.sheetData.score.value*100).toFixed(0)}/100</span>`;
        
        
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

		// this.sheetData.htmlElm.sheetVisibleInstuments.textContent = "";
        // this.sheetData.htmlElm.sheetAnalyseInstuments.textContent = ""; 
        // for (const instrument of this.sheetData.instruments ){
		// 	const option = document.createElement('option');
		// 	option.value = instrument.staffNumbers.toString();
		// 	option.textContent = instrument.name;
		// 	option.selected = instrument.visible?"selected": ""; 
		// 	this.sheetData.htmlElm.sheetVisibleInstuments.appendChild(option);
        //     if(instrument.visible){
        //         const option2 = option.cloneNode(true);
        //         option2.selected = instrument.analyse?"selected": "";
        //         this.sheetData.htmlElm.sheetAnalyseInstuments.appendChild(option2);
        //     }
		// }

		// this.sheetData.htmlElm.sheetVisibleInstuments.addEventListener("change", this.#handleSelectVisible.bind(this));
		// this.sheetData.htmlElm.sheetAnalyseInstuments.addEventListener("change", this.#handleSelectAnalyse.bind(this));
		this.sheetData.htmlElm.sheetNotes.addEventListener("click", this.#noteTab.bind(this));
		this.sheetData.htmlElm.sheetEdit.addEventListener("click", ()=>{this.options.edit = !this.options.edit; this.sheetData.htmlElm.sheetEdit.dataset.edit=this.options.edit});
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
        if (this.audioCTX.state === 'suspended') {
            this.audioCTX.resume();
        }
        document.body.setAttribute("data-loading", "");
        console.log("start");
        this.musicData.activeNotes = [];
        this.sheetData.htmlElm.sheetNotes.dataset.playing = true;
        if(this.options.state == "idle"){
            this.musicData.timestamps = this.musicSheet.renderPlay();
            this.sheetData.style.notesValidationCss.textContent = "";
            for(const key of Object.keys(this.midiData.instruments)){
                this.instrumentFontByStaff[key] = await this.midiData.instruments[key];
            }

            this.sheetData.skipRests = this.midiData.skipRests;
        }

        if(this.options.analyse) await this.micAnalyser.startListinig();
        const notesAtTime = this.musicData.timestamps[this.options.playIndex];

        if(notesAtTime.on) this.#scrollToNote(notesAtTime.on[0].id);
        document.body.removeAttribute("data-loading")
        this.options.state = "running";
        let localBPM = 0;
        for (const instrument of this.sheetData.instruments){
            if(instrument.analyse){
                localBPM = this.sheetData.options.bpm * (instrument.rhythm[1]/4) 
            }

        }
        const countdown = (number, midi, duration) =>{
            if(this.options.state != "running") return;
            if(number < 1) {
                this.step();
                return;
            };
            this.playSound(1, midi, duration);
            setTimeout(()=>countdown(number-1, midi, duration), duration);
        }
        countdown(3, 70, 60000/localBPM);
        
    }

    /**
     * Musicstück wird pausiert
     */
    async pause(){
        if(this.options.state == "running"){
            this.options.state = "paused";
            await this.micAnalyser.stopListinig();
            console.log("Wiedergabe pausiert");
        }
    }

    async stop(){
        this.options.playIndex=0;
        this.options.state = "idle"
        if(this.options.analyse) await this.micAnalyser.stopListinig();
        this.musicData.timestamps = this.musicSheet.renderOverview();
        this.sheetData.htmlElm.sheetNotes.dataset.playing = false
    }

    async step(){
        if(this.options.state != "running") return;
        this.micAnalyser.setFrequencyData(this.options.analyse ? this.musicData.activeNotes : []);
        
        const skipToTime = this.sheetData.skipRests[this.musicData.timestamps[this.options.playIndex].tstamp] 
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
            this.musicData.activeElms = this.musicData.activeElms.filter(itemA => !offRestEvents.some(itemB => itemB === itemA));
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
                    const note = {id:midi.id, midi:midi.pitch, frequency:this.#midiToFrequency(midi.pitch), duration:midi.duration, score:[]}
                    this.musicData.activeNotes.push(note);
                    this.musicData.activeNotesMap[note.id] = note;
                }

                if(this.options.sound){
                    this.playSound(midi.staff, midi.pitch, midi.duration)
                }
            }
        }
        if(onRestEvents){
            this.musicData.activeElms = this.musicData.activeElms.concat(onRestEvents);
        }
        

        const allActiveCompontents = this.musicData.activeElms.concat(Object.keys(this.musicData.activeNotesMap));
        this.#scrollToNote(allActiveCompontents[allActiveCompontents.length-1]);
        this.musicSheet.highlightNotes(allActiveCompontents);
        
        this.options.playIndex ++;
        if(this.options.playIndex < this.musicData.timestamps.length){
            setTimeout(()=>this.step(), this.musicData.timestamps[this.options.playIndex].tstamp - currentTimeStamp.tstamp);
        }else{
            this.stop();
        } 
    }

    async #loadPayerData(){
        const skipTimes = {};
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
                            skipTimes[lastTime] = elm.tstamp - 60000/this.sheetData.options.bpm*6;
                        }
                    }

                }
            }
        }
        
        const instrumentsByStaff = {}
        for (const staffId of Object.keys(this.sheetData.staffInstrumentMap)){
            if(staffId == "internal") continue;
            instrumentsByStaff[staffId] = new Soundfont(this.audioCTX, {instrument: midiInstumentTable[this.sheetData.staffInstrumentMap[staffId].midiNumber]}).load;
        }
        /**@type {{instruments:{<string>:Promise<Soundfont>}, skipRests:Object<number, number>}} */
        this.midiData = {instruments: instrumentsByStaff, skipRests: skipTimes};
    }

    async #noteTab(e){
        if(e.target.closest(".note") && this.options.state != "running"){
            /**@type {HTMLElement} */
            const note = e.target.closest(".note")

            if(!this.options.edit){
                const midiValue = this.musicSheet.highlightNotes([note.getAttribute("id")]).list[0];
                midiValue.pitch += this.sheetData.staffInstrumentMap[this.sheetData.staffInstrumentMap.internal[midiValue.staff]].transSemi
                this.options.playIndex = this.musicData.timestamps.findIndex( timestamp => timestamp.tstamp >= midiValue.time);
                for(const key of Object.keys(this.midiData.instruments)){
                    this.instrumentFontByStaff[key] = await this.midiData.instruments[key];
                }
                this.playSound(midiValue.staff, midiValue.pitch, midiValue.duration);
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
    playSound(staff, pitch, pitchDuration){
        this.instrumentFontByStaff[staff].start({
            note: pitch, // Die MIDI Note Number
            velocity: 100, // Die Anschlagstärke (0-127)
            duration: pitchDuration/1000
        });
    }

    
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
                if (score > 0.90) {
                    this.sheetData.style.notesValidationCss.textContent += `[id="${note.id}"]{fill:green}`;


                } else if (score > 0.80) {
                    this.sheetData.style.notesValidationCss.textContent += `[id="${note.id}"]{fill:yellow}`;

                } else {
                    flagAllpassed = false;
                    if (this.sheetData.options.mode !== "learn") {
                        this.sheetData.style.notesValidationCss.textContent += `[id="${note.id}"]{fill:red}`;
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
        document.body.setAttribute("data-loading", "DATA IS THERE");
        console.log("START FLASH", Date.now(), document.body.getAttribute("data-loading"))
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
        document.body.removeAttribute("data-loading");
        console.log("STOP FLASH", Date.now(), document.body.getAttribute("data-loading"));

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
            await this.db_helper.setSheetOptions(this.sheetData.sheetId, this.sheetData.options);

            for(const transSemi of data.transSemi){
                this.sheetData.instruments[transSemi.id].transSemi = transSemi.transSemi; 
            }
            this.db_helper.updateSheetInstruments(this.sheetData.sheetId, this.sheetData);
            
            this.#changeVisibleInstruments(data.visible_instuments);
            this.#changeVisibleAnalyse(data.analyse_instuments);

        };
    }
}