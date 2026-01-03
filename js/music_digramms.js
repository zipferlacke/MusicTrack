export class MusicDiagrams{
    /**
     * Erstellt ein SVG-Diagramm für Noten
     * @param {{id:string, centVarianceAnalyse:number, centVarianceOk:number, centVarianceTop:number, width:number}} param0 
     * @returns {SVGElement} 
     */
    createNoteDiagramm({id, centVarianceAnalyse=75, centVarianceOk=12.5, centVarianceTop=7.5, width=500}){
        const height = centVarianceAnalyse*2;
        const variance = centVarianceAnalyse;
        const parser = new DOMParser();

        const svgHTML = `
        <svg class="noteDiagram" id="noteDiagram_${id}" viewBox="0 ${-variance} ${width} ${height}" width="${width}" height="200px" preserveAspectRatio="none">
            <rect x="0" y="${-variance}" width="${width}" height="${height}" fill="var(--noteDiagram_red)" />
            <rect x="0" y="-${centVarianceOk}" width="${width}" height="${centVarianceOk*2}" fill="var(--noteDiagram_yellow)" />
            <rect x="0" y="-${centVarianceTop}" width="${width}" height="${centVarianceTop*2}" fill="var(--noteDiagram_green)" />
            <line x1="0" y1="0" x2="${width}" y2="0" stroke="var(--noteDiagram_line)" stroke-dasharray="2" stroke-width="1" opacity="0.5" />
            <text id="score_text" x="${width - 10}" y="${-variance + 20}" text-anchor="end" fill="white" pointer-events: none;">0%</text>
            <g id="data_layer"></g>
        </svg>`;
        return document.createRange().createContextualFragment(svgHTML).firstElementChild;
    }
    
    /**
     * Updatet ein SVG-Diagramm einer Note
     * @param {string} id 
     * @param {number[]} divergations 
     * @param {number} max 
     * @param {SVGElement} svg 
     */
    updateNoteDiagramm(score, divergations, maxPoints, svg){
        const stepWidth = parseInt(svg.getAttribute("width"))/maxPoints;
        const dataLayer = svg.querySelector(`#data_layer`);
        svg.querySelector(`#score_text`).textContent =  (score*100).toFixed(0) + "%";
        dataLayer.innerHTML = "";

        let lastX = null;
        let lastY = null;

        // 2. Neue Elemente generieren
        let elements = "";
        for (let i=0; i<divergations.length; i++){
            const y =  divergations[i] != null? -divergations[i]:null;
            const x = i * stepWidth;
            if(y != null) elements += `<circle cx="${x}" cy="${y}" r="1" fill="var(--noteDiagram_line)" />`;
            if(y!= null && lastY != null){
                elements += `<line x1="${lastX}" y1="${lastY}" x2="${x}" y2="${y}" stroke="var(--noteDiagram_line)" stroke-width="1" stroke-linecap="round" />`;
            }
            lastX = x;
            lastY = y;
        }
        dataLayer.innerHTML = elements;
    }
}