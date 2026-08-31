-- Logo on survey title: centered, 240*240 baseline
alter table surveys add column if not exists logo_url text;
alter table surveys add column if not exists logo_fit text not null default 'contain' check (logo_fit in ('contain','height_fixed','width_fixed'));
-- guidance stored as comment
comment on column surveys.logo_url is 'University logo URL or data URL shown centered above survey title';
comment on column surveys.logo_fit is 'contain (240x240 fit) | height_fixed (h=240, w auto, allow wider) | width_fixed (w=240, h auto)';
