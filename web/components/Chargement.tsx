'use client'

import { Logo } from './Logo'
import { useTraduction } from '@/lib/i18n'

/**
 * L'attente pleine page.
 *
 * Vingt écrans écrivaient la même ligne à la main — `<div className="auth-wrap">
 * <p className="muted">Chargement…</p></div>` — ce qui n'était pas un problème
 * tant qu'il n'y avait rien à y montrer. Depuis que la marque sait balayer, il
 * y a quelque chose : une seule définition, et les vingt écrans en héritent.
 *
 * ⚠️ CE N'EST PAS UNE ROUE QUI TOURNE, ET C'EST LE POINT. L'allée pleine saute
 * d'une position à l'autre dans le cadre — c'est le geste du produit, on
 * compte une zone puis la suivante. Une roue dit « ça charge » ; ceci dit
 * « Quantinvo travaille ».
 *
 * ⚠️ LE MOT RESTE. Une marque qui bouge sans un mot laisse le doute entre
 * « ça arrive » et « c'est cassé » — c'est la règle posée le 4 septembre avec
 * `.chargement-note` : l'attente se DIT. Et le `role="status"` la fait dire
 * aussi aux lecteurs d'écran, pour qui une animation ne dit rien du tout.
 */
export function Chargement({ texte }: { texte?: string }) {
  const { t } = useTraduction()
  return (
    <div className="auth-wrap" role="status" aria-live="polite">
      <div className="chargement-marque">
        <Logo size={44} anime />
        <p className="muted">{texte ?? t('Chargement…')}</p>
      </div>
    </div>
  )
}
