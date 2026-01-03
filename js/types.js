/**
 * @typedef Note
 * @property {string} id - Id der Grapischen Note
 * @property {number} frequency - Frequenz der Note 
 * @property {number} duration - Dauer der Note 
 * @property {number[]} score - Array mit den Score Daten
 * @property {number[]} centDeviations - Array mit den Abweichungen
 * @property {number} maxCountDeviations - Maximal mögliche Anzahl an abweiungen die eine Note haben kann
 * @property {number} midi - Midiwert der Note
 */

/**
 * @typedef Instrument
 * @property {number} id - Id des Instruments
 * @property {string} name - Name des Instruments
 * @property {number} transSemi - Abweichung des Instruments
 * @property {number} midiNumber - Midinumber  des Instruments
 * @property {[number, number]} rhythm - Takt des Instruments
 * @property {number[]} staffNumbers - Staffnumbers des Instruments
 * @property {boolean} visible - Sichbarkiets des Instruments
 * @property {boolean} analyse - Analyse des Instruments
 */

/**
 * @typedef SheetMetaData
 * @property {string} fileName Name des Files
 * @property {string} mimeType Mimtype des FIles
 * @property {string} title Title des FIles
 * @property {string} subtitle Untertitel des FIles
 * @property {string} composer Komponist des FIles
 * @property {number} score Bewrtung des Viles
 * @property {number} id 
 * @property {Number} creationTime Datum des importierens
 * @property {Number} lastUsed Datum des letzten Aufrufes
 * @property {{id:string, text:string}[]} noteAnnotations Map mit Id der Note und dem Text
 * @property {Instrument[]} instruments Liste der Instrumnte
 * @property {{<number>:Instrument, internal:{<number>:number}}} staffInstrumentMap Map mit Staff-ID zu Instrument, internal-Map mit aktueller Staff-ID zu ursprünglichen. 
 * @property {UserOptions} options Map mit den Useroptionen
 */

/**
 * @typedef UserOptions
 * @property {"normal"|"learn"} mode Spiel Modus des Stückes
 * @property {number} bpm Aktuelle BPM
 * @property {number} defaultBPM Standard BPM-Wert
 * @property {"auto"|"ask"|"never"} skipRest Einstellung fürs Pausen überspringen
 * @property {boolean} firstOpen Wert ob das File das erste mal überhaupt geöffnet wurde
 * @property {"holding"|"declining"} noteAnalyse Einstellung wie die Noten Analysiert werden sollen
 * @property {number[]} showNoteNames Liste mit den Ids der Instrumente deren Notennamen angezeigt werden sollen
 * @property {boolean} showNoteDiagramsOnAnalyse Einstellung ob Noten-Diagramme wärend der Analyse angezeigt werden sollen
 * @property {boolean} skipReview Einstellung ob die Review Ansicht übersprungen werden soll
 * @property {boolean} showNoteDiagramOnTab Einstellung ob Noten-Diagram beim drauf klicken angezeigt werden soll
 */

export {}