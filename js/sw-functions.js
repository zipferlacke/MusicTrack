import {userDialog} from "/wuefl-libs/js/userDialog.js";
import updateData from './update.json' with { type: 'json' };

/**
 * 
 * @param {{firstTime:boolean, currentVersion:string, autoUpdate:[true], funcUpdateVersion:Function}}  
 * @returns {Promise<void>}
 */
export async function initialServiceWorker({firstTime, currentVersion, autoupdate=true, funcUpdateVersion}){

    if (!'serviceWorker' in navigator) return;    

    // navigator.serviceWorker.register('./sw.js', {scope: "/", type: 'module'})
    navigator.serviceWorker.register('./sw.js', {scope: "/musicTrack/", type: 'module'})
        .then(registration => {
            console.log('Service Worker registriert. Scope:', registration.scope);
        })
        .catch(error => {
            console.error('Service Worker Registrierung fehlgeschlagen:', error);
        });

    //Prüfe ob Seite das erstmal angezeigt wird
    if(firstTime){
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if(!isStandalone){
            await userDialog({
                title:"Installieren...",
                content:`
                    <p>
                        Sie können diese Anwendung als WebApp (PWA) installieren.<br>
                        <b>IOS</b><br>
                        1. Drücken sie auf das Teilen-Symbol <br>
                        2. Drücken sie auf zum Home Bildschirm hinzufügen (meist etwas versteckt, unter 'mehr' [<span class="msr" style="align-self:center;">more_horiz</span>]) 
                    </p>`,
                confirmText:"verstanden",
                onlyConfirm:true,
            });
        }
        await userDialog({
            title:"Willkommen",
            content:`<p>${updateData.welcome.join("<br>")}<br>(Version: ${updateData.changelog[0].version}) </p>`,
            confirmText:"Starten",
            onlyConfirm:true
        });
    }

    navigator.serviceWorker.addEventListener('message', async(event) => {
        if (event.data && event.data.type === 'APP_VERSION') {
            const newVersion = event.data.data;
            if(currentVersion != newVersion){
                console.log(`[CHANGE]: ${currentVersion} => ${newVersion}`)
                

                const currentVersions = updateData.changelog.filter((v) => compareVersions(parseVersion(v.version), parseVersion(currentVersion)) > 0 && compareVersions(parseVersion(v.version), parseVersion(newVersion)) <= 0)
                let html = ``;
                for(const version of currentVersions){
                    html += `
                        <h2 class="heading-2">Version ${version.version}</h2>
                        <p>${version.changes.join("<br>")}</p>
                    `;
                }
                let result;
                if(autoupdate || compareVersions(parseVersion(v.version), parseVersion(updateData.minVersion)) < 0){
                    result = await userDialog({
                        title:"Update",
                        content:html,
                        confirmText:"Aktualisieren",
                        onlyConfirm:true
                    });
                }else{
                    result = await userDialog({
                        title:"Update",
                        content:html,
                        confirmText:"Aktualisieren",
                        cancelText:"Später Aktualisieren"
                    });
                }
                if(result.submit){
                    await funcUpdateVersion(newVersion);
                    location.reload();
                }
            }
        }
    });
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