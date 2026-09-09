(function(){
'use strict';
var c=window.CHECK_ADMIN_CONFIG;if(!c||!c.version||!c.appUrl)throw new Error('Configuração da Central ausente.');
var deferred=null,standalone=!!((window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true);
var installButton=document.getElementById('installButton'),openButton=document.getElementById('openButton'),statusText=document.getElementById('statusText'),hint=document.getElementById('hint'),toast=document.getElementById('toast');
openButton.href=c.appUrl;
function setOnline(){var off=navigator.onLine===false;document.body.classList.toggle('offline',off);statusText.textContent=off?'Offline':'Online';hint.textContent=off?'Sem conexão. Reconecte para abrir a Central.':(standalone?'Aplicativo instalado neste aparelho.':'Instale para abrir em tela cheia pelo ícone do celular.');}
window.addEventListener('online',setOnline);window.addEventListener('offline',setOnline);setOnline();
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;installButton.textContent='Instalar aplicativo';});
installButton.addEventListener('click',async function(){if(!deferred){hint.textContent='No Chrome, use o menu ⋮ e escolha “Instalar app” ou “Adicionar à tela inicial”.';return}try{await deferred.prompt();await deferred.userChoice;deferred=null}catch(e){}});
window.addEventListener('appinstalled',function(){installButton.hidden=true;hint.textContent='Aplicativo instalado neste aparelho.';});
openButton.addEventListener('click',function(e){if(navigator.onLine===false){e.preventDefault();hint.textContent='Sem conexão. Reconecte para abrir a Central.';return}});
if('serviceWorker'in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(function(){})})}
/* Trava de puxar para atualizar no topo, mantendo rolagem normal do conteúdo. */
var startY=0;document.addEventListener('touchstart',function(e){if(e.touches&&e.touches.length===1)startY=e.touches[0].clientY},{passive:true});document.addEventListener('touchmove',function(e){if(!e.touches||e.touches.length!==1)return;var y=e.touches[0].clientY;if(window.scrollY<=0&&y>startY)e.preventDefault()},{passive:false});
/* Primeiro voltar é consumido; segundo voltar em até 2 s permite sair. */
var armed=false,timer=null;history.replaceState({checkAdminRoot:true},'',location.href);history.pushState({checkAdminGuard:true},'',location.href);window.addEventListener('popstate',function(){if(!armed){armed=true;history.pushState({checkAdminGuard:true},'',location.href);toast.classList.add('show');clearTimeout(timer);timer=setTimeout(function(){armed=false;toast.classList.remove('show')},2000);return}clearTimeout(timer);toast.classList.remove('show');history.back()});
if(standalone&&navigator.onLine!==false){installButton.hidden=true;setTimeout(function(){location.replace(c.appUrl)},220)}
}());
