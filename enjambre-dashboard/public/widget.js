// ============================================
// BLACKWOLF ENJAMBRE - FORM WIDGET
// ============================================
// Pega esto en cualquier landing para capturar leads:
//
//   <script src="https://api.tudominio.com/widget.js"
//           data-producto="Mi Curso"
//           data-landing="mi-landing">
//   </script>
//   <div id="enjambre-form"></div>
//
// O usa la función directamente:
//   EnjambreForm.init({ container: '#mi-div', producto: 'Mi Curso' })

(function () {
  const WEBHOOK_URL =
    document.currentScript?.getAttribute('data-webhook') ||
    'https://forms.tudominio.com/webhook';

  const config = {
    producto: document.currentScript?.getAttribute('data-producto') || '',
    landing: document.currentScript?.getAttribute('data-landing') || window.location.hostname,
    container: document.currentScript?.getAttribute('data-container') || '#enjambre-form',
    theme: document.currentScript?.getAttribute('data-theme') || 'dark',
    buttonText: document.currentScript?.getAttribute('data-button') || 'Enviar',
    successText: document.currentScript?.getAttribute('data-success') || 'Recibido. Te contactaremos pronto.',
  };

  // Capturar UTMs
  function getUtms() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
    };
  }

  // Estilos
  const styles = `
    .enjambre-form { font-family: 'Inter', -apple-system, sans-serif; max-width: 400px; }
    .enjambre-form input {
      width: 100%; padding: 12px 16px; margin-bottom: 10px;
      border: 1px solid ${config.theme === 'dark' ? '#333' : '#ddd'};
      border-radius: 8px; font-size: 14px;
      background: ${config.theme === 'dark' ? '#1a1a2e' : '#fff'};
      color: ${config.theme === 'dark' ? '#e8e8f0' : '#333'};
      outline: none; transition: border-color 0.2s;
    }
    .enjambre-form input:focus { border-color: #00d4ff; }
    .enjambre-form button {
      width: 100%; padding: 14px; border: none; border-radius: 8px;
      background: #00d4ff; color: #0a0a0f; font-size: 16px;
      font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .enjambre-form button:hover { opacity: 0.85; }
    .enjambre-form button:disabled { opacity: 0.5; cursor: not-allowed; }
    .enjambre-form .enjambre-success {
      text-align: center; padding: 20px; color: #00d68f;
      font-size: 16px; font-weight: 500;
    }
    .enjambre-form .enjambre-error {
      color: #ff4466; font-size: 13px; margin-bottom: 10px;
    }
  `;

  function init(overrides = {}) {
    const cfg = { ...config, ...overrides };
    const container = document.querySelector(cfg.container);
    if (!container) return;

    // Inyectar estilos
    if (!document.getElementById('enjambre-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'enjambre-styles';
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }

    container.innerHTML = `
      <form class="enjambre-form" id="enjambre-form-el">
        <input type="text" name="nombre" placeholder="Tu nombre" required />
        <input type="email" name="email" placeholder="Tu email" required />
        <input type="tel" name="telefono" placeholder="Tu WhatsApp (opcional)" />
        <div class="enjambre-error" id="enjambre-error" style="display:none"></div>
        <button type="submit">${cfg.buttonText}</button>
      </form>
    `;

    const form = document.getElementById('enjambre-form-el');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      const errorEl = document.getElementById('enjambre-error');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      errorEl.style.display = 'none';

      const data = {
        nombre: form.nombre.value,
        email: form.email.value,
        telefono: form.telefono.value,
        producto: cfg.producto,
        landing: cfg.landing,
        ...getUtms(),
      };

      try {
        const res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error('Error al enviar');

        container.innerHTML = `<div class="enjambre-form"><div class="enjambre-success">${cfg.successText}</div></div>`;
      } catch (err) {
        errorEl.textContent = 'Error al enviar. Inténtalo de nuevo.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = cfg.buttonText;
      }
    });
  }

  // Auto-init si hay container
  if (document.querySelector(config.container)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => init());
    } else {
      init();
    }
  }

  // API global
  window.EnjambreForm = { init };
})();
