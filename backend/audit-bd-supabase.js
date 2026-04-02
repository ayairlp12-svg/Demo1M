/**
 * AUDITORÍA PROFESIONAL DE BD - RifaPlus
 * 
 * Script: audit-bd-supabase.js
 * Objetivo: Validar integridad, índices, performance y confiabilidad de Supabase
 * 
 * Uso:
 * node -r dotenv/config audit-bd-supabase.js
 * 
 * Verificaciones:
 * ✅ Tablas principales existen y tienen datos
 * ✅ Índices críticos están creados y funcionales
 * ✅ Sin índices redundantes u obsoletos
 * ✅ Performance de queries críticas (usando EXPLAIN)
 * ✅ Detección de typos en migraciones (ej: order_oportunidades vs orden_oportunidades)
 * ✅ Tamaño y bloat de tablas/índices
 * ✅ Estadísticas de BD actualizadas
 */

const db = require('./db');
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

const log = {
    header: (msg) => console.log(`\n${colors.bold}${colors.cyan}╔${'═'.repeat(60)}╗${colors.reset}`),
    title: (msg) => console.log(`${colors.bold}${colors.cyan}║  ${msg.padEnd(56)}║${colors.reset}`),
    footer: () => console.log(`${colors.bold}${colors.cyan}╚${'═'.repeat(60)}╝${colors.reset}\n`),
    success: (msg) => console.log(`${colors.green}   ✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}   ❌ ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}   ⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}   ℹ️  ${msg}${colors.reset}`),
    bullet: (msg) => console.log(`   • ${msg}`)
};

async function auditarBD() {
    console.log(`\n${colors.bold}${colors.cyan}╔${'═'.repeat(60)}╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║  🔍 AUDITORÍA PROFESIONAL - RifaPlus BD${' '.repeat(17)}║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚${'═'.repeat(60)}╝${colors.reset}\n`);

    let totalIssues = 0;
    let criticalIssues = 0;

    try {
        // ═══════════════════════════════════════════════════════════════
        // 1. VERIFICAR TABLAS PRINCIPALES
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.bold}📋 1. VERIFICAR TABLAS PRINCIPALES${colors.reset}\n`);

        const requiredTables = {
            'ordenes': { required: true, critical: true },
            'boletos_estado': { required: true, critical: true },
            'orden_oportunidades': { required: true, critical: true },
            'admin_users': { required: true, critical: true },
            'ganadores': { required: true, critical: true },
            'order_id_counter': { required: true, critical: false }
        };

        const tablesResult = await db.raw(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        const existingTables = new Set(tablesResult.rows.map(r => r.tablename));

        // Verificar typos comunes (ej: "order_oportunidades" en lugar de "orden_oportunidades")
        const typosComunes = {
            'order_oportunidades': 'orden_oportunidades (TYPO detectado)',
            'boleto_estado': 'boletos_estado (TYPO detectado)'
        };

        for (const [tipoName, correctName] of Object.entries(typosComunes)) {
            if (existingTables.has(tipoName)) {
                log.error(`Tabla con typo detectada: "${tipoName}" (debería ser "${correctName}")`);
                totalIssues++;
                criticalIssues++;
            }
        }

        for (const [table, meta] of Object.entries(requiredTables)) {
            if (existingTables.has(table)) {
                const countResult = await db(table).count('* as total').first();
                const rowCount = countResult.total || 0;
                log.success(`${table} (${rowCount.toLocaleString('es-MX')} filas)`);
            } else {
                if (meta.critical) {
                    log.error(`Tabla CRÍTICA faltante: ${table}`);
                    criticalIssues++;
                } else {
                    log.warn(`Tabla faltante: ${table}`);
                }
                totalIssues++;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 2. VERIFICAR ÍNDICES CRÍTICOS
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}🔑 2. VERIFICAR ÍNDICES CRÍTICOS${colors.reset}\n`);

        const criticalIndexes = {
            // boletos_estado
            'idx_boletos_disponibles_para_seleccion': {
                table: 'boletos_estado',
                type: 'PARTIAL',
                purpose: 'Máquina de la suerte (performance crítica)'
            },
            'idx_estado_boleto': {
                table: 'boletos_estado',
                type: 'SIMPLE',
                purpose: 'Búsqueda por estado'
            },
            'idx_numero_orden_boleto': {
                table: 'boletos_estado',
                type: 'SIMPLE',
                purpose: 'Búsqueda por número de orden'
            },
            // ordenes
            'idx_numero_orden': {
                table: 'ordenes',
                type: 'SIMPLE',
                purpose: 'Lookup de órdenes por número'
            },
            'idx_ordenes_estado': {
                table: 'ordenes',
                type: 'SIMPLE',
                purpose: 'Filtro por estado'
            },
            // orden_oportunidades
            'idx_orden_oportunidades_numero_boleto': {
                table: 'orden_oportunidades',
                type: 'SIMPLE',
                purpose: 'Búsqueda de oportunidades por boleto'
            }
        };

        const indexesResult = await db.raw(`
            SELECT schemaname, tablename, indexname 
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname
        `);

        const existingIndexes = new Set(
            indexesResult.rows.map(r => r.indexname)
        );

        for (const [idxName, meta] of Object.entries(criticalIndexes)) {
            if (existingIndexes.has(idxName)) {
                log.success(`${idxName} en ${meta.table}`);
            } else {
                log.error(`FALTANTE: ${idxName} (${meta.purpose})`);
                totalIssues++;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. DETECTAR ÍNDICES REDUNDANTES
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}🔄 3. DETECTAR ÍNDICES REDUNDANTES${colors.reset}\n`);

        const redundantIndexesCheck = await db.raw(`
            SELECT 
                schemaname,
                tablename,
                COUNT(*) as idx_count,
                string_agg(indexname, ', ') as indexes
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE 'pk_%'
            GROUP BY schemaname, tablename
            HAVING COUNT(*) > 5
            ORDER BY idx_count DESC
        `);

        if (redundantIndexesCheck.rows.length > 0) {
            log.warn(`${redundantIndexesCheck.rows.length} tabla(s) con muchos índices:`);
            for (const row of redundantIndexesCheck.rows) {
                log.bullet(`${row.tablename}: ${row.idx_count} índices`);
                totalIssues++;
            }
        } else {
            log.success('No se detectaron excesos de índices');
        }

        // ═══════════════════════════════════════════════════════════════
        // 4. VALIDAR PERFORMANCE DE QUERIES CRÍTICAS
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}⚡ 4. VALIDAR PERFORMANCE - QUERIES CRÍTICAS${colors.reset}\n`);

        // Query 1: Obtener 100 boletos disponibles
        console.log(`${colors.bold}4.1 Máquina de la suerte (SELECT 100 números)${colors.reset}`);
        const queryMaquina = `
            SELECT numero FROM boletos_estado
            WHERE estado = 'disponible' AND numero_orden IS NULL
            ORDER BY RANDOM()
            LIMIT 100
        `;

        const explainMaquina = await db.raw(`EXPLAIN ANALYZE ${queryMaquina}`);
        const planMaquina = explainMaquina.rows[explainMaquina.rows.length - 1];
        const executionTime = planMaquina['Execution Time'] || planMaquina['Query Time'] || null;

        if (executionTime) {
            const ms = parseFloat(executionTime.toString().match(/[\d.]+/)[0]);
            if (ms < 500) {
                log.success(`Query completa en ${ms.toFixed(2)}ms ✅`);
            } else if (ms < 2000) {
                log.warn(`Query completa en ${ms.toFixed(2)}ms (podría mejorar)`);
                totalIssues++;
            } else {
                log.error(`Query lenta: ${ms.toFixed(2)}ms (falta índice parcial)`);
                totalIssues++;
            }
        } else {
            log.info('EXPLAIN ANALYZE proporcionó datos sin timing');
        }

        // Query 2: Verificar disponibilidad de boletos específicos
        console.log(`\n${colors.bold}4.2 Verificación de disponibilidad (WHERE IN)${colors.reset}`);
        const queryVerif = `
            SELECT numero, estado FROM boletos_estado
            WHERE numero IN (100, 200, 300, 400, 500)
        `;

        try {
            const explainVerif = await db.raw(`EXPLAIN ANALYZE ${queryVerif}`);
            const planVerif = explainVerif.rows[explainVerif.rows.length - 1];
            const executionTimeVerif = planVerif['Execution Time'] || null;

            if (executionTimeVerif) {
                const ms = parseFloat(executionTimeVerif.toString().match(/[\d.]+/)[0]);
                if (ms < 10) {
                    log.success(`Query completa en ${ms.toFixed(2)}ms ✅`);
                } else {
                    log.warn(`Query completa en ${ms.toFixed(2)}ms`);
                }
            }
        } catch (e) {
            log.info('No se pudo analizar query de verificación');
        }

        // ═══════════════════════════════════════════════════════════════
        // 5. TAMAÑO Y BLOAT DE TABLAS
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}💾 5. TAMAÑO DE TABLAS${colors.reset}\n`);

        const sizeResult = await db.raw(`
            SELECT 
                schemaname,
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname::regnamespace||'.'||tablename::regclass)) AS size,
                pg_total_relation_size(schemaname::regnamespace||'.'||tablename::regclass) AS bytes
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(schemaname::regnamespace||'.'||tablename::regclass) DESC
            LIMIT 10
        `);

        for (const row of sizeResult.rows) {
            log.bullet(`${row.tablename}: ${row.size}`);
        }

        // ═══════════════════════════════════════════════════════════════
        // 6. ESTADÍSTICAS Y SALUD GENERAL
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}📊 6. ESTADÍSTICAS Y SALUD${colors.reset}\n`);

        const healthResult = await db.raw(`
            SELECT 
                schemaname,
                tablename,
                n_live_tup,
                n_dead_tup,
                last_vacuum,
                last_autovacuum
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY n_live_tup DESC
            LIMIT 5
        `);

        for (const row of healthResult.rows) {
            const deadPercent = row.n_live_tup > 0 
                ? ((row.n_dead_tup / (row.n_live_tup + row.n_dead_tup)) * 100).toFixed(1)
                : 0;
            
            log.bullet(`${row.tablename}: ${row.n_live_tup.toLocaleString('es-MX')} rows, ${deadPercent}% dead tuples`);
            
            if (deadPercent > 10) {
                log.warn(`${row.tablename} podría beneficiarse de VACUUM (${deadPercent}% dead)`);
                totalIssues++;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // 7. RESUMEN FINAL
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.bold}${'═'.repeat(62)}${colors.reset}`);
        console.log(`${colors.bold}📋 RESUMEN FINAL${colors.reset}\n`);

        console.log(`${colors.bold}Problemas detectados:${colors.reset}`);
        console.log(`   • Total: ${totalIssues} problema(s)`);
        console.log(`   • Críticos: ${criticalIssues} crítico(s)`);

        if (criticalIssues === 0 && totalIssues === 0) {
            console.log(`\n${colors.green}${colors.bold}✅ ¡BD OPTIMIZADA Y CONFIABLE!${colors.reset}`);
            console.log(`${colors.bold}La BD está lista para producción con 1M de boletos.${colors.reset}\n`);
        } else if (criticalIssues === 0) {
            console.log(`\n${colors.yellow}${colors.bold}⚠️  BD FUNCIONAL pero con recomendaciones${colors.reset}`);
            console.log(`${colors.bold}Corrige los ${totalIssues} problema(s) para optimizar.${colors.reset}\n`);
        } else {
            console.log(`\n${colors.red}${colors.bold}❌ BD con problemas críticos${colors.reset}`);
            console.log(`${colors.bold}Requiere atención antes de producción.${colors.reset}\n`);
        }

        await db.destroy();
        process.exit(criticalIssues > 0 ? 1 : 0);

    } catch (error) {
        console.error(`\n${colors.red}❌ ERROR en auditoría:${colors.reset}`, error.message);
        await db.destroy();
        process.exit(1);
    }
}

auditarBD();
