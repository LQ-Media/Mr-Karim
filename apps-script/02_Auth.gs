/**
 * Authentication and permissions.
 *
 * The script is deployed to execute as its owner, so the Sheet and the photo
 * folder are never shared with relatives -- they reach the data only through
 * this code. That choice rules out Apps Script's own Session.getActiveUser():
 * when a script runs as its owner, that call returns an empty string for any
 * visitor outside the owner's Workspace domain, which is exactly who the
 * relatives will be.
 *
 * It also rules out the Google Identity Services button, for a less obvious
 * reason. Apps Script serves its pages inside a sandbox iframe on a generated
 * googleusercontent.com origin that changes between deployments, and Google
 * Identity Services will only run on JavaScript origins registered in advance.
 * There is no origin to register.
 *
 * So sign-in is done the long way round, which turns out to be the robust way.
 * The visitor is sent to Google at the top level, Google returns them to this
 * web app's own /exec URL -- a fixed, registerable address -- and the
 * authorization code is exchanged for an identity server-side, where the client
 * secret can safely live. The result is a signed session token that the browser
 * presents on every later call.
 */

var AUTH_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
var AUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
var AUTH_SESSION_HOURS = 12;
var AUTH_STATE_MINUTES = 120;

/* Reading someone's Google Photos needs its own consent, asked for only when
 * they actually reach for it. Signing in to look at the family tree should not
 * demand access to a person's photo library. */
var AUTH_PHOTOS_SCOPE = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

/* ------------------------------------------------------------------ *
 * The sign-in round trip
 * ------------------------------------------------------------------ */

function AUTH_clientId() {
  var id = ST_props().getProperty(CFG.PROP_CLIENT_ID);
  if (!id) throw new Error('Sign-in is not configured yet. See docs/SETUP.md.');
  return id;
}

/**
 * Where Google sends people back to.
 *
 * Stored rather than derived. ScriptApp.getService().getUrl() returns the /dev
 * URL when called from the editor, and on a Workspace account it can return a
 * domain-scoped /a/<domain>/ form -- so the value used here would not match the
 * one registered in the Cloud Console, and the exchange fails with an error
 * that explains nothing. The owner records the exact string they registered.
 */
function AUTH_redirectUri() {
  var stored = ST_props().getProperty(CFG.PROP_WEBAPP_URL);
  if (stored) return stored;
  return ScriptApp.getService().getUrl();
}

/**
 * Where to send someone to sign in.
 *
 * `state` is signed and timestamped so a callback that did not originate here
 * is rejected -- without it, a link could walk a signed-in visitor through a
 * sign-in they did not start.
 */
function AUTH_signInUrl() {
  return AUTH_buildAuthUrl('openid email profile', { purpose: 'signin' });
}

/**
 * Consent to read the photos this person picks.
 *
 * Asked for separately, and only at the moment somebody chooses to add a photo
 * from Google Photos. The state carries which person the photo is for, so the
 * app can carry on where it left off when Google sends them back.
 *
 * No session token goes into this URL. It would travel through Google's
 * redirect and land in browser history; the browser already holds the session
 * and picks it up again when the page reloads.
 */
function AUTH_photosAuthUrl(personId) {
  return AUTH_buildAuthUrl('openid email ' + AUTH_PHOTOS_SCOPE,
    { purpose: 'photos', personId: String(personId || '') });
}

function AUTH_buildAuthUrl(scope, statePayload) {
  var params = {
    client_id: AUTH_clientId(),
    redirect_uri: AUTH_redirectUri(),
    response_type: 'code',
    scope: scope,
    state: AUTH_makeState(statePayload),
    include_granted_scopes: 'true'
  };
  var parts = [];
  for (var key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      parts.push(key + '=' + encodeURIComponent(params[key]));
    }
  }
  return AUTH_AUTH_ENDPOINT + '?' + parts.join('&');
}

function AUTH_makeState(payload) {
  var state = { n: Utilities.getUuid(), exp: AUTH_epoch() + AUTH_STATE_MINUTES * 60 };
  for (var key in (payload || {})) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) state[key] = payload[key];
  }
  return AUTH_sign(state);
}

/**
 * Handles Google's redirect back to the app.
 *
 * The authorization code is exchanged over TLS directly with Google's token
 * endpoint, so the identity in the response is trustworthy without verifying
 * the JWT signature ourselves -- but the audience and expiry are still checked,
 * because a token minted for a different application must never be accepted.
 */
function AUTH_completeSignIn(code, state) {
  var checkedState = AUTH_verify(state);
  if (!checkedState) throw new Error('That sign-in link has expired. Please try again.');
  if (checkedState.purpose === 'photos') throw new Error('That link was for photos, not sign-in.');

  var body = AUTH_exchangeCode(code);
  if (!body.id_token) throw new Error('Google did not return an identity.');

  var claims = AUTH_readIdToken(body.id_token);
  if (claims.aud !== AUTH_clientId()) throw new Error('Sign-in rejected.');
  if (String(claims.email_verified) !== 'true') throw new Error('Your Google email is not verified.');
  if (Number(claims.exp) <= AUTH_epoch()) throw new Error('That sign-in has already expired.');

  return AUTH_sign({
    email: String(claims.email).toLowerCase(),
    name: claims.name || '',
    picture: claims.picture || '',
    exp: AUTH_epoch() + AUTH_SESSION_HOURS * 3600
  });
}

/** Reads the claims out of a JWT that Google just handed us over TLS. */
function AUTH_readIdToken(idToken) {
  var parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('Google returned an identity we could not read.');
  var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  while (payload.length % 4) payload += '=';
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(payload)).getDataAsString());
}

/**
 * Completes the Google Photos consent and keeps the resulting access token.
 *
 * Held in the cache against the person's email for slightly less than its own
 * lifetime, and never written to the spreadsheet: it is a key to somebody's
 * entire photo library and has no business outliving the few minutes it is
 * needed for.
 */
function AUTH_completePhotosGrant(code, state) {
  var checked = AUTH_verify(state);
  if (!checked || checked.purpose !== 'photos') {
    throw new Error('That link has expired. Please try again.');
  }

  var body = AUTH_exchangeCode(code);
  if (!body.access_token) throw new Error('Google did not grant access to your photos.');
  if (!body.id_token) throw new Error('Google did not say who granted it.');

  var claims = AUTH_readIdToken(body.id_token);
  if (claims.aud !== AUTH_clientId()) throw new Error('Sign-in rejected.');

  var email = String(claims.email).toLowerCase();
  var lifetime = Math.max(60, Math.min(Number(body.expires_in || 3600) - 120, 3000));
  CacheService.getUserCache().put('photos_tok_' + email, body.access_token, lifetime);
  CacheService.getScriptCache().put('photos_tok_' + email, body.access_token, lifetime);

  return { email: email, personId: checked.personId || '' };
}

/** The Photos access token for this caller, if the consent is still live. */
function AUTH_photosToken(email) {
  var key = 'photos_tok_' + String(email).toLowerCase();
  return CacheService.getUserCache().get(key) ||
         CacheService.getScriptCache().get(key) || null;
}

function AUTH_exchangeCode(code) {
  var secret = ST_props().getProperty('OAUTH_CLIENT_SECRET');
  if (!secret) throw new Error('Sign-in is not configured yet. See docs/SETUP.md.');

  var response = UrlFetchApp.fetch(AUTH_TOKEN_ENDPOINT, {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      code: code,
      client_id: AUTH_clientId(),
      client_secret: secret,
      redirect_uri: AUTH_redirectUri(),
      grant_type: 'authorization_code'
    }
  });
  if (response.getResponseCode() !== 200) {
    // Google's own words, not ours. The common failure here is a redirect_uri
    // that differs between the sign-in link and this exchange, and a generic
    // "please try again" sends the person round the same loop for ever.
    throw new Error('Google rejected the sign-in: ' + AUTH_tokenError(response) +
      '\n\nRedirect URI used: ' + AUTH_redirectUri());
  }
  return JSON.parse(response.getContentText());
}

/** What Google said went wrong, without echoing anything we sent it. */
function AUTH_tokenError(response) {
  try {
    var body = JSON.parse(response.getContentText());
    var code = body.error || 'unknown_error';
    return body.error_description ? code + ' (' + body.error_description + ')' : code;
  } catch (err) {
    return 'HTTP ' + response.getResponseCode();
  }
}

/* ------------------------------------------------------------------ *
 * Session tokens
 * ------------------------------------------------------------------ */

/**
 * Sessions are signed rather than stored.
 *
 * A server-side session table would mean either a cache that silently evicts
 * people mid-visit or another sheet to write on every request. A token the
 * server signs and re-checks needs neither, and it cannot be forged without the
 * secret, which never leaves Script Properties.
 */
function AUTH_secret() {
  var props = ST_props();
  var secret = props.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function AUTH_sign(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  var mac = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, AUTH_secret()));
  return body + '.' + mac;
}

function AUTH_verify(token) {
  if (!token || typeof token !== 'string' || token.length > 4096) return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], AUTH_secret()));
  if (!AUTH_constantTimeEquals(parts[1], expected)) return null;

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) {
    return null;
  }
  if (!payload.exp || Number(payload.exp) <= AUTH_epoch()) return null;
  return payload;
}

/** Compares without leaking how much of the signature matched. */
function AUTH_constantTimeEquals(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function AUTH_epoch() {
  return Math.floor(Date.now() / 1000);
}

/* ------------------------------------------------------------------ *
 * Who is calling
 * ------------------------------------------------------------------ */

/**
 * Resolves a session token into a user, creating a pending record for a
 * first-time visitor so their access request reaches the admin.
 */
function AUTH_session(sessionToken) {
  var identity = AUTH_verify(sessionToken);
  if (!identity || !identity.email) throw new Error('Sign-in expired. Please sign in again.');

  var users = ST_readAll('Users');
  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email).toLowerCase() === identity.email) { user = users[i]; break; }
  }

  if (!user) user = AUTH_admitOrQueue(identity);

  if (user.status === 'suspended' || user.role === 'blocked') {
    throw new Error('Your access to the family tree has been withdrawn.');
  }

  ST_update('Users', 'email', user.email, { last_login_at: ST_now() });

  return {
    email: user.email,
    personId: user.person_id || null,
    role: user.role,
    lang: user.lang_pref || ST_settings().default_lang || 'ms',
    canInvite: String(user.can_invite).toUpperCase() === 'TRUE',
    name: identity.name,
    picture: identity.picture,
    isAdmin: user.role === 'owner' || user.role === 'admin',
    isPending: user.role === 'pending'
  };
}

/**
 * A visitor nobody has heard of.
 *
 * If they were invited they are admitted immediately and bound to whichever
 * record the invitation named. Otherwise they are recorded as pending, which
 * shows them a holding screen and puts them in the admin's queue -- they see
 * nothing of the family until someone approves them.
 */
function AUTH_admitOrQueue(identity) {
  var invite = AUTH_findInvite(identity.email);
  var settings = ST_settings();

  var row = {
    email: identity.email,
    person_id: invite ? (invite.prebind_person_id || '') : '',
    role: invite ? 'member' : 'pending',
    lang_pref: settings.default_lang || 'ms',
    can_invite: invite && String(settings.allow_member_invites).toUpperCase() === 'TRUE'
      ? 'TRUE' : 'FALSE',
    invited_by: invite ? invite.invited_by : '',
    invited_at: ST_now(),
    last_login_at: ST_now(),
    status: 'active'
  };

  ST_append('Users', row);
  if (invite) {
    ST_update('Invites', 'invite_id', invite.invite_id, { used_at: ST_now(), status: 'used' });
  }
  ST_audit(identity.email, invite ? 'join_via_invite' : 'access_requested',
    'Users', identity.email, null);
  return row;
}

function AUTH_findInvite(email) {
  var invites = ST_readAll('Invites');
  var now = ST_now();
  for (var i = 0; i < invites.length; i++) {
    var invite = invites[i];
    if (invite.status !== 'open') continue;
    if (String(invite.email).toLowerCase() !== email) continue;
    if (invite.expires_at && String(invite.expires_at) < now) continue;
    return invite;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Permissions
 * ------------------------------------------------------------------ */

/**
 * Who a member may edit without an admin's approval.
 *
 * A parent entering their own family should not have to wait for anyone: their
 * household, the generation above and everything below them is theirs to
 * maintain. Reaching sideways -- a cousin's children, an aunt's second marriage
 * -- is where a shared tree gets damaged by well-meaning guesses, so those
 * edits become proposals instead of writes.
 *
 * Siblings are deliberately outside the direct scope. Each adult maintains
 * their own record, and a sibling who needs something changed can propose it.
 */
function AUTH_editableScope(graph, personId) {
  var scope = {};
  if (!personId) return scope;
  scope[personId] = 'self';

  var spouses = KIN_spousesOf(graph, personId);
  for (var i = 0; i < spouses.length; i++) scope[spouses[i].personId] = 'spouse';

  var parents = KIN_parentsOf(graph, personId);
  for (var j = 0; j < parents.length; j++) scope[parents[j]] = 'parent';

  var frontier = KIN_childrenOf(graph, personId);
  var depth = 0;
  while (frontier.length && depth < 6) {
    var next = [];
    for (var k = 0; k < frontier.length; k++) {
      if (scope[frontier[k]]) continue;
      scope[frontier[k]] = 'descendant';
      // A descendant's spouse marries into the household, so they are in scope.
      var theirSpouses = KIN_spousesOf(graph, frontier[k]);
      for (var s = 0; s < theirSpouses.length; s++) {
        if (!scope[theirSpouses[s].personId]) {
          scope[theirSpouses[s].personId] = 'descendant_spouse';
        }
      }
      next = next.concat(KIN_childrenOf(graph, frontier[k]));
    }
    frontier = next;
    depth++;
  }

  return scope;
}

function AUTH_canEditDirectly(session, graph, targetPersonId) {
  if (session.isAdmin) return true;
  if (session.isPending || !session.personId) return false;
  return !!AUTH_editableScope(graph, session.personId)[targetPersonId];
}

function AUTH_requireActive(session) {
  if (session.isPending) throw new Error('Your request to join is still waiting for approval.');
  if (!session.personId) throw new Error('Your account is not linked to anyone in the tree yet.');
}

function AUTH_requireAdmin(session) {
  if (!session.isAdmin) throw new Error('Only a family tree admin can do that.');
}
