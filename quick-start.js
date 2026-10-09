const quickStartModal=document.querySelector('#quick-start-modal');
const quickIntro=quickStartModal.querySelector('.quick-guide-intro');
const quickGrid=quickStartModal.querySelector('.quick-guide-grid');
const quickFooter=quickStartModal.querySelector('.quick-guide-footer');
const legacyIntro=quickIntro.textContent,legacyFooter=quickFooter.textContent;
function renderQuickStart(){
  const v2=globalThis.IronDustBrowserV2?.mode==='ready';
  quickGrid.style.display=v2?'none':'';
  quickIntro.textContent=v2?GoblinLanguage.t('v2.quick.intro'):legacyIntro;
  quickFooter.textContent=v2?GoblinLanguage.t('v2.quick.steps'):legacyFooter;
}
function openQuickStart(){renderQuickStart();quickStartModal.classList.remove('hidden');}
function closeQuickStart(){quickStartModal.classList.add('hidden');}
document.querySelector('#quick-start-open').onclick=openQuickStart;
document.querySelector('#quick-start-close').onclick=closeQuickStart;
quickStartModal.addEventListener('click',event=>{if(event.target===quickStartModal)closeQuickStart()});
document.addEventListener('keydown',event=>{if(!quickStartModal.classList.contains('hidden')&&event.key==='Escape')closeQuickStart()});
globalThis.addEventListener?.('goblin-language-change',()=>{if(!quickStartModal.classList.contains('hidden'))renderQuickStart()});
