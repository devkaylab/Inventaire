// Double authentification : la garde côté client, et son pendant serveur.
//
// Le point à ne pas perdre : `is_admin()` est le seul verrou des dix-huit
// fonctions `admin_*`. Le relâcher — ou revenir à un « aal2 obligatoire » qui
// enfermerait dehors un administrateur ayant perdu son téléphone — doit se
// voir ici.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { mfaPending, verifiedTotpFactor } from '@/lib/mfa'

const lire = (p: string) => readFileSync(path.resolve(__dirname, p), 'utf8')
const migration = lire('../../supabase/migrations/20260819123621_mfa_admin_aal2.sql')
const garde = lire('../hooks/useAuthGuard.ts')
const login = lire('../app/login/page.tsx')
const compte = lire('../app/account/page.tsx')

describe('garde serveur (migration)', () => {
  it('exige aal2 des comptes qui ont un facteur vérifié', () => {
    expect(migration).toContain("auth.jwt() ->> 'aal'")
    expect(migration).toContain("= 'aal2'")
    expect(migration).toMatch(/auth\.mfa_factors[\s\S]*?status = 'verified'/)
  })

  it('garde l’exigence conditionnelle, pour ne jamais enfermer dehors', () => {
    // Sans ce `not exists`, un administrateur ayant perdu son téléphone
    // n'aurait plus aucun moyen d'agir : il faudrait défaire la migration.
    // Avec lui, il suffit de supprimer son facteur en service_role.
    expect(migration).toMatch(/or not exists/i)
  })

  it('continue de refuser quiconque n’est pas administrateur', () => {
    // La condition MFA s'ajoute au contrôle d'origine, elle ne le remplace pas.
    expect(migration).toContain('select p.is_admin from public.profiles p where p.id = auth.uid()')
  })

  it('reste SECURITY DEFINER avec un search_path figé', () => {
    // Elle lit auth.mfa_factors, interdit au rôle authenticated ; sans
    // search_path figé, elle serait détournable.
    expect(migration).toMatch(/stable security definer/i)
    expect(migration).toMatch(/set search_path to 'public'/i)
  })
})

describe('garde client', () => {
  it('renvoie vers la connexion une session restée au mot de passe seul', () => {
    expect(garde).toContain('mfaPending')
    expect(garde).toContain("router.replace('/login')")
  })

  it('demande le code après le mot de passe, et ferme la session si on renonce', () => {
    expect(login).toContain('challengeAndVerify')
    expect(login).toContain('supabase.auth.signOut()')
  })

  it('propose l’activation depuis Mon compte', () => {
    expect(compte).toContain('MfaPanel')
  })
})

describe('mfaPending', () => {
  it('ne bloque personne quand l’état est illisible', async () => {
    // Sans session ni réseau, la question « le code manque-t-il ? » n'a pas de
    // réponse : répondre « oui » enfermerait dehors un compte sans second
    // facteur. Le doute profite à l'accès, la sécurité repose sur le serveur.
    await expect(mfaPending()).resolves.toBe(false)
    await expect(verifiedTotpFactor()).resolves.toBeNull()
  })
})
