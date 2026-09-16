export interface ParsedCurl {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
}

/**
 * Parse a curl command into URL, method, headers, and body.
 * Supports common curl flags: -X/--request, -H/--header, -u/--user, --url,
 * -d/--data, --data-raw, --data-binary, --data-ascii, --data-urlencode, -G/--get.
 * Tolerates shell-style "#" comment lines and "\" line continuations in pasted input.
 */
export function parseCurl(input: string): ParsedCurl {
  const text = input.trim()
  if (!text) throw new Error('Empty input')

  // Tokenize: handle quoted strings (single and double quotes),
  // "#" comments and backslash-newline continuations
  const tokens: string[] = []
  let i = 0
  while (i < text.length) {
    // Skip whitespace, comments (to end of line) and line continuations
    while (i < text.length) {
      if (/\s/.test(text[i])) {
        i++
      } else if (text[i] === '#') {
        while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++
      } else if (text[i] === '\\' && (text[i + 1] === '\n' || text[i + 1] === '\r')) {
        i += 2
      } else {
        break
      }
    }
    if (i >= text.length) break

    const ch = text[i]
    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let str = ''
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < text.length) {
          str += text[i + 1]
          i += 2
        } else {
          str += text[i]
          i++
        }
      }
      i++ // skip closing quote
      tokens.push(str)
    } else {
      let str = ''
      while (i < text.length && !/\s/.test(text[i])) {
        if (text[i] === '\\' && (text[i + 1] === '\n' || text[i + 1] === '\r')) {
          i += 2 // continuation joins lines mid-token, like a shell
        } else {
          str += text[i]
          i++
        }
      }
      // A lone "\" is a leftover continuation (e.g. "\  \n"), not a real token
      if (str !== '\\') tokens.push(str)
    }
  }

  // Drop a leading shell prompt or "curl" keyword (comments may precede it)
  if (tokens[0] === '$') tokens.shift()
  if (tokens[0] === 'curl') tokens.shift()

  let url = ''
  let method = 'GET'
  let useGet = false
  const headers: Record<string, string> = {}
  const dataParts: string[] = []

  let j = 0
  while (j < tokens.length) {
    const tok = tokens[j]

    if (tok === '-X' || tok === '--request') {
      method = tokens[++j] || method
    } else if (tok === '--url') {
      url = tokens[++j] || url
    } else if (tok === '-H' || tok === '--header') {
      const header = tokens[++j] || ''
      const idx = header.indexOf(':')
      if (idx > 0) {
        const key = header.substring(0, idx).trim()
        const val = header.substring(idx + 1).trim()
        headers[key] = val
      }
    } else if (tok === '-u' || tok === '--user') {
      const cred = tokens[++j] || ''
      if (cred && !headers['Authorization']) headers['Authorization'] = `Basic ${btoa(cred)}`
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' ||
               tok === '--data-binary' || tok === '--data-ascii') {
      dataParts.push(tokens[++j] ?? '')
    } else if (tok === '--data-urlencode') {
      // curl rules: "name=content" encodes only content; "=content"/"content" encode the value
      const arg = tokens[++j] ?? ''
      const eq = arg.indexOf('=')
      dataParts.push(eq > 0
        ? arg.slice(0, eq + 1) + encodeURIComponent(arg.slice(eq + 1))
        : encodeURIComponent(eq === 0 ? arg.slice(1) : arg))
    } else if (tok === '-G' || tok === '--get') {
      useGet = true
    } else if (tok === '-I' || tok === '--head') {
      method = 'HEAD'
    } else if (tok === '-o' || tok === '--output' || tok === '-O' || tok === '--remote-name') {
      // Skip output file args
      if (tok !== '-O' && tok !== '--remote-name') j++
    } else if (tok === '-s' || tok === '--silent' || tok === '-S' || tok === '--show-error' ||
               tok === '-L' || tok === '--location' || tok === '-k' || tok === '--insecure' ||
               tok === '-i' || tok === '--include' || tok === '--compressed' ||
               tok === '-v' || tok === '--verbose' || tok === '-f' || tok === '--fail' ||
               tok === '-g' || tok === '--globoff' || tok === '-n' || tok === '--netrc' ||
               tok === '-N' || tok === '--no-buffer' || tok === '-#' || tok === '--progress-bar' ||
               tok === '-0' || tok === '--http1.0' || tok === '--http1.1' ||
               tok === '--http2' || tok === '--http3' || tok === '-1' || tok === '--tlsv1' ||
               tok === '-4' || tok === '--ipv4' || tok === '-6' || tok === '--ipv6' ||
               tok === '-J' || tok === '--remote-header-name' || tok === '-R' || tok === '--remote-time' ||
               tok === '-Z' || tok === '--parallel' || tok === '-B' || tok === '--use-ascii') {
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

  let body: string | null = null
  if (dataParts.length) {
    if (useGet) {
      // -G appends data parameters to the query string instead of a request body
      url += (url.includes('?') ? '&' : '?') + dataParts.join('&')
    } else {
      body = dataParts.join('&')
      if (method === 'GET') method = 'POST'
    }
  }

  return { url, method, headers, body }
}
