'use client'

// La carte « un magasin » — son nom, et le nombre d'appareils qui y comptent.
//
// Elle est née sur /inscription, où le prospect déclare ses magasins. Elle sert
// aussi à l'administrateur d'entreprise qui demande l'ajout d'un magasin : dans
// les deux cas on demande la même chose, pour la même raison — c'est ce qui
// tarife la licence.
//
// ⚠️ **L'ASSIETTE A CHANGÉ LE 2 SEPTEMBRE 2026, et avec elle deux règles.**
//
// 1. **Le stock théorique et la surface ont quitté ce formulaire.** La licence
//    se calait sur le volume de stock jusqu'au 30 août ; elle se cale désormais
//    sur le nombre d'appareils qui comptent EN MÊME TEMPS dans le magasin
//    (hypothèse 4). Un chiffre qui ne tarife plus rien n'a rien à faire dans un
//    formulaire public : il se remplit mal, il se discute pour rien, et il
//    laisse croire qu'il pèse sur le prix.
//    ⚠️ Conséquence à connaître : le recoupement stock / surface
//    (`alerteDensite` d'`admin_pipeline`) et l'écran `/admin/usage` n'ont plus
//    de source sur les demandes nouvelles. Ils ne servent plus qu'aux magasins
//    déclarés avant cette date. Les colonnes `units` et `sqm` restent en base —
//    on retire les appels d'abord, on supprime les objets plus tard.
//
// 2. **L'offre et son prix S'AFFICHENT à la frappe**, ce qui renverse la
//    décision du 22 août 2026. Elle interdisait d'afficher un tarif en face du
//    champ qui le détermine, et elle avait raison tant que ce champ était le
//    stock : déclaré, invérifiable, il indiquait au prospect quel chiffre
//    baisser pour payer moins. Le nombre d'appareils est d'une autre nature —
//    il se mesure, c'est même la raison pour laquelle cette assiette a été
//    retenue — et les trois prix sont publics sur /tarifs depuis le 30 août.
//    Les cacher ici ne protégerait plus rien : cela ferait seulement remplir un
//    formulaire à l'aveugle.
//
// Une seule définition, donc. Les deux écrans ne doivent pas se mettre à
// diverger sur les libellés ou les unités.

import { euros, nomOffre, prixCents } from '@/lib/offres'

export type SaisieMagasin = { nom: string; appareils: string }

/** Une saisie libre (« 12 », « 1 200 ») ramenée à un nombre. */
export function nombreOuNull(saisie: string): number | null {
  const n = Number.parseFloat(saisie.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function MagasinSaisie({
  numero, valeur, onChange, onRetirer, idPrefix,
}: {
  /** Rang affiché dans la pastille. Absent = pas de pastille : numéroter un
      élément unique ne dit rien, la demande d'ajout n'en porte qu'un. */
  numero?: number
  valeur: SaisieMagasin
  onChange: (champ: keyof SaisieMagasin, v: string) => void
  /** Absent = pas de croix : on ne retire pas la seule ligne d'un formulaire. */
  onRetirer?: () => void
  /** Préfixe d'identifiant, dérivé d'un useId() : les libellés doivent viser
      le bon champ quand la carte est répétée. */
  idPrefix: string
}) {
  const appareils = nombreOuNull(valeur.appareils)
  const offre = nomOffre(appareils)
  const prix = prixCents(appareils, 'yearly')

  return (
    <div className="magasin">
      <div className="magasin-top">
        {numero !== undefined && <span className="magasin-no">{numero}</span>}
        <input
          value={valeur.nom}
          onChange={(e) => onChange('nom', e.target.value)}
          placeholder="Nom du magasin — Lyon Part-Dieu"
          aria-label={numero === undefined ? 'Nom du magasin' : `Nom du magasin ${numero}`}
          maxLength={80}
        />
        {onRetirer && (
          <button
            type="button"
            className="magasin-kill"
            onClick={onRetirer}
            aria-label={`Retirer le magasin ${numero ?? ''}`.trim()}
          >
            ×
          </button>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${idPrefix}-appareils`}>Appareils qui comptent en même temps</label>
        <input
          id={`${idPrefix}-appareils`}
          type="number"
          min={1}
          step={1}
          value={valeur.appareils}
          onChange={(e) => onChange('appareils', e.target.value)}
          placeholder="5"
        />
        <p className="field-hint">
          Téléphones ou tablettes qui scannent en même temps, le jour de l&apos;inventaire. Pas le
          nombre de comptes, ni le nombre de salariés.
        </p>
        {/* L'offre se lit à la frappe : les trois prix sont publics, et c'est
            ce que le devis reprendra. Rien n'est promis pour autant — un devis
            se négocie, et le montant qui part est celui que Quantinvo établit. */}
        {offre && prix !== null && (
          <p className="magasin-offre">
            <strong>{offre}</strong> — {euros(prix / 100)} / an HT par magasin
          </p>
        )}
      </div>
    </div>
  )
}
