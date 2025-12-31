/**
 * Script: Sincronizar boletos de órdenes CANCELADAS
 * 
 * Problema: Órdenes canceladas tienen boletos que siguen en estado "apartado"
 * Solución: Recorrer todas las órdenes canceladas y liberar sus boletos
 * 
 * USO: node backend/scripts/fix-boletos-canceladas.js
 */

// ✅ CRÍTICO: Cargar .env PRIMERO, antes de cualquier require
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('../db');

async function sincronizarBoletoscanceladas() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  FIX: Sincronizar boletos de órdenes CANCELADAS       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    let totalOrdenesCanceladas = 0;
    let totalBoletosSincronizados = 0;
    let errores = [];

    try {
        // 1. Buscar todas las órdenes CANCELADAS **SIN COMPROBANTE**
        const ordenesCanceladas = await db('ordenes')
            .where('estado', 'cancelada')
            .whereNull('comprobante_path')  // ⭐ SOLO sin comprobante
            .select('id', 'numero_orden', 'boletos', 'created_at');

        console.log(`📋 Encontradas ${ordenesCanceladas.length} órdenes CANCELADAS SIN COMPROBANTE\n`);
        totalOrdenesCanceladas = ordenesCanceladas.length;

        // 2. Para cada orden cancelada, liberar sus boletos
        for (const orden of ordenesCanceladas) {
            try {
                let boletos = [];
                
                // Parsear boletos
                if (Array.isArray(orden.boletos)) {
                    boletos = orden.boletos.map(n => {
                        const num = parseInt(n, 10);
                        return isNaN(num) ? null : num;
                    }).filter(n => n !== null);
                } else if (typeof orden.boletos === 'string') {
                    try {
                        boletos = JSON.parse(orden.boletos || '[]');
                        if (!Array.isArray(boletos)) boletos = [];
                    } catch (e) {
                        if (orden.boletos.length > 0) {
                            boletos = orden.boletos.split(',').map(n => {
                                const num = parseInt(n.trim(), 10);
                                return isNaN(num) ? null : num;
                            }).filter(n => n !== null);
                        }
                    }
                }

                if (boletos.length === 0) {
                    console.log(`⊘ ${orden.numero_orden}: Sin boletos`);
                    continue;
                }

                // Liberar TODOS los boletos (sin verificar estado previo)
                // Solo actualizar los que existan en boletos_estado
                const actualizados = await db('boletos_estado')
                    .whereIn('numero', boletos)
                    .update({
                        estado: 'disponible',
                        numero_orden: null,
                        reservado_en: null,
                        vendido_en: null,
                        updated_at: new Date()
                    });

                console.log(`\n📌 Orden ${orden.numero_orden}: ${boletos.length} boletos`);
                if (actualizados > 0) {
                    console.log(`   ✅ Liberados ${actualizados} boletos a DISPONIBLE`);
                    totalBoletosSincronizados += actualizados;
                } else {
                    console.log(`   ⊘ No se encontraron boletos para liberar`);
                }

            } catch (error) {
                console.error(`   ❌ Error procesando ${orden.numero_orden}:`, error.message);
                errores.push(`${orden.numero_orden}: ${error.message}`);
            }
        }

        // Resumen final
        console.log(`\n╔════════════════════════════════════════════════════════╗`);
        console.log(`║              ✅ SINCRONIZACIÓN COMPLETADA             ║`);
        console.log(`╠════════════════════════════════════════════════════════╣`);
        console.log(`║ Órdenes canceladas: ${totalOrdenesCanceladas.toString().padEnd(36)}║`);
        console.log(`║ Boletos liberados: ${totalBoletosSincronizados.toString().padEnd(37)}║`);
        if (errores.length > 0) {
            console.log(`║ Errores: ${errores.length.toString().padEnd(47)}║`);
            errores.forEach(e => {
                console.log(`║   - ${e.substring(0, 50).padEnd(50)}║`);
            });
        }
        console.log(`╚════════════════════════════════════════════════════════╝\n`);

        process.exit(0);

    } catch (error) {
        console.error('❌ ERROR CRÍTICO:', error.message);
        console.error(error);
        process.exit(1);
    }
}

sincronizarBoletoscanceladas();
