const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pageExtensions = ['.js', '.json', '.wxml', '.wxss']
const componentExtensions = ['.js', '.json', '.wxml', '.wxss']
const riskTokenPatterns = [
  { token: '!==', pattern: /!==/ },
  { token: '===', pattern: /===/ },
  { token: '&&', pattern: /&&/ },
  { token: '||', pattern: /\|\|/ },
  { token: '?', pattern: /\?/ },
]

function exists(targetPath) {
  return fs.existsSync(targetPath)
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function readJson(filePath) {
  return JSON.parse(readText(filePath))
}

function walkFiles(dirPath, predicate, result = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  entries.forEach((entry) => {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, result)
      return
    }
    if (entry.isFile() && predicate(fullPath)) {
      result.push(fullPath)
    }
  })
  return result
}

function collectPageBases(appConfig) {
  const pageBases = []
  ;(appConfig.pages || []).forEach((page) => {
    pageBases.push(page)
  })
  ;(appConfig.subPackages || []).forEach((pkg) => {
    ;(pkg.pages || []).forEach((page) => {
      pageBases.push(path.posix.join(pkg.root, page))
    })
  })
  return pageBases
}

function verifyPageFiles(pageBases) {
  const errors = []
  pageBases.forEach((pageBase) => {
    pageExtensions.forEach((ext) => {
      const targetPath = path.join(root, `${pageBase}${ext}`)
      if (!exists(targetPath)) {
        errors.push(`Missing page file: ${path.relative(root, targetPath)}`)
      }
    })
  })
  return errors
}

function normalizeMiniappPath(value) {
  return value.replace(/\\/g, '/')
}

function resolveComponentBase(ownerJsonPath, componentPath) {
  if (!componentPath) {
    return ''
  }
  if (componentPath.startsWith('plugin://')) {
    return ''
  }
  if (componentPath.startsWith('/')) {
    return normalizeMiniappPath(componentPath.slice(1))
  }
  const ownerDir = path.dirname(ownerJsonPath)
  return normalizeMiniappPath(path.relative(root, path.resolve(ownerDir, componentPath)))
}

function verifyComponentFiles(jsonFiles) {
  const errors = []
  const visited = new Set()
  const pending = [...jsonFiles]

  while (pending.length) {
    const jsonPath = pending.pop()
    if (visited.has(jsonPath)) {
      continue
    }
    visited.add(jsonPath)

    let config
    try {
      config = readJson(jsonPath)
    } catch (error) {
      continue
    }

    const usingComponents = config.usingComponents || {}
    Object.keys(usingComponents).forEach((key) => {
      const componentBase = resolveComponentBase(jsonPath, usingComponents[key])
      if (!componentBase) {
        return
      }

      componentExtensions.forEach((ext) => {
        const targetPath = path.join(root, `${componentBase}${ext}`)
        if (!exists(targetPath)) {
          errors.push(`Missing component file: ${path.relative(root, targetPath)} (from ${path.relative(root, jsonPath)})`)
        }
      })

      const componentJsonPath = path.join(root, `${componentBase}.json`)
      if (exists(componentJsonPath) && !visited.has(componentJsonPath)) {
        pending.push(componentJsonPath)
      }
    })
  }

  return errors
}

function verifyJsonSyntax(jsonFiles) {
  const errors = []
  jsonFiles.forEach((jsonPath) => {
    try {
      readJson(jsonPath)
    } catch (error) {
      errors.push(`Invalid JSON: ${path.relative(root, jsonPath)} -> ${error.message}`)
    }
  })
  return errors
}

function findRiskTokensInExpression(expression) {
  return riskTokenPatterns
    .filter((item) => item.pattern.test(expression))
    .map((item) => item.token)
}

function verifyWxmlExpressions(wxmlFiles) {
  const errors = []
  const bindingPattern = /\{\{([\s\S]*?)\}\}/g

  wxmlFiles.forEach((wxmlPath) => {
    const content = readText(wxmlPath)
    let match
    while ((match = bindingPattern.exec(content)) !== null) {
      const expression = match[1].trim()
      const riskTokens = findRiskTokensInExpression(expression)
      if (!riskTokens.length) {
        continue
      }
      const before = content.slice(0, match.index)
      const line = before.split('\n').length
      errors.push(`Risky WXML expression: ${path.relative(root, wxmlPath)}:${line} -> ${riskTokens.join(', ')} -> {{${expression}}}`)
    }
  })

  return errors
}

function main() {
  const appJsonPath = path.join(root, 'app.json')
  const appConfig = readJson(appJsonPath)
  const pageBases = collectPageBases(appConfig)
  const jsonFiles = walkFiles(root, (filePath) => filePath.endsWith('.json'))
  const wxmlFiles = walkFiles(root, (filePath) => filePath.endsWith('.wxml'))

  const errors = []
  errors.push(...verifyPageFiles(pageBases))
  errors.push(...verifyJsonSyntax(jsonFiles))
  errors.push(...verifyComponentFiles(jsonFiles))
  errors.push(...verifyWxmlExpressions(wxmlFiles))

  if (errors.length) {
    console.error('Miniapp verification failed.')
    errors.forEach((error) => {
      console.error(`- ${error}`)
    })
    process.exit(1)
  }

  console.log('Miniapp verification passed.')
  console.log(`- pages: ${pageBases.length}`)
  console.log(`- json files: ${jsonFiles.length}`)
  console.log(`- wxml files: ${wxmlFiles.length}`)
}

main()
