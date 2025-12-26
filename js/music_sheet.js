import createVerovioModule from './libs/node_modules/verovio/dist/verovio-module.mjs';
import { VerovioToolkit } from './libs/node_modules/verovio/dist/verovio.mjs';

export class MusicSheet{
    /**
     * @type {{htmlElemts:{sheetElm:HTMLDivElement}, activePage:number}}
     */
    #sheetData = {
        htmlElemts:{sheetElm:null},
        activePage: 0
    }

    /**
     * Ein MusicSheet wird erstellt
     * @param {Sting|HTMLElement} elm 
     */
    constructor(elm){
        this.#sheetData.htmlElemts.sheetElm=elm;
    }

    /**
     * Lädt eine Datei (mei, mxl, musicxml, xml) und stellt diese graphisch dar.
     * @param {string} xmlContent 
     * @param {boolean} [render=true]   
     */
    async loadMusic(xmlContent, BPMfactor, render=true) {
        try {
            const VerovioModule = await createVerovioModule();
            /**
             * @type {VerovioToolkit}
             */
            this.verovioToolkit = new VerovioToolkit(VerovioModule);
            // const dataFetch = await fetch("./Rachmaninow Bogoroditse Djevo.musicxml");
            // const dataText = await dataFetch.text();
            const loadSuccess = this.verovioToolkit.loadData(xmlContent);
            if(loadSuccess == 0) throw("Fehler beim Laden der Datei<br>");
            console.log("Musikstück geladen");
            
            this.verovioToolkit.setOptions({
                svgAdditionalAttribute:"staff@n",
                midiTempoAdjustment: BPMfactor,
                
                scale:45,
                
                // 3. Andere Einstellungen
                pageMarginTop: 0,
                pageMarginLeft: 0,
                pageMarginRight: 0, 
                header:"none",
                footer: "none"
            });
            
            if(!render) return
            this.render();
            
        } catch (e) {
            console.error("Fehler beim Laden oder Rendern des Stücks:", e);
        }
    }

    setBPMFactor(BPMfactor){
        this.verovioToolkit.setOptions({midiTempoAdjustment:BPMfactor});
        this.render();
    }


    /**
     * Rendert das Musikfile
     */
    render(){
        this.verovioToolkit.redoLayout();
        const data = this.verovioToolkit.renderToSVG();
        const timestampData = this.verovioToolkit.renderToTimemap({includeRests:true});
        this.#sheetData.htmlElemts.sheetElm.innerHTML = data;
        console.log("Musikstück gerendert");
        return timestampData;
    }

    renderPlay(){
        this.verovioToolkit.select({measureRange: "start-end"});
        this.verovioToolkit.setOptions({
            breaks:"none",
            adjustPageWidth: false,
            adjustPageHeight: true,
        });
        return this.render();
    }

    renderOverview(){
        this.verovioToolkit.setOptions({
            breaks:"auto",
            pageHeight: 60000,
            pageWidth:this.#sheetData.htmlElemts.sheetElm.clientWidth * 100/this.verovioToolkit.getOptions().scale,
            adjustPageWidth: false,
            adjustPageHeight: true,
        });

        return this.render()
    }

    /**
     * Gibt die Musiknoten als MEI Format zurück.
     * @returns {string}
     */
    getMEIFile(){
        return this.verovioToolkit.getMEI();
    }


    /**
     * Färbt die Noten zu einer übergebenen Zeit ein
     * @param {number} time Time in seconds
     * @returns {{list:{duration:number, pitch:number, time:number, id:string, staff:number}[], map:Object<number,{duration:number, pitch:number, time:number, id:string, staff:number}>}}
     */
    highlightNotesByTime(time) {
        // Get elements at a time in milliseconds (time from the player is in seconds)
        let currentElements = this.verovioToolkit.getElementsAtTime(time*1000+10);
        if (currentElements.page == 0|| !currentElements.notes) return;

        if (currentElements.page != this.#sheetData.activePage) {
            this.#sheetData.activePage = currentElements.page;
            this.#sheetData.htmlElemts.sheetElm.innerHTML = this.verovioToolkit.renderToSVG(this.#sheetData.activePage);
        }

        // let noteElement = this.#sheetData.htmlElemts.sheetElm.querySelector(`[id=${currentElements.measure}]`);
        // if (noteElement) noteElement.classList.add("playing");
        // Get all notes playing and set the class
        
        return this.highlightNotes(currentElements.notes);
    }

    /**
     * Färbt Noten mit übergebener Id ein
     * @param {string[]} ids 
     * @returns {{list:{duration:number, pitch:number, time:number, id:string, staff:number}[], map:Object<number,{duration:number, pitch:number, time:number, id:string, staff:number}>}}
     */
    highlightNotes(ids){
        // Entferne das Attribut "playing" überall
        let playingNotes = this.#sheetData.htmlElemts.sheetElm.querySelectorAll('g.playing');
        for (let playingNote of playingNotes) playingNote.classList.remove("playing");


        // Setze das Attribut "playing" neu
        const activeNotes = {list:[], map:{}}
        for (const id of ids) {
            let noteElement = this.#sheetData.htmlElemts.sheetElm.querySelector(`[id=${id}]`);
            if (noteElement) noteElement.classList.add("playing");
            const midiValues = this.verovioToolkit.getMIDIValuesForElement(id);
            midiValues.id = id;
            midiValues.staff = this.getStaff(id);
            activeNotes.list.push(midiValues);
            activeNotes.map[midiValues.pitch] = midiValues;
        }
        return activeNotes
    }


    /**
     * Gibt MidiWerte für eine Note Wieder
     * @param {string} id
     * @returns {{id:string, staff:number, duration:number, pitch:number, time:number}}
     */
    getMIDIValuesForElementId(id){
        const midiData = this.verovioToolkit.getMIDIValuesForElement(id);
        midiData.id = id;
        midiData.staff = this.getStaff(id);
        return midiData;
    }
    
    /**
     * Gibt die Staff Nummer für die Note aus
     * @param {string} id 
     * @returns {number} 
     */
    getStaff(id){
        return parseInt(this.#sheetData.htmlElemts.sheetElm.querySelector(`[id=${id}]`).closest(".staff").getAttribute("data-n"));
    }
}