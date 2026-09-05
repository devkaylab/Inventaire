// Lire la définition QUI FAIT FOI, pas celle d'un fichier choisi.
//
// ⚠️ Ce helper vient d'un vrai défaut, et il a resservi. Un test qui lit une
// migration nommée en dur ne voit pas ce qu'une migration ultérieure a défait :
//
//   · `submit_company_request` a perdu sa limitation de débit le 21 août 2026,
//     parce que deux migrations l'ont réécrite en entier sans recopier le bloc,
//     et que rien ne lisait ces migrations-là ;
//   · `web/tests/stripe.test.ts` lisait `20260822250001_stripe_paiement.sql` en
//     dur. Le 28 août, `fulfil_paid_request` et
//     `invite_company_admin_after_payment` ont été corrigées ailleurs : le test
//     a continué de passer en validant une définition qui ne tournait plus.
//
// D'où une seule définition partagée, plutôt qu'une copie par fichier de test.
// Toute nouvelle garde sur une fonction sensible passe par ici.
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const dossierMigrations = path.resolve(__dirname, '../../supabase/migrations')

/** La dernière migration qui définit `fn`, et le corps de cette définition. */
export function derniereDefinition(fn: string): { fichier: string; corps: string } {
  // ⚠️ `create` AVEC OU SANS `or replace`. Changer la liste des colonnes de
  // retour d'une fonction impose un `drop` préalable, et le `create` qui suit
  // n'a alors pas besoin du `or replace` — c'est ce qu'a fait
  // `mes_balises_comptees` le 3 septembre 2026. En n'acceptant que la forme
  // `or replace`, ce helper serait remonté à la définition PRÉCÉDENTE, celle
  // qui ne tourne plus : exactement le défaut qu'il existe pour empêcher.
  //
  // Le `(` final est ce qui évite qu'un `drop function if exists` ou un nom
  // plus long (`lister_articles_bis`) soit pris pour la définition.
  //
  // ⚠️ ET SANS ÉGARD À LA CASSE (5 septembre 2026). `pg_get_functiondef` rend
  // « CREATE OR REPLACE FUNCTION » en majuscules : une migration écrite en
  // repartant de la base — le moyen le plus sûr de ne réécrire QUE la phrase
  // qu'on veut changer — serait passée inaperçue, et ce helper aurait rendu la
  // définition PRÉCÉDENTE. Le défaut qu'il existe pour empêcher, une fois de
  // plus, par une autre porte.
  const marqueur = new RegExp(`create (?:or replace )?function public\\.${fn}\\(`, 'gi')
  const fichiers = readdirSync(dossierMigrations).filter((f) => f.endsWith('.sql')).sort().reverse()

  for (const fichier of fichiers) {
    const texte = readFileSync(path.join(dossierMigrations, fichier), 'utf8')
    const trouves = [...texte.matchAll(marqueur)]
    if (trouves.length === 0) continue
    const apres = texte.slice(trouves[trouves.length - 1].index)
    // Fin du corps : le délimiteur de chaîne, quel qu'il soit dans ce fichier.
    const fin = Math.min(
      ...['$function$;', '$$;'].map((d) => {
        const i = apres.indexOf(d)
        return i === -1 ? Number.POSITIVE_INFINITY : i
      }),
    )
    return { fichier, corps: apres.slice(0, fin) }
  }
  throw new Error(`Aucune migration ne définit ${fn}`)
}

/** Le fichier entier de la dernière migration qui définit `fn` — pour lire les GRANT, qui sont hors du corps. */
export function fichierDe(fn: string): string {
  const { fichier } = derniereDefinition(fn)
  return readFileSync(path.join(dossierMigrations, fichier), 'utf8')
}
