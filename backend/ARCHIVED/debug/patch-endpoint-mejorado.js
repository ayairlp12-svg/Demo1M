/**
 * ACTUALIZACIÓN: endpoint PATCH /api/admin/config
 * UBICACIÓN: backend/server.js línea ~1985
 * 
 * CAMBIOS PRINCIPALES:
 * 1. Usa ConfigManagerV2 para guardar en BD
 * 2. Ya NO escribe en config.json directamente
 * 3. Mantiene mismo flujo de validación
 * 4. Recarga config en memoria desde BD
 * 
 * INSTALACIÓN:
 * 1. Reemplazar el endpoint PATCH actual con este código
 * 2. Al principio del server.js, cambiar:
 *    const configManager = new ConfigManager();
 *    Por:
 *    let configManagerV2; // Se inicializa en server startup
 * 3. En server startup (después de conectar BD):
 *    configManagerV2 = new ConfigManagerV2(db);
 *    await configManagerV2.inicializar();
 */

const ConfigManagerV2 = require('./config-manager-v2');

/**
 * ENDPOINT MEJORADO PATCH /api/admin/config
 * Todos los cambios se guardan en Supabase ahora
 */
app.patch('/api/admin/config', verificarToken, async (req, res) => {
    // 🔒 Verificar permiso de administrador
    if (req.usuario.rol !== 'administrador') {
        return res.status(403).json({
            success: false,
            message: 'Permiso denegado: Solo administradores pueden actualizar configuración'
        });
    }

    try {
        console.log('[PATCH /api/admin/config] 📥 Body recibido:', {
            tieneCliente: !!req.body.cliente,
            tieneRifa: !!req.body.rifa,
            tieneTecnica: !!req.body.tecnica
        });

        // 📖 PASO 1: Leer config actual desde el configManager
        let config = JSON.parse(JSON.stringify(configManagerV2.getConfig())); // Deep copy

        // ✅ PASO 2: Actualizar datos del cliente
        if (req.body.cliente) {
            if (!config.cliente) config.cliente = {};
            
            config.cliente.nombre = req.body.cliente.nombre || config.cliente.nombre;
            config.cliente.eslogan = req.body.cliente.eslogan || config.cliente.eslogan;
            config.cliente.telefono = req.body.cliente.telefono || config.cliente.telefono;
            config.cliente.email = req.body.cliente.email || config.cliente.email;
            
            if (req.body.cliente.imagenPrincipal) {
                config.cliente.imagenPrincipal = req.body.cliente.imagenPrincipal;
            }

            const logoRecibido = req.body.cliente.logo ?? req.body.cliente.logotipo;
            if (logoRecibido !== undefined) {
                config.cliente.logo = logoRecibido;
                config.cliente.logotipo = logoRecibido;
            }

            if (req.body.cliente.redesSociales) {
                config.cliente.redesSociales = req.body.cliente.redesSociales;
            }

            if (req.body.cliente.mensajesWhatsapp) {
                config.cliente.mensajesWhatsapp = req.body.cliente.mensajesWhatsapp;
            }

            console.log('[PATCH /api/admin/config] ✅ Datos del cliente actualizados');
        }

        // ✅ PASO 3: Actualizar datos de la rifa
        if (req.body.rifa) {
            if (!config.rifa) config.rifa = {};

            // Actualizar campos simples
            if (req.body.rifa.nombreSorteo) config.rifa.nombreSorteo = req.body.rifa.nombreSorteo;
            if (req.body.rifa.edicionNombre) config.rifa.edicionNombre = req.body.rifa.edicionNombre;
            if (req.body.rifa.estado) config.rifa.estado = req.body.rifa.estado;
            if (req.body.rifa.totalBoletos !== undefined) {
                config.rifa.totalBoletos = parseInt(req.body.rifa.totalBoletos) || config.rifa.totalBoletos;
            }
            if (req.body.rifa.precioBoleto !== undefined) {
                config.rifa.precioBoleto = parseFloat(req.body.rifa.precioBoleto) || config.rifa.precioBoleto;
            }
            if (req.body.rifa.descripcion) config.rifa.descripcion = req.body.rifa.descripcion;

            // Procesar fechaSorteo
            if (req.body.rifa.fechaSorteo) {
                config.rifa.fechaSorteo = req.body.rifa.fechaSorteo;
                try {
                    const fecha = new Date(req.body.rifa.fechaSorteo);
                    if (!isNaN(fecha.getTime())) {
                        const horas = String(fecha.getHours()).padStart(2, '0');
                        const minutos = String(fecha.getMinutes()).padStart(2, '0');
                        config.rifa.horaSorteo = `${horas}:${minutos}`;

                        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                        const dia = fecha.getDate();
                        const mes = meses[fecha.getMonth()];
                        config.rifa.fechaSorteoFormato = `${dia} de ${mes} del ${fecha.getFullYear()}`;
                    }
                } catch (e) {
                    console.error('⚠️  Error procesando fechaSorteo:', e.message);
                }
            }

            // Procesar descuentos
            if (req.body.rifa.descuentos !== undefined) {
                const descuentosRecibidos = req.body.rifa.descuentos || {};
                const reglasNormalizadas = Array.isArray(descuentosRecibidos.reglas)
                    ? descuentosRecibidos.reglas
                        .map(regla => {
                            const cantidad = parseInt(regla?.cantidad, 10);
                            const total = Number(regla?.total ?? regla?.precio);
                            const ahorro = Number(regla?.ahorro);

                            if (!Number.isFinite(cantidad) || cantidad <= 0 || 
                                !Number.isFinite(total) || total <= 0) {
                                return null;
                            }

                            return { cantidad, precio: total, total, ahorro };
                        })
                        .filter(Boolean)
                    : [];

                config.rifa.descuentos = {
                    ...(config.rifa.descuentos || {}),
                    enabled: Boolean(descuentosRecibidos.enabled),
                    reglas: reglasNormalizadas
                };
            }

            // Procesar oportunidades
            if (req.body.rifa.oportunidades !== undefined) {
                config.rifa.oportunidades = {
                    ...(config.rifa.oportunidades || {}),
                    ...(req.body.rifa.oportunidades || {})
                };
            }

            // Procesar tiempoApartadoHoras
            if (req.body.rifa.tiempoApartadoHoras !== undefined) {
                const nuevoTiempo = parseFloat(req.body.rifa.tiempoApartadoHoras);
                if (Number.isNaN(nuevoTiempo) || nuevoTiempo <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'tiempoApartadoHoras debe ser un número mayor a 0'
                    });
                }
                config.rifa.tiempoApartadoHoras = nuevoTiempo;
            }

            console.log('[PATCH /api/admin/config] ✅ Datos de la rifa actualizados');
        }

        // ✅ PASO 4: Actualizar cuentas bancarias
        if (req.body.tecnica?.bankAccounts) {
            try {
                const cuentasValidadas = req.body.tecnica.bankAccounts.map((cuenta, idx) => {
                    if (!cuenta.nombreBanco || !cuenta.accountNumber) {
                        throw new Error(`Cuenta ${idx + 1}: banco y número de cuenta son obligatorios`);
                    }
                    
                    return {
                        id: cuenta.id || (idx + 1),
                        nombreBanco: cuenta.nombreBanco.substring(0, 100),
                        accountNumber: cuenta.accountNumber.substring(0, 50),
                        beneficiary: cuenta.beneficiary ? cuenta.beneficiary.substring(0, 100) : '',
                        accountType: cuenta.accountType || 'Tarjeta',
                        paymentType: cuenta.paymentType || 'transferencia',
                        numero_referencia: cuenta.numero_referencia ? cuenta.numero_referencia.substring(0, 100) : '',
                        phone: cuenta.phone ? cuenta.phone.substring(0, 20) : ''
                    };
                });

                if (!config.tecnica) config.tecnica = {};
                config.tecnica.bankAccounts = cuentasValidadas;
                console.log('[PATCH /api/admin/config] ✅ Cuentas bancarias actualizadas');
            } catch (bankError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validación de cuentas fallida: ' + bankError.message
                });
            }
        }

        // 💾 PASO 5: GUARDAR EN SUPABASE (NUEVO)
        try {
            await configManagerV2.guardarEnBD(config, req.usuario.username);
            console.log('[PATCH /api/admin/config] ✅ Config guardada en Supabase');
        } catch (saveError) {
            console.error('[PATCH /api/admin/config] ❌ Error guardando en Supabase:', saveError.message);
            return res.status(500).json({
                success: false,
                message: 'Error guardando configuración en BD',
                error: saveError.message
            });
        }

        // 🔄 PASO 6: Recargar en memoria
        try {
            await configManagerV2.reload();
            console.log('[PATCH /api/admin/config] ✅ ConfigManager recargado');
        } catch (reloadError) {
            console.error('[PATCH /api/admin/config] ❌ Error recargando:', reloadError.message);
        }

        // ✅ PASO 7: Retornar éxito
        console.log('[PATCH /api/admin/config] ✅ Operación completada exitosamente');
        
        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente en Supabase',
            data: {
                cliente: config.cliente,
                rifa: config.rifa,
                tecnica: config.tecnica,
                guardadoEn: 'Supabase',
                version: configManagerV2.cacheVersion
            }
        });

    } catch (error) {
        console.error('[PATCH /api/admin/config] ❌ Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error procesando solicitud',
            error: error.message
        });
    }
});

module.exports = { app };
