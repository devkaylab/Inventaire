'use client'

// Boîte à outils — ce dont un superviseur a besoin en dehors d'un
// inventaire : imprimer ses balises, ses modèles de fichiers, et la prise
// en main de l'application mobile.
//
// Le panneau de balises est le même composant que dans l'onglet Set up
// d'un inventaire : on ne duplique pas la logique de série.

import { useCallback, useEffect, useState } from 'react'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { AppShell } from '@/components/AppShell'
import { BaliseSheetPanel } from '@/components/BaliseSheetPanel'
import { getMyCompany, type Company } from '@/lib/account'
import { ModelesPanel } from '@/components/ModelesPanel'
import Link from 'next/link'
import { Chargement } from '@/components/Chargement'
import { useTraduction } from '@/lib/i18n'
import { QrInstallation, URL_INSTALLATION } from '@/components/QrInstallation'

export default function OutilsPage() {
  const guard = useAuthGuard('supervisor')
  const { t } = useTraduction()
  const [company, setCompany] = useState<Company | null>(null)

  const charger = useCallback(async () => {
    setCompany(await getMyCompany().catch(() => null))
  }, [])

  useEffect(() => {
    if (guard.status !== 'ready') return
    charger()
  }, [guard.status, charger])

  if (guard.status !== 'ready') {
    return <Chargement />
  }

  return (
    <AppShell profile={guard.profile} companyName={company?.name}>
      <div className="app-head">
        <h1 className="page-title">{t('Boîte à outils')}</h1>
      </div>

      <BaliseSheetPanel context="account" />

      <ModelesPanel />

      <div className="panel">
        <h3>{t("Prise en main de l'application")}</h3>
        <p>
          {t("Les deux parcours de l'application mobile, écran par écran — pour le revoir, ou le montrer à une nouvelle recrue.")}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/outils/prise-en-main" className="btn btn-ghost btn-sm">{t('Ouvrir le guide')}</Link>
        </div>
        {/* ⚠️ UN CODE À SCANNER, PAS DEUX BOUTONS. L'espace connecté ne
            s'ouvre pas sous 720 px : on est toujours devant un ordinateur ici,
            et un bouton de téléchargement tapable n'y servait à rien — il
            fallait ressortir son téléphone et chercher « Quantinvo » dans une
            boutique. Le superviseur fait maintenant scanner l'écran par le
            téléphone de son compteur. Idée de Julien, 28 septembre 2026. */}
        <div className="outils-installer">
          <span className="outils-boutiques-titre">{t('Installer l’application')}</span>
          <div className="outils-installer-corps">
            <div className="outils-installer-code"><QrInstallation /></div>
            <div className="outils-installer-dire">
              <strong>{t('Un seul code, pour tous les téléphones')}</strong>
              <p>{t('Faites-le scanner par votre compteur. Si l’application est déjà installée, elle s’ouvre ; sinon, la boutique de son téléphone lui est proposée.')}</p>
              {/* L'adresse en clair : tout le monde n'a pas un appareil photo
                  sous la main, et un lien se copie. */}
              <a href={URL_INSTALLATION} target="_blank" rel="noreferrer">{t('www.quantinvo.com/open')}</a>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
