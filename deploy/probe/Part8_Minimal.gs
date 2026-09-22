/**
 * A deliberately minimal stand-in for Part8_Entry, to find out whether the
 * problem is in the code at all.
 *
 * Apps Script has reported a syntax error at the same statement across three
 * files and three line numbers, and has kept reporting it through a rewritten
 * method chain and renamed catch parameters. Everything checkable here says
 * the code is valid. So this removes the code from the question entirely.
 *
 * If the app serves the line below, the project is sound and the fault is
 * somewhere in the real doGet. If it still reports a syntax error, then the
 * fault is not in any code I wrote, and we stop looking there.
 */
function doGet() {
  return HtmlService.createHtmlOutput('<h1>It parses.</h1>');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
