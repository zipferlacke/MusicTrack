import {userDialogUpload} from "/wuefl-libs/userDialog/userDialogUpload.js";
import {userDialog} from "/wuefl-libs/userDialog/userDialog.js";

import {MusicDB} from "./music_db.js";
import {MusicSheet} from "./music_sheet.js"
import {FileHelper} from "./music_metadata_extender.js"
import {initialServiceWorker} from "./sw-functions.js"

const sheetElm = document.querySelector(".sheets");
const db_helper = new MusicDB();
async function init(){
    

    //Start ServiceWorker;
    await initialServiceWorker({
        firstTime:await db_helper.isFirstTime(), 
        currentVersion:await db_helper.getAppVersion(),
        funcUpdateVersion:async (version)=>{await db_helper.setAppVersion(version);}
    });

    // Check for PWA Actions
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

    // Start App
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
        const formData = await userDialogUpload(validExtensions, validMimeTypes, true);
        if(!formData.files) return;
        await uploadFiles(formData, validExtensions);
        
        showSheetData();
    })
}
init();




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

/**
 * Fügt die Musicdatein zu Webseite hinzu.
 */
async function showSheetData(){
    sheetElm.textContent = "";
    const sheetData = await db_helper.getAllSheetMetadata();
    sheetData.sort((a,b)=>{return a.lastUsed > b.lastUsed? -1:1});
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