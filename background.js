
let queue = [];
let currentIndex = -1;
let running = false;
let originTabId = null;
const MANUAL_DELAY_MS = 4000;

chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {

  if(msg.action === 'init'){
    queue = msg.raw.trim().split('\n').map(r => r.split('\t').map(c => c.trim()));
    currentIndex = -1;
    originTabId = sender.tab.id; // use current tab
    notify({ text:`Cola cargada (${queue.length}).`, enableNext:true });
    sendResp({ ok:true });
    return true;
  }

  if(msg.action === 'processNext'){
    if(running) return;
    if(currentIndex + 1 >= queue.length){
      notify({ text:'No hay más filas.', enableNext:false });
      return;
    }
    currentIndex++;
    running = true;
    processRow(queue[currentIndex]);
    return;
  }

  if(msg.action === 'contentDone'){
    running = false;
    notify({ text:`Fila ${currentIndex+1} completada. Presiona Siguiente.`, enableNext:true });
    return;
  }

});

function notify(payload){
  chrome.runtime.sendMessage({ type:'status', ...payload });
}

async function processRow(row){
  const url = row[0];
  await chrome.tabs.update(originTabId, { url });

  await waitForTabComplete(originTabId);

  // Delay manual 4s so you can open a field manually
  await new Promise(r => setTimeout(r, MANUAL_DELAY_MS));

  await chrome.scripting.executeScript({
    target: { tabId: originTabId },
    files: ['content.js']
  });

  chrome.tabs.sendMessage(originTabId, { action:'fillRow', row });
}

function waitForTabComplete(tabId){
  return new Promise(resolve=>{
    function listener(updatedId, changeInfo){
      if(updatedId === tabId && changeInfo.status === 'complete'){
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
