'use client'

/**
 * Renommer, sur place.
 *
 * Un lien discret à côté du nom ; au clic, le nom devient un champ, avec
 * « Enregistrer » et « Annuler ». Trois raisons de ne pas ouvrir une modale :
 * on renomme ce qu'on a sous les yeux, c'est réversible d'un second
 * renommage, et une boîte de dialogue pour trois mots est une cérémonie.
 *
 * ⚠️ **Ce composant ne sait pas ce qu'il renomme.** Il rend un nom, encaisse
 * une saisie et appelle `onValider`. La règle — qui a le droit, quel doublon
 * est refusé — vit dans la fonction en base, et le message d'erreur qu'elle
 * renvoie s'affiche ici tel quel.
 */
import { useEffect, useRef, useState } from 'react'

export function Renommer({
  nom, label, onValider, className,
}: {
  nom: string
  /** Ce qu'on renomme, pour l'aide vocale : « ce magasin », « cette entreprise ». */
  label: string
  onValider: (nouveau: string) => Promise<string | null>
  /** Classe du nom quand il n'est pas en cours d'édition (`page-title`…). */
  className?: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const [valeur, setValeur] = useState(nom)
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => { if (ouvert) champ.current?.select() }, [ouvert])

  function ouvrir() {
    setValeur(nom)
    setErreur(null)
    setOuvert(true)
  }

  async function valider() {
    const propre = valeur.trim()
    if (!propre || propre === nom) { setOuvert(false); return }
    setBusy(true)
    const message = await onValider(propre)
    setBusy(false)
    // Un refus reste à l'écran, sous le champ : la personne doit pouvoir
    // corriger sans avoir à rouvrir.
    if (message) { setErreur(message); return }
    setOuvert(false)
  }

  if (!ouvert) {
    return (
      <span className="renommer-ligne">
        <span className={className}>{nom}</span>
        <button type="button" className="link-btn" onClick={ouvrir}>Renommer</button>
      </span>
    )
  }

  return (
    <div className="renommer-edition">
      <div className="renommer-ligne">
        <input
          ref={champ}
          className="renommer-champ"
          value={valeur}
          maxLength={80}
          aria-label={`Nouveau nom de ${label}`}
          onChange={(e) => { setValeur(e.target.value); setErreur(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); valider() }
            if (e.key === 'Escape') { e.preventDefault(); setOuvert(false) }
          }}
        />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={valider}>
          Enregistrer
        </button>
        <button type="button" className="link-btn" onClick={() => setOuvert(false)}>Annuler</button>
      </div>
      {erreur && <p className="field-err">{erreur}</p>}
    </div>
  )
}
