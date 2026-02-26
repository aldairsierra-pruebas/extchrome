
// content.js - injects sidebar UI and handles fillRow messages
(async function(){
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // inject sidebar HTML/CSS once
  if(!document.getElementById('odis-autofill-sidebar-root')){
    // fetch sidebar resources from extension
    try{
      const htmlResp = await fetch(chrome.runtime.getURL('sidebar.html'));
      const html = await htmlResp.text();
      const wrapper = document.createElement('div');
      wrapper.id = 'odis-autofill-sidebar-root';
      wrapper.innerHTML = html;
      document.body.appendChild(wrapper);

      // inject CSS as well (web_accessible)
      const linkHref = chrome.runtime.getURL('sidebar.css');
      // sidebar.html imports sidebar.css already; ensure it's applied for some browsers
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = linkHref;
      document.head.appendChild(l);

      setupSidebar(); // wire events
    } catch(e){
      console.error('Error injecting sidebar', e);
    }
  } else {
    setupSidebar();
  }

  // helpers for DOM and smart search/scroll
  function $x(xpath, root=document){
    try{ return document.evaluate(xpath, root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue; }
    catch(e){ return null; }
  }
  function $q(sel, root=document){
    try{ return root.querySelector(sel); }catch(e){ return null; }
  }
  function dispatchEvents(el){
    if(!el) return;
    try{ el.focus && el.focus(); }catch(e){}
    try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
    try{ el.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
    try{ el.blur && el.blur(); }catch(e){}
  }

  async function smartScrollSearch(findFn, timeout = 15000){
    const start = Date.now();
    let found = findFn();
    if(found) return found;
    const scrollStep = 600;
    const maxScrolls = 20;
    let scrollCount = 0;
    while(Date.now() - start < timeout && scrollCount < maxScrolls){
      window.scrollBy(0, scrollStep);
      await sleep(350);
      found = findFn();
      if(found) return found;
      scrollCount++;
    }
    window.scrollTo(0,0);
    await sleep(300);
    return findFn();
  }

  async function setValueByXPath(xpath, value){
    const el = await smartScrollSearch(()=> $x(xpath));
    if(!el){ console.warn('No encontrado tras scroll:', xpath); return false; }
    try{ el.value = value; el.setAttribute('value', value); }catch(e){}
    dispatchEvents(el);
    return true;
  }

  async function setValueBySelector(sel, value){
    const el = await smartScrollSearch(()=> $q(sel));
    if(!el){ console.warn('No encontrado selector tras scroll:', sel); return false; }
    try{ el.value = value; el.setAttribute('value', value); }catch(e){}
    dispatchEvents(el);
    return true;
  }

  async function clickByXPath(xpath){
    const el = await smartScrollSearch(()=> $x(xpath));
    if(!el){ console.warn('No encontrado para click tras scroll:', xpath); return false; }
    try{ el.click(); }catch(e){ try{ el.dispatchEvent(new MouseEvent('click',{bubbles:true})); }catch(_){} }
    return true;
  }

  // standard XPaths (can be adjusted)
  const X = {
    col1: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[1]/app-dynamic-input/div/input',
    col2: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[4]/app-dynamic-input/div/input',
    col3: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[5]/app-dynamic-input/div[1]/input',
    col4: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[7]/app-dynamic-input/div/input',
    col5_address: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[16]/app-address-input/div/div/div/input',
    col6_a: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[26]/app-dynamic-input/div/input',
    col6_b: '/html/body/app-root/mat-drawer-container/mat-drawer-content/div/div/mat-sidenav-container/mat-sidenav-content/app-order-edit/div/div[2]/div/app-crud-incidence/app-dialog-content/mat-dialog-content/div/div/form/div[4]/app-custom-form/form/div/div[28]/app-dynamic-input/div/input',
    radio_si_13: '//*[@id="mat-radio-13-input"]',
    radio_si_16: '//*[@id="mat-radio-16-input"]',
    radio_g1_18: '//*[@id="mat-radio-18-input"]',
    radio_so_23: '//*[@id="mat-radio-23-input"]',
    radio_si_26: '//*[@id="mat-radio-26-input"]',
    radio_def_sec: '//*[@id="mat-radio-29-input"]',
    radio_en_servicio: '//*[@id="mat-radio-32-input"]'
  };

  const EXTRA_INPUTS = [
    'div.form-group:nth-child(71) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(72) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(73) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(75) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(77) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(78) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(79) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)',
    'div.form-group:nth-child(81) > app-dynamic-input:nth-child(2) > div:nth-child(1) > input:nth-child(1)'
  ];

  // setup the injected sidebar UI event handling and messaging
  function setupSidebar(){
    const root = document.getElementById('odis-autofill-sidebar-root');
    if(!root) return;
    const sidebar = root.querySelector('#odis-sidebar');
    const btnClose = root.querySelector('#odis-close');
    const btnInit = root.querySelector('#odis-init');
    const btnNext = root.querySelector('#odis-next');
    const btnAbort = root.querySelector('#odis-abort');
    const textarea = root.querySelector('#odis-rows');
    const chkClose = root.querySelector('#odis-close-tab');
    const closeDelayInput = root.querySelector('#odis-close-delay');
    const statusText = root.querySelector('#odis-status-text');
    const logEl = root.querySelector('#odis-log');

    if(root.dataset.bound === '1'){
      sidebar.classList.remove('odis-hidden');
      return;
    }
    root.dataset.bound = '1';

    sidebar.classList.remove('odis-hidden');

    function log(msg){
      const p = document.createElement('div');
      p.textContent = `${(new Date()).toLocaleTimeString()} — ${msg}`;
      logEl.prepend(p);
    }

    btnClose.addEventListener('click', ()=>{ sidebar.classList.add('odis-hidden'); });

    btnInit.addEventListener('click', ()=>{
      const raw = textarea.value.trim();
      if(!raw){ alert('Pega las filas primero'); return; }
      const closeTab = !!chkClose.checked;
      const delayMs = Math.max(0, Number(closeDelayInput.value) || 60) * 1000;
      chrome.runtime.sendMessage({ action:'init', raw, closeTab, closeDelayMs: delayMs }, (resp) => {
        statusText.textContent = `Cola cargada (${raw.split('\n').length})`;
        btnNext.disabled = false;
        log('Cola cargada');
      });
    });

    btnNext.addEventListener('click', ()=>{
      chrome.runtime.sendMessage({ action:'processNext' }, (resp) => {
        if(resp && resp.ok){
          statusText.textContent = 'Procesando...';
          btnNext.disabled = true;
          log('Procesando siguiente fila...');
        } else {
          log('No fue posible procesar: ' + (resp && resp.message ? resp.message : JSON.stringify(resp)));
        }
      });
    });

    btnAbort.addEventListener('click', ()=>{
      chrome.runtime.sendMessage({ action:'abort' }, ()=>{
        statusText.textContent = 'Abortado';
        btnNext.disabled = true;
        log('Abort solicitado');
      });
    });

    // listen messages from background
    chrome.runtime.onMessage.addListener((msg) => {
      if(msg.type === 'status'){
        statusText.textContent = msg.text || '';
        if(msg.enableNext) btnNext.disabled = false;
        if(msg.log) log(msg.log);
      }
    });
  }

  // Fill row handler (same logic as earlier content script)
  chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
    if(msg.action === 'ping'){
      sendResp({ action:'pong' });
      return true;
    }
    if(msg.action === 'fillRow' && Array.isArray(msg.row)){
      (async ()=>{
        const row = msg.row;
        try{
          const [, empresa, numCliente, nombreCliente, telefono, latlng, codigo] = row;
          // wait a bit for DOM
          await sleep(600);
          try{ await setValueByXPath(X.col1, empresa || ''); } catch(e){ console.warn('set col1', e); }
          try{ await setValueByXPath(X.col2, numCliente || ''); } catch(e){}
          try{ await setValueByXPath(X.col3, nombreCliente || ''); } catch(e){}
          try{ await setValueByXPath(X.col4, telefono || ''); } catch(e){}
          try{ await setValueByXPath(X.col5_address, latlng || ''); } catch(e){}
          try{ await setValueByXPath(X.col6_a, codigo || ''); } catch(e){}
          try{ await setValueByXPath(X.col6_b, codigo || ''); } catch(e){}

          // clicks
          try{ await clickByXPath(X.radio_si_13); } catch(e){}
          try{ await clickByXPath(X.radio_si_16); } catch(e){}
          try{ await clickByXPath(X.radio_g1_18); } catch(e){}
          try{ await clickByXPath(X.radio_so_23); } catch(e){}
          try{ await clickByXPath(X.radio_si_26); } catch(e){}
          try{ await clickByXPath(X.radio_def_sec); } catch(e){}
          try{ await clickByXPath(X.radio_en_servicio); } catch(e){}

          // extras
          for(let i=0;i<EXTRA_INPUTS.length;i++){
            const sel = EXTRA_INPUTS[i];
            const value = (i === EXTRA_INPUTS.length-1) ? 'Pintar de amarillo' : (i===0? '1' : (i===1?'ES':'')); 
            try{ await setValueBySelector(sel, value); } catch(e){ /*ignore*/ }
          }

          // tecnico fields by placeholder/name
          try{
            const tName = await smartScrollSearch(()=> [...document.querySelectorAll('input,textarea')].find(e => (e.placeholder||'').toLowerCase().includes('técnico') || (e.name||'').toLowerCase().includes('nombretecnico')), 4000);
            if(tName){ tName.value = 'ALDAIR ISAAC SIERRA LOA'; dispatchEvents(tName); }
          }catch(e){}
          try{
            const tEmp = await smartScrollSearch(()=> [...document.querySelectorAll('input,textarea')].find(e => (e.placeholder||'').toLowerCase().includes('empresa') || (e.name||'').toLowerCase().includes('empresatecnico')), 4000);
            if(tEmp){ tEmp.value = 'OCA GLOBAL'; dispatchEvents(tEmp); }
          }catch(e){}
          try{
            const tNum = await smartScrollSearch(()=> [...document.querySelectorAll('input,textarea')].find(e => (e.placeholder||'').toLowerCase().includes('número') || (e.name||'').toLowerCase().includes('numtecnico')), 4000);
            if(tNum){ tNum.value = '7236'; dispatchEvents(tNum); }
          }catch(e){}

          await sleep(300);
          try{ chrome.runtime.sendMessage({ action:'contentDone' }); } catch(e){}
        } catch(err){
          console.error('Error fillRow', err);
          try{ chrome.runtime.sendMessage({ action:'contentDone', error:String(err) }); }catch(e){}
        }
      })();
      return true;
    }
  });

})();