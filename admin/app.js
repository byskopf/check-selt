(function () {
  'use strict';

  var config = window.CHECK_ADMIN_CONFIG;
  if (!config || !config.version || !config.appUrl) {
    throw new Error('Configuração da Central ausente.');
  }

  var deferredInstallPrompt = null;
  var serviceWorkerRegistration = null;
  var reloadAfterUpdate = false;
  var launchSlowTimer = null;
  var userAgent = navigator.userAgent || '';
  var isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  var isIOS = /iphone|ipad|ipod/i.test(userAgent) || isIPadOS;
  var isAndroid = /android/i.test(userAgent);
  var prefersReducedMotion = Boolean(
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  var isStandalone = Boolean(
    (window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches
    )) || navigator.standalone === true
  );

  var installButton = document.getElementById('installButton');
  var installButtonText = document.getElementById('installButtonText');
  var openButton = document.getElementById('openButton');
  var statusText = document.getElementById('statusText');
  var hint = document.getElementById('hint');
  var toast = document.getElementById('toast');
  var installDialog = document.getElementById('installDialog');
  var installInstructions = document.getElementById('installInstructions');
  var updateBanner = document.getElementById('updateBanner');
  var updateText = document.getElementById('updateText');
  var updateButton = document.getElementById('updateButton');
  var launchOverlay = document.getElementById('launchOverlay');
  var launchStatus = document.getElementById('launchStatus');
  var launchLoader = document.getElementById('launchLoader');
  var launchRetry = document.getElementById('launchRetry');

  document.documentElement.setAttribute('data-pwa-version', config.version);
  openButton.href = config.appUrl;

  function setOnlineState() {
    var offline = navigator.onLine === false;
    document.body.classList.toggle('offline', offline);
    statusText.textContent = offline ? 'Offline' : 'Online';

    if (offline) {
      hint.textContent = 'Sem conexão. O portal continua disponível; reconecte para abrir a Central.';
    } else if (isStandalone) {
      hint.textContent = 'Central instalada neste aparelho.';
    } else if (isAndroid) {
      hint.textContent = 'Toque para instalar. Se necessário, mostramos os 3 passos.';
    } else {
      hint.textContent = 'Instale para abrir pelo ícone do celular ou computador.';
    }
  }

  function resetLaunchOverlay() {
    if (launchSlowTimer) {
      window.clearTimeout(launchSlowTimer);
      launchSlowTimer = null;
    }
    launchStatus.textContent = 'Abrindo seu ambiente…';
    launchLoader.hidden = false;
    launchRetry.hidden = true;
    launchRetry.disabled = false;
    launchRetry.textContent = 'Tentar novamente';
  }

  function hideLaunchOverlay() {
    if (launchSlowTimer) {
      window.clearTimeout(launchSlowTimer);
      launchSlowTimer = null;
    }
    launchOverlay.classList.remove('show');
    launchOverlay.hidden = true;
    resetLaunchOverlay();
  }

  function showLaunchOverlay() {
    resetLaunchOverlay();
    launchOverlay.hidden = false;
    window.requestAnimationFrame(function () {
      launchOverlay.classList.add('show');
    });

    launchSlowTimer = window.setTimeout(function () {
      if (document.visibilityState === 'visible') {
        launchStatus.textContent = 'Está demorando mais que o normal.';
        launchLoader.hidden = true;
        launchRetry.hidden = false;
      }
    }, 8000);
  }

  function navigateToCentral(replaceHistory) {
    if (replaceHistory) window.location.replace(config.appUrl);
    else window.location.assign(config.appUrl);
  }

  function openCentral(replaceHistory) {
    showLaunchOverlay();
    // Start the Apps Script navigation immediately; do not spend 180 ms on a
    // client-side animation before the network request begins.
    navigateToCentral(replaceHistory);
  }

  function instructionMarkup() {
    if (isIOS) {
      return '<p>No Safari, siga estes passos:</p>' +
        '<ol class="install-steps">' +
        '<li>Toque no botão Compartilhar.</li>' +
        '<li>Escolha “Adicionar à Tela de Início”.</li>' +
        '<li>Toque em “Adicionar”.</li>' +
        '</ol>';
    }

    if (isAndroid) {
      return '<p>No Chrome do Android:</p>' +
        '<ol class="install-steps">' +
        '<li>Toque nos três pontos ⋮ no canto superior.</li>' +
        '<li>Escolha “Instalar app” ou “Adicionar à tela inicial”.</li>' +
        '<li>Toque em “Instalar” para criar o ícone.</li>' +
        '</ol>';
    }

    return '<p>No computador:</p>' +
      '<ol class="install-steps">' +
      '<li>Procure o ícone de instalação na barra de endereço.</li>' +
      '<li>Escolha “Instalar CHECK Admin”.</li>' +
      '<li>Confirme a instalação.</li>' +
      '</ol>';
  }

  function showInstallInstructions() {
    installInstructions.innerHTML = instructionMarkup();
    if (typeof installDialog.showModal === 'function') installDialog.showModal();
    else installDialog.setAttribute('open', '');
  }

  function showUpdate(message) {
    updateText.textContent = message || 'Nova versão da Central disponível.';
    updateButton.disabled = false;
    updateButton.textContent = 'Atualizar';
    updateBanner.hidden = false;
  }

  function watchServiceWorker(registration) {
    serviceWorkerRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) showUpdate();

    registration.addEventListener('updatefound', function () {
      var worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', function () {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdate();
        }
      });
    });

    registration.update().catch(function () {
      // A Central continua funcionando se a verificação falhar.
    });
  }

  window.addEventListener('online', setOnlineState);
  window.addEventListener('offline', setOnlineState);
  setOnlineState();

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButtonText.textContent = 'Instalar Central';
    hint.textContent = 'Toque no botão e confirme a instalação do ícone.';
  });

  installButton.addEventListener('click', async function () {
    if (!deferredInstallPrompt) {
      showInstallInstructions();
      return;
    }

    installButton.disabled = true;
    installButtonText.textContent = 'Abrindo instalação…';

    try {
      await deferredInstallPrompt.prompt();
      var choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;

      if (choice && choice.outcome === 'accepted') {
        installButtonText.textContent = 'Instalação confirmada';
        hint.textContent = 'Abra a Central pelo novo ícone na tela inicial.';
      } else {
        installButtonText.textContent = 'Instalar Central';
        hint.textContent = 'A instalação foi cancelada. Você pode tentar novamente.';
      }
    } catch (error) {
      installButtonText.textContent = 'Como instalar';
      showInstallInstructions();
    } finally {
      installButton.disabled = false;
    }
  });

  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    installButton.hidden = true;
    hint.textContent = 'Central instalada neste aparelho.';
  });

  openButton.addEventListener('click', function (event) {
    if (navigator.onLine === false) {
      event.preventDefault();
      hint.textContent = 'Sem conexão. Reconecte para abrir a Central.';
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) return;
    showLaunchOverlay();
    // Keep native link navigation so the request starts without a JS delay.
  });

  launchRetry.addEventListener('click', function () {
    launchRetry.disabled = true;
    launchRetry.textContent = 'Tentando novamente…';
    launchStatus.textContent = 'Tentando abrir a Central novamente…';
    launchLoader.hidden = false;
    navigateToCentral(true);
  });

  updateButton.addEventListener('click', function () {
    updateButton.disabled = true;
    updateButton.textContent = 'Atualizando…';
    if (serviceWorkerRegistration && serviceWorkerRegistration.waiting) {
      reloadAfterUpdate = true;
      serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }
    window.location.reload();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloadAfterUpdate) {
        window.location.reload();
        return;
      }
      showUpdate('Nova versão pronta para usar.');
    });

    window.addEventListener('load', function () {
      var dir = location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1) || '/';
      navigator.serviceWorker.register(dir + 'sw.js', { scope: dir, updateViaCache: 'none' })
        .then(watchServiceWorker)
        .catch(function () {
          // O portal ainda pode abrir a Central sem o modo instalável.
        });
    });
  }

  function refreshPortalState() {
    hideLaunchOverlay();
    setOnlineState();
    if (serviceWorkerRegistration) {
      serviceWorkerRegistration.update().catch(function () {});
    }
  }

  window.addEventListener('pageshow', refreshPortalState);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshPortalState();
  });

  /* Trava de puxar para atualizar no topo, mantendo a rolagem normal. */
  var startY = 0;
  document.addEventListener('touchstart', function (event) {
    if (event.touches && event.touches.length === 1) startY = event.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchmove', function (event) {
    if (!event.touches || event.touches.length !== 1) return;
    if (window.scrollY <= 0 && event.touches[0].clientY > startY) event.preventDefault();
  }, { passive: false });

  /* Primeiro voltar é consumido; o segundo, em até 2 segundos, permite sair. */
  var armed = false;
  var timer = null;
  history.replaceState({ checkAdminRoot: true }, '', location.href);
  history.pushState({ checkAdminGuard: true }, '', location.href);
  window.addEventListener('popstate', function () {
    if (!armed) {
      armed = true;
      history.pushState({ checkAdminGuard: true }, '', location.href);
      toast.classList.add('show');
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        armed = false;
        toast.classList.remove('show');
      }, 2000);
      return;
    }
    window.clearTimeout(timer);
    toast.classList.remove('show');
    history.back();
  });

  if (isStandalone) {
    installButton.hidden = true;
    if (navigator.onLine !== false) {
      openCentral(true);
    }
  } else if (isIOS) {
    installButtonText.textContent = isIPadOS || /ipad/i.test(userAgent)
      ? 'Como instalar no iPad'
      : 'Como instalar no iPhone';
  } else if (isAndroid) {
    installButtonText.textContent = 'Instalar Central';
  }
}());
