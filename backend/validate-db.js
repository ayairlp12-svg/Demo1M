/**
 * Script: Validar que BD está correctamente inicializada
 * Uso: node -r dotenv/config validate-db.js
 * 
 * Verifica:
 * ✅ Todas las tablas existen
 * ✅ Índices reales del proyecto están creados
 * ✅ Sin tablas con typos (order_oportunidades vs orden_oportunidades)
 * ✅ Sin códigigo muerto (functions eliminadas)
 * ✅ Constraint única de ordenes.numero_orden intacta
 * ✅ Índices estratégicos/recomendados reportados por separado
 * 
 * NOTA: Esta validación se alinea con las migraciones reales del repositorio.
 */

const db = require('./db');

// Colores para salida
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
};

async function validateDatabase() {
    console.log(`\n${colors.bold}${colors.cyan}╔${'═'.repeat(60)}╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║  VALIDAR INTEGRIDAD DE BD - RifaPlus${' '.repeat(23)}║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚${'═'.repeat(60)}╝${colors.reset}\n`);

    let criticalErrors = 0;
    let warnings = 0;

    try {
        // ═══════════════════════════════════════════════════════════════
        // PASO 1: VERIFICAR TABLAS PRINCIPALES
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.bold}📋 Paso 1: Verificar tablas principales${colors.reset}\n`);

        const requiredTables = {
            'ordenes': { critical: true },
            'boletos_estado': { critical: true },
            'orden_oportunidades': { critical: true },
            'admin_users': { critical: true },
            'ganadores': { critical: true },
            'order_id_counter': { critical: false },
            'knex_migrations': { critical: false },
            'knex_migrations_lock': { critical: false }
        };

        const tablesResult = await db.raw(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        const existingTables = new Set(tablesResult.rows.map(r => r.tablename));

        // Detectar typos comunes
        const typos = {
            'order_oportunidades': 'orden_oportunidades',
            'boleto_estado': 'boletos_estado',
            'ordenes_oportunidades': 'orden_oportunidades'
        };

        for (const [typo, correct] of Object.entries(typos)) {
            if (existingTables.has(typo)) {
                log.error(`Tabla con typo detectada: "${typo}" (debería ser "${correct}")`);
                log.error(`   → Esta tabla debe ser eliminada/renombrada`);
                criticalErrors++;
            }
        }

        let tablesOk = true;
        for (const [table, meta] of Object.entries(requiredTables)) {
            if (existingTables.has(table)) {
                console.log(`   ${colors.green}✅${colors.reset} ${table}`);
            } else {
                const severity = meta.critical ? '❌ CRÍTICA' : '⚠️  OPCIONAL';
                console.log(`   ${severity}: ${table}`);
                if (meta.critical) {
                    criticalErrors++;
                    tablesOk = false;
                } else {
                    warnings++;
                }
            }
        }

        console.log(`\n   Total: ${existingTables.size} tablas\n`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 2: VERIFICAR ÍNDICES CRÍTICOS
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.bold}🔑 Paso 2: Verificar índices CRÍTICOS${colors.reset}\n`);

        const indexResult = await db.raw(`
            SELECT 
                indexname, 
                tablename,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);

        const existingIndexes = indexResult.rows;
        const existingIndexNames = new Set(existingIndexes.map(i => i.indexname));

        const criticalIndexes = [
            {
                name: 'idx_boletos_estado',
                table: 'boletos_estado',
                critical: true,
                reason: 'Filtro base por estado en boletos'
            },
            {
                name: 'idx_boletos_numero_orden_estado',
                table: 'boletos_estado',
                critical: true,
                reason: 'Liberación y actualización por orden/estado'
            },
            {
                name: 'idx_ordenes_numero_orden',
                table: 'ordenes',
                critical: true,
                reason: 'Lookup rápido por numero_orden'
            },
            {
                name: 'idx_opp_estado_numero_orden',
                table: 'orden_oportunidades',
                critical: true,
                reason: 'Disponibilidad y asignación de oportunidades'
            },
            {
                name: 'idx_opp_numero_oportunidad',
                table: 'orden_oportunidades',
                critical: true,
                reason: 'Búsqueda directa por oportunidad'
            }
        ];

        const recommendedIndexes = [
            {
                name: 'idx_opp_disponibles',
                table: 'orden_oportunidades',
                reason: 'Optimiza oportunidades disponibles'
            },
            {
                name: 'idx_opp_numero_optimizado',
                table: 'orden_oportunidades',
                reason: 'Acelera joins por numero_orden'
            },
            {
                name: 'idx_boletos_vendidos_fecha',
                table: 'boletos_estado',
                reason: 'Estadísticas y dashboard de vendidos'
            },
            {
                name: 'idx_ordenes_expiracion',
                table: 'ordenes',
                reason: 'Limpieza de órdenes pendientes expiradas'
            }
        ];

        const legacyIndexes = [
            {
                name: 'idx_estado_boleto',
                table: 'boletos_estado',
                reason: 'Índice legacy de creación inicial'
            },
            {
                name: 'idx_numero_orden_boleto',
                table: 'boletos_estado',
                reason: 'Índice legacy de creación inicial'
            },
            {
                name: 'idx_estado_tiempo',
                table: 'boletos_estado',
                reason: 'Índice legacy para estado + reservado_en'
            },
            {
                name: 'idx_numero_boleto',
                table: 'boletos_estado',
                reason: 'Índice legacy para número'
            },
            {
                name: 'idx_opp_numero_orden_estado',
                table: 'orden_oportunidades',
                reason: 'Índice compuesto legacy aún válido'
            }
        ];

        let indexesOk = true;
        for (const idx of criticalIndexes) {
            const exists = existingIndexNames.has(idx.name);
            if (exists) {
                const severity = idx.critical ? '✅' : '✓ ';
                console.log(`   ${colors.green}${severity}${colors.reset} ${idx.name} (${idx.reason})`);
            } else {
                const severity = idx.critical ? '❌ CRÍTICO' : '⚠️  RECOMENDADO';
                console.log(`   ${severity}: ${idx.name}`);
                if (idx.critical) {
                    criticalErrors++;
                    indexesOk = false;
                } else {
                    warnings++;
                }
            }
        }

        console.log(`\n${colors.bold}   Índices recomendados:${colors.reset}`);
        for (const idx of recommendedIndexes) {
            const exists = existingIndexNames.has(idx.name);
            if (exists) {
                console.log(`   ${colors.green}✓${colors.reset} ${idx.name} (${idx.reason})`);
            } else {
                console.log(`   ${colors.yellow}⚠️${colors.reset} ${idx.name} (${idx.reason})`);
                warnings++;
            }
        }

        const presentLegacyIndexes = legacyIndexes.filter((idx) => existingIndexNames.has(idx.name));
        if (presentLegacyIndexes.length > 0) {
            console.log(`\n${colors.bold}   Índices legacy detectados:${colors.reset}`);
            for (const idx of presentLegacyIndexes) {
                console.log(`   ${colors.cyan}ℹ️${colors.reset} ${idx.name} (${idx.reason})`);
            }
        }

        const constraintsResult = await db.raw(`
            SELECT
                conname,
                conrelid::regclass::text AS tablename,
                pg_get_constraintdef(oid) AS definition
            FROM pg_constraint
            WHERE connamespace = 'public'::regnamespace
        `);

        const hasOrdenesNumeroOrdenUnique = constraintsResult.rows.some((constraint) => (
            constraint.tablename === 'ordenes' &&
            typeof constraint.definition === 'string' &&
            constraint.definition.includes('UNIQUE (numero_orden)')
        ));

        console.log(`\n${colors.bold}   Constraints críticas:${colors.reset}`);
        if (hasOrdenesNumeroOrdenUnique) {
            console.log(`   ${colors.green}✅${colors.reset} UNIQUE (numero_orden) en ordenes`);
        } else {
            console.log(`   ${colors.red}❌ CRÍTICO${colors.reset}: Falta UNIQUE (numero_orden) en ordenes`);
            criticalErrors++;
            indexesOk = false;
        }

        console.log(`\n   Total índices en BD: ${existingIndexes.length}\n`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 3: VERIFICAR FUNCIONES ELIMINADAS (V4.2)
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.bold}🧹 Paso 3: Verificar que funciones muertas están eliminadas${colors.reset}\n`);

        const deadFunctions = [
            'check_bd_size',
            'check_conexiones_activas',
            'check_transacciones_largas',
            'check_table_bloat',
            'run_all_health_checks',
            'siguiente_numero_boleto',
            'siguiente_numero_oportunidad',
            'generar_numero_orden'
        ];

        const functionsResult = await db.raw(`
            SELECT routine_name FROM information_schema.routines 
            WHERE routine_schema = 'public'
        `);

        const existingFunctions = new Set(functionsResult.rows.map(r => r.routine_name));

        let deadFunctionsOk = true;
        for (const func of deadFunctions) {
            if (!existingFunctions.has(func)) {
                console.log(`   ${colors.green}✅${colors.reset} ${func} - eliminada`);
            } else {
                console.log(`   ${colors.red}❌${colors.reset} ${func} - AÚN EXISTE (debe eliminarse)`);
                criticalErrors++;
                deadFunctionsOk = false;
            }
        }

        console.log(`\n   Funciones activas: ${existingFunctions.size}\n`);

        // ═══════════════════════════════════════════════════════════════
        // PASO 4: VERIFICAR DATOS DE TABLAS
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.bold}📊 Paso 4: Estadísticas de datos${colors.reset}\n`);

        const statsTable = ['ordenes', 'boletos_estado', 'orden_oportunidades', 'admin_users'];
        for (const table of statsTable) {
            try {
                const countResult = await db.raw(`SELECT COUNT(*) as count FROM ${table}`);
                const count = parseInt(countResult.rows[0].count);
                
                const display = count === 0 
                    ? `${colors.cyan}vacía${colors.reset}` 
                    : `${count.toLocaleString('es-MX')} registros`;
                    
                console.log(`   • ${table}: ${display}`);
            } catch (e) {
                console.log(`   ${colors.red}❌${colors.reset} ${table} - error al contar`);
                criticalErrors++;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // RESULTADO FINAL
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${'═'.repeat(62)}\n`);

        if (criticalErrors === 0) {
            console.log(`${colors.bold}${colors.green}✅ BD VALIDADA CORRECTAMENTE${colors.reset}\n`);
            console.log(`${'═'.repeat(62)}\n`);
            
            if (warnings > 0) {
                console.log(`${colors.bold}Advertencias (no críticas):${colors.reset}`);
                console.log(`   ${warnings} advertencia(s) - considere resolverlas\n`);
            }
            
            console.log(`${colors.bold}Estado:${colors.reset}`);
            console.log(`   ${colors.green}✅${colors.reset} Tablas principales: OK`);
            console.log(`   ${colors.green}✅${colors.reset} Índices críticos: OK`);
            console.log(`   ${colors.green}✅${colors.reset} Funciones: OK`);
            console.log(`   ${colors.green}✅${colors.reset} Datos: OK`);
            console.log(`\n   ${colors.bold}BD lista para producción${colors.reset}\n`);
            
            await db.destroy();
            process.exit(0);
        } else {
            console.log(`${colors.bold}${colors.red}❌ BD TIENE PROBLEMAS CRÍTICOS${colors.reset}\n`);
            console.log(`${'═'.repeat(62)}\n`);
            console.log(`${colors.bold}Errores encontrados: ${criticalErrors}${colors.reset}\n`);
            
            if (!tablesOk) {
                console.log(`   ${colors.red}→${colors.reset} Faltan tablas críticas`);
                console.log(`     Ejecutar: ${colors.cyan}npm run migrate${colors.reset}`);
            }
            if (!indexesOk) {
                console.log(`   ${colors.red}→${colors.reset} Faltan índices críticos`);
                console.log(`     Ejecutar: ${colors.cyan}npm run migrate${colors.reset}`);
            }
            if (!deadFunctionsOk) {
                console.log(`   ${colors.red}→${colors.reset} Funciones obsoletas presentes`);
                console.log(`     Ejecutar: ${colors.cyan}node execute-v4-2-cleanup.js${colors.reset}`);
            }
            
            console.log(`\n${colors.bold}Requiere atención antes de producción.${colors.reset}\n`);
            
            await db.destroy();
            process.exit(1);
        }

    } catch (error) {
        console.error(`\n${colors.red}❌ ERROR en validación:${colors.reset}`, error.message);
        
        if (process.env.NODE_ENV === 'development') {
            console.error('\nDetalles completos:');
            console.error(error);
        }
        
        await db.destroy();
        process.exit(1);
    }
}

validateDatabase();
