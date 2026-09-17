import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { APP_VERSION, APP_DISPLAY_VERSION } from '../src/lib/version'
import { translate } from '../src/lib/i18n'

describe('Version Consistency Verification', () => {
  it('matches package.json version with APP_VERSION', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.version).toBe(APP_VERSION)
  })

  it('matches package-lock.json version with APP_VERSION', () => {
    const lock = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package-lock.json'), 'utf8'))
    expect(lock.version).toBe(APP_VERSION)
    expect(lock.packages[''].version).toBe(APP_VERSION)
  })

  it('formats APP_DISPLAY_VERSION with v prefix', () => {
    expect(APP_DISPLAY_VERSION).toBe(`v${APP_VERSION}`)
  })

  it('matches android/app/build.gradle versionName and valid versionCode', () => {
    const gradle = readFileSync(path.resolve(process.cwd(), 'android/app/build.gradle'), 'utf8')
    const versionNameMatch = gradle.match(/versionName\s+"([^"]+)"/)
    const versionCodeMatch = gradle.match(/versionCode\s+(\d+)/)

    expect(versionNameMatch).not.toBeNull()
    expect(versionNameMatch[1]).toBe(APP_VERSION)

    expect(versionCodeMatch).not.toBeNull()
    expect(Number(versionCodeMatch[1])).toBeGreaterThan(0)
  })

  it('interpolates version placeholder correctly in help.contactCardSubtitle across locales', () => {
    const idSubtitle = translate('id', 'help.contactCardSubtitle', { version: APP_DISPLAY_VERSION })
    const enSubtitle = translate('en', 'help.contactCardSubtitle', { version: APP_DISPLAY_VERSION })

    expect(idSubtitle).toContain(APP_DISPLAY_VERSION)
    expect(enSubtitle).toContain(APP_DISPLAY_VERSION)
    expect(idSubtitle).not.toContain('v4.6.6')
    expect(enSubtitle).not.toContain('v4.6.6')
  })

  it('interpolates version placeholder correctly in auth.welcomeBadge across locales', () => {
    const idBadge = translate('id', 'auth.welcomeBadge', { version: APP_DISPLAY_VERSION })
    const enBadge = translate('en', 'auth.welcomeBadge', { version: APP_DISPLAY_VERSION })

    expect(idBadge).toContain(APP_DISPLAY_VERSION)
    expect(enBadge).toContain(APP_DISPLAY_VERSION)
    expect(idBadge).not.toContain('v4.6.6')
    expect(enBadge).not.toContain('v4.6.6')
  })

  it('matches react-native-fintrack package.json and app.json versions', () => {
    const rnPkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'react-native-fintrack/package.json'), 'utf8'))
    const rnApp = JSON.parse(readFileSync(path.resolve(process.cwd(), 'react-native-fintrack/app.json'), 'utf8'))

    expect(rnPkg.version).toBe(APP_VERSION)
    expect(rnApp.expo.version).toBe(APP_VERSION)
  })

  it('declares necessary microphone and camera permissions in android/app/src/main/AndroidManifest.xml', () => {
    const manifest = readFileSync(path.resolve(process.cwd(), 'android/app/src/main/AndroidManifest.xml'), 'utf8')
    expect(manifest).toContain('android.permission.RECORD_AUDIO')
    expect(manifest).toContain('android.permission.MODIFY_AUDIO_SETTINGS')
    expect(manifest).toContain('android.permission.CAMERA')
  })
})
