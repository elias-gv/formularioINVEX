(function () {
  const form = document.getElementById('quote-form');
  const output = document.getElementById('quote-output');
  const generateButton = document.getElementById('generate-button');
  const printButton = document.getElementById('print-button');
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
  const PRINT_READY_CLASS = 'quote-output--ready';
  const PRINT_MODE_CLASS = 'is-printing';
  const LOGO_SRC = 'assets/logo-sisnova.svg';

  const priceCatalog = [
    {
      field: 'adminCount',
      label: 'Administradores (todos los accesos)',
      priceField: 'adminPrice',
      defaultPrice: 50,
    },
    {
      field: 'salesCount',
      label: 'Ventas / Cajas',
      priceField: 'salesPrice',
      defaultPrice: 20,
    },
    {
      field: 'inventoryCount',
      label: 'Inventarios',
      priceField: 'inventoryPrice',
      defaultPrice: 30,
    },
    {
      field: 'otherCount',
      label: 'Otros módulos individuales',
      priceField: 'otherPrice',
      defaultPrice: 30,
    },
    {
      field: 'comboCount',
      label: 'Usuarios combinados (hasta 3 módulos)',
      priceField: 'comboPrice',
      defaultPrice: 30,
    },
  ];

  function parseNumber(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrency(value) {
    return `${currencyFormatter.format(value)} USD`;
  }

  function parsePrice(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    const normalized = String(value).replace(/,/g, '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function getUnitPrice(formData, entry) {
    return parsePrice(formData.get(entry.priceField), entry.defaultPrice);
  }

  function updatePriceHelpers() {
    priceCatalog.forEach((entry) => {
      const helper = document.querySelector(`[data-price-helper="${entry.field}"]`);
      if (!helper) {
        return;
      }
      const input = document.getElementById(entry.priceField);
      const price = parsePrice(input ? input.value : '', entry.defaultPrice);
      helper.textContent = `Precio unitario: ${formatCurrency(price)}`;
    });
  }

  function breakLines(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function computeImplementationCost(employees) {
    if (employees <= 0) {
      return {
        label: 'Sin colaboradores registrados',
        cost: 0,
        detail: 'Actualiza el número de colaboradores para calcular el estimado de implementación.',
      };
    }

    if (employees <= 5) {
      return {
        label: 'Empresas de 1 a 5 colaboradores',
        cost: 1000,
      };
    }

    if (employees <= 15) {
      return {
        label: 'Empresas de 6 a 15 colaboradores',
        cost: 2000,
      };
    }

    if (employees <= 20) {
      return {
        label: 'Empresas de 16 a 20 colaboradores',
        cost: 3000,
        detail: 'Validar con el equipo de implementación si se requiere un ajuste adicional.',
      };
    }

    return {
      label: 'Más de 20 colaboradores',
      cost: null,
      detail:
        'Para este volumen de colaboradores necesitamos preparar una propuesta formal. Ponte en contacto con un asesor para continuar.',
    };
  }

  function collectMonthlyItems(formData) {
    const items = [];

    priceCatalog.forEach((entry) => {
      const count = parseNumber(formData.get(entry.field));
      if (count > 0) {
        const unitPrice = getUnitPrice(formData, entry);
        const subtotal = count * unitPrice;
        items.push({
          label: entry.label,
          count,
          unitPrice,
          subtotal,
        });
      }
    });

    return items;
  }

  function buildMetadata({ companyName, contactName, contactEmail, goLive, notes }) {
    const metadata = [];

    if (companyName) {
      metadata.push(`<span><strong>Empresa:</strong> ${escapeHtml(companyName)}</span>`);
    }

    if (contactName) {
      metadata.push(`<span><strong>Contacto:</strong> ${escapeHtml(contactName)}</span>`);
    }

    if (contactEmail) {
      metadata.push(`<span><strong>Email:</strong> ${escapeHtml(contactEmail)}</span>`);
    }

    if (goLive) {
      const date = new Date(goLive + 'T00:00:00');
      if (!Number.isNaN(date.getTime())) {
        const formatted = date.toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        metadata.push(`<span><strong>Arranque estimado:</strong> ${formatted}</span>`);
      }
    }

    if (notes) {
      metadata.push(`<span><strong>Resumen:</strong> ${breakLines(notes)}</span>`);
    }

    if (metadata.length === 0) {
      return '';
    }

    return `<div class="quote-metadata">${metadata.join('')}</div>`;
  }

  function renderQuote() {
    document.body.classList.remove(PRINT_MODE_CLASS);
    const formData = new FormData(form);

    const companyName = (formData.get('companyName') || '').trim();
    const contactName = (formData.get('contactName') || '').trim();
    const contactEmail = (formData.get('contactEmail') || '').trim();
    const goLive = (formData.get('goLive') || '').trim();
    const projectNotes = (formData.get('notes') || '').trim();
    const introText = (formData.get('introText') || '').trim();
    const notesText = (formData.get('notesText') || '').trim();
    const disclaimerText = (formData.get('disclaimerText') || '').trim();
    const headingText = (formData.get('quoteTitle') || '').trim();
    const employees = parseNumber(formData.get('employees'));

    const implementation = computeImplementationCost(employees);
    const monthlyItems = collectMonthlyItems(formData);
    const monthlyTotal = monthlyItems.reduce((sum, item) => sum + item.subtotal, 0);

    const headingSuffix = companyName || 'tu proyecto';
    const headingBase = headingText || 'Estimado de inversión para {{empresa}}';
    const headingWithCompany = headingBase.includes('{{empresa}}')
      ? headingBase.replace(/{{empresa}}/gi, headingSuffix)
      : `${headingBase} ${headingSuffix}`.trim();
    const heading = escapeHtml(headingWithCompany);

    let implementationBlock = '';

    if (implementation.cost === null) {
      implementationBlock = `
        <div class="quote-alert" role="status">
          <div>
            <strong>Requiere cotización personalizada</strong>
            <span>${breakLines(implementation.detail)}</span>
          </div>
        </div>
      `;
    } else {
      const detailText = implementation.detail
        ? `<p class="field-helper" style="margin-top: 0.5rem;">${breakLines(implementation.detail)}</p>`
        : '';

      implementationBlock = `
        <div class="summary-item">
          <span>${escapeHtml(implementation.label)}</span>
          <strong>${formatCurrency(implementation.cost)}</strong>
        </div>
        ${detailText}
      `;
    }

    let monthlyBlock = '';

    if (monthlyItems.length > 0) {
      const tableRows = monthlyItems
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.label)}</td>
              <td>${item.count}</td>
              <td>${formatCurrency(item.unitPrice)}</td>
              <td>${formatCurrency(item.subtotal)}</td>
            </tr>
          `,
        )
        .join('');

      monthlyBlock = `
        <div class="quote-section">
          <h4>Detalle de licencias mensuales</h4>
          <table class="quote-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Cant.</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="quote-total">
            <span>Total mensual estimado</span>
            <span>${formatCurrency(monthlyTotal)}</span>
          </div>
        </div>
      `;
    } else {
      monthlyBlock = `
        <div class="quote-section">
          <h4>Detalle de licencias mensuales</h4>
          <p>No se han agregado licencias. Actualiza los campos del formulario para calcular el costo mensual.</p>
        </div>
      `;
    }

    let combinedSummary = '';
    if (implementation.cost !== null || monthlyTotal > 0) {
      const items = [];
      if (implementation.cost !== null) {
        items.push(
          `<div class="summary-item"><span>Implementación</span><strong>${formatCurrency(
            implementation.cost,
          )}</strong></div>`,
        );
      }
      if (monthlyTotal > 0) {
        items.push(
          `<div class="summary-item"><span>Inversión mensual</span><strong>${formatCurrency(
            monthlyTotal,
          )}</strong></div>`,
        );
      }
      if (implementation.cost !== null && monthlyTotal > 0) {
        items.push(
          `<div class="summary-item"><span>Estimado primer mes</span><strong>${formatCurrency(
            implementation.cost + monthlyTotal,
          )}</strong></div>`,
        );
      }

      combinedSummary = `<div class="summary-box">${items.join('')}</div>`;
    }

    const disclaimerBlock = disclaimerText
      ? `<div class="quote-section"><div class="quote-alert"><div><strong>Aviso importante</strong><span>${breakLines(
          disclaimerText,
        )}</span></div></div></div>`
      : '';

    const introBlock = introText
      ? `<p>${breakLines(introText)}</p>`
      : '';

    const notesBlock = notesText
      ? `<div class="quote-section"><h4>Notas adicionales</h4><p>${breakLines(notesText)}</p></div>`
      : '';

    const generationDate = new Date();
    const formattedGenerationDate = generationDate.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    output.innerHTML = `
      <header class="quote-header">
        <div class="quote-brand">
          <img src="${LOGO_SRC}" alt="Logo de SISNOVA" class="quote-brand__logo" />
          <div class="quote-brand__content">
            <h3>${heading}</h3>
            <p class="quote-generated-date">Estimado generado ${formattedGenerationDate}</p>
          </div>
        </div>
      </header>
      ${buildMetadata({ companyName, contactName, contactEmail, goLive, notes: projectNotes })}
      <div class="quote-section">
        ${introBlock}
        <h4>Implementación</h4>
        ${implementationBlock}
      </div>
      ${monthlyBlock}
      ${combinedSummary}
      ${notesBlock}
      ${disclaimerBlock}
    `;

    output.classList.add(PRINT_READY_CLASS);
  }

  generateButton.addEventListener('click', renderQuote);

  function handlePrint() {
    if (!output.classList.contains(PRINT_READY_CLASS)) {
      alert('Genera un estimado antes de imprimir o exportar.');
      return;
    }

    document.body.classList.add(PRINT_MODE_CLASS);

    const cleanup = () => {
      document.body.classList.remove(PRINT_MODE_CLASS);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    window.requestAnimationFrame(() => {
      window.print();
    });
  }

  if (printButton) {
    printButton.addEventListener('click', handlePrint);
  }

  priceCatalog.forEach((entry) => {
    const input = document.getElementById(entry.priceField);
    if (input) {
      input.addEventListener('input', () => {
        updatePriceHelpers();
      });
    }
  });

  updatePriceHelpers();

  form.addEventListener('reset', () => {
    setTimeout(() => {
      output.innerHTML = `
        <div class="quote-placeholder">
          <p>Completa la información y haz clic en “Generar estimado” para ver el detalle aquí.</p>
        </div>
      `;
      output.classList.remove(PRINT_READY_CLASS);
      document.body.classList.remove(PRINT_MODE_CLASS);
      updatePriceHelpers();
    }, 0);
  });
})();
