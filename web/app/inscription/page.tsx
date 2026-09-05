'use client'

/**
 * Le parcours d'inscription, en huit étapes (5 septembre 2026).
 *
 * Maquette validée point par point :
 * https://claude.ai/code/artifact/27d8f3e6-5e7a-4de7-a1eb-6da9d39cce3a
 *
 * « On paie, on est inscrit » — plus de demande, plus de devis, plus d'attente.
 * Ce qui remplace la demande d'avant : une adresse vérifiée par un code, un
 * compte qui ne voit rien tant qu'il n'a pas payé, et une offre calculée
 * magasin par magasin.
 *
 * ⚠️ AUCUN PRIX N'EST DÉCIDÉ ICI. `prixCents` sert à AFFICHER ; le montant qui
 * part chez Stripe vient de `prix_offre`, en base. Cette page est appelée avec
 * le jeton du prospect : lui laisser porter un montant le laisserait s'inscrire
 * à un centime.
 *
 * ⚠️ ET LE PARCOURS SE REPREND. Un abandon à l'étape 5 n'est pas perdu :
 * `enregistrer_inscription` écrit à chaque pas, `mon_inscription` relit au
 * retour, et trois relances (J+1, J+8, J+21) ramènent la personne ici.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { MentionCollecte } from '@/components/MentionCollecte'
import { PasswordRules } from '@/components/PasswordRules'
import { passwordError } from '@/lib/password'
import { formaterSiren, messageSiren, normaliserSiren } from '@/lib/siren'

/**
 * ⚠️ Un exemple qui NE DÉSIGNE PERSONNE. Un numéro valide en placeholder invite
 * à le saisir, et le registre rendrait alors la raison sociale d'une vraie
 * entreprise — un nom de personne s'il s'agit d'un entrepreneur individuel.
 * Celui-ci échoue à la clé de Luhn, et un test le vérifie.
 */
const SIREN_EXEMPLE = '123 456 789'
import { chercherParSiren } from '@/lib/registre'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { euros, nomOffre, prixCents } from '@/lib/offres'
import { nb } from '@/lib/format'
import {
  APPAREILS_TRANCHES, FREQUENCES, VOLUMES,
  appareilsDe, magasinVide, refusMagasin, type MagasinSaisi,
} from '@/lib/inscription'

type Rythme = 'monthly' | 'yearly'

const ETAPES = 8

export default function InscriptionPage() {
  const uid = useId()
  const [etape, setEtape] = useState(1)
  const [prete, setPrete] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [occupe, setOccupe] = useState(false)

  // 1 → 3 : l'adresse, le code, le mot de passe
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')

  // 4 → 7 : les réponses
  const [pratique, setPratique] = useState<'oui' | 'non' | ''>('')
  const [frequence, setFrequence] = useState('')
  const [volume, setVolume] = useState('')
  const [magasins, setMagasins] = useState<MagasinSaisi[]>([magasinVide()])
  const [societe, setSociete] = useState('')
  const [siren, setSiren] = useState('')
  const [ape, setApe] = useState('')
  const [telephone, setTelephone] = useState('')
  const [rythme, setRythme] = useState<Rythme>('monthly')
  const [paye, setPaye] = useState(false)

  const reponses = useMemo(() => ({
    pratique, frequence, volume, magasins, societe, siren, ape, telephone, rythme,
  }), [pratique, frequence, volume, magasins, societe, siren, ape, telephone, rythme])

  // ─── Reprendre où on s'est arrêté ─────────────────────────────────────────
  useEffect(() => {
    let vivant = true
    ;(async () => {
      if (new URLSearchParams(window.location.search).get('paiement') === 'ok') {
        if (vivant) { setPaye(true); setPrete(true) }
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { if (vivant) setPrete(true); return }
      const { data } = await supabase.rpc('mon_inscription')
      if (!vivant) return
      if (data?.existe) {
        const r = (data.reponses ?? {}) as Record<string, unknown>
        setPratique((r.pratique as 'oui' | 'non' | '') ?? '')
        setFrequence(String(r.frequence ?? ''))
        setVolume(String(r.volume ?? ''))
        setMagasins(Array.isArray(r.magasins) && r.magasins.length ? r.magasins as MagasinSaisi[] : [magasinVide()])
        setSociete(String(r.societe ?? ''))
        setSiren(String(r.siren ?? ''))
        setApe(String(r.ape ?? ''))
        setTelephone(String(r.telephone ?? ''))
        setRythme((r.rythme as Rythme) ?? 'monthly')
        setEtape(data.demande_id ? 8 : Math.max(4, Number(data.etape ?? 4)))
      } else {
        setEtape(4)
      }
      setEmail(session.user.email ?? '')
      setPrete(true)
    })()
    return () => { vivant = false }
  }, [])

  const enregistrer = useCallback(async (prochaine: number) => {
    // ⚠️ On écrit AVANT d'avancer : c'est ce qui rend l'abandon rattrapable.
    await supabase.rpc('enregistrer_inscription', {
      p_etape: prochaine, p_reponses: reponses,
    })
  }, [reponses])

  const edge = useCallback(async (corps: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('inscription', {
      body: corps,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    })
    // ⚠️ `invoke` JETTE le corps d'un refus, or c'est là que vit le message
    // utile. On le relit sur la réponse portée par l'erreur.
    if (error) {
      const r = (error as { context?: Response }).context
      if (r) { try { return await r.json() } catch { /* corps illisible */ } }
      return { success: false, error: 'Le service n’a pas répondu. Réessayez dans un instant.' }
    }
    return data
  }, [])

  // ─── Les gestes ───────────────────────────────────────────────────────────
  const demanderCode = async () => {
    setErreur(null); setOccupe(true)
    const r = await edge({ action: 'code', email: email.trim().toLowerCase() })
    setOccupe(false)
    if (!r?.success) { setErreur(r?.error ?? 'Envoi impossible.'); return }
    setEtape(2)
  }

  const creerCompte = async () => {
    setErreur(null)
    const faible = passwordError(motDePasse)
    if (faible) { setErreur(faible); return }
    setOccupe(true)
    const r = await edge({
      action: 'creer', email: email.trim().toLowerCase(), code: code.trim(),
      password: motDePasse, firstName: prenom.trim(), lastName: nom.trim(),
    })
    if (!r?.success) { setOccupe(false); setErreur(r?.error ?? 'Création impossible.'); return }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password: motDePasse,
    })
    setOccupe(false)
    if (error) { setErreur('Compte créé. Connectez-vous pour continuer.'); return }
    setMotDePasse('')
    setEtape(4)
  }

  const payer = async () => {
    setErreur(null); setOccupe(true)
    await enregistrer(8)
    const r = await edge({
      action: 'payer',
      companyName: societe.trim(),
      siren: normaliserSiren(siren) || null,
      ape: ape || null,
      firstName: prenom.trim(),
      lastName: nom.trim(),
      phone: telephone.trim(),
      billingPeriod: rythme,
      stores: magasins.map((m) => ({ name: m.nom.trim(), devices: String(appareilsDe(m) ?? '') })),
    })
    setOccupe(false)
    if (!r?.success || !r?.paymentUrl) { setErreur(r?.error ?? 'Le paiement n’a pas pu s’ouvrir.'); return }
    window.location.href = r.paymentUrl as string
  }

  // ─── Ce que l'offre coûte, à l'affichage ─────────────────────────────────
  const lignes = useMemo(() => magasins.map((m) => {
    const n = appareilsDe(m)
    return {
      nom: m.nom.trim() || 'Magasin',
      appareils: n,
      offre: n ? nomOffre(n) : '',
      mois: n ? prixCents(n, 'monthly') : null,
      an: n ? prixCents(n, 'yearly') : null,
    }
  }), [magasins])
  const complet = lignes.every((l) => l.mois != null && l.an != null)
  const totalMois = complet ? lignes.reduce((s, l) => s + (l.mois ?? 0), 0) / 100 : null
  const totalAn = complet ? lignes.reduce((s, l) => s + (l.an ?? 0), 0) / 100 : null

  const avancer = async (prochaine: number) => {
    setErreur(null)
    await enregistrer(prochaine)
    setEtape(prochaine)
  }

  if (!prete) {
    return (
      <>
        <SiteHeader />
        <main className="wrap ins-page"><p className="muted">Chargement…</p></main>
        <SiteFooter />
      </>
    )
  }

  return (
    <>
      <SiteHeader />
      <main className="wrap ins-page">
        {paye ? (
          <section className="ins-carte ins-fin">
            <h1>Votre espace est prêt</h1>
            <p className="muted">
              Le paiement est passé. Vos magasins sont créés et vous en êtes l’administrateur —
              vous pouvez constituer votre équipe et lancer un premier inventaire.
            </p>
            <Link href="/entreprise" className="btn btn-primary btn-block">Ouvrir mon espace</Link>
          </section>
        ) : (
          <section className="ins-carte">
            <div className="ins-jauge" aria-hidden="true">
              <i style={{ width: `${Math.round((etape / ETAPES) * 100)}%` }} />
            </div>
            <p className="ins-pas">Étape {etape} sur {ETAPES}</p>

            {etape === 1 && (
              <>
                <h1>Inscrire mon entreprise</h1>
                <p className="muted">
                  Quantinvo se prend en ligne, sans devis : vous répondez à quelques questions,
                  vous voyez votre offre, vous réglez. Vos accès s’ouvrent aussitôt.
                </p>
                <div className="field">
                  <label htmlFor={`${uid}-email`}>Adresse e-mail</label>
                  <input id={`${uid}-email`} type="email" autoComplete="email" value={email}
                         onChange={(e) => setEmail(e.target.value)} placeholder="vous@entreprise.fr" />
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled={occupe || !email.trim()}
                        onClick={demanderCode}>
                  {occupe ? 'Envoi…' : 'Recevoir mon code'}
                </button>
                <MentionCollecte finalite="créer votre compte, établir votre offre et vous adresser votre facture" />
              </>
            )}

            {etape === 2 && (
              <>
                <h1>Votre code</h1>
                <p className="muted">
                  Nous avons envoyé un code à six chiffres à <b>{email}</b>. Il est valable dix minutes.
                </p>
                <div className="field">
                  <label htmlFor={`${uid}-code`}>Code à six chiffres</label>
                  <input id={`${uid}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                         value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled={code.length !== 6}
                        onClick={() => { setErreur(null); setEtape(3) }}>
                  Continuer
                </button>
                <button type="button" className="link-btn ins-lien" onClick={demanderCode} disabled={occupe}>
                  Renvoyer un code
                </button>
              </>
            )}

            {etape === 3 && (
              <>
                <h1>Créez votre mot de passe</h1>
                <p className="muted">C’est avec lui que vous vous connecterez ensuite.</p>
                <div className="ins-duo">
                  <div className="field">
                    <label htmlFor={`${uid}-prenom`}>Prénom</label>
                    <input id={`${uid}-prenom`} value={prenom} autoComplete="given-name"
                           maxLength={80} onChange={(e) => setPrenom(e.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor={`${uid}-nom`}>Nom</label>
                    <input id={`${uid}-nom`} value={nom} autoComplete="family-name"
                           maxLength={80} onChange={(e) => setNom(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-mdp`}>Mot de passe</label>
                  <input id={`${uid}-mdp`} type="password" autoComplete="new-password"
                         value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
                </div>
                <PasswordRules password={motDePasse} />
                <button type="button" className="btn btn-primary btn-block"
                        disabled={occupe || !prenom.trim() || !nom.trim()} onClick={creerCompte}>
                  {occupe ? 'Création…' : 'Créer mon compte'}
                </button>
              </>
            )}

            {etape === 4 && (
              <>
                <h1>Où en êtes-vous de vos inventaires&nbsp;?</h1>
                <div className="ins-choix">
                  {([['oui', 'Nous faisons des inventaires régulièrement', 'Vous savez ce que vous comptez et à quel rythme.'],
                     ['non', 'Nous n’en faisons pas encore', 'Vous voulez mettre en place un rythme.']] as const)
                    .map(([v, t, s]) => (
                      <button key={v} type="button"
                              className={pratique === v ? 'ins-carte-choix choisie' : 'ins-carte-choix'}
                              onClick={() => setPratique(v)}>
                        <span className="t">{t}</span>
                        <span className="s">{s}</span>
                      </button>
                    ))}
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled={!pratique}
                        onClick={() => avancer(5)}>Continuer</button>
              </>
            )}

            {etape === 5 && (
              <>
                <h1>{pratique === 'oui' ? 'Comment vous comptez aujourd’hui' : 'Ce que vous aimeriez mettre en place'}</h1>
                <div className="field">
                  <label htmlFor={`${uid}-freq`}>
                    {pratique === 'oui' ? 'À quelle fréquence comptez-vous ?' : 'À quelle fréquence souhaitez-vous compter ?'}
                  </label>
                  <select id={`${uid}-freq`} value={frequence} onChange={(e) => setFrequence(e.target.value)}>
                    <option value="">Choisir…</option>
                    {FREQUENCES.map((f) => <option key={f.valeur} value={f.valeur}>{f.libelle}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-vol`}>Combien de références en stock&nbsp;?</label>
                  <select id={`${uid}-vol`} value={volume} onChange={(e) => setVolume(e.target.value)}>
                    <option value="">Choisir…</option>
                    {VOLUMES.map((v) => <option key={v.valeur} value={v.valeur}>{v.libelle}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-primary btn-block" disabled={!frequence || !volume}
                        onClick={() => avancer(6)}>Continuer</button>
              </>
            )}

            {etape === 6 && (
              <>
                <h1>Vos magasins</h1>
                <p className="muted">Une licence par magasin. Vous pourrez en ajouter à tout moment.</p>
                {magasins.map((m, i) => (
                  <div key={i} className="ins-magasin">
                    <div className="field">
                      <label htmlFor={`${uid}-mag${i}`}>Magasin {i + 1}</label>
                      <input id={`${uid}-mag${i}`} value={m.nom} maxLength={80}
                             placeholder="Nom du magasin"
                             onChange={(e) => setMagasins((v) =>
                               v.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))} />
                    </div>
                    <div className="field">
                      <label htmlFor={`${uid}-app${i}`}>Appareils qui comptent en même temps</label>
                      <select id={`${uid}-app${i}`} value={m.tranche}
                              onChange={(e) => setMagasins((v) =>
                                v.map((x, j) => j === i ? { ...x, tranche: e.target.value } : x))}>
                        <option value="">Choisir…</option>
                        {APPAREILS_TRANCHES.map((t) =>
                          <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                      </select>
                      {m.tranche === 'exact' && (
                        <input className="ins-exact" type="number" min={101} step={1} value={m.exact}
                               placeholder="Nombre exact"
                               onChange={(e) => setMagasins((v) =>
                                 v.map((x, j) => j === i ? { ...x, exact: e.target.value } : x))} />
                      )}
                      {refusMagasin(m) && m.tranche !== '' && (
                        <p className="offre-refus" role="status">{refusMagasin(m)}</p>
                      )}
                    </div>
                    {magasins.length > 1 && (
                      <button type="button" className="link-btn danger-link"
                              onClick={() => setMagasins((v) => v.filter((_, j) => j !== i))}>
                        Retirer ce magasin
                      </button>
                    )}
                  </div>
                ))}
                <p className="field-hint">
                  Un téléphone par personne qui compte au même moment — les comptes, eux, sont
                  illimités. C’est ce chiffre qui détermine l’offre, magasin par magasin.
                </p>
                <button type="button" className="link-btn ins-lien"
                        onClick={() => setMagasins((v) => [...v, magasinVide()])}>
                  + Ajouter un magasin
                </button>
                <button type="button" className="btn btn-primary btn-block"
                        disabled={magasins.some((m) => refusMagasin(m) !== null)}
                        onClick={() => avancer(7)}>Continuer</button>
              </>
            )}

            {etape === 7 && (
              <>
                <h1>Votre entreprise</h1>
                <div className="field">
                  <label htmlFor={`${uid}-siren`}>SIREN</label>
                  <input id={`${uid}-siren`} value={siren} inputMode="numeric"
                         placeholder={SIREN_EXEMPLE}
                         onChange={async (e) => {
                           const v = formaterSiren(e.target.value)
                           setSiren(v)
                           const n = normaliserSiren(v)
                           if (n.length === 9) {
                             const r = await chercherParSiren(n)
                             // Le registre remplit la raison sociale et le code
                             // APE : on ne les fait pas retaper.
                             if (r.etat === 'trouve') {
                               setSociete(r.fiche.raisonSociale)
                               if (r.fiche.ape) setApe(r.fiche.ape)
                             }
                           }
                         }} />
                  {siren && messageSiren(siren) && <p className="field-hint">{messageSiren(siren)}</p>}
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-soc`}>Raison sociale</label>
                  <input id={`${uid}-soc`} value={societe} maxLength={80}
                         onChange={(e) => setSociete(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`${uid}-tel`}>Téléphone (facultatif)</label>
                  <input id={`${uid}-tel`} value={telephone} maxLength={30} inputMode="tel"
                         onChange={(e) => setTelephone(e.target.value)} />
                </div>
                <p className="field-hint">
                  Nous vous écrirons à {email}. Le SIREN suffit — <b>aucun Kbis à fournir</b>.
                </p>
                <button type="button" className="btn btn-primary btn-block" disabled={!societe.trim()}
                        onClick={() => avancer(8)}>Voir mon offre</button>
              </>
            )}

            {etape === 8 && (
              <>
                <h1>Voici votre offre, magasin par magasin</h1>
                <div className="ins-recap">
                  {lignes.map((l, i) => (
                    <div className="l" key={i}>
                      <span>{l.nom}{l.appareils ? ` · ${nb(l.appareils)} appareils` : ''}</span>
                      <b>{l.offre}{l.mois != null ? ` · ${euros((rythme === 'monthly' ? l.mois : l.an!) / 100)}` : ''}</b>
                    </div>
                  ))}
                </div>
                <div className="ins-rythmes">
                  {(['monthly', 'yearly'] as const).map((r) => (
                    <button key={r} type="button"
                            className={rythme === r ? 'ins-rythme choisi' : 'ins-rythme'}
                            onClick={() => setRythme(r)}>
                      <span className="t">{r === 'monthly' ? 'Au mois' : 'À l’année'}</span>
                      <span className="p">
                        {r === 'monthly'
                          ? (totalMois != null ? euros(totalMois) : '—')
                          : (totalAn != null ? euros(totalAn) : '—')}
                      </span>
                    </button>
                  ))}
                </div>
                {totalMois != null && totalAn != null && totalMois * 12 > totalAn && (
                  <p className="field-hint">
                    À l’année, vous économisez {euros(totalMois * 12 - totalAn)}.
                  </p>
                )}
                <button type="button" className="btn btn-primary btn-block" disabled={occupe || !complet}
                        onClick={payer}>
                  {occupe ? 'Ouverture…' : 'Commencer à fiabiliser mon stock'}
                </button>
                {/* ⚠️ « Besoin de réfléchir » ne perd rien : le brouillon est
                    écrit, et trois relances ramènent ici. */}
                <Link href="/" className="link-btn ins-lien">J’ai besoin de réfléchir</Link>
                <p className="field-hint">
                  Rien ne se perd : nous gardons vos réponses trente jours et vous
                  reprendrez où vous en êtes.
                </p>
              </>
            )}

            {erreur && <p className="souscrire-erreur douce" role="alert">{erreur}</p>}
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
