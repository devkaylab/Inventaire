-- EAN normalisé (zéros initiaux retirés) pour une reconnaissance au scan
-- insensible au format Excel : un EAN saisi en cellule « Nombre » perd ses zéros
-- initiaux dès Excel (irrécupérable à l'import). On compare donc au scan sur une
-- forme sans zéros initiaux. Colonne générée STORED : auto-maintenue à chaque
-- import/insert, y compris sur les lignes existantes. L'EAN d'origine est conservé.
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS ean_norm text
  GENERATED ALWAYS AS (NULLIF(ltrim(ean, '0'), '')) STORED;

CREATE INDEX IF NOT EXISTS articles_session_ean_norm_idx
  ON public.articles (session_id, ean_norm);
