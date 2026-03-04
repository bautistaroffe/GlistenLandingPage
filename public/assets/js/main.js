function setFormResult(form, type, message) {
  const result = form.querySelector('.form-result');
  if (!result) return;
  result.dataset.type = type;
  result.textContent = message;
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
  const payload = new FormData(form);

  const response = await fetch(endpoint, {
    method: 'POST',
    body: payload,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudo enviar el formulario.');
  return data;
}

document.querySelectorAll('.js-form').forEach((form) => {
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
