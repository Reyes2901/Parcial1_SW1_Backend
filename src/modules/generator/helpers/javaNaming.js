// src/modules/generator/helpers/javaNaming.js

/**
 * "usuario"      -> "Usuario"
 * "detalleVenta" -> "DetalleVenta"
 */
function toClassName(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * "id_venta"     -> "idVenta"
 * "DetalleVenta" -> "detalleVenta"
 */
function toFieldName(raw) {
    if (!raw) return '';
    const parts = String(raw).split(/[_\s]+/).filter(Boolean);
    if (!parts.length) return String(raw);
    return (
        parts[0].charAt(0).toLowerCase() +
        parts[0].slice(1) +
        parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
    );
}

const JAVA_KEYWORDS = new Set([
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
    'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
    'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int',
    'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public',
    'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
    'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while',
    'true', 'false', 'null'
]);

/**
 * "class"  -> "classField"
 * "int"    -> "intField"
 * "nombre" -> "nombre"
 */
function safeFieldName(raw) {
    if (!raw) throw new Error('nombre de campo vacío');
    let name = String(raw).replace(/[^a-zA-Z0-9_$]/g, '');
    if (!name) name = 'field';
    if (JAVA_KEYWORDS.has(name)) name = name + 'Field';
    if (/^[0-9]/.test(name)) name = '_' + name;
    return name;
}

/**
 * "parcial1-diagrama" -> "parcial1_diagrama_db"
 */
function sanitizeDbName(projectName) {
    if (!projectName) throw new Error('projectName vacío');
    return (
        String(projectName)
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .toLowerCase()
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '') + '_db'
    );
}

module.exports = { toClassName, toFieldName, safeFieldName, sanitizeDbName };