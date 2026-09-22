/**
 * A throwaway file to find out what the Apps Script parser objects to.
 *
 * Every check available locally says doGet is valid JavaScript: Node parses it,
 * the braces and parentheses balance, the bytes are plain ASCII. Apps Script
 * rejects it anyway, at the statement straight after a second `catch (err)` in
 * the same function.
 *
 * Each probe below isolates one suspect. Paste this in, save, and the editor
 * reports the first line it dislikes -- which names the culprit.
 *
 * Delete this file afterwards.
 */

/* A: two catch blocks in one function, both naming the error `err`.
 *    Legal, but it is the only thing doGet does that is at all unusual. */
function zzProbeA() {
  var a = '';
  try { a = '1'; } catch (err) { a = err.message; }
  try { a = '2'; } catch (err) { a = err.message; }
  var page = 'ok';
  return page;
}

/* B: the same, with the catches named differently. */
function zzProbeB() {
  var a = '';
  try { a = '1'; } catch (errOne) { a = errOne.message; }
  try { a = '2'; } catch (errTwo) { a = errTwo.message; }
  var page = 'ok';
  return page;
}

/* C: `page` as a variable name, next to the HtmlService calls doGet uses. */
function zzProbeC() {
  var page = HtmlService.createHtmlOutput('ok');
  page.setTitle('t');
  page.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return page;
}

/* D: an object literal straight after `||`, as doGet's first line has. */
function zzProbeD(e) {
  var params = (e && e.parameter) || {};
  return params;
}
