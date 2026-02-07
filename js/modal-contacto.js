/**
 * ============================================================
 * ARCHIVO: js/modal-contacto.js
 * DESCRIPCIÓN: Gestión del modal de formulario de contacto
 * Validación de datos, almacenamiento y generación de ID de orden
 * ÚLTIMA ACTUALIZACIÓN: 2025
 * ============================================================
 */

/* ============================================================ */
/* SECCIÓN 1: FUNCIONES DE GESTIÓN DEL MODAL                   */
/* ============================================================ */

/**
 * abrirModalContacto - Abre el modal de contacto
 * @returns {void}
 */
function abrirModalContacto() {
    const modal = document.getElementById('modalContacto');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden'; // Prevenir scroll
        limpiarFormularioContacto();
    }
}

/**
 * cerrarModalContacto - Cierra el modal de contacto
 * @returns {void}
 */
function cerrarModalContacto() {
    const modal = document.getElementById('modalContacto');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto'; // Restaurar scroll
    }
}

/**
 * limpiarFormularioContacto - Limpia campos y errores del formulario
 * @returns {void}
 */
function limpiarFormularioContacto() {
    const form = document.getElementById('formularioContacto');
    if (form) {
        form.reset();
        // Limpiar mensajes de error
        document.querySelectorAll('.form-error').forEach(error => {
            error.textContent = '';
        });
    }
}

/* ============================================================ */
/* SECCIÓN 2: VALIDACIÓN DE FORMULARIO                       */
/* ============================================================ */

/**
 * validarFormularioContacto - Valida todos los campos del formulario
 * @returns {boolean} Verdadero si el formulario es válido
 */
function validarFormularioContacto() {
    const nombre = document.getElementById('clienteNombre').value.trim();
    const apellidos = document.getElementById('clienteApellidos').value.trim();
    const whatsapp = document.getElementById('clienteWhatsapp').value.trim();
    const estadoEl = document.getElementById('clienteEstado');
    const estado = estadoEl ? (estadoEl.value || '').trim() : '';
    const ciudadEl = document.getElementById('clienteCiudad');
    const ciudad = ciudadEl ? ciudadEl.value.trim() : '';
    
    let valido = true;
    
    // Validar nombre
    if (!nombre || nombre.length < 2) {
        document.getElementById('errorNombre').textContent = 'El nombre debe tener al menos 2 caracteres';
        valido = false;
    } else {
        document.getElementById('errorNombre').textContent = '';
    }
    
    // Validar apellidos
    if (!apellidos || apellidos.length < 2) {
        document.getElementById('errorApellidos').textContent = 'Los apellidos deben tener al menos 2 caracteres';
        valido = false;
    } else {
        document.getElementById('errorApellidos').textContent = '';
    }
    
    // Validar WhatsApp: exigir exactamente 10 dígitos (solo números)
    const whatsappDigits = whatsapp.replace(/\D/g, '');
    if (!whatsappDigits || whatsappDigits.length !== 10) {
        document.getElementById('errorWhatsapp').textContent = 'Ingresa exactamente 10 dígitos para WhatsApp';
        valido = false;
    } else {
        document.getElementById('errorWhatsapp').textContent = '';
    }

    // Validar estado (obligatorio)
    if (!estado) {
        document.getElementById('errorEstado').textContent = 'Selecciona tu estado';
        valido = false;
    } else {
        document.getElementById('errorEstado').textContent = '';
    }

    // Validar ciudad/localidad (obligatorio)
    if (!ciudad || ciudad.length < 2) {
        document.getElementById('errorCiudad').textContent = 'Por favor indica tu ciudad o localidad';
        valido = false;
    } else {
        document.getElementById('errorCiudad').textContent = '';
    }
    
    return valido;
}

/* ============================================================ */
/* SECCIÓN 3: GENERACIÓN Y GESTIÓN DE ID DE ORDEN            */
/* ============================================================ */

/**
 * generarIdOrden - Genera un ID único para la orden con secuencia alfabética
 * Patrón dinámico: [PREFIJO]-AA001, [PREFIJO]-AA002... [PREFIJO]-AA999, [PREFIJO]-AB000, etc.
 * Ej: "SORTEOS EL TREBOL" → SET-AA001, SET-AA002, etc.
 * Ej: "Rifas El Trebol" → RET-AA001, RET-AA002, etc.
 * El prefijo se genera dinámicamente de config.cliente.nombre (primeras letras de cada palabra)
 * @returns {Promise<string>} ID de orden formateado (ej: SET-AA001, RET-AA001, etc.)
 */
async function generarIdOrden() {
    try {
        // 1. Obtener prefijo dinámico desde config.js (usa getter automático)
        const prefijo = window.rifaplusConfig?.cliente?.prefijoOrden || 'ORD';
        
        // Validación defensiva
        if (!prefijo || prefijo.length === 0) {
            console.warn('⚠️ Prefijo de orden inválido, usando fallback');
            return `FALLBACK-${Date.now()}`;
        }

        // 2. Solicitar al backend el siguiente ID secuencial
        const respuesta = await fetch(`${window.rifaplusConfig.backend.apiBase}/api/admin/order-counter/next`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cliente_id: window.rifaplusConfig.cliente.id })
        });

        if (!respuesta.ok) {
            console.warn('⚠️ Backend no disponible para generar ID, usando localStorage');
            return generarIdOrdenLocalStorage(prefijo);
        }

        const data = await respuesta.json();
        if (data.success && data.orden_id) {
            // IMPORTANTE: Reconstruir el ID con el prefijo dinámico actual
            // El backend puede devolver un ID con un prefijo antiguo
            // Ej: Backend devuelve "SY-AA004", pero prefijo actual es "RET"
            // Resultado: "RET-AA004"
            const ordenIdDelBackend = data.orden_id;
            let ordenIdFinal = ordenIdDelBackend;
            
            // Extraer la secuencia del ID del backend (ej: "SY-AA004" → "AA004")
            const secuenciaMatch = ordenIdDelBackend.match(/-(.+)$/);
            if (secuenciaMatch) {
                const secuencia = secuenciaMatch[1];
                ordenIdFinal = `${prefijo}-${secuencia}`;
                
                // Log solo si hubo cambio de prefijo
                if (!ordenIdDelBackend.startsWith(prefijo)) {
                    console.log(`ℹ️  ID de orden actualizado a prefijo dinámico: ${ordenIdDelBackend} → ${ordenIdFinal}`);
                }
            }
            
            // Guardar en localStorage como respaldo
            guardarIdEnLocalStorage(ordenIdFinal);
            
            // CRÍTICO: Guardar el ID actualizado en el cliente también
            // Esto asegura que cuando se abre el modal, tenga el prefijo correcto
            const cliente = JSON.parse(localStorage.getItem('rifaplus_cliente') || '{}');
            cliente.ordenId = ordenIdFinal;
            localStorage.setItem('rifaplus_cliente', JSON.stringify(cliente));
            
            return ordenIdFinal;
        } else {
            console.warn('⚠️ Error en respuesta del servidor:', data.message);
            const prefijo = window.rifaplusConfig?.cliente?.prefijoOrden || 'ORD';
            const ordenIdFinal = generarIdOrdenLocalStorage(prefijo);
            
            // Guardar el ID en el cliente
            const cliente = JSON.parse(localStorage.getItem('rifaplus_cliente') || '{}');
            cliente.ordenId = ordenIdFinal;
            localStorage.setItem('rifaplus_cliente', JSON.stringify(cliente));
            
            return ordenIdFinal;
        }

    } catch (error) {
        console.error('❌ Error generando ID:', error);
        // Fallback: generar localmente si el backend falla (usa prefijo dinámico de config)
        const prefijo = window.rifaplusConfig?.cliente?.prefijoOrden || 'ORD';
        const ordenIdFinal = generarIdOrdenLocalStorage(prefijo);
        
        // Guardar el ID en el cliente también (CRÍTICO)
        const cliente = JSON.parse(localStorage.getItem('rifaplus_cliente') || '{}');
        cliente.ordenId = ordenIdFinal;
        localStorage.setItem('rifaplus_cliente', JSON.stringify(cliente));
        
        return ordenIdFinal;
    }
}

/**
 * generarIdOrdenLocalStorage - Genera ID localmente como fallback
 * IMPORTANTE: Este fallback solo debería usarse si el backend está completamente caído
 * Para evitar conflictos, usa un timestamp y UUID parcial
 * @param {string} prefijo - Prefijo dinámico (ej: "SY")
 * @returns {string} ID de orden formateado
 */
function generarIdOrdenLocalStorage(prefijo) {
    // En lugar de un contador simple que puede causar conflictos,
    // usar una combinación de timestamp + random para garantizar unicidad
    // Formato: SY-TS[timestamp][random]
    // Esto previene conflictos incluso si el fallback se usa múltiples veces
    
    const ahora = Date.now();
    const random = Math.floor(Math.random() * 100000);
    const numeroUnico = String(ahora + random).slice(-3); // Últimos 3 dígitos
    const secuencia = String(Math.floor((ahora + random) / 1000) % 676).toString(26).toUpperCase().padStart(2, '0');
    
    const id = `${prefijo}-${secuencia}${numeroUnico}`;
    
    console.warn(`⚠️ Usando fallback localStorage para ID: ${id}`);
    console.warn(`⚠️ ADVERTENCIA: Backend no disponible. El servidor puede rechazar esta orden si el ID ya existe.`);
    
    return id;
}

/**
 * incrementarSecuencia - Avanza la secuencia alfabética (AA → AB → AC... ZZ)
 * @param {string} secuencia - Secuencia actual (ej: "AA")
 * @returns {string} Siguiente secuencia (ej: "AB")
 */
function incrementarSecuencia(secuencia) {
    if (secuencia.length !== 2) return 'AA';
    
    let [letra1, letra2] = secuencia.split('');
    
    // Incrementar segunda letra
    letra2 = String.fromCharCode(letra2.charCodeAt(0) + 1);
    
    // Si excede 'Z', reiniciar y avanzar primera letra
    if (letra2 > 'Z') {
        letra2 = 'A';
        letra1 = String.fromCharCode(letra1.charCodeAt(0) + 1);
    }
    
    // Si excede 'Z', volvemos a 'AA' (ciclo completo)
    if (letra1 > 'Z') {
        return 'AA';
    }
    
    return letra1 + letra2;
}

/**
 * guardarIdEnLocalStorage - Registra un ID como usado en localStorage
 * @param {string} orderId - ID de orden a registrar
 */
function guardarIdEnLocalStorage(orderId) {
    const usedKey = 'rifaplus_used_order_ids';
    let used = [];
    
    try {
        used = JSON.parse(localStorage.getItem(usedKey) || '[]');
        if (!Array.isArray(used)) used = [];
    } catch (e) {
        used = [];
    }
    
    // Evitar duplicados
    if (!used.includes(orderId)) {
        used.push(orderId);
        // Mantener solo los últimos 10000 IDs para no llenar localStorage
        if (used.length > 10000) {
            used = used.slice(-10000);
        }
        try {
            localStorage.setItem(usedKey, JSON.stringify(used));
        } catch (e) {
            console.warn('⚠️ No se pudo guardar IDs en localStorage');
        }
    }
}

/* ============================================================ */
/* SECCIÓN 4: ALMACENAMIENTO DE DATOS DE CLIENTE               */
/* ============================================================ */

/**
 * guardarClienteEnStorage - Guarda datos del cliente en localStorage
 * @param {string} nombre - Nombre del cliente
 * @param {string} apellidos - Apellidos del cliente
 * @param {string} whatsapp - Número de WhatsApp
 * @param {string} estado - Estado/Departamento
 * @param {string} ciudad - Ciudad/Localidad
 * @returns {Promise<Object>} Objeto con datos guardados
 */
async function guardarClienteEnStorage(nombre, apellidos, whatsapp, estado, ciudad) {
    // Generar ID único (ahora es async)
    const ordenId = await generarIdOrden();
    
    const clienteData = {
        nombre,
        apellidos,
        whatsapp,
        estado: estado || undefined,
        ciudad: ciudad || undefined,
        ordenId: ordenId,
        fecha: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('rifaplus_cliente', JSON.stringify(clienteData));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('⚠️ [MODAL] localStorage lleno, datos del cliente en memoria (DB es autoridad)');
            // Silent fail - datos están en clienteData variable
            // Continuar sin bloquear - el backend tiene la verdad
        } else {
            console.error('❌ Error guardando cliente en storage:', e);
        }
    }
    
    return clienteData;
}

/**
 * obtenerClienteDelStorage - Recupera datos del cliente del almacenamiento
 * @returns {Object|null} Objeto con datos del cliente o null
 */
function obtenerClienteDelStorage() {
    const data = localStorage.getItem('rifaplus_cliente');
    return data ? JSON.parse(data) : null;
}

/**
 * guardarBoletoSeleccionadosEnStorage - Guarda boletos seleccionados en localStorage
 * @returns {void}
 */
function guardarBoletoSeleccionadosEnStorage() {
    try {
        // Guardar números seleccionados para que aparezcan en la orden
        const boletos = Array.from(selectedNumbersGlobal);
        localStorage.setItem('rifaplus_boletos', JSON.stringify(boletos));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('⚠️ [MODAL] localStorage lleno, continuando sin guardar boletos (DB es autoridad)');
            // Silent fail - los boletos ya están en selectedNumbersGlobal en memoria
            // El backend tiene la verdad. Continuar sin bloquear.
        } else {
            console.error('❌ Error guardando boletos en storage:', e);
        }
    }
    
    // ✅ NOTA: Las oportunidades YA fueron calculadas por carrito-global.js
    // y están guardadas en localStorage 'rifaplus_oportunidades'
    // NO recalcular aquí para evitar duplicados o conflictos
    // El siguiente paso es flujo-compra.js que las recupera de localStorage
}

/* ============================================================ */
/* SECCIÓN 5: INICIALIZACIÓN Y EVENT LISTENERS                */
/* ============================================================ */

/**
 * Configura todos los event listeners del modal de contacto
 */
document.addEventListener('DOMContentLoaded', function() {
    const btnCancelarContacto = document.getElementById('btnCancelarContacto');
    const btnContinuarContacto = document.getElementById('btnContinuarContacto');
    const closeContacto = document.getElementById('closeContacto');
    const formularioContacto = document.getElementById('formularioContacto');
    const inputWhatsapp = document.getElementById('clienteWhatsapp');
    const inputNombre = document.getElementById('clienteNombre');
    const inputApellidos = document.getElementById('clienteApellidos');
    const inputCiudad = document.getElementById('clienteCiudad');
    
    // 🔤 CONVERTIR A MAYÚSCULAS AUTOMÁTICAMENTE en campos de texto
    const fieldsToUppercase = [inputNombre, inputApellidos, inputCiudad];
    fieldsToUppercase.forEach(field => {
        if (field) {
            field.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });
            field.addEventListener('change', function() {
                this.value = this.value.toUpperCase();
            });
        }
    });
    
    // Validación en tiempo real para WhatsApp: solo números
    if (inputWhatsapp) {
        inputWhatsapp.addEventListener('input', function(e) {
            // Remover cualquier carácter que no sea número
            this.value = this.value.replace(/[^0-9]/g, '');
            // Limitar a 10 dígitos
            if (this.value.length > 10) {
                this.value = this.value.slice(0, 10);
            }
        });
        
        inputWhatsapp.addEventListener('keypress', function(e) {
            // Permitir solo números
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    }
    
    // Cerrar modal
    if (btnCancelarContacto) {
        btnCancelarContacto.addEventListener('click', cerrarModalContacto);
    }
    
    if (closeContacto) {
        closeContacto.addEventListener('click', cerrarModalContacto);
    }
    
    // Cerrar al hacer click fuera del modal (en el overlay)
    const modalOverlay = document.getElementById('modalContacto');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', function(e) {
            if (e.target === modalOverlay) {
                cerrarModalContacto();
            }
        });
    }
    
    // Continuar (validar y proceder a orden)
    if (btnContinuarContacto) {
        btnContinuarContacto.addEventListener('click', async function(e) {
            e.preventDefault();
            
            if (validarFormularioContacto()) {
                const nombre = document.getElementById('clienteNombre').value.trim();
                const apellidos = document.getElementById('clienteApellidos').value.trim();
                const whatsapp = document.getElementById('clienteWhatsapp').value.trim();
                const estado = document.getElementById('clienteEstado') ? document.getElementById('clienteEstado').value : '';
                const ciudad = document.getElementById('clienteCiudad') ? document.getElementById('clienteCiudad').value.trim() : '';

                // Guardar en storage (ahora es async)
                await guardarClienteEnStorage(nombre, apellidos, whatsapp, estado, ciudad);
                guardarBoletoSeleccionadosEnStorage();
                
                // Si estamos en flujo de pago en compra.html, llamar al callback
                if (window.rifaplusFlujoPago && typeof window.onContactoConfirmado === 'function') {
                    try {
                        window.onContactoConfirmado();
                    } catch (err) {
                        // Fallback: volver a la página de compra donde está el flujo integrado
                        window.location.href = 'compra.html';
                    }
                } else {
                    // Fallback global: redirigir a `compra.html`
                    window.location.href = 'compra.html';
                }
            } else {
                rifaplusUtils.showFeedback('⚠️ Por favor completa correctamente el formulario', 'warning');
            }
        });
    }
    
    // Permitir Enter para enviar
    if (formularioContacto) {
        formularioContacto.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                btnContinuarContacto.click();
            }
        });
    }
});

// Exportar función para que compra.js pueda usarla
// (o ya está disponible globalmente)