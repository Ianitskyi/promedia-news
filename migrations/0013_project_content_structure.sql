ALTER TABLE projects ADD COLUMN work_md TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN work_md_en TEXT;
ALTER TABLE projects ADD COLUMN work_md_crh TEXT;
ALTER TABLE projects ADD COLUMN results_md TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN results_md_en TEXT;
ALTER TABLE projects ADD COLUMN results_md_crh TEXT;
ALTER TABLE projects ADD COLUMN period_label TEXT;
ALTER TABLE projects ADD COLUMN period_label_en TEXT;
ALTER TABLE projects ADD COLUMN period_label_crh TEXT;
