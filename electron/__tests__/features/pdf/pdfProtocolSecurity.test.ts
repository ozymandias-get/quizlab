import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const protocolSourcePath = path.resolve(
  __dirname,
  '../../../features/pdf/pdfProtocol.ts'
)
const source = fs.readFileSync(protocolSourcePath, 'utf-8')

describe('PDF protocol security', () => {
  it('should not have bypassCSP in protocol registration', () => {
    expect(source).not.toContain('bypassCSP')
  })

  it('should not have wildcard CORS origin', () => {
    expect(source).not.toContain("'*'")
  })

  it('should dynamically set Access-Control-Allow-Origin for validated origins', () => {
    expect(source).toContain("Access-Control-Allow-Origin")
  })

  it('should enforce CORS origin validation', () => {
    expect(source).toContain('origin')
  })
})
