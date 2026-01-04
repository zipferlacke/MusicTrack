import {openDB} from './libs/idb.js'
import * as Types from "./types.js";

const DB_NAME = 'MusicAppDB';
const DB_VERSION = 2;

export class MusicDB {
    constructor() {
        this.dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 2) { 
                    if (db.objectStoreNames.contains('sheetData')) {
                        db.deleteObjectStore('sheetData'); // Löscht den alten Store
                        console.log("Alte Tabelle: 'sheetData' wurde gelöscht.");
                    }
                }

                if (!db.objectStoreNames.contains('inbox')) {
                    db.createObjectStore('inbox', { keyPath: 'id', autoIncrement: true });
                }
                
                // 2. Erstellen/Aktualisieren der neuen Stores
                
                // Überprüfen und Erstellen von 'sheetMetaData'
                if (!db.objectStoreNames.contains('sheetMetaData')) {
                    const filesStore = db.createObjectStore('sheetMetaData', { keyPath: 'id', autoIncrement: true });
                    filesStore.createIndex('title', 'title', { unique: false });
                }

                // Überprüfen und Erstellen von 'sheetBuffers'
                if (!db.objectStoreNames.contains('sheetBuffers')) {
                    db.createObjectStore('sheetBuffers', { keyPath: 'id' });
                }

                // Überprüfen und Erstellen von 'settings' (wenn es noch nicht existiert)
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'setting_name' });
                }
            },
        });
    }
    

    /**
     * Speichert eine neue Musikdatei und ihre Metadaten
     * @param {{title:string, subtitle:string, composer:string, instruments:Types.Instrument[], staffInstrumentMap:{<number>:Types.Instrument ,internal:{<number>:number}}}} fileMetaData
     * @param {string} fileString
     * @param {File} file
     * @returns {Promise<number>} Die ID der neuen Datei
     */
    async saveFile(fileMetaData, fileString, file) {
        const db = await this.dbPromise;
		
        //Metadaten werden geschriben
        const tx = db.transaction('sheetMetaData', 'readwrite');
        /**@type {Types.SheetMetaData} */
        const sheetMetaData = {
            title: fileMetaData.title,
            subtitle: fileMetaData.subtitle,
            composer: fileMetaData.composer,
            instruments: fileMetaData.instruments,
            staffInstrumentMap: fileMetaData.staffInstrumentMap,
            fileName: file.name,
            mimeType: file.type,
            noteAnnotations:[],
            score: 0,
            creationTime: Date.now(),
            lastUsed: Date.now(),
            options:{mode:"normal", defaultBPM:fileMetaData.defaultBPM, bpm:fileMetaData.currentBPM, firstOpen:true, skipRest:"auto", noteAnalyse:"holding", showNoteNames:[], drawNoteDiagrams:true}
        }
        const sheetId = await tx.store.add(sheetMetaData);await tx.done;

        //Buffer wird geschrieben
        const tx2 = db.transaction('sheetBuffers', 'readwrite');
        tx2.store.put({
            id: sheetId,
            sheetBuffer: fileString,
        });await tx2.done;
        return sheetId;
    }
    
    /**
     * Setzt die ID der aktuell aktiven Musikdatei in den Settings Store
     * @param {number} sheetId
     */
    async setActiveFileId(sheetId) {
        const db = await this.dbPromise;
        const tx = db.transaction('settings', 'readwrite');
        
        await tx.store.put({
            setting_name: 'activeFileId',
            value: sheetId
        });
        
        await tx.done;
    }

    /**
     * Setzt eine neue Version
     * @param {string} version
     */
    async setAppVersion(version) {
        const db = await this.dbPromise;
        const tx = db.transaction('settings', 'readwrite');

        await tx.store.put({
            setting_name: 'version',
            value: version
        });
        
        await tx.done;
    }

    /**
     * Ruft die ID der aktuell aktiven Datei ab
     * @returns {Promise<string|null>}
     */
    async getAppVersion() {
        const db = await this.dbPromise;
        const setting = await db.get('settings', 'version');
        
        return setting ? setting.value : null;
    }

    /**
     * Setzt eine neue Version
     * @param {string} version
     */
    async setServiceVersion(version) {
        const db = await this.dbPromise;
        const tx = db.transaction('settings', 'readwrite');

        await tx.store.put({
            setting_name: 'serviceVersion',
            value: version
        });
        
        await tx.done;
    }

    /**
     * Ruft die ID der aktuell aktiven Datei ab
     * @returns {Promise<string|null>}
     */
    async getServiceVersion() {
        const db = await this.dbPromise;
        const setting = await db.get('settings', 'serviceVersion');
        
        return setting ? setting.value : null;
    }

    /**
     * Updatet zu Timestamp: lastUsed für Sheet
     */
    async updateLastUsed() {
        const db = await this.dbPromise;
        const sheetId = await this.getActiveFileId();
        const sheetMetaData = await this.getSheetMetaData(sheetId);
        sheetMetaData.lastUsed = Date.now();

        const tx = db.transaction('sheetMetaData', 'readwrite');
        
        await tx.store.put(sheetMetaData);
        
        await tx.done;
    }

    /**
     * Setzt einen neuen sheetScore für das Sheet
     * @param {number} sheetId
     * @param {number} sheetScore
     */
    async setSheetScore(sheetId, sheetScore) {
        const db = await this.dbPromise;
        const sheetMetaData = await this.getSheetMetaData(sheetId);
        sheetMetaData.score = sheetScore;
        const tx = db.transaction('sheetMetaData', 'readwrite');
        
        await tx.store.put(sheetMetaData);
        
        await tx.done;
    }

    /**
     * Setzt einen neuen sheetScore für das Sheet
     * @param {number} sheetId
     * @param {number} noteAnnotations
     */
    async setSheetNoteAnnotations(sheetId, noteAnnotations) {
        const db = await this.dbPromise;
        const sheetMetaData = await this.getSheetMetaData(sheetId);
        sheetMetaData.noteAnnotations = noteAnnotations;
        const tx = db.transaction('sheetMetaData', 'readwrite');
        
        await tx.store.put(sheetMetaData);
        
        await tx.done;
    }

    /**
     * Setzt einen neuen sheetScore für das Sheet
     * @param {number} sheetId
     * @param {Types.SheetMetaData.options} sheetOptions
     */
    async setSheetOptions(sheetId, sheetOptions) {
        const db = await this.dbPromise;
        const sheetMetaData = await this.getSheetMetaData(sheetId);
        const newOptions = {
            ...sheetMetaData.options,  
            ...sheetOptions
        };
        sheetMetaData.options = newOptions;
        
        const tx = db.transaction('sheetMetaData', 'readwrite');
        
        await tx.store.put(sheetMetaData);
        
        await tx.done;
    }

    /**
     * Aktualisiert die Sichtbarkeit/Anaylse von den Instrumenten
     * @param {number} sheetId
     * @param {Types.SheetMetaData} sheetData
     */
    async updateSheetInstruments(sheetId, sheetData) {
        const db = await this.dbPromise;
        const sheetMetaData = await this.getSheetMetaData(sheetId);
        sheetMetaData.instruments = sheetData.instruments;
        sheetMetaData.staffInstrumentMap = sheetData.staffInstrumentMap;
        
        const tx = db.transaction('sheetMetaData', 'readwrite');
        
        await tx.store.put(sheetMetaData);
        await tx.done;
    }

    /**
     * Ruft die ID der aktuell aktiven Datei ab
     * @returns {Promise<number|null>}
     */
    async getActiveFileId() {
        const db = await this.dbPromise;
        const setting = await db.get('settings', 'activeFileId');
        
        return setting ? setting.value : null;
    }

    /**
     * Ruft die MetaDaten der übergebenden Datei ab.
     * @returns {Promise<Types.SheetMetaData|null>}
     */
    async getSheetMetaData(sheetId) {
        if (sheetId === null) return null;
        const db = await this.dbPromise;
        return await db.get('sheetMetaData', sheetId);
    }
    
    /**
     * Ruft den Buffer der übergebenden Datei ab.
     * @returns {Promise<ArrayBuffer|null>}
     */
    async getSheetBuffer(sheetId) {
        if (sheetId === null) return null;
        const db = await this.dbPromise;
        return await db.get('sheetBuffers', sheetId);
    }

    

    /**
     * Gibt an ob der Nutzer das erstmal da ist
     * @returns {Promise<boolean>}
     */
    async isFirstTime() {
        const db = await this.dbPromise;
        let isFirstTime = await db.get('settings', "isFirstTime");
        if(isFirstTime == null) {
            isFirstTime = true;
            const tx = db.transaction('settings', 'readwrite');
        
            await tx.store.put({
                setting_name: 'isFirstTime',
                value: false
            });
        
            await tx.done;
        }else{
            
            isFirstTime = isFirstTime.value
        }
        return isFirstTime;
    }


    /**
     * Ruft die MetaDaten der aktiven Datei ab
     * @returns {Promise<Types.SheetMetaData|null>}
     */
    async getActiveSheetMetaData() {
        const activeId = await this.getActiveFileId();
        return await this.getSheetMetaData(activeId);
    }

    /**
     * Ruft den Buffer der aktiven Datei ab
     * @returns {Promise<ArrayBuffer|null>}
     */
    async getActiveSheetBuffer() {
        const activeId = await this.getActiveFileId();
        return await this.getSheetBuffer(activeId);
    }
    
    /**
     * Ruft die ID, den Titel und den Score aller gespeicherten Musikstücke ab.
     * @returns {Promise<Array<{id: number,fileName:string, title: string, subtitle:string, score: number, lastUsed:Number}>>}
     */
    async getAllSheetMetadata() {
        const db = await this.dbPromise;
        
        // Ruft alle Objekte aus dem 'files' Store ab
        const allFiles = await db.getAll('sheetMetaData');
        
        // Mappt die Ergebnisse, um nur ID, Titel und Score zurückzugeben
        return allFiles.map(file => ({
            id: file.id,
            fileName: file.fileName,
            title: file.title,
            subtitle: file.subtitle,
            score: file.score,
            lastUsed: file.lastUsed
        }));
    }

    /**
     * Löscht ein Musikstück anhand seiner ID aus der Datenbank.
     * @param {number} id - Die ID des zu löschenden Musikstücks.
     * @returns {Promise<void>}
     */
    async deleteFile(id) {
        const db = await this.dbPromise;
        
        const tx = db.transaction('sheetMetaData', 'readwrite');
        await tx.store.delete(id); await tx.done;
        const tx2 = db.transaction('sheetBuffers', 'readwrite');
        await tx2.store.delete(id); await tx2.done;
        
        console.log(`Musikstück mit ID ${id} erfolgreich gelöscht.`);
    }

    /**
     * Speichert ein File in die Inbox
     * @param {*} file 
     * @return {Promise<void>}
     */
    async saveToInbox(file) {
        const db = await this.dbPromise;
        const tx = db.transaction('inbox', 'readwrite');
        await tx.store.put({type:"file", data:file});
        await tx.done;
    };

    /**
     * Gibt die gesammte Inbox aus
     * @return {Promise<{type:"file", data:obj}[]>}
     */
    async getInbox() {
        const db = await this.dbPromise;
        return await db.getAll('inbox');
    };
    /**
     * Löscht ein InboxElemnt anhand seiner ID aus der Datenbank.
     * @param {number} id - Die ID des zu löschenden Musikstücks.
     * @returns {Promise<void>}
     */
    async deleteInbox(id) {
        const db = await this.dbPromise;
        
        const tx = db.transaction('inbox', 'readwrite');
        await tx.store.delete(id); await tx.done;        
        console.log(`Inbox mit ID ${id} erfolgreich gelöscht.`);
    }
}
