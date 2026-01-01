export class MusicDiagrams{
    /**
     * Erstellt ein SVG-Diagramm für Noten
     * @param {{centVarianceAnalyse:number, centVarianceOk:number, centVarianceTop:number, width:number}} param0 
     * @returns {SVGElement} 
     */
    createNoteDiagramm({centVarianceAnalyse=75, centVarianceOk=12.5, centVarianceTop=7.5, width=500}){
        const height = centVarianceAnalyse*2;
        const variance = centVarianceAnalyse;
        const parser = new DOMParser();

        const svgHTML = `
        <svg id="varianceSvg" viewBox="0 ${-variance} ${width} ${height}" width="100%" height="200px" preserveAspectRatio="none">
            <rect x="0" y="${-variance}" width="${width}" height="${height}" fill="#ff4444" />
            <rect x="0" y="-${centVarianceOk}" width="${width}" height="${centVarianceOk*2}" fill="#ffbb33" />
            <rect x="0" y="-${centVarianceTop}" width="${width}" height="${centVarianceTop*2}" fill="#00c851" />
            <line x1="0" y1="0" x2="${width}" y2="0" stroke="white" stroke-dasharray="2" stroke-width="1" opacity="0.5" />
            
            <g id="data-layer"></g>
        </svg>`;
        return parser.parseFromString(svgHTML, "image/svg+xml");
    }
    
    /**
     * Updatet ein SVG-Diagramm einer Note
     * @param {number[]} divergation 
     * @param {number} max 
     * @param {SVGElement} svg 
     */
    updateNoteDiagramm(divergation, maxPoints, svg){
        const stepWidth = parseInt(svg.getAttribute("width"))/maxPoints;

        // 1. Gruppe leeren
        dataLayer.innerHTML = "";

        let lastX = null;
        let lastY = null;

        // 2. Neue Elemente generieren
        let elements = "";

        for (const [y, index] of divergation){
            const x = index * stepWidth;
            const y = -y;
            elements += `<circle cx="${x}" cy="${y}" r="3" fill="black" />`;
            if(lastX != null){
                elements += `<line x1="${lastX}" y1="${lastY}" x2="${x}" y2="${y}" stroke="black" stroke-width="2" stroke-linecap="round" />`;
                lastX = x;
                lastY = y;
            }
        }
    }
}