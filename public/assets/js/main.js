function setFormResult(form, type, message) {
  const result = form.querySelector('.form-result');
  if (!result) return;
  result.dataset.type = type;
  result.textContent = message;
}

function initMobileMenu() {
  const button = document.querySelector('[data-mobile-menu-button]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (!button || !menu) return;

  function closeMenu() {
    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    menu.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
  }

  button.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
      return;
    }
    openMenu();
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) closeMenu();
  });
}

function ensureAntiBotFields(form) {
  let honeypot = form.querySelector('[name="website"]');
  if (!honeypot) {
    honeypot = document.createElement('input');
    honeypot.type = 'text';
    honeypot.name = 'website';
    honeypot.autocomplete = 'off';
    honeypot.tabIndex = -1;
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.style.position = 'absolute';
    honeypot.style.left = '-9999px';
    form.appendChild(honeypot);
  }

  let startedAt = form.querySelector('[name="formStartedAt"]');
  if (!startedAt) {
    startedAt = document.createElement('input');
    startedAt.type = 'hidden';
    startedAt.name = 'formStartedAt';
    form.appendChild(startedAt);
  }

  if (!form.dataset.formStartedAt) {
    form.dataset.formStartedAt = String(Date.now());
  }

  startedAt.value = form.dataset.formStartedAt;
}

function syncSelectedFileLabel(form) {
  const fileInput = form.querySelector('input[type="file"][name="cv"]');
  if (!fileInput) return;

  const feedbackTarget = form.querySelector('[data-file-feedback]');
  if (!feedbackTarget) return;

  const fileName = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : 'Ningun archivo seleccionado.';
  feedbackTarget.textContent = fileName;
}

function emailIsValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateForm(form) {
  const type = form.dataset.formType;
  const fullName = form.querySelector('[name="fullName"]')?.value?.trim() || '';
  const email = form.querySelector('[name="email"]')?.value?.trim() || '';

  if (!fullName) return 'El nombre completo es obligatorio.';
  if (!emailIsValid(email)) return 'Ingresa un email valido.';

  if (type === 'job') {
    const phone = form.querySelector('[name="phone"]')?.value?.trim() || '';
    if (!phone) return 'El telefono es obligatorio.';

    const cv = form.querySelector('[name="cv"]');
    if (!cv || !cv.files || !cv.files[0]) return 'Adjunta tu CV antes de enviar.';
  }

  if (type === 'quote') {
    const message = form.querySelector('[name="message"]')?.value?.trim() || '';
    if (!message) return 'La consulta es obligatoria.';
  }

  return null;
}

async function sendForm(form) {
  const type = form.dataset.formType;
  const endpoint = `/api/forms/${type}`;
  ensureAntiBotFields(form);
  const payload = new FormData(form);
  const honeypotValue = form.querySelector('[name="website"]')?.value || '';
  const startedAtValue = form.dataset.formStartedAt || form.querySelector('[name="formStartedAt"]')?.value || '';

  payload.set('website', honeypotValue);
  payload.set('formStartedAt', startedAtValue);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: payload,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudo enviar el formulario.');
  return data;
}

document.querySelectorAll('.js-form').forEach((form) => {
  form.setAttribute('novalidate', 'novalidate');
  ensureAntiBotFields(form);
  syncSelectedFileLabel(form);

  const fileInput = form.querySelector('input[type="file"][name="cv"]');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      syncSelectedFileLabel(form);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const error = validateForm(form);
    if (error) {
      setFormResult(form, 'error', error);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    setFormResult(form, 'success', '');

    try {
      await sendForm(form);
      form.reset();
      delete form.dataset.formStartedAt;
      ensureAntiBotFields(form);
      syncSelectedFileLabel(form);
      setFormResult(form, 'success', 'Formulario enviado correctamente. Te contactaremos pronto.');
    } catch (err) {
      setFormResult(form, 'error', err.message || 'Error enviando el formulario.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });
});

initMobileMenu();
