const quickStartModal=document.querySelector('#quick-start-modal');
function openQuickStart(){quickStartModal.classList.remove('hidden');}
function closeQuickStart(){quickStartModal.classList.add('hidden');}
document.querySelector('#quick-start-open').onclick=openQuickStart;
document.querySelector('#quick-start-close').onclick=closeQuickStart;
quickStartModal.addEventListener('click',event=>{if(event.target===quickStartModal)closeQuickStart()});
document.addEventListener('keydown',event=>{if(!quickStartModal.classList.contains('hidden')&&event.key==='Escape')closeQuickStart()});