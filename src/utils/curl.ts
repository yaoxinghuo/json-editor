export interface ParsedCurl {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

/**
 * Parse a curl command into URL, method, headers, and body.
 * Supports common curl flags: -X/--request, -H/--header, -d/--data, --data-raw, --data-binary.
 */
export function parseCurl(input: string): ParsedCurl {
  const text = input.trim()
  if (!text) throw new Error('Empty input')

  // Remove leading "curl" keyword if present
  const cleaned = text.replace(/^curl\s+/, '')

  // Tokenize: handle quoted strings (single and double quotes)
  const tokens: string[] = []
  let i = 0
  while (i < cleaned.length) {
    // Skip whitespace
    while (i < cleaned.length && /\s/.test(cleaned[i])) i++
    if (i >= cleaned.length) break

    const ch = cleaned[i]
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let str = ''
      while (i < cleaned.length && cleaned[i] !== quote) {
        if (cleaned[i] === '\\' && i + 1 < cleaned.length) {
          str += cleaned[i + 1]
          i += 2
        } else {
          str += cleaned[i]
          i++
        }
      }
      i++ // skip closing quote
      tokens.push(str)
    } else {
      let str = ''
      while (i < cleaned.length && !/\s/.test(cleaned[i])) {
        str += cleaned[i]
        i++
      }
      tokens.push(str)
    }
  }

  let url = ''
  let method = 'GET'
  const headers: Record<string, string> = {}
  let body: string | null = null

  let j = 0
  while (j < tokens.length) {
    const tok = tokens[j]

    if (tok === '-X' || tok === '--request') {
      method = tokens[++j] || method
    } else if (tok === '-H' || tok === '--header') {
      const header = tokens[++j] || ''
      const idx = header.indexOf(':')
      if (idx > 0) {
        const key = header.substring(0, idx).trim()
        const val = header.substring(idx + 1).trim()
        headers[key] = val
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      body = tokens[++j] || ''
      if (method === 'GET') method = 'POST'
    } else if (tok === '-o' || tok === '--output' || tok === '-O' || tok === '--remote-name') {
      // Skip output file args
      if (tok !== '-O' && tok !== '--remote-name') j++
    } else if (tok === '-s' || tok === '--silent' || tok === '-S' || tok === '--show-error' ||
               tok === '-L' || tok === '--location' || tok === '-k' || tok === '--insecure' ||
               tok === '-i' || tok === '--include' || tok === '-I' || tok === '--head' ||
               tok === '--compressed' || tok === '-v' || tok === '--verbose') {
      // Flags without arguments, skip
    } else if (tok.startsWith('-')) {
      // Unknown flag with argument, skip next token
      if (j + 1 < tokens.length && !tokens[j + 1].startsWith('-')) j++
    } else {
      // Positional argument = URL
      if (!url) url = tok
    }
    j++
  }

  if (!url) throw new Error('No URL found in curl command')

  return { url, method, headers, body }
}
