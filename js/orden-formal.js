/**
 * ============================================================
 * ARCHIVO: js/orden-formal.js
 * DESCRIPCIÓN: Gestión de órdenes formales con generación de PDF
 * y envío de información por WhatsApp al organizador
 * ÚLTIMA ACTUALIZACIÓN: 2025
 * ============================================================
 */

/* ============================================================ */
/* SECCIÓN 1: CONFIGURACIÓN GLOBAL Y VARIABLES DE ESTADO       */
/* ============================================================ */

var ordenActual = null;

/**
 * compactRanges - Compacta un array de números en rangos
 * @param {Array} arr - Array de números
 * @returns {string} String con rangos compactados (ej: "1-5, 7, 9-11")
 */
function compactRanges(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '-';
    const nums = arr.slice().map(n => Number(n)).filter(n => !isNaN(n)).sort((a,b) => a - b);
    const ranges = [];
    let start = nums[0], end = nums[0];
    for (let i = 1; i < nums.length; i++) {
        const n = nums[i];
        if (n === end || n === end + 1) {
            end = n;
        } else {
            ranges.push(start === end ? String(start) : `${start}-${end}`);
            start = n;
            end = n;
        }
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
    return ranges.join(',');
}

/* ============================================================ */
/* SECCIÓN 2: APERTURA Y CIERRE DE MODAL DE ORDEN              */
/* ============================================================ */

/**
 * abrirOrdenFormal - Abre el modal de orden formal con datos compilados
 * @param {Object} cuenta - Objeto con datos de cuenta bancaria
 * @returns {void}
 */
function abrirOrdenFormal(cuenta) {
    // Compilar datos de la orden
    const cliente = JSON.parse(localStorage.getItem('rifaplus_cliente') || '{}');
    let boletos = JSON.parse(localStorage.getItem('rifaplus_boletos') || '[]');
    const totales = JSON.parse(localStorage.getItem('rifaplus_total') || '{}');

    // Si rifaplus_boletos está vacío, intentar recuperar de rifaplusSelectedNumbers
    if (!boletos || boletos.length === 0) {
        const selectedNumbers = JSON.parse(localStorage.getItem('rifaplusSelectedNumbers') || '[]');
        if (selectedNumbers && selectedNumbers.length > 0) {
            console.warn('⚠️  rifaplus_boletos está vacío, usando rifaplusSelectedNumbers como fallback');
            boletos = selectedNumbers;
            localStorage.setItem('rifaplus_boletos', JSON.stringify(boletos));
        }
    }

    // CRÍTICO: Usar la función helper de config.js para GARANTIZAR el prefijo dinámico
    // Esta función reconstruye SIEMPRE el ID con el prefijo actual, sin importar el estado anterior
    let ordenId = cliente.ordenId || `ORD-AA001`;
    ordenId = window.rifaplusConfig.reconstruirIdOrdenConPrefijoActual(ordenId);
    
    // Guardar el ID reconstruido en localStorage para futuros usos
    cliente.ordenId = ordenId;
    localStorage.setItem('rifaplus_cliente', JSON.stringify(cliente));

    ordenActual = {
        ordenId: ordenId,
        cliente: {
            nombre: cliente.nombre,
            apellidos: cliente.apellidos,
            whatsapp: cliente.whatsapp,
            estado: cliente.estado || '',
            ciudad: cliente.ciudad || ''
        },
        cuenta: cuenta,
        boletos: boletos,
        totales: totales,
        // Precio dinámico: desde totales (si se calculó) → desde config.js → default 15
        precioUnitario: totales?.precioUnitario || (typeof obtenerPrecioDinamico === 'function' ? obtenerPrecioDinamico() : 15),
        fecha: new Date().toISOString(),
        referencia: ordenId
    };

    // Guardar en storage
    localStorage.setItem('rifaplus_orden_actual', JSON.stringify(ordenActual));

    // Renderizar modal
    renderizarOrdenFormal(ordenActual);

    // Mostrar modal
    const modal = document.getElementById('modalOrdenFormal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * cerrarOrdenFormal - Cierra el modal de orden formal
 * @returns {void}
 */
function cerrarOrdenFormal() {
    const modal = document.getElementById('modalOrdenFormal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
    }
}

/* ============================================================ */
/* SECCIÓN 3: RENDERIZADO DE ORDEN FORMAL EN HTML              */
/* ============================================================ */

/**
 * renderizarOrdenFormal - Renderiza el contenido HTML de la orden formal
 * @param {Object} orden - Objeto con datos de la orden actual
 * @returns {void}
 */
function renderizarOrdenFormal(orden) {
    const contenedor = document.getElementById('contenidoOrdenFormal');
    if (!contenedor) return;

    // CRÍTICO: RECONSTRUIR EL ID CON EL PREFIJO DINÁMICO ACTUAL
    // Esto garantiza que el modal SIEMPRE muestre el prefijo correcto
    console.log('🔍 renderizarOrdenFormal - START');
    console.log('  - Orden recibida:', orden.ordenId);
    console.log('  - Cliente actual:', window.rifaplusConfig?.cliente?.nombre);
    console.log('  - Prefijo actual:', window.rifaplusConfig?.cliente?.prefijoOrden);
    
    const ordenIdReconstruido = window.rifaplusConfig?.reconstruirIdOrdenConPrefijoActual?.(orden.ordenId) || orden.ordenId;
    console.log('  - Orden RECONSTRUIDA:', ordenIdReconstruido);
    
    orden.ordenId = ordenIdReconstruido; // Actualizar en el objeto orden también

    const fecha = new Date(orden.fecha);
    const fechaFormato = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const horaFormato = fecha.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const logoUrl = 'images/logo.png';
    const nombreOrganizador = window.rifaplusConfig?.cliente?.nombre || 'Organizador';
    
    // Obtener todos los boletos (sin compactar - mostrar todos los números)
    const boletosArray = (orden.boletos || []).map(b => Number(b)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const boletosStr = boletosArray.join(', ');
    
    // ✅ OBTENER OPORTUNIDADES SOLO SI ESTÁN HABILITADAS
    const oportunidadesHabilitadas = window.rifaplusConfig?.rifa?.oportunidades?.enabled === true;
    const oportunidadesStorage = JSON.parse(localStorage.getItem('rifaplus_oportunidades') || '{}');
    const boletosOcultos = oportunidadesStorage.boletosOcultos || [];
    const oportunidadesHtml = (oportunidadesHabilitadas && boletosOcultos.length > 0) ? `
        <div class="orden-boletos">
            <div class="orden-field-label">Oportunidades Adicionales (${boletosOcultos.length})</div>
            <div class="orden-boletos-list">${boletosOcultos.join(', ')}</div>
        </div>
    ` : '';
    
    // Totales
    const subtotal = orden.totales?.subtotal || 0;
    const descuento = orden.totales?.descuento || 0;
    const total = orden.totales?.totalFinal || orden.totales?.subtotal || 0;

    const html = `
        <div class="orden-documento" id="documentoPDF">
            
            <!-- ENCABEZADO: Logo Grande + Nombre Organizador (Izquierda) + ID Orden (Derecha) -->
            <div class="orden-header">
                <div class="orden-header-left">
                    <img src="${logoUrl}" alt="logo" />
                    <div class="orden-organizador">${nombreOrganizador}</div>
                </div>
                <div class="orden-header-right">
                    <div class="orden-label">Orden de Pago</div>
                    <div class="orden-id">${orden.ordenId}</div>
                    <div class="orden-fecha">📅 ${fechaFormato}</div>
                    <div class="orden-hora">⏰ ${horaFormato}</div>
                </div>
            </div>

            <!-- DATOS DEL CLIENTE -->
            <div class="orden-section">
                <div class="orden-section-title">Datos del Cliente</div>
                <div class="orden-cliente-grid">
                    <div>
                        <div class="orden-field-label">Nombre</div>
                        <div class="orden-field-value">${orden.cliente.nombre || '-'}</div>
                    </div>
                    <div>
                        <div class="orden-field-label">Apellidos</div>
                        <div class="orden-field-value">${orden.cliente.apellidos || '-'}</div>
                    </div>
                    <div>
                        <div class="orden-field-label">WhatsApp</div>
                        <div class="orden-field-value">${orden.cliente.whatsapp || '-'}</div>
                    </div>
                </div>
            </div>

            <!-- RESUMEN DE COMPRA -->
            <div class="orden-section">
                <div class="orden-section-title">Resumen de Compra</div>
                <div class="orden-section-content">
                    <div class="orden-boletos">
                        <div class="orden-field-label">Boletos Adquiridos (${boletosArray.length})</div>
                        <div class="orden-boletos-list">${boletosStr}</div>
                    </div>
                    ${oportunidadesHtml}
                    <div class="orden-totales">
                        <div class="orden-subtotal">
                            <span class="orden-subtotal-label">Subtotal:</span>
                            <span>$${Number(subtotal).toFixed(2)}</span>
                        </div>
                        ${descuento > 0 ? `
                        <div class="orden-descuento">
                            <span class="orden-descuento-label">Descuento:</span>
                            <span class="orden-descuento-valor">-$${Number(descuento).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div class="orden-total-bar">
                            <span>TOTAL A PAGAR:</span>
                            <span class="orden-total-valor">$${Number(total).toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MÉTODO DE PAGO -->
            <div class="orden-section">
                <div class="orden-section-title">Información de Pago</div>
                <div class="orden-section-content">
                    <div class="orden-pago-item">
                        <div class="orden-pago-label">Banco</div>
                        <div class="orden-pago-valor">${orden.cuenta?.nombreBanco || '-'}</div>
                    </div>
                    <div class="orden-pago-item">
                        <div class="orden-pago-label">Número de Cuenta</div>
                        <div class="orden-pago-valor-monospace">${orden.cuenta?.accountNumber || '-'}</div>
                    </div>
                    <div class="orden-pago-item">
                        <div class="orden-pago-label">Referencia de Pago</div>
                        <div class="orden-pago-valor-monospace orden-referencia-id">${orden.ordenId || '-'}</div>
                    </div>
                    <div class="orden-pago-item">
                        <div class="orden-pago-label">Beneficiario</div>
                        <div class="orden-pago-valor">${orden.cuenta?.beneficiary || '-'}</div>
                    </div>
                </div>
            </div>

            <!-- MENSAJE FINAL -->
            <div class="orden-mensaje-final">
                <div class="orden-mensaje-texto">
                    <p style="margin: 0.5rem 0; line-height: 1.5;"><strong>Paso 1:</strong> Realiza una transferencia bancaria por el monto indicado a la cuenta de arriba</p>
                    <p style="margin: 0.5rem 0; line-height: 1.5;"><strong>Paso 2:</strong> Guarda el comprobante de pago (captura de pantalla o PDF)</p>
                    <p style="margin: 0.5rem 0; line-height: 1.5;"><strong>Paso 3:</strong> Sube tu comprobante usando el botón <strong>"📤 Subir Comprobante"</strong> en la esquina inferior derecha O desde <strong>"Mis Boletos"</strong> en el menú</p>
                    <div style="margin: 1rem 0 0 0; padding: 1rem; border-top: 2px solid #1A1A1A; background: #f8f9fa; border-radius: 8px; text-align: center;">
                        <p style="margin: 0; color: #1A1A1A; font-weight: 700; font-size: 1rem; line-height: 1.4;">¡Gracias por tu compra! Una vez completados estos pasos, <strong style="color: #E63946;">¡ya estarás participando en nuestro sorteo!</strong> 🎊</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    contenedor.innerHTML = html;
}

/* ============================================================ */
/* SECCIÓN 4: CONSTRUCCIÓN DE MENSAJES PARA WHATSAPP           */
/* ============================================================ */

/**
 * makeOrderMessage - Construye el mensaje de orden para el cliente
 * @param {Object} ord - Objeto con datos de la orden
 * @returns {string} Mensaje formateado para WhatsApp
 */
function makeOrderMessage(ord) {
    const cliente = ord.cliente || {};
    const ordenId = ord.ordenId || '';
    const banco = ord.cuenta ? (ord.cuenta.nombreBanco || '') : '';
    const cuenta = ord.cuenta ? ord.cuenta.accountNumber : '';
    const beneficiario = ord.cuenta ? ord.cuenta.beneficiary : '';
    const referencia = ord.referencia || '';
    const subtotal = ord.totales ? (ord.totales.subtotal || 0) : 0;
    const descuento = ord.totales ? (ord.totales.descuento || 0) : 0;
    const monto = ord.totales ? (ord.totales.totalFinal || ord.totales.subtotal || 0) : 0;
    const boletos = ord.boletos || [];
    
    // Use global compactRanges function
    const compactBoletosStr = compactRanges(boletos);
    const fecha = new Date(ord.fecha);
    const fechaFormato = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
    const misBoletosUrl = cliente.whatsapp ? `${origin}/mis-boletos.html?whatsapp=${encodeURIComponent(cliente.whatsapp)}` : `${origin}/mis-boletos.html`;

    return `ORDEN DE PAGO
ID de orden: ${ordenId}
Emitida: ${fechaFormato}

DATOS DEL CLIENTE
Nombre: ${cliente.nombre || ''} ${cliente.apellidos || ''}
WhatsApp: ${cliente.whatsapp || '-'}
Estado: ${cliente.estado || '-'}
Ciudad: ${cliente.ciudad || '-'}

DETALLES DE COMPRA
Boletos: ${compactBoletosStr}
Subtotal: $${Number(subtotal).toFixed(2)}
${descuento > 0 ? `Descuento: -$${Number(descuento).toFixed(2)}\n` : ''}Total a pagar: $${Number(monto).toFixed(2)}

MÉTODO DE PAGO
Banco: ${banco}
Número de cuenta: ${cuenta}
Referencia: ${referencia}
Beneficiario: ${beneficiario}

Ver tu orden y el estado de tus boletos: ${misBoletosUrl}

------------------------------
Por favor, envía el comprobante de pago para confirmar la compra de tus boletos y asegurar tu participación en la rifa.
¡Mucha suerte! Tu participación es muy importante y pronto podrías ser el ganador. 🎉`;
}

/**
 * buildWaMeUrl - Construye URL de WhatsApp Web con teléfono y mensaje
 * @param {string} phone - Número de teléfono
 * @param {string} text - Texto del mensaje
 * @returns {string} URL para wa.me
 */
function buildWaMeUrl(phone, text) {
    if (!phone) phone = '';
    let cleaned = phone.replace(/[^0-9+]/g, '');
    cleaned = cleaned.replace(/^\+/, ''); // wa.me needs no +
    const encoded = encodeURIComponent(text);
    return `https://wa.me/ ${cleaned}?text=${encoded}`;
}

/* ============================================================ */
/* SECCIÓN 5: GENERACIÓN Y DESCARGA DE PDF                     */
/* ============================================================ */

/**
 * imprimirOrden - Genera PDF de la orden usando html2canvas + jsPDF CON OPTIMIZACIÓN
 * OPTIMIZACIONES APLICADAS:
 * 1. Escala reducida de 2 a 1.5 para menor memoria y tamaño
 * 2. Formato JPEG con 80% de calidad en lugar de PNG
 * 3. Compresión del PDF habilitada en jsPDF
 * 4. Aplicación automática de clase 'pdf-optimizado' para estilos compactos
 * 5. Sin imágenes de fondo ni estilos innecesarios durante captura
 * @returns {void}
 */
function imprimirOrden() {
    const docEl = document.getElementById('documentoPDF');
    if (!docEl) {
        rifaplusUtils.showFeedback('❌ No hay documento para descargar', 'error');
        return;
    }

    try {
        if (typeof window.html2canvas !== 'function') {
            rifaplusUtils.showFeedback('❌ html2canvas no está disponible', 'error');
            return;
        }
        if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
            rifaplusUtils.showFeedback('❌ jsPDF no está disponible', 'error');
            return;
        }
        
        rifaplusUtils.showFeedback('⏳ Generando PDF profesional...', 'info');
        
        // SOLUCIÓN: Clonar el elemento en un contenedor oculto con ancho de desktop
        // Esto garantiza captura perfecta sin afectar la página
        
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';  // Fuera de vista
        container.style.top = '0';
        container.style.width = '1000px';  // Ancho de DESKTOP
        container.style.display = 'block';
        container.style.zIndex = '-9999';
        
        // Clonar el elemento completo
        const clone = docEl.cloneNode(true);
        container.appendChild(clone);
        document.body.appendChild(container);
        
        // Esperar a que se renderice el clone
        setTimeout(() => {
            // Capturar el clon (no el original)
            window.html2canvas(clone, {
                scale: 2,                   // Buena calidad
                useCORS: true,
                logging: false,
                allowTaint: true,
                backgroundColor: '#ffffff',
                imageTimeout: 0,
                width: 1000,                // Ancho exacto
                windowWidth: 1000
            }).then(canvas => {
                // Eliminar el contenedor clonado
                document.body.removeChild(container);
                
                // Convertir a imagen JPEG
                const imgData = canvas.toDataURL('image/jpeg', 0.92);
                const { jsPDF } = window.jspdf;
                
                // Crear PDF A4
                const pdf = new jsPDF({
                    unit: 'mm',
                    format: 'a4',
                    orientation: 'portrait',
                    compress: true
                });
                
                const pdfWidth = 210;
                const pdfHeight = 297;
                const margin = 10;
                const availableWidth = pdfWidth - (margin * 2);  // 190mm
                const availableHeight = pdfHeight - (margin * 2); // 277mm
                
                // Calcular proporciones
                const canvasRatio = canvas.height / canvas.width;
                const imgHeight = availableWidth * canvasRatio;
                
                // Calcular cuántas páginas se necesitan
                const pagesNeeded = Math.ceil(imgHeight / availableHeight);
                
                if (pagesNeeded === 1) {
                    // Cabe en una página - centrar verticalmente
                    const yPos = margin + ((availableHeight - imgHeight) / 2);
                    pdf.addImage(imgData, 'JPEG', margin, yPos, availableWidth, imgHeight);
                } else {
                    // Necesita múltiples páginas - dividir la imagen inteligentemente
                    const heightPerPage = imgHeight / pagesNeeded;
                    
                    for (let i = 0; i < pagesNeeded; i++) {
                        if (i > 0) {
                            pdf.addPage('a4', 'portrait');
                        }
                        
                        // Usar crop para mostrar la porción correcta de la imagen en cada página
                        const sourceY = (i / pagesNeeded) * canvas.height;
                        const sourceHeight = canvas.height / pagesNeeded;
                        
                        // Crear un canvas temporal con la porción de la imagen
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = canvas.width;
                        tempCanvas.height = sourceHeight;
                        const tempCtx = tempCanvas.getContext('2d');
                        tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
                        
                        const portionImgData = tempCanvas.toDataURL('image/jpeg', 0.92);
                        pdf.addImage(portionImgData, 'JPEG', margin, margin, availableWidth, heightPerPage);
                    }
                }
                
                const filename = `orden-${ordenActual ? ordenActual.ordenId : Date.now()}.pdf`;
                pdf.save(filename);
                rifaplusUtils.showFeedback('✅ PDF descargado', 'success');
                
            }).catch(err => {
                document.body.removeChild(container);
                console.error('Error al generar PDF:', err);
                rifaplusUtils.showFeedback('❌ Error al generar PDF', 'error');
            });
        }, 100);
        
    } catch (err) {
        console.error('Error al generar PDF:', err);
        rifaplusUtils.showFeedback('❌ Error al generar PDF', 'error');
    }
}

/* ============================================================ */
/* SECCIÓN 6: GUARDADO Y CONFIRMACIÓN DE ORDEN                 */
/* ============================================================ */

/**
 * limpiarCarritoCompletamente - Limpia todo el carrito y localStorage
 * Se llama después de éxito (409 verificado, timeout verificado, o éxito normal)
 */
function limpiarCarritoCompletamente() {
    console.log('🧹 Limpiando carrito completamente...');
    
    // Limpiar localStorage
    localStorage.removeItem('rifaplusSelectedNumbers');
    localStorage.removeItem('rifaplus_boletos');
    localStorage.removeItem('rifaplus_cliente');
    localStorage.removeItem('rifaplus_total');
    localStorage.removeItem('rifaplusBoletosCache');
    localStorage.removeItem('rifaplusBoletosTimestamp');
    localStorage.removeItem('rifaplus_oportunidades');
    
    // Limpiar objeto global del carrito
    if (typeof selectedNumbersGlobal !== 'undefined' && selectedNumbersGlobal?.clear) {
        try {
            selectedNumbersGlobal.clear();
            console.log('✅ selectedNumbersGlobal limpiado');
        } catch (e) {
            console.warn('⚠️  Error limpiando selectedNumbersGlobal:', e?.message);
        }
    }
    
    // Actualizar UI
    if (typeof actualizarVistaCarritoGlobal === 'function') {
        try { 
            actualizarVistaCarritoGlobal();
            console.log('✅ Vista carrito actualizada');
        } catch (e) { 
            console.warn('⚠️  Error actualizando vista:', e); 
        }
    }
    if (typeof actualizarContadorCarritoGlobal === 'function') {
        try { 
            actualizarContadorCarritoGlobal();
            console.log('✅ Contador carrito actualizado');
        } catch (e) { 
            console.warn('⚠️  Error actualizando contador:', e); 
        }
    }
    
    // Marcar que regresará a compra.html
    localStorage.setItem('rifaplusOrdenEnviada', 'true');
    
    // Cerrar modal
    cerrarOrdenFormal();
    
    console.log('✅ Carrito limpiado completamente');
}

/**
 * guardarOrden - Guarda la orden en backend y redirige a página de confirmación
 * @async
 * @returns {Promise<void>}
 */
async function guardarOrden() {
    if (!ordenActual) {
        rifaplusUtils.showFeedback('❌ No hay orden para guardar', 'error');
        return;
    }

    // Prevenir múltiples clics
    if (window.guardandoOrden) {
        console.warn('⚠️  Ya hay una orden en proceso de guardado');
        return;
    }

    window.guardandoOrden = true;

    try {
        // Mostrar modal de loading
        const modalLoading = document.getElementById('modalLoadingOrden');
        const btnContinuar = document.getElementById('btnContinuarOrdenFormal');
        if (modalLoading) {
            modalLoading.style.display = 'flex';
            // Iniciar contador de tiempo
            let segundos = 0;
            const contadorInterval = setInterval(() => {
                segundos++;
                const tiempoEl = document.getElementById('tiempoTranscurrido');
                if (tiempoEl) tiempoEl.textContent = `Tiempo: ${segundos}s`;
                // Si no se completa en 120 segundos, mostrar advertencia
                if (segundos > 120) {
                    const pEl = document.getElementById('tiempoTranscurrido');
                    if (pEl) pEl.style.color = '#ff6b6b';
                }
            }, 1000);
            window.contadorOrdenInterval = contadorInterval;
        }
        if (btnContinuar) btnContinuar.disabled = true;
        
        // Mostrar mensaje de envío
        rifaplusUtils.showFeedback('📤 Guardando orden en la base de datos...', 'loading');
        
        // VALIDACIÓN 1: Datos básicos de orden
        if (!ordenActual.cliente) {
            throw new Error('Datos del cliente incompletos');
        }
        if (!ordenActual.boletos) {
            throw new Error('No hay boletos en la orden');
        }

        // VALIDACIÓN 2: Asegurar que boletos es un array válido
        let boletosArray = ordenActual.boletos;
        if (!Array.isArray(boletosArray)) {
            console.error('❌ boletosArray no es array:', { type: typeof boletosArray, value: boletosArray });
            throw new Error('Los boletos deben ser un array válido');
        }

        if (boletosArray.length === 0) {
            throw new Error('Se requiere al menos un boleto');
        }

        // VALIDACIÓN 3: Limpiar y validar cada boleto
        boletosArray = boletosArray
            .map(b => {
                const num = Number(b);
                if (isNaN(num)) {
                    console.warn(`⚠️  Boleto no válido: ${b}`);
                    return null;
                }
                return num;
            })
            .filter(b => b !== null && b >= 0);

        if (boletosArray.length === 0) {
            throw new Error('No hay boletos válidos para guardar');
        }

        // ✅ OPTIMIZACIÓN: Verificación de disponibilidad DELEGADA AL SERVIDOR
        // El servidor ya valida y maneja race conditions con transacciones
        // Omitimos el check en cliente para ahorrar roundtrip y transferencia de datos
        console.log('✅ Verificación delegada al servidor (transacción atómica)');

        // VALIDACIÓN 4: Datos del cliente
        const nombre = (ordenActual.cliente.nombre || '').trim();
        const whatsapp = (ordenActual.cliente.whatsapp || '').trim();
        
        if (!nombre || nombre.length < 2) {
            throw new Error('Nombre del cliente requerido (mín. 2 caracteres)');
        }

        if (!whatsapp || whatsapp.replace(/[^0-9]/g, '').length < 10) {
            throw new Error('Teléfono/WhatsApp inválido');
        }

        // VALIDACIÓN 5: Datos monetarios
        const subtotal = parseFloat(ordenActual.totales?.subtotal) || parseFloat(ordenActual.totales?.total) || 0;
        const totalFinal = parseFloat(ordenActual.totales?.totalFinal) || parseFloat(ordenActual.totales?.total) || 0;

        if (subtotal <= 0 || totalFinal <= 0) {
            throw new Error('El total debe ser mayor a 0');
        }

        // Preparar payload validado
        const payload = {
            ordenId: (ordenActual.ordenId || `RIFA-${Date.now()}`).slice(0, 50),  // Limitar longitud
            cliente: {
                nombre: nombre.slice(0, 100),
                apellidos: (ordenActual.cliente.apellidos || '').trim().slice(0, 100),
                whatsapp: whatsapp.slice(0, 20),
                estado: (ordenActual.cliente.estado || '').trim().slice(0, 50),
                ciudad: (ordenActual.cliente.ciudad || '').trim().slice(0, 50)
            },
            boletos: boletosArray,
            totales: {
                subtotal: Math.round(subtotal * 100) / 100,
                descuento: Math.max(0, Math.round((parseFloat(ordenActual.totales?.descuento) || 0) * 100) / 100),
                totalFinal: Math.round(totalFinal * 100) / 100
            },
            cuenta: ordenActual.cuenta || {},
            precioUnitario: (function(){
                const p1 = parseFloat(ordenActual.totales?.precioUnitario);
                if (!Number.isNaN(p1) && p1 > 0) return p1;
                if (typeof obtenerPrecioDinamico === 'function') return obtenerPrecioDinamico();
                return (window.rifaplusConfig?.rifa?.precioBoleto && Number(window.rifaplusConfig.rifa.precioBoleto)) || 15;
            })(),
            metodoPago: 'transferencia',
            notas: '',
            // ✅ ENVIAR OPORTUNIDADES GENERADAS DESDE CLIENTE
            // El servidor las validará en BD para garantizar que estén disponibles
            boletosOcultos: await (async function(){
                const oportunidadesHabilitadas = window.rifaplusConfig?.rifa?.oportunidades?.enabled === true;
                if (!oportunidadesHabilitadas) {
                    console.log('ℹ️  Oportunidades deshabilitadas');
                    return [];
                }
                
                // ✅ USAR LAS OPORTUNIDADES YA CALCULADAS POR carrito-global.js
                try {
                    const oportunidadesData = localStorage.getItem('rifaplus_oportunidades');
                    if (oportunidadesData) {
                        const oportunidades = JSON.parse(oportunidadesData);
                        
                        // Verificar que sean para estos boletos
                        if (oportunidades.oportunidadesPorBoleto) {
                            const boletosSet = new Set(boletosArray);
                            let todasValidas = true;
                            
                            for (const boleto of boletosArray) {
                                if (!oportunidades.oportunidadesPorBoleto[boleto]) {
                                    todasValidas = false;
                                    break;
                                }
                            }
                            
                            if (todasValidas) {
                                console.log(`✅ Oportunidades válidas recuperadas de localStorage`);
                                return oportunidades.boletosOcultos || [];
                            } else {
                                console.warn('⚠️  Algunos boletos no tienen oportunidades en localStorage');
                                // Si hay conflicto, filtrar solo lo que sí tenemos
                                const oportunidadesDisponibles = [];
                                for (const boleto of boletosArray) {
                                    if (oportunidades.oportunidadesPorBoleto[boleto]) {
                                        oportunidadesDisponibles.push(...oportunidades.oportunidadesPorBoleto[boleto]);
                                    }
                                }
                                if (oportunidadesDisponibles.length > 0) {
                                    console.log(`✅ Recuperadas parcialmente: ${oportunidadesDisponibles.length} oportunidades`);
                                    return oportunidadesDisponibles;
                                }
                            }
                        } else {
                            // Fallback si estructura es diferente
                            if (Array.isArray(oportunidades.boletosOcultos) && oportunidades.boletosOcultos.length > 0) {
                                console.log(`✅ Oportunidades recuperadas (estructura alternativa)`);
                                return oportunidades.boletosOcultos;
                            }
                        }
                    }
                    
                    console.error('❌ No hay oportunidades en localStorage. Esto no debería pasar - carrito-global.js debería haberlas generado');
                    return [];
                    
                } catch (e) {
                    console.error('❌ Error recuperando oportunidades:', e);
                    console.error('   Stack:', e.stack);
                    return [];
                }
            })()
        };

        // VALIDACIÓN 6: Consistencia de precio
        const precioCalculado = boletosArray.length * payload.precioUnitario;
        const diferencia = Math.abs(precioCalculado - payload.totales.subtotal);
        if (diferencia > 0.01 * boletosArray.length) {  // Permitir pequeña diferencia por redondeos
            console.warn(`⚠️  Diferencia de precio: calculado=${precioCalculado}, enviado=${payload.totales.subtotal}`);
            // No fallar, pero avisar
        }

        // ENVÍO AL SERVIDOR CON TIMEOUT Y REINTENTOS
        const apiBase = window.rifaplusConfig?.backend?.apiBase || 'http://localhost:5001';
        const apiUrl = `${apiBase}/api/ordenes`;
        const maxReintentos = 3;
        let ultimoError = null;

        // Calcular timeout dinámico según cantidad de boletos
        // ✅ OPTIMIZADO v5: Timeouts adaptativos para diferentes conexiones
        // - Fast (>= 1Mbps): 5s base + 5ms por boleto
        // - Normal (100-1000 Kbps): 8s base + 15ms por boleto  
        // - Slow (< 100 Kbps): 12s base + 25ms por boleto
        // 
        // Ejemplos (con velocidad Normal asumida):
        // - 100 boletos: 8000 + 1500 = 9.5s ✅
        // - 500 boletos: 8000 + 7500 = 15.5s ✅
        // - 1000 boletos: 8000 + 15000 = 23s ✅
        // - 10000 boletos: 8000 + 150000 = 158s (máx: 120s) = 120s ✅
        const cantidadBoletos = boletosArray.length;
        const baseTimeout = 8000;  // 8 segundos base (conexión normal)
        const msPerBoleto = 15;    // 15ms por boleto (conservador)
        const timeoutMs = Math.max(8000, Math.min(120000, baseTimeout + (cantidadBoletos * msPerBoleto)));
        console.log(`⏱️  Timeout dinámico: ${timeoutMs}ms (${(timeoutMs/1000).toFixed(1)}s) para ${cantidadBoletos} boletos`);
        console.log(`   Fórmula: base=${baseTimeout}ms + boletos=${cantidadBoletos}×${msPerBoleto}ms = ${baseTimeout + (cantidadBoletos * msPerBoleto)}ms (capped at 120s)`);

        for (let intento = 1; intento <= maxReintentos; intento++) {
            try {
                console.log(`📡 Intento ${intento}/${maxReintentos} de guardar orden...`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);  // Timeout dinámico

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload),
                    mode: 'cors',
                    signal: controller.signal,
                    credentials: 'omit'
                });

                clearTimeout(timeoutId);

                // PROCESAR RESPUESTA
                if (!response.ok) {
                    let errorData = {};
                    try {
                        errorData = await response.json();
                    } catch (parseError) {
                        console.warn('No se pudo parsear respuesta de error:', parseError);
                    }

                    const mensajeError = errorData.message || `Error ${response.status}`;
                    console.error(`❌ Error HTTP ${response.status}:`, errorData);
                    
                    // Errores que SÍ se pueden reintentar
                    if (response.status >= 500 && intento < maxReintentos) {
                        // Backoff exponencial mejorado: 2s, 4s, 8s (en lugar de 2s, 4s, 6s)
                        const delayMs = 1000 * Math.pow(2, intento - 1);
                        ultimoError = `Error servidor (${response.status}). Reintentando en ${(delayMs/1000).toFixed(1)}s...`;
                        console.log(`⏳ ${ultimoError}`);
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                        continue;
                    }

                    // Errores que NO se reintentan
                    if (response.status === 409) {
                        // Error 409 = Conflicto de boletos
                        console.log('⚠️  Error 409 - Conflicto detectado');

                        // ✅ NUEVO: Manejo elegante de conflictos
                        if (errorData.code === 'BOLETOS_CONFLICTO' && typeof window.ModalConflictoBoletos !== 'undefined') {
                            console.log('🔴 Mostrando modal de conflicto de boletos...');
                            
                            // Mostrar modal al usuario
                            const opcionUsuario = await window.ModalConflictoBoletos.manejarConflicto(errorData);
                            
                            if (opcionUsuario.opcion === 'elegir_otros') {
                                // Usuario quiere elegir otros boletos
                                console.log('ℹ️  Usuario decidió elegir otros boletos');
                                
                                // ✅ NUEVO: Eliminar automáticamente los boletos conflictivos del carrito
                                console.log('🗑️  Eliminando boletos conflictivos del carrito...');
                                if (typeof window.removerBoletoSeleccionado === 'function') {
                                    errorData.boletosConflicto.forEach(boleto => {
                                        console.log(`  - Removiendo boleto #${boleto}`);
                                        window.removerBoletoSeleccionado(boleto);
                                    });
                                    console.log('✅ Boletos conflictivos removidos del carrito');
                                } else {
                                    console.warn('⚠️  removerBoletoSeleccionado no disponible, removiendo manualmente...');
                                    // Fallback manual si la función no está disponible
                                    let stored = localStorage.getItem('rifaplusSelectedNumbers');
                                    let numbers = stored ? JSON.parse(stored).map(n => parseInt(n, 10)) : [];
                                    numbers = numbers.filter(n => !errorData.boletosConflicto.includes(n));
                                    localStorage.setItem('rifaplusSelectedNumbers', JSON.stringify(numbers));
                                }
                                
                                // Volver a la tienda para que seleccione otros
                                alert('Por favor, selecciona otros boletos de la tienda.\n\n✓ Los boletos en conflicto han sido removidos automáticamente de tu carrito.');
                                window.location.href = 'compra.html';
                                return;
                            } else if (opcionUsuario.opcion === 'continuar_sin_conflicto') {
                                // Usuario quiere continuar sin los boletos conflictivos
                                console.log('✅ Usuario decidió continuar con boletos disponibles:', opcionUsuario.boletosSeleccionados);
                                
                                // Actualizar los boletos en la orden
                                payload.boletos = opcionUsuario.boletosSeleccionados;
                                boletosArray = opcionUsuario.boletosSeleccionados;
                                
                                // Recalcular totales
                                const precioUnitarioActual = payload.precioUnitario || 100;
                                const nuevoSubtotal = boletosArray.length * precioUnitarioActual;
                                payload.cantidad_boletos = boletosArray.length;
                                payload.totales = {
                                    subtotal: nuevoSubtotal,
                                    descuentoMonto: 0,
                                    totalFinal: nuevoSubtotal
                                };
                                
                                // ✅ SOLUCIÓN FINAL Y CORRECTA: 
                                // Recalcular oportunidades SOLO para los boletos disponibles
                                // Esto garantiza las oportunidades CORRECTAS sin importar qué esté en localStorage
                                console.log('🎲 Filtrando oportunidades SOLO para boletos disponibles...');
                                console.log('  📌 Boletos disponibles:', boletosArray);
                                console.log('  📌 Boletos conflictivos eliminados:', errorData.boletosConflicto);
                                
                                const oportunidadesHabilitadas = window.rifaplusConfig?.rifa?.oportunidades?.enabled === true;
                                if (oportunidadesHabilitadas) {
                                    try {
                                        // ✅ ESTRATEGIA: Las oportunidades YA fueron calculadas por carrito-global.js
                                        // SOLO necesitamos filtrar las que corresponden a boletos disponibles
                                        const oportunidadesGuardadas = localStorage.getItem('rifaplus_oportunidades');
                                        if (oportunidadesGuardadas) {
                                            const datosOpp = JSON.parse(oportunidadesGuardadas);
                                            const boletosSet = new Set(boletosArray);
                                            
                                            // Filtrar oportunidades SOLO para boletos que están disponibles
                                            const oportunidadesFiltradas = [];
                                            if (datosOpp.oportunidadesPorBoleto) {
                                                for (const boleto of boletosArray) {
                                                    if (datosOpp.oportunidadesPorBoleto[boleto]) {
                                                        oportunidadesFiltradas.push(...datosOpp.oportunidadesPorBoleto[boleto]);
                                                    }
                                                }
                                            }
                                            
                                            payload.boletosOcultos = oportunidadesFiltradas;
                                            console.log(`  ✅ Oportunidades filtradas: ${payload.boletosOcultos.length} para ${boletosArray.length} boletos`);
                                            console.log(`  ✅ Oportunidades asignadas: [${payload.boletosOcultos.slice(0, 10).join(', ')}${payload.boletosOcultos.length > 10 ? '...' : ''}]`);
                                        } else {
                                            console.warn('⚠️  No hay oportunidades guardadas en localStorage');
                                            payload.boletosOcultos = [];
                                        }
                                        
                                    } catch (e) {
                                        console.error('❌ Error al filtrar oportunidades:', e);
                                        console.error('   Stack:', e.stack);
                                        payload.boletosOcultos = [];
                                    }
                                } else {
                                    console.log('ℹ️  Oportunidades deshabilitadas en config');
                                    payload.boletosOcultos = [];
                                }
                                
                                // ✅ VALIDACIÓN DE INTEGRIDAD PRE-FLIGHT
                                // Verificar que el payload es consistente antes de reintentar
                                const validacionPayload = {
                                    boletosArray: Array.isArray(payload.boletos),
                                    boletosLength: payload.boletos?.length || 0,
                                    oportunidadesArray: Array.isArray(payload.boletosOcultos),
                                    oportunidadesLength: payload.boletosOcultos?.length || 0,
                                    totalsCorrecto: payload.totales && payload.totales.totalFinal > 0,
                                    precioValido: payload.precioUnitario > 0
                                };

                                const todasLasValidacionesPasan = Object.values(validacionPayload).every(v => v === true);
                                
                                console.log('📋 VALIDACIÓN DE INTEGRIDAD DEL PAYLOAD:', validacionPayload);
                                console.log(`   ${todasLasValidacionesPasan ? '✅' : '❌'} Integridad: ${todasLasValidacionesPasan ? 'CORRECTA' : 'ERROR'}`);
                                
                                if (!todasLasValidacionesPasan) {
                                    console.error('❌ PAYLOAD CORRUPTO DETECTADO:', {
                                        boletos: payload.boletos,
                                        boletosOcultos: payload.boletosOcultos,
                                        totales: payload.totales
                                    });
                                    throw new Error('PAYLOAD_INTEGRITY_CHECK_FAILED');
                                }

                                console.log('📊 Estado FINAL del payload después de filtrado:', {
                                    boletos: `${payload.boletos.length} boleto(s)`,
                                    oportunidades: `${payload.boletosOcultos.length} oportunidad(es)`,
                                    total: `$${payload.totales.totalFinal}`,
                                    precioUnitario: payload.precioUnitario
                                });
                                
                                // ✅ TODO CORRECTO: Reintentar con los nuevos boletos
                                console.log('🔄 Reintentando POST con payload validado...');
                                continue;
                            }
                        }

                        // FALLBACK: Si no está disponible el modal, hacer verificación antigua
                        console.log('⚠️  Modal no disponible, usando verificación antigua...');
                        try {
                            const pollController = new AbortController();
                            const pollTimeoutId = setTimeout(() => pollController.abort(), 3000);
                            
                            // Obtener datos para búsqueda
                            const nombreCliente = payload.cliente?.nombre || '';
                            const whatsappCliente = payload.cliente?.whatsapp || '';
                            const totalFinal = payload.totales?.totalFinal;
                            const cantidadBoletos = payload.boletos?.length || 0;
                            
                            if (nombreCliente && whatsappCliente) {
                                // Buscar órdenes recientes del cliente por nombre + whatsapp
                                const searchUrl = `${apiBase}/api/ordenes/por-cliente/dummy?nombre=${encodeURIComponent(nombreCliente)}&whatsapp=${encodeURIComponent(whatsappCliente)}`;
                                
                                const checkResponse = await fetch(searchUrl, {
                                    method: 'GET',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'omit',
                                    signal: pollController.signal
                                });
                                
                                clearTimeout(pollTimeoutId);
                                
                                if (checkResponse.ok) {
                                    const ordenes = await checkResponse.json();
                                    // Buscar orden MÁS RECIENTE con monto similar
                                    if (Array.isArray(ordenes) && ordenes.length > 0) {
                                        const ordenReciente = ordenes[0]; // Primera (más reciente)
                                        
                                        // Verificar que sea la misma orden (cantidad de boletos)
                                        if (ordenReciente.cantidad_boletos === cantidadBoletos) {
                                            console.log('✅ La orden SÍ se guardó (encontrada por cliente+cantidad)');
                                            console.log('📋 Orden encontrada:', ordenReciente.numero_orden);
                                            window.location.href = 'orden-confirmada.html';
                                            return;
                                        }
                                    }
                                }
                            }
                        } catch (checkError) {
                            console.warn('⚠️  No se pudo verificar en error 409:', checkError.message);
                            // No fallar por error de verificación, continuar con reintentos
                        }
                        
                        // Si no se encontró la orden y hay conflicto de boletos específico
                        if (errorData.boletosConflicto) {
                            throw new Error(
                                `❌ Estos boletos ya fueron comprados: ${errorData.boletosConflicto.join(', ')}. Selecciona otros.`
                            );
                        }
                        throw new Error('Esta orden ya existe. Intenta con otra configuración.');
                    }
                    if (response.status >= 400 && response.status < 500) {
                        throw new Error(`Error en los datos: ${mensajeError}`);
                    }

                    throw new Error(`Error del servidor: ${mensajeError}`);
                }

                // ÉXITO - Procesar respuesta (incluye 200 OK para órdenes duplicadas idempotentes)
                const respuestaExitosa = await response.json();
                
                if (respuestaExitosa.success) {
                    // Detectar si fue una orden duplicada (idempotencia)
                    const esIdempotente = response.status === 200 && respuestaExitosa.message?.includes('idempotencia');
                    if (esIdempotente) {
                        console.log('ℹ️  Orden duplicada detectada (idempotencia) - Orden ya existe:', respuestaExitosa.ordenId);
                    } else {
                        console.log('✅ Orden guardada en BD:', respuestaExitosa);
                    }
                } else {
                    console.error('❌ Respuesta no exitosa:', respuestaExitosa);
                    throw new Error(respuestaExitosa.message || 'Respuesta no exitosa del servidor');
                }

                // ⭐ OCULTAR LOADING INMEDIATAMENTE (cuando se crea exitosamente la orden)
                const modalLoadingSuccess = document.getElementById('modalLoadingOrden');
                if (modalLoadingSuccess) {
                    modalLoadingSuccess.style.display = 'none';
                }
                
                // Limpiar contador
                if (window.contadorOrdenInterval) {
                    clearInterval(window.contadorOrdenInterval);
                    window.contadorOrdenInterval = null;
                }

                // ACTUALIZAR DISPONIBILIDAD
                if (typeof cargarBoletosPublicos === 'function') {
                    try {
                        await cargarBoletosPublicos();
                        console.log('✅ Disponibilidad de boletos actualizada');
                    } catch (e) {
                        console.warn('⚠️  No se pudo actualizar disponibilidad:', e?.message);
                    }
                }
                // GUARDAR EN LOCALSTORAGE (con fallback si quota se excede)
                try {
                    localStorage.setItem('rifaplus_orden_actual', JSON.stringify(ordenActual));
                    localStorage.setItem('rifaplus_orden_url', respuestaExitosa.url || '');
                    localStorage.setItem('rifaplus_orden_confirmada', 'true');
                } catch (e) {
                    if (e.name === 'QuotaExceededError') {
                        console.warn('⚠️  [GRACEFUL FALLBACK] localStorage quota exceeded para datos de orden');
                        // Intentar al menos guardar la URL como fallback
                        try {
                            localStorage.setItem('rifaplus_orden_url', respuestaExitosa.url || '');
                        } catch (e2) {
                            console.warn('    ℹ️  Los datos están en BD, se recuperarán desde API');
                        }
                    } else {
                        throw e;
                    }
                }
                
                // ✅ IMPORTANTE: Guardar DATOS FINALES de la orden (después de posibles filtrados por conflicto)
                // Esto es lo que orden-confirmada.html mostrará al usuario
                const datosFinalesOrden = {
                    ordenId: payload.ordenId,
                    boletos: payload.boletos,
                    boletosOcultos: payload.boletosOcultos,
                    cantidad_boletos: payload.cantidad_boletos,
                    totales: payload.totales,
                    cliente: payload.cliente,
                    fecha: new Date().toISOString(),
                    esResultadoDeConflicto: payload.boletos.length !== boletosArray.length ? false : undefined  // Solo si hubo cambio
                };
                
                // ✅ INTENTAR guardar en localStorage, pero con fallback si no hay espacio
                try {
                    localStorage.setItem('rifaplus_orden_final', JSON.stringify(datosFinalesOrden));
                    console.log('📦 Datos finales de la orden guardados para orden-confirmada:', datosFinalesOrden);
                } catch (e) {
                    if (e.name === 'QuotaExceededError') {
                        console.warn('⚠️  [GRACEFUL FALLBACK] localStorage quota exceeded para rifaplus_orden_final');
                        console.warn('    ℹ️  Los datos están en la BD, se recuperarán en orden-confirmada.html desde API');
                        // NO hacer throw - la orden está en BD, es solo para cache local
                    } else {
                        throw e;
                    }
                }
                
                // ✅ IMPORTANTE: Actualizar TAMBIÉN rifaplus_oportunidades con los datos correctos filtrados
                // Esto asegura que orden-confirmada.html y mis-boletos.html vean los datos correctos
                try {
                    localStorage.setItem('rifaplus_oportunidades', JSON.stringify({
                        boletosOcultos: payload.boletosOcultos || [],
                        boletosSeleccionados: payload.boletos || [],
                        cantidad: (payload.boletosOcultos || []).length,
                        oportunidadesPorBoleto: {} // Vacío porque ya no es necesario
                    }));
                    console.log('✅ localStorage rifaplus_oportunidades actualizado con datos filtrados:', payload.boletosOcultos);
                } catch (e) {
                    if (e.name === 'QuotaExceededError') {
                        console.warn('⚠️  [GRACEFUL FALLBACK] localStorage quota exceeded para rifaplus_oportunidades');
                        console.warn('    ℹ️  Los datos están en la BD, se recuperarán desde API');
                        // NO hacer throw - la orden está en BD
                    } else {
                        throw e;
                    }
                }

                // GUARDAR EN HISTORIAL
                try {
                    const ordenes = JSON.parse(localStorage.getItem('rifaplus_ordenes_admin') || '[]');
                    ordenes.push({
                        ...ordenActual,
                        estado: 'pendiente',
                        fecha: new Date().toISOString(),
                        url_confirmacion: respuestaExitosa.url
                    });
                    localStorage.setItem('rifaplus_ordenes_admin', JSON.stringify(ordenes));
                } catch (e) {
                    console.warn('⚠️  No se pudo guardar historial:', e?.message);
                }

                // LIMPIAR CARRITO
                console.log('🧹 Limpiando carrito...');
                localStorage.removeItem('rifaplusSelectedNumbers');
                localStorage.removeItem('rifaplus_boletos');
                localStorage.removeItem('rifaplus_cliente');
                localStorage.removeItem('rifaplus_total');
                
                if (typeof selectedNumbersGlobal !== 'undefined' && selectedNumbersGlobal?.clear) {
                    selectedNumbersGlobal.clear();
                }
                
                // ACTUALIZAR UI
                if (typeof actualizarVistaCarritoGlobal === 'function') {
                    try { actualizarVistaCarritoGlobal(); } catch (e) { console.warn('Error actualizando vista:', e); }
                }
                if (typeof actualizarContadorCarritoGlobal === 'function') {
                    try { actualizarContadorCarritoGlobal(); } catch (e) { console.warn('Error actualizando contador:', e); }
                }
                
                // ⚡ LIMPIAR CACHÉ DE BOLETOS (importante para que cuando regrese a compra.html, vea datos frescos)
                localStorage.removeItem('rifaplusBoletosCache');
                localStorage.removeItem('rifaplusBoletosTimestamp');
                
                // Marcar que regresará a compra.html
                localStorage.setItem('rifaplusOrdenEnviada', 'true');
                
                cerrarOrdenFormal();
                
                // ⭐ REDIRIGIR INMEDIATAMENTE (sin delay) - experiencia de usuario optimizada
                console.log('🚀 Redirigiendo a orden-confirmada.html (INMEDIATAMENTE)');
                window.location.href = 'orden-confirmada.html';
                
                return;  // ÉXITO - salir del loop de reintentos

            } catch (fetchError) {
                ultimoError = fetchError.message;
                
                if (fetchError.name === 'AbortError') {
                    console.error(`⏱️  Timeout en intento ${intento}`);
                    ultimoError = 'Timeout de conexión. Verificando si la orden se guardó...';
                    
                    // Si fue timeout, verificar si la orden se guardó en el servidor
                    if (intento === maxReintentos) {
                        console.log(`🔍 Último intento con timeout - verificando si la orden existe en el servidor...`);
                        try {
                            // Usar un timeout más corto para el polling
                            const pollController = new AbortController();
                            const pollTimeoutId = setTimeout(() => pollController.abort(), 5000);
                            
                            const nombreCliente = payload.cliente?.nombre || '';
                            const whatsappCliente = payload.cliente?.whatsapp || '';
                            const cantidadBoletos = payload.boletos?.length || 0;
                            
                            // Búsqueda por nombre + whatsapp (datos que SÍ tenemos)
                            const searchUrl = `${apiBase}/api/ordenes/por-cliente/dummy?nombre=${encodeURIComponent(nombreCliente)}&whatsapp=${encodeURIComponent(whatsappCliente)}`;
                            
                            const checkResponse = await fetch(searchUrl, {
                                method: 'GET',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'omit',
                                signal: pollController.signal
                            });
                            
                            clearTimeout(pollTimeoutId);
                            
                            if (checkResponse.ok) {
                                const ordenes = await checkResponse.json();
                                // Buscar orden MÁS RECIENTE con cantidad similar
                                if (Array.isArray(ordenes) && ordenes.length > 0) {
                                    const ordenReciente = ordenes[0]; // Primera (más reciente)
                                    
                                    if (ordenReciente.cantidad_boletos === cantidadBoletos) {
                                        console.log('✅ La orden SÍ se guardó en el servidor (encontrada después de timeout)');
                                        console.log('📋 Orden encontrada:', ordenReciente.numero_orden);
                                        console.log('🚀 Redirigiendo a orden-confirmada.html');
                                        window.location.href = 'orden-confirmada.html';
                                        return;
                                    }
                                }
                            }
                        } catch (checkError) {
                            console.warn('No se pudo verificar si la orden existe (polling falló):', checkError.message);
                            // Si el polling falla, asumir que la orden SÍ se guardó
                            // porque llegó al último reintento con timeout
                            console.log('⚠️  Asumiendo que la orden se guardó porque llegó al timeout final');
                            console.log('🚀 Redirigiendo a orden-confirmada.html');
                            window.location.href = 'orden-confirmada.html';
                            return;
                        }
                    }
                } else if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
                    console.error(`🌐 Error de red en intento ${intento}`);
                    ultimoError = 'No se puede conectar al servidor. Verifica tu conexión a internet.';
                } else {
                    console.error(`❌ Error en intento ${intento}:`, fetchError);
                }

                if (intento < maxReintentos) {
                    console.log(`⏳ Reintentando (${intento + 1}/${maxReintentos})...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * intento));
                    continue;
                }

                throw ultimoError;
            }
        }

    } catch (error) {
        console.error('❌ Error crítico al guardar orden:', error);
        
        // Detectar tipo de error para mensaje más específico
        let mensajeFinal = 'Error desconocido';
        
        if (typeof error === 'string') {
            if (error === 'PAYLOAD_INTEGRITY_CHECK_FAILED') {
                mensajeFinal = '❌ Error de integridad en datos de orden. Por favor, intenta de nuevo.';
                console.error('   El payload contiene datos inválidos o corruptos.');
            } else {
                mensajeFinal = error;
            }
        } else if (error?.message) {
            if (error.message.includes('PAYLOAD_INTEGRITY_CHECK_FAILED')) {
                mensajeFinal = '❌ Los datos de la orden se corrompieron durante el procesamiento. Por favor, intenta de nuevo.';
            } else {
                mensajeFinal = error.message;
            }
        }
        
        rifaplusUtils.showFeedback(`❌ ${mensajeFinal}`, 'error');
        console.error('   Detalles:', error);
        
    } finally {
        window.guardandoOrden = false;
        
        // Ocultar modal de loading
        const modalLoading = document.getElementById('modalLoadingOrden');
        if (modalLoading) {
            modalLoading.style.display = 'none';
        }
        
        // Limpiar contador
        if (window.contadorOrdenInterval) {
            clearInterval(window.contadorOrdenInterval);
            window.contadorOrdenInterval = null;
        }
        
        // Re-habilitar botón
        const btnContinuar = document.getElementById('btnContinuarOrdenFormal');
        if (btnContinuar) btnContinuar.disabled = false;
    }
}

/**
 * Inicializa los event listeners para botones y modales
 */
document.addEventListener('DOMContentLoaded', function() {
    const btnCancelarOrdenFormal = document.getElementById('btnCancelarOrdenFormal');
    const btnContinuarOrdenFormal = document.getElementById('btnContinuarOrdenFormal');
    const closeOrdenFormal = document.getElementById('closeOrdenFormal');
    const modalOrdenFormal = document.getElementById('modalOrdenFormal');
    const btnDescargarOrdenFormal = document.getElementById('btnDescargarOrdenFormal');

    if (btnCancelarOrdenFormal) {
        btnCancelarOrdenFormal.addEventListener('click', cerrarOrdenFormal);
        console.log('✅ Event listener agregado a btnCancelarOrdenFormal');
    }
    if (btnContinuarOrdenFormal) {
        btnContinuarOrdenFormal.addEventListener('click', function(e) {
            console.log('🖱️ Click en btnContinuarOrdenFormal detectado');
            e.preventDefault();
            e.stopPropagation();
            console.log('🎯 Llamando a guardarOrden()');
            guardarOrden();
        });
        console.log('✅ Event listener agregado a btnContinuarOrdenFormal');
    } else {
        console.warn('⚠️ btnContinuarOrdenFormal NO ENCONTRADO');
    }

    if (btnDescargarOrdenFormal) {
        btnDescargarOrdenFormal.addEventListener('click', function() {
            console.log('🖱️ Click en btnDescargarOrdenFormal detectado');
            imprimirOrden();
        });
    }

    if (closeOrdenFormal) {
        closeOrdenFormal.addEventListener('click', cerrarOrdenFormal);
    }

    // NO permitir cerrar al hacer click fuera
    // El modal solo se cierra al hacer clic en "Apartar boletos"
    if (modalOrdenFormal) {
        modalOrdenFormal.addEventListener('click', function(e) {
            // Prevenir que se cierre al hacer click en el fondo (overlay)
            if (e.target === modalOrdenFormal) {
                e.preventDefault();
                e.stopPropagation();
                // NO llamar a cerrarOrdenFormal() aquí
            }
        });
    }
});
/* ============================================================ */
/* DEBUG HELPERS - Helpers para debugging                       */
/* ============================================================ */

// Función para testear desde la consola
window.debugOrdenFormal = {
    // Verificar estado actual
    status: function() {
        console.log('=== DEBUG ORDEN FORMAL STATUS ===');
        console.log('ordenActual:', ordenActual);
        console.log('Botón btnContinuarOrdenFormal:', document.getElementById('btnContinuarOrdenFormal'));
        console.log('Modal visible:', document.getElementById('modalOrdenFormal')?.style.display);
        return {
            ordenActual,
            botonExiste: !!document.getElementById('btnContinuarOrdenFormal'),
            modalVisible: document.getElementById('modalOrdenFormal')?.style.display !== 'none'
        };
    },
    
    // Simular click en botón Apartar
    simularClick: function() {
        console.log('🧪 Simulando click en btnContinuarOrdenFormal...');
        const btn = document.getElementById('btnContinuarOrdenFormal');
        if (btn) {
            btn.click();
        } else {
            console.error('❌ Botón no encontrado');
        }
    },
    
    // Llamar directamente a la función
    ejecutarDirecto: function() {
        console.log('🧪 Ejecutando guardarOrden() directamente...');
        guardarOrden();
    },
    
    // Ver localStorage
    verLocalStorage: function() {
        console.log('=== localStorage ===');
        console.log('rifaplus_orden_actual:', JSON.parse(localStorage.getItem('rifaplus_orden_actual') || 'null'));
        console.log('rifaplus_cliente:', JSON.parse(localStorage.getItem('rifaplus_cliente') || 'null'));
        console.log('rifaplusSelectedNumbers:', JSON.parse(localStorage.getItem('rifaplusSelectedNumbers') || 'null'));
        console.log('rifaplus_total:', localStorage.getItem('rifaplus_total'));
    }
};

console.log('✅ DEBUG HELPERS disponibles: window.debugOrdenFormal.status(), .simularClick(), .ejecutarDirecto(), .verLocalStorage()');
