/**
 * Configuration and the sheet schema.
 *
 * The schema lives here rather than in the spreadsheet so that a fresh install
 * builds its own tabs and headers. Nobody should have to prepare a spreadsheet
 * by hand before the app will run, and nobody should have to keep one in sync
 * with the code afterwards.
 */

var CFG = {
  APP_NAME: 'Pokok Keluarga',
  SCHEMA_VERSION: 1,

  /* Property keys. Set once at install, read on every request. */
  PROP_SHEET_ID: 'FAMILY_SHEET_ID',
  PROP_FOLDER_ID: 'PHOTO_FOLDER_ID',
  PROP_CLIENT_ID: 'OAUTH_CLIENT_ID',
  PROP_OWNER_EMAIL: 'OWNER_EMAIL',

  CACHE_GRAPH_KEY: 'graph_v1',
  CACHE_SECONDS: 300,

  /* Google caps a single cache entry at 100KB, so a large tree is split across
   * numbered chunks and reassembled on read. */
  CACHE_CHUNK_BYTES: 90000,
  CACHE_MAX_CHUNKS: 40,

  PHOTO_MAX_BYTES: 8 * 1024 * 1024,
  PHOTO_MAX_EDGE: 1200,

  ROLES: ['owner', 'admin', 'member', 'pending', 'blocked'],
  LANGS: ['ms', 'en', 'ar']
};

/**
 * Every tab, in the order they are created, with their columns.
 *
 * Adding a column here and redeploying is enough: the bootstrap appends any
 * header the sheet does not already have, and never reorders or removes the
 * ones that are there, so existing data survives a schema change.
 */
var SCHEMA = {
  People: ['person_id', 'display_name', 'full_name', 'given_name', 'patronym',
    'patronym_type', 'also_known_as', 'honorific', 'gender', 'birth_date',
    'birth_precision', 'birth_place', 'birth_order', 'birth_order_source',
    'is_living', 'death_date', 'death_precision', 'death_place', 'burial_place',
    'email', 'mobile', 'address', 'country', 'occupation', 'notes',
    'photo_file_id', 'photo_thumb_id', 'map_x', 'map_y',
    'status', 'merged_into_id',
    'created_by', 'created_at', 'updated_by', 'updated_at'],

  Parentage: ['link_id', 'child_id', 'parent_id', 'parent_role', 'relation_type',
    'status', 'created_by', 'created_at'],

  Unions: ['union_id', 'partner_a_id', 'partner_b_id', 'union_type', 'status',
    'start_date', 'end_date', 'place', 'order_index', 'notes',
    'created_by', 'created_at'],

  Users: ['email', 'person_id', 'role', 'lang_pref', 'can_invite', 'invited_by',
    'invited_at', 'last_login_at', 'status'],

  Invites: ['invite_id', 'email', 'token', 'prebind_person_id', 'invited_by',
    'created_at', 'expires_at', 'used_at', 'status'],

  PendingChanges: ['change_id', 'kind', 'target_id', 'payload_json', 'summary',
    'requested_by', 'requested_at', 'status', 'reviewed_by', 'reviewed_at',
    'review_note'],

  MergeQueue: ['candidate_id', 'person_a_id', 'person_b_id', 'score',
    'signals_json', 'detected_at', 'status', 'resolved_by', 'resolved_at'],

  CustomTitles: ['title_id', 'from_person_id', 'to_person_id', 'custom_label',
    'lang', 'created_by', 'created_at'],

  AuditLog: ['log_id', 'ts', 'actor_email', 'action', 'entity', 'entity_id',
    'detail_json'],

  Settings: ['key', 'value']
};

/** Seeded on first run so the owner can change behaviour without editing code. */
var DEFAULT_SETTINGS = {
  family_name: 'Keluarga',
  birth_order_titles: 'Long,Ngah,Alang,Anjang,Andak,Uda,Uteh',
  merge_auto_threshold: '92',
  merge_queue_threshold: '68',
  match_suggest_threshold: '55',
  default_lang: 'ms',
  allow_member_invites: 'TRUE',
  invite_expiry_days: '30'
};

/** The id prefix each table counts from. */
var ID_PREFIX = {
  People: 'P', Parentage: 'L', Unions: 'U', Invites: 'I',
  PendingChanges: 'C', MergeQueue: 'M', CustomTitles: 'T', AuditLog: 'A'
};
