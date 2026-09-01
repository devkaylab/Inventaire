'use client'

// La prise en main de l'application mobile, écran par écran.
//
// Elle répond aux deux besoins qu'un repère dans l'app ne couvre pas : le
// REVOIR quand on ne s'en souvient plus, et le MONTRER à quelqu'un qui n'a pas
// encore le téléphone en main.
//
// ⚠️ Une page à part, pas un dépliant dans le panneau de la boîte à outils :
// treize étapes y feraient trois écrans de haut et enterreraient les balises
// et les modèles. Une page a une adresse — elle se met en favori, s'envoie à
// une recrue, et s'imprime.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { getMyCompany, type Company } from '@/lib/account'
import { CAPTURES_LE, CAPTURES_A_REFAIRE, PARCOURS } from '@/lib/priseEnMain'

export default function PriseEnMainPage() {
  const guard = useAuthGuard('supervisor')
  const [company, setCompany] = useState<Company | null>(null)
  const [actif, setActif] = useState<'compteur' | 'superviseur'>('compteur')

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then(setCompany).catch(() => setCompany(null))
  }, [guard.status])

  if (guard.status !== 'ready') {
    return <div className="auth-wrap"><p className="muted">Chargement…</p></div>
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <div>
          <h1 className="page-title">Prise en main</h1>
          <p className="page-sub">
            L&apos;application mobile, écran par écran · captures du {CAPTURES_LE}
          </p>
        </div>
        <div className="app-head-actions pem-actions">
          <Link href="/outils" className="btn btn-ghost btn-sm">Retour à la boîte à outils</Link>
          <button type="button" className="btn btn-sm" onClick={() => window.print()}>
            Imprimer
          </button>
        </div>
      </div>

      {/* ⚠️ Dire que les captures ont vieilli plutôt que laisser croire ce
          qu'elles montrent. C'est ce qui a tué le tutoriel intégré : il
          décrivait des écrans disparus. */}
      {CAPTURES_A_REFAIRE && (
        <div className="panel pem-avis">
          <p>
            <strong>Les captures datent du {CAPTURES_LE} et l&apos;application a changé depuis.</strong>{' '}
            Les gestes et l&apos;ordre des étapes sont à jour ; certains écrans ne sont plus
            exactement ceux-là. Une nouvelle passe de captures est prévue.
          </p>
        </div>
      )}

      {/* Le sélecteur de parcours. Le compteur d'abord : c'est le plus court,
          le plus fréquent, et celui qu'on montre à quelqu'un d'autre. */}
      <div className="pem-onglets" role="tablist" aria-label="Parcours">
        {PARCOURS.map((p) => (
          <button
            key={p.cle}
            type="button"
            role="tab"
            aria-selected={actif === p.cle}
            className={`pem-onglet${actif === p.cle ? ' pem-onglet-on' : ''}`}
            onClick={() => setActif(p.cle)}
          >
            {p.nom}
          </button>
        ))}
      </div>

      {PARCOURS.map((p) => (
        <section
          key={p.cle}
          className={`pem-parcours${actif === p.cle ? '' : ' pem-cache'}`}
          aria-label={`Parcours ${p.nom}`}
        >
          <h2 className="pem-titre">{p.nom}</h2>
          <p className="pem-intro">{p.intro}</p>

          <ol className="pem-etapes">
            {p.etapes.map((e, i) => (
              <li key={e.image} className="pem-etape">
                <div className="pem-shot">
                  {/* Pas de `next/image` : ces PNG sont servis en demi-résolution
                      et jamais redimensionnés côté serveur. Une balise simple
                      s'imprime aussi, ce que le composant optimisé ne garantit
                      pas. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/prise-en-main/${e.image}.png`}
                    alt={`Écran de l’application : ${e.titre}`}
                    loading="lazy"
                    width={603}
                    height={1311}
                  />
                  <span className="pem-num" aria-hidden="true">{i + 1}</span>
                </div>
                <div className="pem-txt">
                  <h3>{e.titre}</h3>
                  <p>{e.texte}</p>
                  <p className="pem-repere">{e.repere}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <p className="pem-pied">
        Ce guide décrit l&apos;application mobile. Le suivi en direct, les écarts et le rapport
        se lisent sur ce site, plus au large.
      </p>
    </AppShell>
  )
}
