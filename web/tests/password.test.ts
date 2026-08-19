// La politique de mot de passe vit à deux endroits : la console Supabase
// (qui fait foi) et `lib/password.ts` (qui l'annonce en français avant
// l'envoi). Ces tests figent le second sur ce que la console applique —
// 12 caractères, minuscule, majuscule, chiffre, symbole — pour qu'un
// relâchement se voie.
import { describe, expect, it } from 'vitest'
import {
  checkPassword, friendlyPasswordError, MIN_PASSWORD_LENGTH, passwordError, passwordSatisfies,
} from '@/lib/password'

const VALIDE = 'Inventaire2026!'

describe('checkPassword', () => {
  it('accepte un mot de passe conforme aux cinq règles', () => {
    expect(checkPassword(VALIDE)).toEqual({
      length: true, lower: true, upper: true, digit: true, symbol: true,
    })
    expect(passwordSatisfies(VALIDE)).toBe(true)
  })

  it('exige la longueur de la console, pas moins', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(12)
    // 11 caractères, tous les autres critères réunis.
    expect(checkPassword('Abcdefgh12!').length).toBe(false)
    expect(checkPassword('Abcdefgh123!').length).toBe(true)
  })

  it('repère chaque classe de caractères manquante', () => {
    expect(checkPassword('INVENTAIRE2026!').lower).toBe(false)
    expect(checkPassword('inventaire2026!').upper).toBe(false)
    expect(checkPassword('InventaireAbcd!').digit).toBe(false)
    expect(checkPassword('Inventaire20261').symbol).toBe(false)
  })

  it('compte les accents comme des lettres, jamais comme des symboles', () => {
    // Sans le drapeau Unicode, « é » passerait pour un symbole et un mot de
    // passe non conforme serait accepté ici avant d'être refusé par le serveur.
    const c = checkPassword('Éléphantsbleus2026')
    expect(c.symbol).toBe(false)
    expect(c.upper).toBe(true)
    expect(c.lower).toBe(true)
  })

  it('n’accepte pas l’espace comme symbole', () => {
    expect(checkPassword('Inventaire 2026').symbol).toBe(false)
  })
})

describe('passwordError', () => {
  it('ne dit rien quand tout va bien', () => {
    expect(passwordError(VALIDE)).toBeNull()
  })

  it('énumère tout ce qui manque en une fois', () => {
    // Trois refus successifs, un critère à la fois, font abandonner.
    const message = passwordError('azertyuiopqs')
    expect(message).toMatch(/majuscule/)
    expect(message).toMatch(/chiffre/)
    expect(message).toMatch(/symbole/)
  })

  it('mentionne la longueur ET les classes quand les deux pèchent', () => {
    const message = passwordError('azerty')
    expect(message).toMatch(/12 caractères/)
    expect(message).toMatch(/majuscule/)
  })

  it('ne parle que de longueur quand c’est le seul défaut', () => {
    const message = passwordError('Abcd123!')
    expect(message).toMatch(/12 caractères/)
    expect(message).not.toMatch(/majuscule/)
  })
})

describe('friendlyPasswordError', () => {
  it('traduit le refus des mots de passe issus de fuites', () => {
    // Règle vérifiée par Supabase seul (HaveIBeenPwned) : elle arrive toujours
    // en anglais, après envoi.
    const message = friendlyPasswordError('Password is known to be weak and easy to guess, please choose a different one. (pwned)')
    expect(message).toMatch(/fuite de données/)
    expect(message).not.toMatch(/pwned/i)
  })

  it('traduit le refus de réutiliser l’ancien mot de passe', () => {
    expect(friendlyPasswordError('New password should be different from the old password.'))
      .toMatch(/différent de l’ancien/)
  })

  it('traduit un refus de politique en énonçant les règles', () => {
    expect(friendlyPasswordError('Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz'))
      .toMatch(/une minuscule, une majuscule, un chiffre et un symbole/)
  })

  it('laisse passer un message qu’il ne sait pas traduire', () => {
    expect(friendlyPasswordError('Erreur inattendue')).toBe('Erreur inattendue')
  })
})
