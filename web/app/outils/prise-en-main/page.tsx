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
import { Chargement } from '@/components/Chargement'
import { QrInstallation, URL_INSTALLATION } from '@/components/QrInstallation'
import { useTraduction } from '@/lib/i18n'

export default function PriseEnMainPage() {
  const guard = useAuthGuard('supervisor')
  const { t } = useTraduction()
  const [company, setCompany] = useState<Company | null>(null)
  const [actif, setActif] = useState<'compteur' | 'superviseur'>('compteur')

  useEffect(() => {
    if (guard.status !== 'ready') return
    getMyCompany().then(setCompany).catch(() => setCompany(null))
  }, [guard.status])

  if (guard.status !== 'ready') {
    return <Chargement />
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <div>
          <h1 className="page-title">{t('Prise en main')}</h1>
          <p className="page-sub">
            {t("L'application mobile, écran par écran · captures du %{date}", { date: t(CAPTURES_LE) })}
          </p>
        </div>
        <div className="app-head-actions pem-actions">
          <Link href="/outils" className="btn btn-ghost btn-sm">{t('Retour à la boîte à outils')}</Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            {t('Imprimer')}
          </button>
        </div>
      </div>

      {/* ⚠️ Dire que les captures ont vieilli plutôt que laisser croire ce
          qu'elles montrent. C'est ce qui a tué le tutoriel intégré : il
          décrivait des écrans disparus. */}
      {CAPTURES_A_REFAIRE && (
        <div className="panel pem-avis">
          <p>
            <strong>{t("Les captures datent du %{date} et l'application a changé depuis.", { date: t(CAPTURES_LE) })}</strong>{' '}
            {t("Les gestes et l'ordre des étapes sont à jour ; certains écrans ne sont plus exactement ceux-là. Une nouvelle passe de captures est prévue.")}
          </p>
        </div>
      )}

      {/* Le sélecteur de parcours. Le compteur d'abord : c'est le plus court,
          le plus fréquent, et celui qu'on montre à quelqu'un d'autre. */}
      <div className="pem-onglets" role="tablist" aria-label={t('Parcours')}>
        {PARCOURS.map((p) => (
          <button
            key={p.cle}
            type="button"
            role="tab"
            aria-selected={actif === p.cle}
            className={`pem-onglet${actif === p.cle ? ' pem-onglet-on' : ''}`}
            onClick={() => setActif(p.cle)}
          >
            {t(p.nom)}
          </button>
        ))}
      </div>

      {PARCOURS.map((p) => (
        <section
          key={p.cle}
          className={`pem-parcours${actif === p.cle ? '' : ' pem-cache'}`}
          aria-label={t('Parcours %{nom}', { nom: t(p.nom) })}
        >
          <h2 className="pem-titre">{t(p.nom)}</h2>
          <p className="pem-intro">{t(p.intro)}</p>

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
                    alt={t('Écran de l’application : %{titre}', { titre: t(e.titre) })}
                    loading="lazy"
                    width={603}
                    height={1311}
                  />
                  <span className="pem-num" aria-hidden="true">{i + 1}</span>
                </div>
                <div className="pem-txt">
                  <h3>{t(e.titre)}</h3>
                  <p>{t(e.texte)}</p>
                  <p className="pem-repere">{t(e.repere)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {/* ⚠️ LE CODE PART AVEC LA FEUILLE. Ce guide s'imprime — c'est sa
          raison d'être, on le pose devant une recrue. Un guide papier qui
          montre l'application sans dire où la prendre est un cul-de-sac : il
          faudrait rouvrir le site pour trouver le lien. Demande de Julien,
          28 septembre 2026 : « au cas où le superviseur l'imprime, et comme
          ça l'info se trouve au même endroit ». */}
      <div className="panel pem-installer">
        <div className="pem-installer-code"><QrInstallation taille={124} /></div>
        <div className="pem-installer-dire">
          <h3>{t('Installer l’application')}</h3>
          <p>{t('Faites-le scanner par votre compteur. Si l’application est déjà installée, elle s’ouvre ; sinon, la boutique de son téléphone lui est proposée.')}</p>
          <a href={URL_INSTALLATION} target="_blank" rel="noreferrer">{t('www.quantinvo.com/open')}</a>
        </div>
      </div>

      <p className="pem-pied">
        {t("Ce guide décrit l'application mobile. Le suivi en direct, les écarts et le rapport se lisent sur ce site, plus au large.")}
      </p>
    </AppShell>
  )
}
