'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getStoreDirectory, inviteToSession,
  type DirectoryEntry, type Member, type SessionInvitation,
} from '@/lib/inventory'
import { friendlyError } from '@/lib/errors'
import { useToast } from '@/components/ui/Toast'
import { t } from '@/lib/i18n'

/**
 * Ajouter quelqu'un à un inventaire : on cherche, on ne saisit pas.
 *
 * L'onglet Équipe d'un inventaire proposait un formulaire prénom / nom /
 * e-mail qui appelait `invite-teammate` — la fonction qui **crée un compte
 * pour l'entreprise**. Deux choses clochaient : ce n'est pas le geste attendu
 * ici (créer un compteur se fait depuis « Mon équipe »), et surtout personne
 * n'était ajouté à l'inventaire. On remplissait le formulaire, l'équipe de
 * l'inventaire ne bougeait pas.
 *
 * On choisit désormais parmi l'équipe du magasin, par nom, prénom ou e-mail,
 * avec les suggestions qui se réduisent à la frappe — le même parcours que
 * l'application mobile, qui appelle la même edge function `invite-to-session`.
 */
export function AddSessionMember({ sessionId, storeId, members, invitations, currentUserId, onAdded }: {
  sessionId: string
  storeId: string | null
  members: Member[]
  invitations: SessionInvitation[]
  currentUserId: string
  onAdded: () => Promise<void> | void
}) {
  const toast = useToast()
  const [annuaire, setAnnuaire] = useState<DirectoryEntry[]>([])
  /**
   * ⚠️ **UNE LISTE QUI N'A PAS PU SE CHARGER N'EST PAS UNE LISTE VIDE**
   * (Julien, 5 octobre 2026). L'échec était avalé — `.catch(() =>
   * setAnnuaire([]))` — et l'écran rendait alors « personne de l'équipe de ce
   * magasin ne correspond ». Une coupure réseau et une équipe vide se
   * ressemblaient exactement, et il n'y avait aucun moyen de faire la
   * différence depuis l'écran.
   */
  const [etat, setEtat] = useState<'chargement' | 'pret' | 'echec'>('chargement')
  const [essai, setEssai] = useState(0)
  const [query, setQuery] = useState('')
  const [choisi, setChoisi] = useState<DirectoryEntry | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!storeId) return
    let vivant = true
    setEtat('chargement')
    getStoreDirectory(storeId)
      .then(rows => { if (vivant) { setAnnuaire(rows); setEtat('pret') } })
      .catch(() => { if (vivant) { setAnnuaire([]); setEtat('echec') } })
    return () => { vivant = false }
  }, [storeId, essai])

  // Déjà dans l'inventaire : on ne les propose pas. Les reproposer ferait
  // découvrir le doublon au moment de l'envoi.
  const exclus = useMemo(() => {
    const ids = new Set<string>([currentUserId])
    for (const m of members) ids.add(m.user_id)
    return ids
  }, [members, currentUserId])
  const exclusMails = useMemo(
    () => new Set(invitations.map(i => i.email.toLowerCase())),
    [invitations],
  )

  const q = query.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!q || choisi) return []
    return annuaire
      .filter(d => !exclus.has(d.user_id) && !exclusMails.has((d.email ?? '').toLowerCase()))
      .filter(d =>
        (d.full_name ?? '').toLowerCase().includes(q)
        || (d.email ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [annuaire, q, choisi, exclus, exclusMails])

  // ⚠️ « Rien trouvé » ne se dit que si la liste est VRAIMENT là.
  const rienTrouve = etat === 'pret' && q.length > 0 && !choisi && suggestions.length === 0

  function choisir(entry: DirectoryEntry) {
    setChoisi(entry)
    setQuery(entry.full_name || entry.email)
  }

  async function ajouter(e: React.FormEvent) {
    e.preventDefault()
    if (!choisi || busy) return
    setBusy(true)
    try {
      const r = await inviteToSession({
        sessionId,
        fullName: choisi.full_name || '',
        email: choisi.email,
      })
      if (!r.success) { toast.error(r.error ?? t('Ajout impossible.')); return }
      const qui = choisi.full_name || choisi.email
      toast.success(
        r.outcome === 'added'
          ? t('%{qui} a rejoint l’inventaire.', { qui })
          : t('%{qui} recevra un e-mail pour rejoindre l’inventaire.', { qui }),
      )
      setChoisi(null)
      setQuery('')
      await onAdded()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!storeId) return null

  return (
    <form onSubmit={ajouter} className="member-search" autoComplete="off">
      <label htmlFor="recherche-membre" className="member-search-title">
        {t('Ajouter quelqu’un à cet inventaire')}
      </label>
      <p className="member-search-hint">
        {t('Cherchez une personne de l’équipe du magasin par nom, prénom ou adresse e-mail. Pour créer un compte, passez par ')}<strong>{t('Mon équipe')}</strong>.
      </p>

      <div className="member-search-row">
        <div className="member-search-field">
          {/*
            Le gestionnaire de mots de passe du navigateur proposait ses
            identifiants enregistrés par-dessus nos suggestions, dès la
            première lettre. `autoComplete="off"` ne suffit pas — Safari et
            Chrome l'ignorent quand le champ ressemble à un identifiant. D'où
            le nom neutre, le type `text` (un champ `search` attire aussi
            l'historique), et les drapeaux que lisent 1Password, LastPass et
            Bitwarden.
          */}
          <input
            id="recherche-membre"
            name="recherche-personne"
            type="text"
            inputMode="search"
            value={query}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore="true"
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
            placeholder={t('Nom, prénom ou e-mail…')}
            onChange={e => { setQuery(e.target.value); setChoisi(null) }}
          />
          {suggestions.length > 0 && (
            <ul className="member-suggestions" role="listbox">
              {suggestions.map(d => (
                <li key={d.user_id}>
                  <button type="button" onClick={() => choisir(d)}>
                    <span className="member-suggestion-name">{d.full_name || d.email}</span>
                    <span className="member-suggestion-mail">{d.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ⚠️⚠️ **LE CHOIX DU RÔLE EST PARTI** (Julien, 9 octobre 2026) : « un
            compteur ne peut pas être superviseur ». Il y avait ici un `select`
            à deux options, et la base enregistrait ce qu'il disait — on pouvait
            donc faire d'un compteur un co-superviseur d'inventaire. Le rôle EST
            le rôle d'entreprise, calculé en base. Ce qui le remplace est un
            constat, plus bas, et seulement une fois quelqu'un choisi. */}

        <button type="submit" className="btn btn-primary btn-sm" disabled={!choisi || busy}>
          {busy ? t('Ajout…') : t('Ajouter')}
        </button>
      </div>

      {choisi && (
        <div className="member-chosen">
          <span className="member-chosen-name">{choisi.full_name || choisi.email}</span>
          <span className="member-chosen-mail">{choisi.email}</span>
          {/* ⚠️ UN CONSTAT, PAS UN RÉGLAGE, et il lit l'annuaire — la même
              source que la base, jamais une seconde règle. */}
          <span className="member-chosen-role">
            {choisi.role === 'supervisor' ? t('Co-superviseur') : t('Compteur')}
          </span>
          <button type="button" className="link-btn" onClick={() => { setChoisi(null); setQuery('') }}>
            {t('Changer')}
          </button>
        </div>
      )}

      {etat === 'echec' && (
        <p className="field-err" style={{ marginTop: 10 }}>
          {t('L’équipe du magasin n’a pas pu être chargée. Ce n’est pas qu’elle est vide : la liste n’est pas arrivée.')}{' '}
          <button type="button" className="link-btn" onClick={() => setEssai(n => n + 1)}>
            {t('Réessayer')}
          </button>
        </p>
      )}

      {rienTrouve && (
        <p className="member-search-hint" style={{ marginTop: 10 }}>
          {t('Personne de l’équipe de ce magasin ne correspond à « %{q} ». Si la personne n’a pas encore de compte, créez-le depuis ', { q: query.trim() })}<strong>{t('Mon équipe')}</strong>{t(' ; elle apparaîtra ensuite ici.')}
        </p>
      )}
    </form>
  )
}
