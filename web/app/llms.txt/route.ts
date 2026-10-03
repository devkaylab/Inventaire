import { boutiquesEnLigne, PUBLIEE_ANDROID, PUBLIEE_IOS } from '@/lib/appStores'
import { venteOuverte } from '@/lib/legal'
import { MENTION_TVA, OFFRES, TVA_APPLICABLE, euros } from '@/lib/offres'
import { SITE_URL, url } from '@/lib/site'

/**
 * `llms.txt` — ce que les assistants lisent pour savoir quoi dire de
 * Quantinvo. Convention llmstxt.org : du Markdown, un titre, un résumé, puis
 * des sections de liens.
 *
 * ⚠️ **CE FICHIER EST GÉNÉRÉ, PAS ÉCRIT.** Les prix viennent de
 * `lib/offres.ts`, les boutiques de `lib/appStores.ts`, l'ouverture de la
 * vente de `lib/legal.ts`. Un `llms.txt` statique aurait vieilli en silence —
 * et c'est le pire endroit pour vieillir : personne ne relit un fichier
 * destiné aux machines, et ce qu'il raconte ressort mot pour mot dans la
 * réponse d'un assistant, sans guillemets et sans date.
 *
 * ⚠️ **IL NE PROMET RIEN QUE LE SITE NE PROMETTE.** Pas de disponibilité, pas
 * de délai de réponse : les CGV les écartent expressément (8.2, 8.3), et les
 * points des offres ont justement été purgés de ces phrases le 19 septembre
 * 2026. Décrire, jamais vendre.
 */
export const dynamic = 'force-static'

function corps(): string {
  const boutiques = boutiquesEnLigne(PUBLIEE_IOS, PUBLIEE_ANDROID)
  const prixMini = euros(Math.min(...OFFRES.map(o => o.mois)))

  const lignes: string[] = [
    '# Quantinvo',
    '',
    "> Outil d'inventaire pour le commerce de détail. Les équipes comptent le",
    '> stock en rayon avec leur téléphone ou une douchette Bluetooth ; le',
    '> magasin est découpé en zones par des balises QR imprimées depuis',
    "> l'outil ; une seconde passe d'audit fiabilise le comptage ; le rapport",
    "> d'écarts s'exporte en tableur. Édité par Devkaylab, en France.",
    '',
    "## Ce que fait l'outil",
    '',
    '- Comptage par scan de code-barres, au téléphone ou à la douchette Bluetooth.',
    '- Découpage du magasin en zones par balises QR imprimées.',
    "- Seconde passe d'audit, et arbitrage des écarts.",
    "- Rapport d'écarts en unités et en valeur, export Excel.",
    '- Import du référentiel articles et du stock théorique (CSV, Excel).',
    "- Suivi de l'avancement en direct depuis le site.",
    '- Fonctionne hors ligne ; les comptages repartent au retour du réseau.',
    '',
    '## Comment il se compose',
    '',
    "- Une application mobile (iOS 16.4+, Android 7.0+) pour compter en rayon.",
    '- Un site pour préparer, suivre et exporter. Il demande un ordinateur :',
    "  l'espace connecté ne s'ouvre pas sous 720 px de large.",
    '- Deux rôles séparés : superviseur et compteur.',
    '',
    '## Pour qui',
    '',
    '- Les magasins et les réseaux de magasins qui comptent leur stock, de la',
    "  boutique à l'entrepôt.",
    '- Aucun matériel à acheter : un téléphone ou une tablette par personne',
    '  qui compte.',
    '',
    '## Prix',
    '',
    `- Une licence par magasin, à partir de ${prixMini} par mois.`,
    '- Comptes et inventaires illimités ; seuls les appareils qui comptent en',
    '  même temps sont décomptés.',
    ...OFFRES.map(o => `- ${o.nom} — ${o.plage} : ${euros(o.mois)} par mois, ou ${euros(o.an)} par an.`),
    `- ${TVA_APPLICABLE ? 'Prix hors taxes, par magasin.' : `Prix par magasin. ${MENTION_TVA}.`}`,
    ...(venteOuverte()
      ? ['- La souscription en ligne est ouverte.']
      : ["- La souscription en ligne n'est pas encore ouverte : la demande passe", '  par le formulaire du site.']),
    '',
    '## Données',
    '',
    "- Hébergées dans l'Union européenne.",
    '- Aucun traceur publicitaire, aucune mesure d’audience ; les polices du',
    '  site sont auto-hébergées.',
    '- Chacun peut télécharger ses données ou supprimer son compte.',
    '',
    '## Langues',
    '',
    '- Français et anglais, pour le site comme pour l’application.',
    `- Les pages anglaises vivent sous ${url('/en')}.`,
    '',
    '## Pages',
    '',
    `- [Accueil](${url('/')}) : ce que fait Quantinvo, en bref.`,
    `- [Qu'est-ce que Quantinvo ?](${url('/decouvrir')}) : la définition du produit, et une foire aux questions.`,
    `- [L'inventaire](${url('/inventaire')}) : pourquoi compter son stock, et comment bien le faire.`,
    `- [Pourquoi nous choisir](${url('/pourquoi-nous-choisir')}) : ce qui distingue l'outil.`,
    `- [Tarifs](${url('/tarifs')}) : la grille complète, et les questions qu'on nous pose.`,
    `- [Confidentialité](${url('/confidentialite')}) · [Conditions générales](${url('/conditions-generales')}) · [Supprimer son compte](${url('/suppression-compte')})`,
    '',
    ...(boutiques.length
      ? ['## Télécharger', '', ...boutiques.map(b => `- ${b}`), '']
      : []),
    '## Contact',
    '',
    '- contact@quantinvo.com',
    `- ${SITE_URL}`,
    '',
  ]
  return lignes.join('\n')
}

export function GET() {
  return new Response(corps(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
