#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Le livre de comptes de Devkaylab — modèle Excel.

    python3 build-comptabilite.py            → Quantinvo-comptabilite-MODELE.xlsx

⚠️ CE SCRIPT ÉCRIT UN MODÈLE VIDE, JAMAIS LE LIVRE DE JULIEN. Le livre est une
   COPIE de ce modèle, renommée, qui vit hors du dépôt (il porte des montants).
   Régénérer le modèle ne doit donc jamais pouvoir écraser des écritures : le
   fichier produit porte « MODELE » dans son nom, et le mode d'emploi dit de le
   copier avant de saisir quoi que ce soit.

⚠️ CE N'EST PAS UN LOGICIEL COMPTABLE, et le mode d'emploi le dit en toutes
   lettres. C'est une tenue de trésorerie avec des catégories comptables, plus
   les quatre écritures de clôture qu'un exercice sans client demande. Le régime
   réel simplifié l'autorise : on tient la trésorerie en cours d'année, on passe
   les écritures d'inventaire à la clôture.

⚠️ FRANCHISE EN BASE DE TVA — c'est la décision qui commande tout le reste.
   Devkaylab ne facture pas de TVA (article 293 B du CGI, voir
   `web/lib/offres.ts`), donc elle ne la RÉCUPÈRE pas non plus sur ses achats.
   Toute dépense s'inscrit pour son montant TTC. La colonne « dont TVA » est là
   pour information seulement — elle servira le jour où la franchise tombera,
   pas avant. Ne pas la brancher sur un calcul.

⚠️ LES NUMÉROS DE COMPTE SONT INDICATIFS. Le plan comptable général laisse du
   jeu, et un comptable en placerait certains ailleurs. Ce qui compte pour un
   bilan juste, ce n'est pas le numéro : c'est de ne rien oublier, et de ne pas
   confondre une charge avec une immobilisation.
"""

from datetime import date
import os

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

# ── Ardoise, en version tableur ────────────────────────────────────────────
# Les valeurs sont celles du thème clair du produit (web/app/globals.css).
ENCRE = '14181A'
ENCRE2 = '3A423F'
ARDOISE = '575F5C'
ACCENT = '1E4D3B'
PAPIER = 'F2F3F1'
FILET = 'E2E5E1'
OCRE = 'A06A12'

EUR = '#,##0.00\\ "€"'
JOUR = 'DD/MM/YYYY'

T_TITRE = Font(name='Calibri', size=16, bold=True, color=ENCRE)
T_SECTION = Font(name='Calibri', size=11, bold=True, color=ENCRE)
T_ENTETE = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
T_CORPS = Font(name='Calibri', size=11, color=ENCRE2)
T_NOTE = Font(name='Calibri', size=10, color=ARDOISE, italic=True)
T_TOTAL = Font(name='Calibri', size=11, bold=True, color=ENCRE)
T_ACCENT = Font(name='Calibri', size=11, bold=True, color=ACCENT)
T_ALERTE = Font(name='Calibri', size=11, bold=True, color=OCRE)

F_ENTETE = PatternFill('solid', fgColor=ENCRE)
F_PAPIER = PatternFill('solid', fgColor=PAPIER)
F_SAISIE = PatternFill('solid', fgColor='FFFDF5')

BAS = Border(bottom=Side(style='thin', color=FILET))
HAUT = Border(top=Side(style='thin', color=ENCRE))

LIGNES = 400  # lignes de saisie du journal


def largeurs(ws, valeurs):
    for i, l in enumerate(valeurs, start=1):
        ws.column_dimensions[get_column_letter(i)].width = l


def entete(ws, titre, sous_titre=None):
    ws['A1'] = titre
    ws['A1'].font = T_TITRE
    if sous_titre:
        ws['A2'] = sous_titre
        ws['A2'].font = T_NOTE
    ws.sheet_view.showGridLines = False


# ── Le plan de comptes ─────────────────────────────────────────────────────
# Catégorie lisible → compte PCG → rubrique du compte de résultat → nature.
# La catégorie est ce que Julien choisit ; tout le reste se déduit.
COMPTES = [
    # (catégorie, compte, rubrique, nature)
    ('Hébergement et serveurs',        '6135', 'Services extérieurs',        'Charge'),
    ('Abonnements logiciels',          '651',  'Services extérieurs',        'Charge'),
    ('Nom de domaine et e-mail',       '626',  'Services extérieurs',        'Charge'),
    ('Téléphone et internet',          '626',  'Services extérieurs',        'Charge'),
    ('Comptes développeur (Apple, Google)', '651', 'Services extérieurs',    'Charge'),
    ('Petit équipement (< 500 € HT)',  '6063', 'Achats',                     'Charge'),
    ('Fournitures de bureau',          '6064', 'Achats',                     'Charge'),
    ('Frais de greffe et formalités',  '6227', 'Services extérieurs',        'Charge'),
    ('Annonce légale',                 '6231', 'Services extérieurs',        'Charge'),
    ('Honoraires (avocat, conseil)',   '6226', 'Services extérieurs',        'Charge'),
    ('Assurance',                      '6161', 'Services extérieurs',        'Charge'),
    ('Documentation et formation',     '6181', 'Services extérieurs',        'Charge'),
    ('Déplacements',                   '6251', 'Services extérieurs',        'Charge'),
    ('Frais bancaires',                '627',  'Services extérieurs',        'Charge'),
    ('Commissions Stripe',             '6278', 'Services extérieurs',        'Charge'),
    ('Publicité et communication',     '6236', 'Services extérieurs',        'Charge'),
    ('Impôts et taxes (CFE…)',         '635',  'Impôts et taxes',            'Charge'),
    ('Rémunération du dirigeant',      '641',  'Charges de personnel',       'Charge'),
    ('Cotisations sociales',           '645',  'Charges de personnel',       'Charge'),
    ('Autre charge',                   '628',  'Services extérieurs',        'Charge'),
    ('Vente de licence Quantinvo',     '706',  'Chiffre d’affaires',         'Produit'),
    ('Autre produit',                  '708',  'Chiffre d’affaires',         'Produit'),
]

RUBRIQUES_CHARGE = ['Achats', 'Services extérieurs', 'Impôts et taxes', 'Charges de personnel']


def feuille_comptes(wb):
    ws = wb.create_sheet('Plan de comptes')
    entete(ws, 'Plan de comptes',
           'La catégorie est ce que tu choisis dans le journal. Le compte et la rubrique s’en déduisent tout seuls.')
    largeurs(ws, [38, 12, 26, 14])
    r = 4
    for i, t in enumerate(['Catégorie', 'Compte', 'Rubrique', 'Nature']):
        c = ws.cell(row=r, column=i + 1, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        c.alignment = Alignment(vertical='center')
    ws.row_dimensions[r].height = 22
    for i, ligne in enumerate(COMPTES):
        for j, v in enumerate(ligne):
            c = ws.cell(row=r + 1 + i, column=j + 1, value=v)
            c.font, c.border = T_CORPS, BAS
    n = r + len(COMPTES)
    ws.cell(row=n + 2, column=1,
            value='Les numéros sont indicatifs : le plan comptable général laisse du jeu. '
                  'Ce qui compte, c’est de ne rien oublier — pas le numéro.').font = T_NOTE
    ws.cell(row=n + 3, column=1,
            value='Ajouter une catégorie : une ligne ici, et elle apparaît dans le menu du journal. '
                  'Garder la rubrique dans la liste existante, sinon le compte de résultat l’ignore.').font = T_NOTE
    return ws, r + 1, n


def feuille_journal(wb, prem_cat, dern_cat):
    ws = wb.create_sheet('Journal')
    entete(ws, 'Journal des opérations',
           'Une ligne par dépense ou par encaissement. Tout se saisit en TTC — la TVA n’est pas récupérable en franchise en base.')
    largeurs(ws, [12, 11, 40, 22, 34, 9, 14, 12, 20, 16, 13, 24, 22])
    titres = ['Date', 'N° pièce', 'Libellé', 'Tiers', 'Catégorie', 'Compte',
              'Montant TTC', 'dont TVA', 'Payé par', 'Moyen',
              'Avant immat.', 'Note', 'Rubrique']
    r = 4
    for i, t in enumerate(titres):
        c = ws.cell(row=r, column=i + 1, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        c.alignment = Alignment(vertical='center', wrap_text=True)
    ws.row_dimensions[r].height = 24
    ws.freeze_panes = 'A5'

    plage_cat = f"'Plan de comptes'!$A${prem_cat}:$A${dern_cat}"
    dv_cat = DataValidation(type='list', formula1=plage_cat, allow_blank=True)
    dv_paye = DataValidation(type='list', formula1='"Société,Julien (avance)"', allow_blank=True)
    dv_moyen = DataValidation(type='list', formula1='"Carte,Virement,Prélèvement,Espèces"', allow_blank=True)
    dv_oui = DataValidation(type='list', formula1='"Oui,Non"', allow_blank=True)
    for dv in (dv_cat, dv_paye, dv_moyen, dv_oui):
        ws.add_data_validation(dv)

    for i in range(LIGNES):
        n = r + 1 + i
        for col in range(1, 14):
            c = ws.cell(row=n, column=col)
            c.font, c.border = T_CORPS, BAS
            if col in (1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12):
                c.fill = F_SAISIE
        ws.cell(row=n, column=1).number_format = JOUR
        ws.cell(row=n, column=7).number_format = EUR
        ws.cell(row=n, column=8).number_format = EUR
        # Le compte et la rubrique se déduisent de la catégorie.
        ws.cell(row=n, column=6,
                value=f'=IFERROR(VLOOKUP($E{n},\'Plan de comptes\'!$A:$D,2,FALSE),"")')
        ws.cell(row=n, column=13,
                value=f'=IFERROR(VLOOKUP($E{n},\'Plan de comptes\'!$A:$D,3,FALSE),"")')
        dv_cat.add(ws.cell(row=n, column=5))
        dv_paye.add(ws.cell(row=n, column=9))
        dv_moyen.add(ws.cell(row=n, column=10))
        dv_oui.add(ws.cell(row=n, column=11))

    ws.auto_filter.ref = f'A{r}:M{r + LIGNES}'
    ws.column_dimensions['M'].hidden = True
    return ws


def feuille_immobilisations(wb):
    ws = wb.create_sheet('Immobilisations')
    entete(ws, 'Immobilisations',
           'Ce qui coûte plus de 500 € HT et sert plusieurs années ne passe pas en charge d’un coup : il s’amortit.')
    largeurs(ws, [34, 16, 15, 10, 18, 18, 18, 20])
    titres = ['Désignation', 'Mise en service', 'Montant TTC', 'Durée (ans)',
              'Amortissement 2026', 'Cumul amortissements', 'Valeur nette', 'Payé par']
    r = 4
    for i, t in enumerate(titres):
        c = ws.cell(row=r, column=i + 1, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        c.alignment = Alignment(vertical='center', wrap_text=True)
    ws.row_dimensions[r].height = 24
    # ⚠️ « Payé par » n'est pas décoratif : une immobilisation réglée par Julien
    # est une avance, donc une dette de la société envers lui. Sans cette
    # colonne, elle n'entrait pas au compte courant et le bilan ne tombait pas —
    # trouvé en calculant un exemplaire d'essai.
    dv_paye = DataValidation(type='list', formula1='"Société,Julien (avance)"', allow_blank=True)
    ws.add_data_validation(dv_paye)
    for i in range(20):
        n = r + 1 + i
        for col in range(1, 9):
            c = ws.cell(row=n, column=col)
            c.font, c.border = T_CORPS, BAS
            if col <= 4 or col == 8:
                c.fill = F_SAISIE
        dv_paye.add(ws.cell(row=n, column=8))
        ws.cell(row=n, column=2).number_format = JOUR
        for col in (3, 5, 6, 7):
            ws.cell(row=n, column=col).number_format = EUR
        # Amortissement linéaire, au prorata des jours de l'exercice.
        # ⚠️ La dotation ne doit PAS se borner au cumul de la colonne F : F vaut
        # E, donc E se référencerait elle-même et Excel rend #VALEUR!. Vu en
        # calculant un exemplaire d'essai. La seule borne utile est le montant.
        ws.cell(row=n, column=5, value=(
            f'=IF(OR($B{n}="",$C{n}="",$D{n}=""),"",'
            f'ROUND(MIN($C{n}/$D{n}*MAX(0,DATE(2026,12,31)-MAX($B{n},DATE(2026,1,1))+1)/365,'
            f'$C{n}),2))'))
        ws.cell(row=n, column=6, value=f'=IF($E{n}="","",$E{n})')
        ws.cell(row=n, column=7, value=f'=IF($C{n}="","",$C{n}-$F{n})')
    t = r + 21
    ws.cell(row=t, column=1, value='Total').font = T_TOTAL
    for col, lettre in ((3, 'C'), (5, 'E'), (6, 'F'), (7, 'G')):
        c = ws.cell(row=t, column=col, value=f'=SUM({lettre}{r + 1}:{lettre}{r + 20})')
        c.font, c.number_format, c.border = T_TOTAL, EUR, HAUT
    ws.cell(row=t + 2, column=1, value=(
        'Durées d’usage courantes : ordinateur 3 ans, téléphone 3 ans, mobilier 5 à 10 ans. '
        'La première année ne compte que les jours écoulés depuis la mise en service — c’est déjà calculé.')).font = T_NOTE
    ws.cell(row=t + 3, column=1, value=(
        '⚠️ Ces lignes ne se saisissent PAS dans le journal : elles y feraient une charge, '
        'et la dépense serait comptée deux fois.')).font = T_NOTE
    return ws, t


def feuille_apports(wb):
    ws = wb.create_sheet('Apports et trésorerie')
    entete(ws, 'Apports et trésorerie',
           'Trois chiffres à renseigner. Le reste du bilan s’en déduit.')
    largeurs(ws, [46, 20, 60])
    lignes = [
        ('Capital social (statuts)', None,
         'Le montant déposé à la création. Il figure sur les statuts et le Kbis.'),
        ('Solde du compte bancaire au 31/12/2026', None,
         'Le solde exact du relevé de décembre. C’est lui qui fait tomber le bilan juste.'),
        ('Solde du compte bancaire au 01/01/2026', None,
         'Zéro si la société est née en 2026.'),
    ]
    r = 4
    for i, (lib, val, note) in enumerate(lignes):
        n = r + i
        ws.cell(row=n, column=1, value=lib).font = T_SECTION
        c = ws.cell(row=n, column=2, value=val)
        c.number_format, c.fill, c.font, c.border = EUR, F_SAISIE, T_CORPS, BAS
        ws.cell(row=n, column=3, value=note).font = T_NOTE
        ws.row_dimensions[n].height = 20

    n = r + 5
    ws.cell(row=n, column=1, value='Ce que Julien a avancé (calculé)').font = T_SECTION
    c = ws.cell(row=n, column=2, value=(
        '=SUMIF(Journal!$I:$I,"Julien (avance)",Journal!$G:$G)'
        "+SUMIF('Immobilisations'!$H:$H,\"Julien (avance)\",'Immobilisations'!$C:$C)"))
    c.number_format, c.font = EUR, T_ACCENT
    ws.cell(row=n, column=3, value=(
        'Les lignes du journal ET les immobilisations marquées « Julien (avance) ». '
        'C’est une dette de la société envers toi : un compte courant d’associé, remboursable.')).font = T_NOTE

    n += 2
    ws.cell(row=n, column=1, value=(
        '⚠️ Les frais engagés AVANT l’immatriculation ne sont repris par la société que '
        's’ils figurent sur l’état des actes accomplis pour son compte, annexé aux statuts, '
        'ou repris par une décision. Marque-les « Oui » dans la colonne « Avant immat. » '
        'du journal, et fais valider cette liste avant de les déclarer.')).font = T_ALERTE
    ws.cell(row=n, column=1).alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells(start_row=n, start_column=1, end_row=n + 2, end_column=3)
    return ws


def feuille_resultat(wb):
    ws = wb.create_sheet('Compte de résultat')
    entete(ws, 'Compte de résultat 2026',
           'Tout est calculé depuis le journal et les immobilisations. Rien à saisir ici.')
    largeurs(ws, [46, 20, 60])
    r = 4

    def titre(n, t):
        c = ws.cell(row=n, column=1, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        ws.cell(row=n, column=2).fill = F_ENTETE
        ws.row_dimensions[n].height = 20

    def ligne(n, lib, formule, note=None, gras=False):
        ws.cell(row=n, column=1, value=lib).font = T_TOTAL if gras else T_CORPS
        c = ws.cell(row=n, column=2, value=formule)
        c.number_format, c.font = EUR, (T_TOTAL if gras else T_CORPS)
        c.border = HAUT if gras else BAS
        ws.cell(row=n, column=1).border = HAUT if gras else BAS
        if note:
            ws.cell(row=n, column=3, value=note).font = T_NOTE

    titre(r, 'PRODUITS')
    ligne(r + 1, 'Chiffre d’affaires',
          '=SUMIF(Journal!$M:$M,"Chiffre d’affaires",Journal!$G:$G)',
          'Les ventes de licences. Zéro tant qu’aucun client ne paie.')
    ligne(r + 2, 'Total des produits', f'=B{r + 1}', None, gras=True)

    d = r + 4
    titre(d, 'CHARGES')
    for i, rub in enumerate(RUBRIQUES_CHARGE):
        ligne(d + 1 + i, rub, f'=SUMIF(Journal!$M:$M,"{rub}",Journal!$G:$G)')
    amort = d + 1 + len(RUBRIQUES_CHARGE)
    ligne(amort, 'Dotations aux amortissements',
          "='Immobilisations'!E25",
          'Reprise automatique de la feuille Immobilisations.')
    ligne(amort + 1, 'Total des charges',
          f'=SUM(B{d + 1}:B{amort})', None, gras=True)

    f = amort + 3
    ws.cell(row=f, column=1, value='RÉSULTAT DE L’EXERCICE').font = T_TITRE
    c = ws.cell(row=f, column=2, value=f'=B{r + 2}-B{amort + 1}')
    c.number_format, c.font, c.border = EUR, T_TITRE, HAUT
    ws.cell(row=f, column=3, value=(
        'Négatif la première année, c’est le cas normal d’une société qui investit avant de vendre. '
        'Ce déficit se reporte sur les exercices suivants.')).font = T_NOTE
    return ws, f


def feuille_bilan(wb, ligne_resultat, ligne_amort_total):
    ws = wb.create_sheet('Bilan')
    entete(ws, 'Bilan au 31 décembre 2026',
           'Ce que la société possède, et avec quel argent. Tout est calculé.')
    largeurs(ws, [40, 18, 6, 40, 18])
    r = 4
    for col, t in ((1, 'ACTIF — ce qu’elle possède'), (4, 'PASSIF — d’où vient l’argent')):
        c = ws.cell(row=r, column=col, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        ws.cell(row=r, column=col + 1).fill = F_ENTETE
    ws.row_dimensions[r].height = 20

    def poser(n, col, lib, formule, gras=False):
        ws.cell(row=n, column=col, value=lib).font = T_TOTAL if gras else T_CORPS
        ws.cell(row=n, column=col).border = HAUT if gras else BAS
        c = ws.cell(row=n, column=col + 1, value=formule)
        c.number_format, c.font = EUR, (T_TOTAL if gras else T_CORPS)
        c.border = HAUT if gras else BAS

    poser(r + 1, 1, 'Immobilisations (valeur nette)', "='Immobilisations'!G25")
    poser(r + 2, 1, 'Disponibilités (banque)', "='Apports et trésorerie'!B5")
    poser(r + 4, 1, 'TOTAL ACTIF', f'=B{r + 1}+B{r + 2}', gras=True)

    poser(r + 1, 4, 'Capital social', "='Apports et trésorerie'!B4")
    poser(r + 2, 4, 'Résultat de l’exercice', f"='Compte de résultat'!B{ligne_resultat}")
    poser(r + 3, 4, 'Compte courant d’associé', "='Apports et trésorerie'!B9")
    poser(r + 4, 4, 'TOTAL PASSIF', f'=E{r + 1}+E{r + 2}+E{r + 3}', gras=True)

    n = r + 6
    ws.cell(row=n, column=1, value='Contrôle — l’actif doit égaler le passif').font = T_SECTION
    c = ws.cell(row=n, column=2, value=f'=B{r + 4}-E{r + 4}')
    c.number_format, c.font = EUR, T_ALERTE
    ws.cell(row=n, column=4, value=(
        'Zéro : le bilan tient. Autre chose : il manque une écriture — '
        'une dépense oubliée, un solde bancaire faux, ou une avance non marquée.')).font = T_NOTE

    ws.cell(row=n + 3, column=1, value=(
        '⚠️ Ce bilan ne tient pas compte des factures reçues mais non encore payées au 31/12, '
        'ni des abonnements payés d’avance qui courent sur 2027. Les deux se corrigent à la main '
        'au moment de la clôture — voir le mode d’emploi, « Les quatre écritures de fin d’année ».')).font = T_ALERTE
    ws.cell(row=n + 3, column=1).alignment = Alignment(wrap_text=True, vertical='top')
    ws.merge_cells(start_row=n + 3, start_column=1, end_row=n + 5, end_column=5)
    return ws


def feuille_mode_emploi(wb):
    ws = wb.create_sheet('Mode d’emploi', 0)
    entete(ws, 'Le livre de comptes de Devkaylab',
           f'Exercice du 1er janvier au 31 décembre 2026 · modèle produit le {date.today().strftime("%d/%m/%Y")}')
    largeurs(ws, [110])
    blocs = [
        ('AVANT DE COMMENCER', [
            'Fais une COPIE de ce fichier et renomme-la — « Devkaylab-comptes-2026.xlsx » par exemple. '
            'C’est sur la copie que tu saisis. Le modèle, lui, peut être régénéré à tout moment.',
            'Range la copie ailleurs que dans le dépôt de code : elle porte des montants.',
        ]),
        ('CHAQUE FOIS QUE TU PAIES QUELQUE CHOSE', [
            'Une ligne dans « Journal ». La date, à quoi ça correspond, chez qui, la catégorie, le montant TTC.',
            'Le compte comptable se remplit tout seul à partir de la catégorie.',
            '« Payé par » : « Société » si c’est le compte de la société, « Julien (avance) » si c’est ta carte à toi.',
            'Garde le justificatif (facture PDF). Numérote-le et reporte le numéro dans « N° pièce ». '
            'Sans justificatif, une dépense n’est pas déductible.',
        ]),
        ('LA SEULE RÈGLE QUI PEUT FAUSSER LE BILAN', [
            'Ce qui coûte plus de 500 € HT et sert plusieurs années — un ordinateur, un téléphone — '
            'ne va PAS dans le journal. Il va dans « Immobilisations », et son coût se répartit sur plusieurs années.',
            'Le mettre dans le journal gonflerait les charges de 2026 et viderait l’actif. C’est l’erreur la plus fréquente.',
        ]),
        ('LA TVA', [
            'Devkaylab est en franchise en base : elle ne facture pas de TVA, donc elle ne la récupère pas non plus.',
            'Tout s’inscrit en TTC. La colonne « dont TVA » n’est là que pour information, le jour où la franchise tombera.',
        ]),
        ('LES QUATRE ÉCRITURES DE FIN D’ANNÉE', [
            '1. Les amortissements — déjà calculés dans « Immobilisations », rien à faire.',
            '2. Les factures reçues en 2026 mais payées en 2027 : elles appartiennent à 2026. Ajoute-les au journal '
            'à leur date de facture, avec « Moyen » vide, et note-le.',
            '3. Les abonnements payés en 2026 qui courent sur 2027 (un an d’hébergement pris en novembre, par exemple) : '
            'seule la part de 2026 est une charge de 2026. Le reste est une avance.',
            '4. Le solde bancaire au 31/12 : recopie-le dans « Apports et trésorerie ». C’est lui qui fait tomber le contrôle à zéro.',
        ]),
        ('CE QUE CE FICHIER N’EST PAS', [
            'Ce n’est pas un logiciel comptable, et il ne remplit pas ta liasse fiscale. '
            'Il tient les comptes et calcule le bilan et le résultat — ce qui est l’essentiel pour un exercice sans client.',
            'La déclaration de résultat reste à déposer, et elle se fait sur un formulaire (2033 ou 2050 selon le régime). '
            'Les chiffres de « Bilan » et « Compte de résultat » s’y recopient.',
            'Le jour où il y aura des clients, des salaires ou de la TVA, ce fichier ne suffira plus.',
        ]),
    ]
    n = 4
    for t, points in blocs:
        c = ws.cell(row=n, column=1, value=t)
        c.font, c.fill = T_ENTETE, F_ENTETE
        ws.row_dimensions[n].height = 20
        n += 1
        for p in points:
            c = ws.cell(row=n, column=1, value='·  ' + p)
            c.font = T_CORPS
            c.alignment = Alignment(wrap_text=True, vertical='top')
            ws.row_dimensions[n].height = 15 * (1 + len(p) // 95)
            n += 1
        n += 1
    return ws


def main():
    wb = Workbook()
    wb.remove(wb.active)

    feuille_mode_emploi(wb)
    ws_c, prem, dern = feuille_comptes(wb)
    feuille_journal(wb, prem, dern)
    _, ligne_total_immo = feuille_immobilisations(wb)
    feuille_apports(wb)
    _, ligne_resultat = feuille_resultat(wb)
    feuille_bilan(wb, ligne_resultat, ligne_total_immo)

    # Le mode d'emploi en premier, le plan de comptes en dernier : on ouvre sur
    # ce qu'on doit lire, on range ce qu'on ne touche presque jamais.
    ordre = ['Mode d’emploi', 'Journal', 'Immobilisations', 'Apports et trésorerie',
             'Compte de résultat', 'Bilan', 'Plan de comptes']
    wb._sheets = [wb[n] for n in ordre]

    sortie = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          'Quantinvo-comptabilite-MODELE.xlsx')
    wb.save(sortie)
    print('OK', sortie)


if __name__ == '__main__':
    main()
