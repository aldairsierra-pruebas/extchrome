
let queue = [];
let currentIndex = -1;
let running = false;
let originTabId = null;
let closeTabOnFinish = false;
let closeDelayMs = 60000;
let aborted = false;
const MANUAL_DELAY_MS = 4000;

chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {

  if(msg.action === 'init'){
    queue = msg.raw
      .trim()
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean)
      .map(r => r.split('\t').map(c => c.trim()));
    currentIndex = -1;
    running = false;
    aborted = false;
    originTabId = sender.tab.id; // use current tab
    closeTabOnFinish = !!msg.closeTab;
    closeDelayMs = Math.max(0, Number(msg.closeDelayMs) || 60000);
    notify({ text:`Cola cargada (${queue.length}).`, enableNext:true });
    sendResp({ ok:true });
    return true;
  }

  if(msg.action === 'processNext'){
    if(running){
      sendResp({ ok:false, message:'Ya se está procesando una fila.' });
      return true;
    }
    if(aborted){
      sendResp({ ok:false, message:'Proceso abortado. Vuelve a cargar la cola.' });
      return true;
    }
    if(currentIndex + 1 >= queue.length){
      notify({ text:'No hay más filas.', enableNext:false });
      sendResp({ ok:false, message:'No hay más filas.' });
      return true;
    }

    currentIndex++;
    running = true;
    notify({ text:`Procesando fila ${currentIndex + 1}/${queue.length}...`, enableNext:false });
    processRow(queue[currentIndex]).catch((error)=>{
      console.error('Error al procesar fila', error);
      running = false;
      notify({ text:`Error en fila ${currentIndex + 1}: ${String(error)}`, enableNext:true });
    });
    sendResp({ ok:true });
    return true;
  }

  if(msg.action === 'abort'){
    aborted = true;
    running = false;
    notify({ text:'Abortado. Recarga la cola para continuar.', enableNext:false });
    sendResp({ ok:true });
    return true;
  }

  if(msg.action === 'contentDone'){
    running = false;

    if(aborted){
      notify({ text:'Abortado. Recarga la cola para continuar.', enableNext:false });
      return;
    }

    const hasMoreRows = currentIndex + 1 < queue.length;
    notify({
      text: hasMoreRows
        ? `Fila ${currentIndex+1} completada. Presiona Siguiente.`
        : 'Proceso finalizado. No hay más filas.',
      enableNext: hasMoreRows
    });

    if(!hasMoreRows && closeTabOnFinish && originTabId){
      setTimeout(()=>{
        chrome.tabs.remove(originTabId).catch(()=>{});
      }, closeDelayMs);
    }
    return;
  }

});

function notify(payload){
  chrome.runtime.sendMessage({ type:'status', ...payload });
}

async function processRow(row){
  const url = row[0];
  if(!url){
    throw new Error('Fila sin URL en la primera columna.');
  }

  await chrome.tabs.update(originTabId, { url });

  await waitForTabComplete(originTabId);

  // Delay manual 4s so you can open a field manually
  await new Promise(r => setTimeout(r, MANUAL_DELAY_MS));

  await ensureContentScriptLoaded(originTabId);
  await sendMessageWithRetry(originTabId, { action:'fillRow', row });
}



async function ensureContentScriptLoaded(tabId){
  try{
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch(error){
    console.warn('No se pudo inyectar content.js (puede ya estar activo):', error);
  }
}

async function sendMessageWithRetry(tabId, payload, retries = 6){
  let lastError;
  for(let i = 0; i < retries; i++){
    try{
      await chrome.tabs.sendMessage(tabId, payload);
      return;
    } catch (error) {
      lastError = error;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw lastError || new Error('No se pudo enviar mensaje al content script.');
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
