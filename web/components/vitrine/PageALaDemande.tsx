'use client'

/**
 * « Qui fait votre inventaire ? » — la page qui compare les deux produits.
 *
 * Maquette : la planche Main.
 *
 * ⚠️ **ELLE EXISTE PARCE QUE RIEN NE MENAIT À ON-DEMAND.** Constat de Julien,
 * 20 septembre 2026 : « depuis le site quantinvo, je n'ai aucun bouton qui
 * mène vers on demand ». Le tunnel `/reserver` était construit et
 * inatteignable — une porte sans couloir.
 *
 * ⚠️ **LES DEUX OFFRES SONT AU MÊME RANG, ET C'EST LE POINT.** Une page qui
 * pousse On-Demand dirait à un abonné OS qu'il s'est trompé, et une page qui le
 * relègue laisserait croire que c'est un service de dépannage. Ce qui change
 * entre les deux tient en une phrase — qui tient le téléphone — et c'est elle
 * qui est en tête.
 */
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '@/components/SiteChrome'
import { useTraduction } from '@/lib/i18n'
import { OFFRES, euros } from '@/lib/offres'

function Coche({ accent = false }: { accent?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
         stroke={accent ? 'var(--accent-2)' : 'var(--text-2)'} strokeWidth="2.4"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="4 12 9.5 17.5 20 6.5" />
    </svg>
  )
}

export function PageALaDemande() {
  const { lien } = useTraduction()

  // ⚠️ LE PRIX D'APPEL SE DÉDUIT DE LA GRILLE, il ne se recopie pas. Il a
  // bougé une fois déjà (31 août 2026) et trois pages l'affichaient encore à
  // l'ancien tarif.
  const moinsCher = Math.min(...OFFRES.map((o) => o.mois))

  return (
    <>
      <SiteHeader langue="fr" />
      <main className="container ald-page">
        <header className="ald-tete">
          <h1>Qui fait votre inventaire ?</h1>
          <p>
            Deux façons d’y arriver. Le logiciel est le même, le rapport aussi —
            ce qui change, c’est qui tient le téléphone.
          </p>
        </header>

        <div className="ald-choix">
          <section className="ald-carte">
            <h2>Vous, avec votre équipe</h2>
            <p className="muted">
              Vous importez votre stock, vous découpez le magasin en zones, vos
              collaborateurs comptent sur leurs téléphones.
            </p>
            <ul>
              <li><Coche />Comptage, audit en seconde passe, rapport d’écarts</li>
              <li><Coche />Autant d’inventaires que vous voulez dans l’année</li>
              <li><Coche />Vous recrutez et encadrez les compteurs</li>
            </ul>
            <div className="ald-pied">
              <p className="muted">
                À partir de <b>{euros(moinsCher)}</b> par mois et par magasin
              </p>
              <Link href={lien('/decouvrir')} className="btn btn-ghost">
                Découvrir Quantinvo OS
              </Link>
            </div>
          </section>

          <section className="ald-carte">
            <h2>Nous, avec la nôtre</h2>
            <p className="muted">
              Nous venons avec les inventoristes et les téléphones. Vous suivez
              l’avancement depuis votre bureau et vous recevez le rapport.
            </p>
            <ul>
              <li><Coche accent />Une équipe formée, un responsable sur place</li>
              <li><Coche accent />Contrôle des écarts et second comptage compris</li>
              <li><Coche accent />Personne à recruter, personne à former</li>
            </ul>
            <div className="ald-pied">
              <p className="muted">Votre inventaire en <b>trois questions</b>.</p>
              {/* ⚠️ `/reserver` n'est pas une page de vitrine : elle reste en
                  français quelle que soit la langue de celle-ci, parce que le
                  service ne couvre que la France. `lien()` la laisse donc
                  telle quelle, et c'est voulu. */}
              <Link href="/reserver" className="btn btn-primary">
                Réserver un inventaire
              </Link>
            </div>
          </section>
        </div>

        <p className="ald-note muted">
          Déjà abonné à Quantinvo OS ? Vous réservez une équipe depuis votre
          tableau de bord, avec vos magasins et vos coordonnées de facturation —
          sans recréer de compte.
        </p>
      </main>
      <SiteFooter langue="fr" />
    </>
  )
}
