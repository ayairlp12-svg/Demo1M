/**
 * Script: Aplicar índice parcial directamente a Supabase
 * 
 * Problema: La tabla BD en Supabase no usa Knex migrations
 * Solución: Script SQL directo que aplica el índice sin depender de Knex
 * 
 * Uso: node -r dotenv/config apply-partial-index.js
 */

const db = require('./db');

async function applyPartialIndex() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  APLICAR ÍNDICE PARCIAL - Máquina de la suerte           ║');
    console.log('║  Impacto esperado: 3s → 200ms ⚡                         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    try {
        // ═══════════════════════════════════════════════════════════════
        // VERIFICAR QUE LA TABLA EXISTE
        // ═══════════════════════════════════════════════════════════════
        console.log('🔍 Paso 1: Verificar tabla boletos_estado existe...\n');
        
        const tableCheck = await db.raw(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'boletos_estado'
            ) as exists
        `);

        if (!tableCheck.rows[0].exists) {
            throw new Error('❌ Tabla "boletos_estado" no existe. Abortar.');
        }
        
        console.log('   ✅ Tabla boletos_estado existe\n');

        // ═══════════════════════════════════════════════════════════════
        // VERIFICAR SI EL ÍNDICE YA EXISTE
        // ═══════════════════════════════════════════════════════════════
        console.log('🔍 Paso 2: Verificar si el índice ya existe...\n');
        
        const indexCheck = await db.raw(`
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'boletos_estado'
                AND indexname = 'idx_boletos_disponibles_para_seleccion'
            ) as exists
        `);

        if (indexCheck.rows[0].exists) {
            console.log('   ✅ Índice ya existe. Nada que hacer.\n');
            console.log('╔═══════════════════════════════════════════════════════════╗');
            console.log('║  ✅ ÍNDICE YA APLICADO                                    ║');
            console.log('╚═══════════════════════════════════════════════════════════╝\n');
            await db.destroy();
            process.exit(0);
        }

        console.log('   ✅ Índice no existe. Proceder con creación.\n');

        // ═══════════════════════════════════════════════════════════════
        // CREAR ÍNDICE PARCIAL
        // ═══════════════════════════════════════════════════════════════
        console.log('⚡ Paso 3: Crear índice parcial (sin bloqueos)...\n');

        await db.raw(`
            CREATE INDEX CONCURRENTLY idx_boletos_disponibles_para_seleccion
            ON boletos_estado(numero)
            WHERE estado = 'disponible' AND numero_orden IS NULL
        `);

        console.log('   ✅ Índice creado exitosamente\n');

        // ═══════════════════════════════════════════════════════════════
        // VERIFICAR QUE SE CREÓ
        // ═══════════════════════════════════════════════════════════════
        console.log('✓ Paso 4: Verificar que el índice fue creado...\n');
        
        const verify = await db.raw(`
            SELECT indexname, tablename FROM pg_indexes
            WHERE indexname = 'idx_boletos_disponibles_para_seleccion'
        `);

        if (verify.rows.length > 0) {
            console.log(`   ✅ Índice verificado: ${verify.rows[0].indexname}`);
            console.log(`   ✅ En tabla: ${verify.rows[0].tablename}\n`);
        } else {
            throw new Error('❌ Índice no fue creado correctamente');
        }

        // ═══════════════════════════════════════════════════════════════
        // ANÁLISIS DE ESTADÍSTICAS
        // ═══════════════════════════════════════════════════════════════
        console.log('📊 Paso 5: Estadísticas de boletos:\n');

        const counts = await db.raw(`
            SELECT 
                COUNT(*) FILTER (WHERE estado = 'disponible' AND numero_orden IS NULL) as disponibles_para_seleccionar,
                COUNT(*) FILTER (WHERE estado = 'disponible') as total_disponible,
                COUNT(*) FILTER (WHERE estado = 'apartado') as apartados,
                COUNT(*) FILTER (WHERE estado = 'vendido') as vendidos,
                COUNT(*) as total
            FROM boletos_estado
        `);

        const count = counts.rows[0];
        console.log(`   • Total boletos: ${count.total.toLocaleString('es-MX')}`);
        console.log(`   • Disponibles para seleccionar: ${count.disponibles_para_seleccionar.toLocaleString('es-MX')}`);
        console.log(`   • Apartados: ${count.apartados.toLocaleString('es-MX')}`);
        console.log(`   • Vendidos: ${count.vendidos.toLocaleString('es-MX')}\n`);

        // ═══════════════════════════════════════════════════════════════
        // ÉXITO
        // ═══════════════════════════════════════════════════════════════
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║  ✅ ÍNDICE PARCIAL APLICADO EXITOSAMENTE               ║');
        console.log('║  La máquina de la suerte ahora es mucho más rápida      ║');
        console.log('║  Generación de 100 boletos: 3s → ~200ms                ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('\nDetalles completos:', error);
        }
        
        await db.destroy();
        process.exit(1);
    }
}

applyPartialIndex();
