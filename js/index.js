import {uploadMultiple} from "/wuefl-libs/js/upload_preview.js";
import {MusicDB} from "./music_db.js";
import {userDialog} from "/wuefl-libs/js/userDialog.js";
import {MusicSheet} from "./music_sheet.js"
import {FileHelper} from "./music_metadata_extender.js"

const db_helper = new MusicDB();
window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.get('share_upload')){
        for (const inboxElm of await db_helper.getInbox()) {
            if(inboxElm.type != "file") continue;
            const formData = new FormData();
            formData.append('files', inboxElm.data);
            const id = uploadFiles(formData, ['mxl', 'musicxml', 'xml', 'mei'])[0];
            await db_helper.setActiveFileId(id);
            await db_helper.deleteInbox(id);
            window.history.replaceState({}, document.title, "/app.html");
            document.title = "app.html";
            break;
        }
    }

    if ('serviceWorker' in navigator) {
        // Registriere den Service Worker, der im Root-Verzeichnis liegt
        // navigator.serviceWorker.register('./sw.js', {scope: "/", type: 'module'})
        navigator.serviceWorker.register('./sw.js', {scope: "/musicTrack/", type: 'module'})
            .then(registration => {
                console.log('Service Worker registriert. Scope:', registration.scope);
            })
            .catch(error => {
                console.error('Service Worker Registrierung fehlgeschlagen:', error);
            });

        navigator.serviceWorker.addEventListener('message', async(event) => {
            if (event.data && event.data.type === 'APP_VERSION') {
                // ➡️ KRITISCHER SCHRITT: Neuladen, um den Fetch-Handler zu aktivieren
                await db_helper.setServiceVersion(event.data.data);
                window.location.reload();
            }
        });
    }


});

const sheetElm = document.querySelector(".sheets");
sheetElm.addEventListener("click", async (e) => {
    if(e.target.closest(".file-delete")){
        const userDialogRaw = await userDialog({title:"File löschen", content:`Soll das File: ${e.target.closest(".file").querySelector("h3").innerText} wirklich gelöscht werden?`, confirmText:"Löschen"})
        if(userDialogRaw.submit){
            await db_helper.deleteFile(parseInt(e.target.closest(".file").dataset.id));
            e.target.closest(".file").remove();
        }
    }
    if(e.target.closest(".file-active")){
        await db_helper.setActiveFileId(parseInt(e.target.closest(".file").dataset.id));
    }
});
showSheetData();

document.querySelector(".addFiles").addEventListener("click", async ()=>{
    const validExtensions = ['mxl', 'musicxml', 'xml', 'mei'];
    const validMimeTypes = ["application/x-mei+xml","application/octet-stream","application/vnd.recordare.musicxml+xml","application/vnd.recordare.musicxml","text/xml"];
    const formData = await uploadMultiple(validExtensions, validMimeTypes);
    if(!formData.files) return;
    await uploadFiles(formData, validExtensions);
    
    showSheetData();
})

/**
 * Speicher die Übergeben Datein ab und gibt die Ids zurück.
 * @param {FormData} formData - Formdata der zuspeichernen Datein
 * @returns {Promise<number[]>} - ids der Datein
 */
async function uploadFiles(formData, validExtensions) {
    const fileHelper = new FileHelper();
    const musicSheet = new MusicSheet(null);
    const ids = []
    for (const file of formData.files){
        if(!validExtensions.includes(file.name.split('.').pop().toLowerCase())) continue;
        const fileBuffer = await file.arrayBuffer();
        const fileString = await fileHelper.convertFiletoSting(file.name, fileBuffer);
        
        await musicSheet.loadMusic(fileString, 1, false);
        const fileMetaData = fileHelper.extendMetaDataMEI(musicSheet.getMEIFile());

        ids.push(await db_helper.saveFile(fileMetaData, musicSheet.getMEIFile(), file));
    }
    return ids;
}
async function showSheetData(){
    const currentVersion = await db_helper.getAppVersion();
    const serviceVersion = await db_helper.getServiceVersion();

    if(currentVersion != serviceVersion){
        console.log(`[CHANGE]: ${currentVersion} => ${serviceVersion}`)
        await db_helper.setAppVersion(serviceVersion);
        const data = await (await fetch("./js/update.json")).json();

        const dataVersions = Object.keys(data).filter((v)=> {return compareVersions(parseVersion(v), parseVersion(currentVersion)) > 0 && compareVersions(parseVersion(v), parseVersion(serviceVersion)) <= 0});
        let html = ``;
        for(const version of dataVersions){
            html += `<h2 class="heading-2">${version}</h2>`;
            html += `<p>${data[version]}</p>`;
        }
        userDialog({
            title:"Update",
            content:html,
            confirmText:"Alles klar",
            onlyConfirm:true
        });
    }
    if(await db_helper.isFirstTime()){
        userDialog({
            title:"Willkommen",
            content:`<p>
            Die App <b>MusicTrack</b> versucht dich beim Erlernen von Liedern zu unterstützen, dabei werden alle Datein nur <b>lokal</b> bei dir gespeichert. 
            <br>Nichts geht nach draußen!<br>
            Starte einfach, in dem du ein File hochlädst!
            <br><br>
            (Version 1.0.0)
            </p>
            `,
            confirmText:"Starten",
            onlyConfirm:true
        });
    }

    sheetElm.textContent = "";
    const sheetData = await db_helper.getAllSheetMetadata();
    sheetData.sort((a,b)=>{return a.lastUsed > b.lastUsed? -1:1}) 
    for(const elm of sheetData){
        sheetElm.insertAdjacentHTML("beforeend", `  
            <div class="file" data-id="${elm.id}">
                <a href="app.html">
                    <button class="button file-active" data-shape="no-background">
                        <span class="msr">frame_inspect</span><h3>${elm.title}</h3>
                        <p>${elm.fileName}</p>
                    </button>
                </a>
                <div><progress max="1" value="${elm.score}"></progress> <span>${(elm.score*100).toFixed(0)}/100</span> </div>
                <button class="button file-delete" data-shape="round"><span class="msr">delete</span></button>
            </div>
        `);
    }
}

function parseVersion(versionStr) {
    if (!versionStr) return [0, 0, 0];
    const numericPart = versionStr.match(/(\d+\.?)+/);
    if (!numericPart) return [0, 0, 0];
    return numericPart[0].split('.').map(Number);
}

function compareVersions(v1, v2) {
    const len = Math.max(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
        const num1 = v1[i] || 0;
        const num2 = v2[i] || 0;

        if (num1 > num2) return 1; // v1 > v2
        if (num1 < num2) return -1; // v1 < v2
    }
    return 0; // v1 == v2
}