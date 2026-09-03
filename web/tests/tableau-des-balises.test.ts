import { describe, expect, it } from 'vitest'
import { derniereDefinition, fichierDe } from './migrations'

/**
 * Le tableau des balises, à l'échelle (3 septembre 2026).
 *
 * `get_zone_dashboard` est l'appel le plus fréquent du produit : le tableau de
 * bord du superviseur ET l'écran de comptage de chaque téléphone, rejoué à
 * chaque ouverture et à chaque clôture de balise. Mesuré sur 400 000
 * références et 900 000 comptages, il demandait 6 225 ms pour un plafond
 * `authenticated` de 8 s — et il est tombé en 500 en production pendant la
 * mesure. Après correction : 1 915 ms.
 *
 * Ces gardes protègent les deux moitiés du correctif. Elles ont été rejouées
 * contre la version d'avant : toutes échouent.
 */
describe('le tableau des balises tient à l’échelle', () => {
  const { corps } = derniereDefinition('get_zone_dashboard')
  const fichier = fichierDe('get_zone_dashboard')
  // Le corps sans ses commentaires : ils EXPLIQUENT le défaut corrigé, donc ils
  // citent `auth.uid()` et `filter`. Une garde d'absence qui les lirait
  // échouerait sur sa propre documentation — cinquième variante de ce piège
  // sur ce dépôt.
  const code = corps.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '')

  it('⚠️ auth.uid() est lue UNE FOIS, jamais dans la requête', () => {
    // Elle figurait dans quatre `filter (...)`, donc évaluée par ligne : sur
    // 900 000 comptages, jusqu'à 3,6 millions d'analyses du JSON des claims.
    // À elle seule, cette ligne fait passer la fonction de 6 225 à 3 459 ms.
    expect(code).toMatch(/declare\s+v_moi\s+uuid\s*:=\s*auth\.uid\(\)/)
    expect(code).toContain('counted_by is distinct from v_moi')

    // Aucun `filter (...)` ne doit rappeler auth.uid().
    for (const f of code.match(/filter\s*\([^)]*\)/g) ?? []) {
      expect(f).not.toContain('auth.uid()')
    }
  })

  it('⚠️ on regroupe par (balise, référence, passe) avant de compter', () => {
    // Les quatre `count(distinct sku)` forçaient un tri global des 900 000
    // lignes, qui débordait sur disque (work_mem = 3,5 Mo). Après
    // pré-agrégation il ne reste que des lignes déjà uniques à compter.
    expect(code).toMatch(/with\s+par_ref\s+as/)
    expect(code).toMatch(/group by\s+c\.zone,\s*c\.sku,\s*c\.pass_number/)
    expect(code).not.toContain('count(distinct')
  })

  it('⚠️ `is distinct from`, jamais `<>`, sur l’auteur du comptage', () => {
    // Une ligne dont l'auteur a été supprimé porte `null` (détachée par
    // `on delete set null`). Elle vient bien de quelqu'un d'autre, et un `<>`
    // la laisserait passer pour la nôtre.
    expect(code).not.toMatch(/counted_by\s*<>/)
  })

  it('l’index qui sert le regroupement est posé dans la même migration', () => {
    expect(fichier).toMatch(
      /create index if not exists counts_session_zone_sku_pass_idx[\s\S]*?\(session_id, zone, sku, pass_number\)/,
    )
  })

  it('⚠️ les droits sont reposés, anon nommément', () => {
    // `create or replace` rend EXECUTE à PUBLIC — constat n°6 du 28 août 2026,
    // qui se reproduit à chaque fonction redéfinie.
    expect(fichier).toMatch(/revoke all on function public\.get_zone_dashboard\(uuid\) from public, anon/)
    expect(fichier).toMatch(/grant execute on function public\.get_zone_dashboard\(uuid\) to authenticated/)
  })

  it('le contrat rendu à l’écran ne bouge pas', () => {
    // Vérifié avant d'appliquer : 0 différence sur 501 balises d'essai et 70
    // balises réelles. Les treize colonnes doivent rester, dans cet ordre.
    for (const colonne of [
      'count_units', 'count_lines', 'audit_units', 'audit_lines',
      'count_units_autres', 'count_lines_autres',
      'audit_units_autres', 'audit_lines_autres',
    ]) {
      expect(corps).toContain(colonne)
    }
  })
})
