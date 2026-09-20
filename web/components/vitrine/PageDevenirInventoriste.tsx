'use client'

/**
 * Devenir inventoriste — la porte d'entrée du prestataire.
 *
 * Maquette : la planche Inscription-Choix (colonne « Je veux réaliser des
 * inventaires ») et Prestataire-Profil.
 *
 * ⚠️ **LE PROFIL SE REMPLIT ICI, LES MISSIONS SE PRENNENT DANS L'APP.** Saisir
 * un SIRET et cocher six secteurs au pouce, debout, est pénible ; accepter une
 * mission en quinze secondes depuis un quai de métro ne l'est pas. Chaque
 * geste va sur le support où il est facile.
 *
 * ⚠️ **ET ON NE DEMANDE NI PIÈCE D'IDENTITÉ NI IBAN.** C'est Stripe qui les
 * collecte et qui a l'obligation de vérifier. Si cette page ne le dit pas, on
 * nous les envoie par e-mail — et le risque qu'on avait évité revient par la
 * boîte de réception.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { SECTEURS } from '@/lib/prixOnDemand'
import { formaterSiren } from '@/lib/siren'

const FORMES = ['Auto-entrepreneur', 'EURL', 'SASU', 'Autre société', 'Portage salarial']
const LANGUES = ['Français', 'Anglais', 'Espagnol', 'Arabe', 'Portugais', 'Autre']
const MOBILITES = ['À pied', 'Transports en commun', 'Deux-roues', 'Voiture']

export function PageDevenirInventoriste() {
  const uid = useId()
  const [connecte, setConnecte] = useState<boolean | null>(null)
  const [aUneEntreprise, setAUneEntreprise] = useState(false)
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  const [forme, setForme] = useState('')
  const [siret, setSiret] = useState('')
  const [experience, setExperience] = useState('')
  const [secteurs, setSecteurs] = useState<string[]>([])
  const [langues, setLangues] = useState<string[]>(['Français'])
  const [mobilite, setMobilite] = useState('')
  const [rayon, setRayon] = useState('20')

  const charger = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setConnecte(Boolean(session))
    if (!session) return
    const { data } = await supabase
      .from('profiles').select('company_id').eq('id', session.user.id).maybeSingle()
    setAUneEntreprise(Boolean((data as { company_id?: string } | null)?.company_id))
  }, [])

  useEffect(() => { charger() }, [charger])

  const basculer = (liste: string[], set: (v: string[]) => void, v: string) =>
    set(liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v])

  const enregistrer = async () => {
    setErreur(null); setOccupe(true)
    const { data, error } = await supabase.rpc('enregistrer_mon_profil_inventoriste', {
      p_forme_juridique: forme || null,
      p_siret: siret.replace(/\D/g, '') || null,
      p_experience_annees: experience === '' ? null : Number(experience),
      p_secteurs: secteurs,
      p_langues: langues,
      p_mobilite: mobilite || null,
      p_rayon_km: Number(rayon) || 20,
    })
    setOccupe(false)
    if (error) { setErreur(error.message); return }
    const r = data as { success: boolean; code?: string }
    if (!r?.success) {
      setErreur(r?.code === 'compte_d_entreprise'
        // ⚠️ On dit QUOI FAIRE, pas juste « erreur ». Même règle que le refus
        // `other_company` sur les invitations, depuis le 22 août 2026.
        ? 'Ce compte appartient à une entreprise cliente. Créez un compte personnel avec une autre adresse : compter chez un concurrent de votre employeur avec le compte qu’il vous a ouvert ne serait bon pour personne.'
        : 'Enregistrement impossible pour le moment.')
      return
    }
    setEnregistre(true)
  }

  const complet = forme !== '' && secteurs.length > 0 && mobilite !== ''

  return (
    <>
      <SiteHeader langue="fr" />
      <main className="container ald-page">
        <header className="ald-tete">
          <h1>Réaliser des inventaires</h1>
          <p>
            Vous comptez sur le terrain, dans les magasins que Quantinvo sert.
            Le profil se remplit ici, une fois ; les missions se prennent ensuite
            depuis l’application.
          </p>
        </header>

        <section className="ald-carte inv-promesses">
          <ul>
            <li>Un profil professionnel, vérifié une fois pour toutes</li>
            <li>Des missions près de chez vous, aux heures que vous indiquez</li>
            <li>La rémunération annoncée avant d’accepter, jamais à négocier</li>
          </ul>
        </section>

        {connecte === false && (
          <section className="ald-carte">
            <h2>Créez d’abord votre compte</h2>
            <p className="muted">
              Le compte est gratuit et n’engage à rien. Vous reviendrez ensuite
              ici remplir votre profil.
            </p>
            <div className="ald-pied">
              <Link href="/login" className="btn btn-primary">Se connecter</Link>
            </div>
          </section>
        )}

        {connecte && aUneEntreprise && (
          <section className="ald-carte">
            <h2>Ce compte appartient à une entreprise</h2>
            <p className="muted">
              Un inventoriste indépendant a son propre compte. Compter chez un
              concurrent de votre employeur avec le compte qu’il vous a ouvert ne
              serait bon pour personne — créez-en un avec une autre adresse.
            </p>
          </section>
        )}

        {connecte && !aUneEntreprise && !enregistre && (
          <section className="ald-carte">
            <h2>Votre profil</h2>

            <div className="field">
              <span className="champ-label">Forme juridique</span>
              <div className="res-choix">
                {FORMES.map((f) => (
                  <button key={f} type="button"
                          className={`res-option${forme === f ? ' actif' : ''}`}
                          onClick={() => setForme(f)}>{f}</button>
                ))}
              </div>
            </div>

            <div className="field-duo">
              <div className="field">
                <label htmlFor={`${uid}-siret`}>SIRET <span className="muted">(facultatif ici)</span></label>
                <input id={`${uid}-siret`} value={siret} inputMode="numeric"
                       placeholder="123 456 789 00012"
                       onChange={(e) => setSiret(formaterSiren(e.target.value))} />
                <p className="field-hint">C’est Stripe qui le vérifiera.</p>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-exp`}>Expérience en inventaire</label>
                <input id={`${uid}-exp`} value={experience} inputMode="numeric" maxLength={2}
                       placeholder="3"
                       onChange={(e) => setExperience(e.target.value.replace(/\D/g, ''))} />
                <p className="field-hint">en années</p>
              </div>
            </div>

            <div className="field">
              <span className="champ-label">Secteurs que vous connaissez</span>
              <div className="res-choix">
                {SECTEURS.map((s) => (
                  <button key={s.cle} type="button"
                          className={`res-option${secteurs.includes(s.cle) ? ' actif' : ''}`}
                          onClick={() => basculer(secteurs, setSecteurs, s.cle)}>{s.nom}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="champ-label">Langues</span>
              <div className="res-choix">
                {LANGUES.map((l) => (
                  <button key={l} type="button"
                          className={`res-option${langues.includes(l) ? ' actif' : ''}`}
                          onClick={() => basculer(langues, setLangues, l)}>{l}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="champ-label">Comment vous vous déplacez</span>
              <div className="res-choix">
                {MOBILITES.map((m) => (
                  <button key={m} type="button"
                          className={`res-option${mobilite === m ? ' actif' : ''}`}
                          onClick={() => setMobilite(m)}>{m}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor={`${uid}-rayon`}>Jusqu’à quelle distance</label>
              <input id={`${uid}-rayon`} value={rayon} inputMode="numeric" maxLength={3}
                     onChange={(e) => setRayon(e.target.value.replace(/\D/g, ''))} />
              <p className="field-hint">en kilomètres autour de chez vous</p>
            </div>

            {erreur && <p className="field-err">{erreur}</p>}

            <div className="ald-pied">
              <button type="button" className="btn btn-primary"
                      disabled={occupe || !complet} onClick={enregistrer}>
                {occupe ? 'Enregistrement…' : 'Enregistrer mon profil'}
              </button>
            </div>
          </section>
        )}

        {enregistre && (
          <section className="ald-carte">
            <h2>Votre profil est enregistré</h2>
            <p className="muted">
              Il reste une étape, et elle ne se fait pas ici : ouvrir votre compte
              de paiement chez Stripe. C’est lui qui contrôle votre identité et
              qui vous verse l’argent — <b>Quantinvo ne voit ni vos papiers ni
              votre compte bancaire</b>. Vous la ferez depuis l’application, dans
              « Profil ».
            </p>
          </section>
        )}

        <section className="ald-carte">
          <h2>Ce que nous ne vous demandons pas</h2>
          <p className="muted">
            Ni pièce d’identité, ni RIB, ni justificatif de domicile. Stripe, notre
            prestataire de paiement, les collecte et les vérifie — il y est obligé.
            Ne nous les envoyez pas par e-mail.
          </p>
        </section>
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
