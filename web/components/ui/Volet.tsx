/**
 * Une grande section repliable.
 *
 * Née de l'onglet Set up, trop chargé : tout y était déroulé en permanence —
 * la planche de balises, l'affectation des plages, la liste des emplacements,
 * les deux imports et leurs colonnes attendues. Deux volets, « Zone de
 * comptage » et « Données d'inventaire », remplacent cet empilement.
 *
 * Deux règles portent l'idée, et ne doivent pas se perdre :
 *
 * · **Tout part replié**, décision de Julien le 21 août 2026 : pas d'ouverture
 *   automatique selon l'avancement, et le mode sans balise ne fait pas
 *   exception. On ouvre ce qu'on vient faire, rien d'autre.
 * · **L'en-tête dit ce qu'il y a dedans.** C'est ce qui distingue « replié »
 *   de « caché » : le résumé et la pastille suffisent à savoir où on en est
 *   sans ouvrir. Un volet dont l'en-tête ne dirait que son titre obligerait à
 *   l'ouvrir pour rien, et n'aurait rien désencombré.
 *
 * `<details>` plutôt qu'un état React : le clavier, le lecteur d'écran et la
 * recherche dans la page fonctionnent sans qu'on ait à les rebrancher.
 */
export function Volet({ titre, resume, etat, children }: {
  titre: string
  /** Ce que contient le volet, en une ligne — lisible sans l'ouvrir. */
  resume: string
  /** `null` quand la notion de « fait » n'a pas de sens pour cette section. */
  etat?: { libelle: string; ton: 'faire' | 'pret' } | null
  children: React.ReactNode
}) {
  return (
    <details className="volet">
      <summary>
        <div className="volet-txt">
          <div className="volet-titre">{titre}</div>
          <div className="volet-resume">{resume}</div>
        </div>
        {etat && <span className={`volet-pastille volet-pastille-${etat.ton}`}>{etat.libelle}</span>}
        <ChevronBas className="volet-chevron" />
      </summary>
      <div className="volet-corps">{children}</div>
    </details>
  )
}

/**
 * Le chevron des sections repliables.
 *
 * Un tracé, pas un caractère : « ▸ » et « ▾ » ne se lisent plus à petite
 * taille — « ça ressemble à un point » (Julien, 21 août 2026).
 */
export function ChevronBas({ className, size = 18 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
