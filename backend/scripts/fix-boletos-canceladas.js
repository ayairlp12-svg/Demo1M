/**
 * Script: Sincronizar boletos de órdenes CANCELADAS
 * 
 * Problema: Órdenes canceladas tienen boletos que siguen en estado "apartado"
 * Solución: Recorrer todas las órdenes canceladas y liberar sus boletos
 * 
 * USO: node backend/scripts/fix-boletos-canceladas.js
 */

const db = require('../db');
const path = require('path');

async function sincronizarBoletoscanceladas() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  FIX: Sincronizar boletos de órdenes CANCELADAS       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    let totalOrdenesCanceladas = 0;
    let totalBoletosSincronizados = 0;
    let errores = [];

    try {
        // 1. Buscar todas las órdenes CANCELADAS
        const ordenesCanceladas = await db('ordenes')
            .where('estado', 'cancelada')
            .select('id', 'numero_orden', 'boletos', 'created_at');

        console.log(`📋 Encontradas ${ordenesCanceladas.length} órdenes CANCELADAS\n`);
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

                // Verificar estado actual de los boletos
                const boletosActuales = await db('boletos_estado')
                    .whereIn('numero', boletos)
                    .select('numero', 'estado', 'numero_orden');

                const resumen = {
                    disponible: 0,
                    apartado: 0,
                    vendido: 0,
                    otros: 0
                };

                boletosActuales.forEach(b => {
                    if (b.estado === 'disponible') resumen.disponible++;
                    else if (b.estado === 'apartado') resumen.apartado++;
                    else if (b.estado === 'vendido') resumen.vendido++;
                    else resumen.otros++;
                });

                console.log(`\n📌 Orden ${orden.numero_orden} (${boletos.length} boletos)`);
                console.log(`   Estado actual: Disponible=${resumen.disponible}, Apartado=${resumen.apartado}, Vendido=${resumen.vendido}, Otros=${resumen.otros}`);

                // Si hay boletos NO disponibles, liberarlos
                if (resumen.apartado > 0 || resumen.vendido > 0) {
                    const actualizados = await db('boletos_estado')
                        .whereIn('numero', boletos)
                        .where('estado', '!=', 'disponible')
                        .update({
                            estado: 'disponible',
                            numero_orden: null,
                            reservado_en: null,
                            vendido_en: null,
                            updated_at: new Date()
                        });

                    console.log(`   ✅ Liberados ${actualizados} boletos de vuelta a DISPONIBLE`);
                    totalBoletosSincronizados += actualizados;
                } else {
                    console.log(`   ✓ Todos los boletos ya están en estado correcto`);
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
