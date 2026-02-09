export type MapFeatureType =
  | 'state'
  | 'province'
  | 'burg'
  | 'marker'
  | 'river'
  | 'route'
  | 'cell'

export type MapStageAction = 'create' | 'link' | 'merge' | 'skip'

export type MapReimportStrategy =
  | 'replace_preserve_links'
  | 'replace_relink_by_name'
  | 'create_new_map'
