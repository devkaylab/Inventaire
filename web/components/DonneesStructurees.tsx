import { OFFRES, TVA_APPLICABLE } from '@/lib/offres'
import { SITE_URL, url } from '@/lib/site'

/**
 * Les données structurées (JSON-LD) que lisent les moteurs et les assistants.
 *
 * ⚠️ **Elles décrivent, elles ne vendent pas.** Un balisage qui annonce ce que
 * la page ne dit pas est une fausse déclaration : Google le sanctionne, et un
 * assistant qui le recopie fait dire au produit ce qu'il ne fait pas. Chaque
 * valeur ci-dessous vient de la même source que la page — les prix de
 * `lib/offres.ts`, jamais recopiés à la main.
 *
 * ⚠️ **Le JSON est échappé sur `<`** avant d'entrer dans le document : sans
 * cela, une valeur contenant `</script>` fermerait la balise et le reste
 * s'exécuterait comme du HTML. Aucune de nos valeurs ne vient d'une saisie
 * libre aujourd'hui, mais la règle ne doit pas dépendre de ça.
 */
function Bloc({ donnees }: { donnees: object }) {
  const json = JSON.stringify(donnees).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

/** L'éditeur et le site. À poser une fois, dans la mise en page racine. */
export function OrganisationJsonLd() {
  return (
    <Bloc donnees={{
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organisation`,
          name: 'Quantinvo',
          url: SITE_URL,
          logo: url('/og.png'),
          description:
            "Éditeur de Quantinvo, l'outil d'inventaire pour le commerce de détail : comptage au téléphone, audit en seconde passe, rapport d'écarts.",
          email: 'contact@quantinvo.com',
          areaServed: 'FR',
        },
        {
          '@type': 'WebSite',
          '@id': `${SITE_URL}/#site`,
          url: SITE_URL,
          name: 'Quantinvo',
          inLanguage: 'fr-FR',
          publisher: { '@id': `${SITE_URL}/#organisation` },
        },
      ],
    }} />
  )
}

/**
 * Le produit lui-même, avec sa grille.
 *
 * ⚠️ `offers` reprend `OFFRES` : si la grille bouge, le balisage bouge avec
 * elle. Les decks ont porté pendant une semaine une grille remplacée ; un
 * balisage périmé serait pire, il est lu par des machines qui ne vérifient
 * rien.
 */
export function LogicielJsonLd() {
  return (
    <Bloc donnees={{
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#logiciel`,
      name: 'Quantinvo',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: "Inventaire et gestion de stock",
      operatingSystem: 'iOS 16.4+, Android 7.0+',
      url: SITE_URL,
      image: url('/og.png'),
      inLanguage: 'fr-FR',
      description:
        "Outil d'inventaire pour le commerce de détail. Les équipes comptent en rayon avec leur téléphone ou une douchette Bluetooth ; les zones sont découpées par des balises QR imprimées depuis l'outil ; une seconde passe d'audit fiabilise le comptage ; le rapport d'écarts s'exporte en tableur. Fonctionne sans réseau en réserve, les comptages repartent au retour du signal.",
      featureList: [
        'Comptage par scan de code-barres, au téléphone ou à la douchette Bluetooth',
        'Découpage du magasin en zones par balises QR imprimées',
        'Seconde passe d’audit et arbitrage des écarts',
        "Rapport d'écarts en unités et en valeur, export Excel",
        'Import du référentiel articles et du stock théorique (CSV, Excel)',
        'Suivi de l’avancement en direct depuis le site',
        'Fonctionne hors ligne, synchronisation au retour du réseau',
      ],
      publisher: { '@id': `${SITE_URL}/#organisation` },
      offers: OFFRES.map(o => ({
        '@type': 'Offer',
        name: o.nom,
        description: `${o.plage} comptant en même temps, par magasin.`,
        price: o.an,
        priceCurrency: 'EUR',
        url: url('/tarifs'),
        // Le balisage doit dire la même chose que la page, sinon il annonce
        // un prix qui n'est pas celui payé. En franchise en base, le prix
        // affiché EST le prix dû : rien ne s'y ajoute.
        valueAddedTaxIncluded: !TVA_APPLICABLE,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: o.an,
          priceCurrency: 'EUR',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitText: 'AN' },
          valueAddedTaxIncluded: false,
        },
      })),
    }} />
  )
}

export interface QuestionReponse { question: string; reponse: string }

/**
 * ⚠️ Une `FAQPage` n'est valable que si les questions sont **visibles sur la
 * page**. Un balisage de questions qu'on ne lit nulle part est une infraction
 * aux règles de Google sur les données structurées, et il se sanctionne. Ne
 * poser ce composant qu'à côté du texte qu'il décrit.
 */
export function FaqJsonLd({ items }: { items: QuestionReponse[] }) {
  return (
    <Bloc donnees={{
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.reponse },
      })),
    }} />
  )
}
