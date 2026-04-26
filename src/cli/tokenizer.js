/**
 * CLI input tokenizer.
 * Splits a raw command string into tokens respecting quoted strings.
 */

/**
 * Tokenizes a command line string, respecting quoted strings.
 * Example: 'migrate "my file.js" --dry-run' → ['migrate', 'my file.js', '--dry-run']
 * @param {string} input
 * @returns {string[]}
 */
export function tokenize(input) {
    const tokens = [];
    let current = "";
    let inQuote = false;
    let quoteChar = "";

    for (const char of input) {
        if (inQuote) {
            if (char === quoteChar) {
                inQuote = false;
            } else {
                current += char;
            }
        } else if (char === '"' || char === "'") {
            inQuote = true;
            quoteChar = char;
        } else if (char === " " || char === "\t") {
            if (current) {
                tokens.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }

    if (current) tokens.push(current);
    return tokens;
}

/**
 * Reads one flag token starting at index i.
 * Returns { key, value, advance } — advance is how many tokens to skip.
 * @param {string[]} tokens
 * @param {number} i
 * @param {number} prefix  Number of leading dash chars to strip
 * @returns {{ key: string, value: string|true, advance: number }}
 */
export function readFlag(tokens, i, prefix) {
    const key = tokens[i].slice(prefix);
    if (i + 1 < tokens.length && !tokens[i + 1].startsWith("-")) {
        return { key, value: tokens[i + 1], advance: 2 };
    }
    return { key, value: true, advance: 1 };
}

/**
 * Splits token array into positional args and --option flags.
 * @param {string[]} tokens
 * @returns {{ args: string[], opts: Record<string, string|boolean> }}
 */
export function parseOpts(tokens) {
    const args = [];
    const opts = {};
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        if (token.startsWith("--")) {
            const { key, value, advance } = readFlag(tokens, i, 2);
            opts[key] = value;
            i += advance;
        } else if (token.startsWith("-") && token.length === 2) {
            const { key, value, advance } = readFlag(tokens, i, 1);
            opts[key] = value;
            i += advance;
        } else {
            args.push(token);
            i += 1;
        }
    }

    return { args, opts };
}