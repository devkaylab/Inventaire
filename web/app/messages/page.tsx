'use client'

// La boîte de réception (30 août 2026, second jet).
//
// Le premier jet empilait des cartes en lecture seule. Constat de Julien :
// « je ne peux rien faire avec ». Une boîte de réception, c'est une boîte
// mail : la liste des fils à gauche, la conversation à droite, et un champ
// pour répondre — c'est la réponse qui fait la différence.
//
// Conséquence : TOUT LE MONDE a une boîte, superviseur compris — il écrit à
// son administrateur, il doit lire la réponse. Le « il écrit sans recevoir »
// du premier jet est tombé avec le bouton Répondre.
//
// Ouvrir UN fil marque CE fil lu, pas les autres — et jamais les invitations
// à un inventaire, qui vivent dans la cloche.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany } from '@/lib/account'
import { EmptyState } from '@/components/ui/EmptyState'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { fmtDateTime, relativeTime } from '@/lib/format'
import { Chargement } from '@/components/Chargement'
import { t, tn, useTraduction } from '@/lib/i18n'

type Fil = {
  id: string
  sujet: string
  portee: 'entreprise' | 'quantinvo'
  entreprise: string | null
  avec: string
  dernier_le: string
  dernier_auteur: string
  dernier_extrait: string
  nb_messages: number
  non_lu: boolean
}
type MessageFil = {
  id: number
  auteur: string
  de_moi: boolean
  corps: string
  cree_le: string
}
type FilOuvert = {
  id: string
  sujet: string
  portee: 'entreprise' | 'quantinvo'
  entreprise: string | null
  messages: MessageFil[]
}

/** Le « + » du bouton d'écriture — un tracé, comme toutes les icônes. */
function PlusIcone() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : '')).toUpperCase()
}

export default function MessagesPage() {
  const toast = useToast()
  const guard = useAuthGuard('supervisor')
  useTraduction()
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [fils, setFils] = useState<Fil[] | null>(null)
  const [ouvert, setOuvert] = useState<FilOuvert | null>(null)
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)
  /**
   * La rédaction d'un fil neuf.
   *
   * ⚠️ ELLE VIVAIT DANS LE RAIL, DANS UNE MODALE (`MessageAdmin`), jusqu'au
   * 7 septembre 2026. Deux problèmes d'un coup : son icône était le MÊME
   * tracé que l'onglet Messages, au caractère près — deux bulles identiques
   * dans la même colonne —, et écrire se faisait ailleurs que lire. Demande
   * de Julien : « fusionner boîte de réception et boîte d'envoi sur la même
   * page ».
   *
   * ⚠️ ET ELLE PREND LA PLACE DU FIL, PAS UNE FENÊTRE PAR-DESSUS. C'est ce
   * qui rend la fusion vraie : une modale flotte au-dessus de la page, on
   * serait toujours à deux endroits. En prenant le panneau de droite, la
   * liste des conversations reste visible — de quoi remarquer qu'un fil sur
   * le même sujet existe déjà.
   */
  const [redaction, setRedaction] = useState(false)
  const [sujet, setSujet] = useState('')
  const [corps, setCorps] = useState('')
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null)

  /**
   * ⚠️ QUI PEUT OUVRIR UN FIL — la règle du rail, déplacée telle quelle.
   * Chacun écrit un cran au-dessus : le superviseur à l'administrateur de son
   * entreprise, l'administrateur d'entreprise à Quantinvo. L'administrateur
   * Quantinvo n'a personne au-dessus — il répond, il n'ouvre pas de fil.
   * Le destinataire reste déduit du PROFIL par la fonction edge, jamais d'un
   * paramètre de l'écran.
   */
  const peutEcrire = guard.status === 'ready'
    && guard.profile.role === 'supervisor' && !guard.profile.is_admin
  const versQuantinvo = guard.status === 'ready' && guard.profile.is_company_admin

  const chargerFils = useCallback(async () => {
    const { data } = await supabase.rpc('mes_fils')
    return (data ?? []) as Fil[]
  }, [])

  const ouvrirFil = useCallback(async (id: string) => {
    const { data, error } = await supabase.rpc('ouvrir_message_fil', { p_fil: id })
    if (error || !data) return
    setOuvert(data as FilOuvert)
    // Le panneau de droite n'a qu'un occupant : ouvrir un fil ferme la
    // rédaction, et réciproquement.
    setRedaction(false)
    // Le fil vient d'être lu : la liste doit cesser de le signaler.
    setFils((prev) => prev?.map((f) => (f.id === id ? { ...f, non_lu: false } : f)) ?? prev)
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then((c) => setCompanyName(c?.name ?? null)).catch(() => {})
    chargerFils().then((liste) => {
      setFils(liste)
      // La notification de la cloche mène à SON fil ; sinon on ouvre le
      // premier, comme une boîte mail.
      // `location.search` plutôt que `useSearchParams` : c'est la règle du
      // projet, elle évite la frontière Suspense que Next impose au prérendu
      // (le build échoue sinon).
      const demande = new URLSearchParams(window.location.search).get('fil')
      const cible = (demande && liste.some((f) => f.id === demande)) ? demande : liste[0]?.id
      if (cible) void ouvrirFil(cible)
    })
  }, [guard.status, chargerFils, ouvrirFil])

  async function repondre(e: React.FormEvent) {
    e.preventDefault()
    if (!ouvert || envoi || reponse.trim() === '') return
    setEnvoi(true)
    try {
      const { data, error } = await supabase.functions.invoke('message-admin', {
        body: { filId: ouvert.id, message: reponse },
      })
      let ok = !error && data?.success
      if (error && !data?.error) {
        // Edge injoignable : la réponse part quand même, sans e-mail.
        const direct = await supabase.rpc('repondre_fil', { p_fil: ouvert.id, p_message: reponse })
        ok = !direct.error && direct.data?.success
        if (direct.error) toast.error(friendlyError(direct.error))
      } else if (!ok) {
        toast.error(data?.error ?? t('Envoi impossible pour le moment.'))
      }
      if (ok) {
        setReponse('')
        await ouvrirFil(ouvert.id)
        setFils(await chargerFils())
      }
    } finally {
      setEnvoi(false)
    }
  }

  function ouvrirRedaction() {
    setRedaction(true)
    setOuvert(null)
    setSujet('')
    setCorps('')
    setErreurEnvoi(null)
  }

  /**
   * L'ouverture d'un fil neuf — le corps de l'ancienne modale du rail, repris
   * tel quel.
   *
   * ⚠️ RIEN NE CHANGE CÔTÉ SERVEUR : même fonction edge `message-admin`, même
   * repli sur `ouvrir_fil` quand elle est injoignable (le message passe alors
   * sans e-mail, plutôt que de ne pas passer du tout), mêmes bornes 120 et
   * 2000 qui REFUSENT. C'est un déménagement d'interface, pas un second
   * chemin d'écriture.
   *
   * ⚠️ Et un refus reste SOUS le formulaire le temps qu'on corrige, jamais
   * dans une notification qui s'efface avant qu'on l'ait lue.
   */
  async function envoyerNouveau(e: React.FormEvent) {
    e.preventDefault()
    if (envoi) return
    setEnvoi(true)
    setErreurEnvoi(null)
    try {
      const { data, error } = await supabase.functions.invoke('message-admin', {
        body: { sujet, message: corps },
      })
      let succes = !error && data?.success
      let refus: string | null = !succes ? (data?.error ?? null) : null
      if (error && !refus) {
        const direct = await supabase.rpc('ouvrir_fil', { p_sujet: sujet, p_message: corps })
        succes = !direct.error && direct.data?.success
        refus = direct.error?.message ?? null
      }
      if (succes) {
        toast.success(versQuantinvo
          ? t('Message envoyé à Quantinvo.')
          : t('Message envoyé à l’administrateur de votre entreprise.'))
        setSujet('')
        setCorps('')
        setRedaction(false)
        // Le fil neuf est en tête de la liste : on l'ouvre, c'est ce qu'on
        // vient d'écrire.
        const liste = await chargerFils()
        setFils(liste)
        if (liste[0]) void ouvrirFil(liste[0].id)
      } else {
        setErreurEnvoi(refus ?? t('Envoi impossible pour le moment.'))
      }
    } finally {
      setEnvoi(false)
    }
  }

  if (guard.status !== 'ready') {
    return <Chargement />
  }

  return (
    <AppShell profile={guard.profile} companyName={companyName}>
      <div className="app-head">
        <div>
          <h1 className="page-title">{t('Messages')}</h1>
          <p className="page-sub">{t('Vos conversations, la plus récente en premier.')}</p>
        </div>
      </div>

      {fils === null ? (
        <div style={{ marginTop: 24 }}><SkeletonRows rows={4} height={72} /></div>
      ) : fils.length === 0 && !redaction ? (
        <div style={{ marginTop: 24 }}>
          {/* ⚠️ LA PHRASE NE RENVOIE PLUS VERS LE RAIL. Elle y disait « le
              bouton d'écriture est dans la barre de gauche » — devenu faux le
              7 septembre 2026. Et l'état vide est justement le seul endroit
              où la liste, donc son bouton, n'existe pas : il s'y repose.

              ⚠️ ET C'EST `&& !redaction` QUI FAIT MARCHER SON BOUTON. Sans
              lui, `ouvrirRedaction()` posait bien son état — mais cette
              branche ne le lit pas, et le formulaire vit dans l'autre. Le
              bouton ne faisait donc RIEN, et précisément pour qui n'a encore
              jamais écrit (constat de Julien, 7 septembre 2026). Une page à
              deux branches se regarde dans les DEUX : je n'avais vérifié que
              celle qui porte des fils. */}
          <EmptyState
            title={t('Aucun message')}
            hint={guard.profile.is_admin
              ? t('Les messages des entreprises clientes arrivent ici.')
              : guard.profile.is_company_admin
                ? t('Les messages de vos superviseurs arrivent ici — et vos échanges avec Quantinvo.')
                : t('Vos échanges avec l’administrateur de votre entreprise arrivent ici.')}
          />
          {peutEcrire && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: -8 }}>
              <button type="button" className="btn btn-primary" onClick={ouvrirRedaction}>
                <PlusIcone /> {t('Nouveau message')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="boite">
          <aside className="boite-liste" aria-label={t('Conversations')}>
            {/* En tête de la liste, comme dans toute messagerie : on écrit
                depuis sa boîte, pas depuis la barre de navigation. */}
            {/* ⚠️ LE BOUTON DIT TOUJOURS LA MÊME CHOSE. Une première version
                le faisait basculer en « Annuler » pendant la rédaction : le
                formulaire en portait déjà un, à trente centimètres de là. Deux
                « Annuler » pour un seul geste, et un bouton d'en-tête qui
                change de sens selon l'état. L'annulation appartient à la
                rangée d'actions, là où on regarde en finissant d'écrire.

                ⚠️ Et ce commentaire se pose AVANT la condition : un
                commentaire JSX ne peut pas être le premier enfant d'un
                `cond && (…)` qui rend un seul élément. Quatrième fois sur ce
                dépôt. */}
            {peutEcrire && (
              <div className="boite-liste-tete">
                <button type="button" className="btn btn-primary btn-large" onClick={ouvrirRedaction}>
                  <PlusIcone /> {t('Nouveau message')}
                </button>
              </div>
            )}
            {/* La liste peut être vide : on n'y arrive alors que par le
                bouton ci-dessus, en train d'écrire son premier message. Une
                colonne muette ferait croire à un chargement. */}
            {fils.length === 0 && (
              <p className="boite-liste-vide">{t("Aucune conversation pour l'instant.")}</p>
            )}
            {fils.map((f) => (
              <button
                type="button"
                key={f.id}
                className={`fil${ouvert?.id === f.id ? ' fil-actif' : ''}${f.non_lu ? ' fil-neuf' : ''}`}
                aria-current={ouvert?.id === f.id ? 'true' : undefined}
                onClick={() => void ouvrirFil(f.id)}
              >
                <div className="fil-haut">
                  <span className="fil-avec">{f.avec}</span>
                  <span className="fil-date">{relativeTime(f.dernier_le)}</span>
                </div>
                <div className="fil-sujet">
                  {f.non_lu && <span className="fil-point" aria-label={t('non lu')} />}
                  {f.sujet}
                </div>
                <div className="fil-extrait">
                  {f.dernier_auteur} : {f.dernier_extrait}
                </div>
              </button>
            ))}
          </aside>

          <section className="boite-fil" aria-label={redaction ? t('Nouveau message') : t('Conversation')}>
            {redaction ? (
              <form className="boite-redaction" onSubmit={envoyerNouveau}>
                <header className="fil-tete">
                  <h2>{versQuantinvo ? t('Nouveau message à Quantinvo') : t('Nouveau message à votre administrateur')}</h2>
                  <p className="fil-tete-sous">
                    {versQuantinvo
                      ? t('Remis à l’équipe Quantinvo, dans ses notifications et par e-mail. Elle vous répondra ici.')
                      : t('Remis à l’administrateur de votre entreprise, dans ses notifications et par e-mail. Il vous répondra ici.')}
                  </p>
                </header>

                <div className="field" style={{ marginTop: 18 }}>
                  <label htmlFor="nouveau-sujet">{t('Sujet')}</label>
                  <input
                    id="nouveau-sujet" type="text" maxLength={120} required autoFocus
                    value={sujet} onChange={(e) => setSujet(e.target.value)}
                    placeholder={versQuantinvo ? t('Licence, magasin, facturation…') : t('Balises, accès, magasin…')}
                  />
                </div>
                <div className="field boite-redaction-corps">
                  <label htmlFor="nouveau-corps">{t('Message')}</label>
                  <textarea
                    id="nouveau-corps" maxLength={2000} required
                    value={corps} onChange={(e) => setCorps(e.target.value)}
                  />
                </div>

                {erreurEnvoi && <div className="error" role="alert">{erreurEnvoi}</div>}

                <div className="boite-redaction-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setRedaction(false)}>{t('Annuler')}</button>
                  <button type="submit" className="btn btn-primary" disabled={envoi || sujet.trim() === '' || corps.trim() === ''}>
                    {envoi ? t('Envoi…') : t('Envoyer')}
                  </button>
                </div>
              </form>
            ) : !ouvert ? (
              <p className="tb-vide">{t('Choisissez une conversation.')}</p>
            ) : (
              <>
                <header className="fil-tete">
                  <h2>{ouvert.sujet}</h2>
                  <p className="fil-tete-sous">
                    {fils.find((f) => f.id === ouvert.id)?.avec}
                    {ouvert.entreprise && guard.profile.is_admin && ` · ${ouvert.entreprise}`}
                    {' · '}
                    {tn('%{count} message', '%{count} messages', ouvert.messages.length)}
                  </p>
                </header>

                <div className="fil-messages">
                  {ouvert.messages.map((m) => (
                    <article className={`bulle${m.de_moi ? ' bulle-moi' : ''}`} key={m.id}>
                      <div className="bulle-tete">
                        <span className="bulle-avatar">{initiales(m.auteur)}</span>
                        <span className="bulle-auteur">{m.de_moi ? t('Vous') : m.auteur}</span>
                        <span className="bulle-date" title={fmtDateTime(m.cree_le)}>
                          {relativeTime(m.cree_le)}
                        </span>
                      </div>
                      {/* pre-line : un message est un texte, ses retours à la
                          ligne comptent. */}
                      <p className="bulle-corps">{m.corps}</p>
                    </article>
                  ))}
                </div>

                <form className="fil-repondre" onSubmit={repondre}>
                  <label htmlFor="fil-reponse" className="sr-only">{t('Votre réponse')}</label>
                  <textarea
                    id="fil-reponse" rows={3} maxLength={2000}
                    value={reponse} onChange={(e) => setReponse(e.target.value)}
                    placeholder={t('Répondre…')}
                  />
                  <button type="submit" className="btn btn-primary" disabled={envoi || reponse.trim() === ''}>
                    {envoi ? t('Envoi…') : t('Répondre')}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </AppShell>
  )
}
