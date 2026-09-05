/**
 * Le tableau de bord d'un inventaire, redessiné pour la vitrine.
 *
 * ⚠️ CE N'EST PAS UNE CAPTURE, et c'est délibéré. Les treize captures de
 * `public/prise-en-main/` sont toutes MOBILES (603 × 1311) : aucune ne montre
 * l'écran du superviseur, qui est précisément la moitié « ordinateur » de la
 * section. Une capture réelle du site porterait par ailleurs les données du
 * compte d'essai — noms de magasins, codes de scan — que la règle du projet
 * interdit dans un livrable.
 *
 * Ce qui est dessiné ici reprend exactement la composition de l'écran réel :
 * progression, tuiles, avancement par zone, derniers scans. Le jour où une
 * capture présentable existe, elle remplace ce bloc sans toucher au reste.
 */
export function ApercuTableauDeBord() {
  return (
    <div className="ecran-navigateur" aria-hidden="true">
      <div className="ecran-barre"><i /><i /><i /></div>
      <div className="tb">
        <div className="tb-tete">
          <div>
            <span className="tb-kick">Rayon textile · Maison Oberlin</span>
            <strong>68&nbsp;% des balises comptées</strong>
          </div>
          <span className="tb-vif">Temps réel</span>
        </div>

        <div className="tb-tuiles">
          <div className="tb-t"><b>6</b><span>Appareils connectés</span></div>
          <div className="tb-t"><b>4</b><span>En comptage</span></div>
          <div className="tb-t"><b>2</b><span>En audit</span></div>
          <div className="tb-t"><b>4&nbsp;820</b><span>Pièces comptées</span></div>
          <div className="tb-t"><b>612</b><span>Références</span></div>
        </div>

        <div className="tb-zones">
          <div>
            <div className="tb-zl"><span>Surface de vente</span><em>22/30 · 73&nbsp;%</em></div>
            <div className="tb-jauge"><i style={{ width: '73%' }} /></div>
          </div>
          <div>
            <div className="tb-zl"><span>Réserve</span><em>12/20 · 60&nbsp;%</em></div>
            <div className="tb-jauge"><i style={{ width: '60%' }} /></div>
          </div>
        </div>

        <div className="tb-scans">
          <span className="tb-kick">Derniers scans</span>
          <div className="tb-s"><em>Comptage</em>Robe midi bleu nuit · balise 1012<i>il y a 4&nbsp;s</i></div>
          <div className="tb-s"><em>Comptage</em>Chemise lin écru · balise 1012<i>il y a 11&nbsp;s</i></div>
          <div className="tb-s tb-s-audit"><em>Audit</em>Pull côtelé camel · balise 1007<i>il y a 26&nbsp;s</i></div>
        </div>
      </div>
    </div>
  )
}
